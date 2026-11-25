/**
 * Empleo: catálogo y candidaturas del voluntario, y ofertas de empleo de la entidad.
 * Usa las ofertas de empleo del seed. Las acciones que escriben (postularse, publicar...)
 * se simulan con page.route: la protección de fixtures.ts bloquea el resto.
 */
import type { Page } from '@playwright/test';
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion, menu } from './fixtures';

// Oferta de empleo del seed publicada por Asociación Horizonte (ORGANIZACION)
const OFERTA_HORIZONTE = 'Auxiliar de acompañamiento a personas mayores';

function tarjeta(page: Page, titulo: string) {
  return page.locator('article.empleo-tarjeta').filter({ has: page.getByRole('heading', { name: titulo, exact: true }) });
}

// El catálogo va por páginas: se busca la oferta para no depender de en qué página cae
async function buscarOferta(page: Page, titulo: string) {
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(titulo);
  await expect(tarjeta(page, titulo)).toBeVisible();
}

test.describe('Empleo como voluntario', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
  });

  test('Llega desde el menú y ve las ofertas de empleo del seed', async ({ page }) => {
    await page.goto('/');
    await menu(page).getByRole('link', { name: 'Empleo' }).click();

    await expect(page).toHaveURL(/\/empleo$/);
    await expect(page.getByRole('heading', { name: 'Empleo', level: 1 })).toBeVisible();
    await expect(page.locator('article.empleo-tarjeta').first()).toBeVisible();
    await buscarOferta(page, OFERTA_HORIZONTE);
    await expect(tarjeta(page, OFERTA_HORIZONTE).getByText('Temporal')).toBeVisible();
  });

  test('Los filtros reducen el listado', async ({ page }) => {
    await page.goto('/empleo');
    // En Gran Canaria caben todas en una página
    await page.getByLabel('Isla').selectOption('gran_canaria');
    await expect(tarjeta(page, OFERTA_HORIZONTE)).toBeVisible();

    await page.getByLabel('Contrato').selectOption('practicas');

    await expect(tarjeta(page, OFERTA_HORIZONTE)).toHaveCount(0);
    // La de Mar y Comunidad (prácticas, Telde) sigue; todas las que quedan son de prácticas
    const tarjetas = page.locator('article.empleo-tarjeta');
    await expect(tarjeta(page, 'Prácticas en educación ambiental')).toBeVisible();
    for (const otra of await tarjetas.all()) {
      await expect(otra.getByText('Prácticas', { exact: true })).toBeVisible();
    }
  });

  test('Recorre las páginas del catálogo (catálogo simulado de 30 ofertas)', async ({ page }) => {
    // El seed solo tiene unas pocas ofertas: se simula un catálogo de 3 páginas (12, 12 y 6)
    const paginasPedidas: string[] = [];
    await page.route(
      (url) => url.pathname === '/api/empleo',
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const parametros = new URL(route.request().url()).searchParams;
        paginasPedidas.push(parametros.toString());
        const pagina = Number(parametros.get('pagina') ?? 1);
        const ofertas = Array.from({ length: pagina === 3 ? 6 : 12 }, (_, i) => {
          const n = (pagina - 1) * 12 + i + 1;
          return {
            id: `simulada-${n}`, titulo: `Puesto simulado ${n}`, descripcion: 'Simulada',
            organizacion: 'Asociación Horizonte', categorias: [], tipoContrato: 'temporal',
            jornada: 'parcial', modalidad: 'online', salario: null, requisitos: null, vacantes: 1,
            fechaLimite: null, fechaPublicacion: '2026-11-20T10:00:00.000Z', abierta: true,
          };
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ofertas, total: 30, pagina, porPagina: 12, totalPaginas: 3 }),
        });
      },
    );

    await page.goto('/empleo');
    const paginacion = page.getByRole('navigation', { name: 'Páginas de ofertas de empleo' });
    await expect(page.getByText('30 ofertas de empleo · Mostrando 1–12')).toBeVisible();
    await expect(page.locator('article.empleo-tarjeta')).toHaveCount(12);
    await expect(paginacion.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');

    await paginacion.getByRole('button', { name: /Siguiente/ }).click();
    await expect(tarjeta(page, 'Puesto simulado 13')).toBeVisible();
    await expect(tarjeta(page, 'Puesto simulado 1')).toHaveCount(0);

    await paginacion.getByRole('button', { name: 'Página 3' }).click();
    await expect(page.getByText('30 ofertas de empleo · Mostrando 25–30')).toBeVisible();
    await expect(page.locator('article.empleo-tarjeta')).toHaveCount(6);
    await expect(paginacion.getByRole('button', { name: /Siguiente/ })).toBeDisabled();

    // Un filtro nuevo vuelve a la primera página
    await page.getByLabel('Jornada').selectOption('parcial');
    await expect(tarjeta(page, 'Puesto simulado 1')).toBeVisible();
    // StrictMode repite la primera petición en desarrollo: se comparan sin duplicados
    expect([...new Set(paginasPedidas)]).toEqual(['', 'pagina=2', 'pagina=3', 'jornada=parcial']);
  });

  test('Abre una oferta y se postula (respuesta simulada)', async ({ page }) => {
    await page.route('**/api/empleo/*/candidaturas', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      expect(route.request().postDataJSON()).toEqual({ mensaje: 'Tengo experiencia con mayores' });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'falsa', estado: 'pendiente' }),
      });
    });
    // Que el voluntario aún no tenga candidatura en esta oferta, aunque otro test la haya creado
    await page.route('**/api/empleo/candidaturas/mias', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.goto('/empleo');
    await buscarOferta(page, OFERTA_HORIZONTE);
    await tarjeta(page, OFERTA_HORIZONTE).getByRole('link', { name: 'Ver oferta' }).click();

    await expect(page.getByRole('heading', { name: OFERTA_HORIZONTE, level: 1 })).toBeVisible();
    await page.getByLabel('Mensaje para la entidad (opcional)').fill('Tengo experiencia con mayores');
    await page.getByRole('button', { name: 'Postularme' }).click();

    await expect(page.getByText(/Candidatura enviada/)).toBeVisible();
    await expect(page.getByText('En revisión')).toBeVisible();
  });

  test('La pestaña Mis candidaturas muestra el estado de cada una (respuesta simulada)', async ({ page }) => {
    await page.route('**/api/empleo/candidaturas/mias', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'c1',
            estado: 'preseleccionada',
            fechaCandidatura: new Date().toISOString(),
            ofertaId: 'e1',
            titulo: 'Puesto simulado',
            organizacion: 'Entidad simulada',
            tipoContrato: 'temporal',
            jornada: 'parcial',
            modalidad: 'online',
            ubicacion: null,
            ofertaAbierta: true,
          },
        ]),
      }),
    );

    await page.goto('/empleo');
    await page.getByRole('tab', { name: 'Mis candidaturas' }).click();

    const fila = page.locator('li.empleo-fila').filter({ hasText: 'Puesto simulado' });
    await expect(fila.getByText('Preseleccionada')).toBeVisible();
    await expect(fila.getByRole('button', { name: 'Retirar' })).toBeVisible();
  });
});

test.describe('Empleo como entidad', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, ORGANIZACION);
  });

  test('Ve sus ofertas de empleo y accede a las candidaturas', async ({ page }) => {
    await page.goto('/empleo');

    const fila = page.locator('li.empleo-fila').filter({ hasText: OFERTA_HORIZONTE });
    await expect(fila).toBeVisible();
    await fila.getByRole('link', { name: /Ver candidaturas/ }).click();

    await expect(page.getByRole('heading', { name: OFERTA_HORIZONTE, level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Candidaturas/ })).toBeVisible();
  });

  test('Publica una oferta de empleo (respuesta simulada)', async ({ page, escriturasBloqueadas }) => {
    let enviado: unknown;
    await page.route('**/api/empleo', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      enviado = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'falsa', estado: 'publicada' }),
      });
    });

    await page.goto('/empleo');
    await page.getByRole('button', { name: 'Publicar oferta de empleo' }).click();
    await page.getByLabel('Título del puesto *').fill('Coordinador/a de voluntariado');
    await page.getByLabel('Descripción *').fill('Gestión de los equipos de voluntariado');
    await page.getByLabel('Modalidad *').selectOption('online');
    await page.getByRole('button', { name: 'Publicar oferta de empleo' }).click();

    await expect(page.getByText(/Oferta de empleo publicada/)).toBeVisible();
    expect(enviado).toMatchObject({
      titulo: 'Coordinador/a de voluntariado',
      modalidad: 'online',
      vacantes: 1,
    });
    expect(escriturasBloqueadas).toEqual([]);
  });
});
