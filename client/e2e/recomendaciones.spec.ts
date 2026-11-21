/**
 * Sistema de recomendación: sección "Recomendado para ti" del inicio del voluntario.
 * Los primeros tests usan los datos reales del seed (Laura y Carlos tienen intereses
 * distintos); los demás simulan la respuesta de GET /api/ofertas/recomendadas.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion } from './fixtures';
import { ofertaFalsa } from './datos-falsos';

const OTRO_VOLUNTARIO = {
  email: process.env.E2E_VOLUNTARIO2_EMAIL ?? 'carlos@ejemplo.com',
  password: process.env.E2E_VOLUNTARIO2_PASSWORD ?? 'Ejemplo123',
};

/**
 * La sección se busca por su aria-labelledby y no con getByRole('region', { name }):
 * en Firefox, repetir ese getByRole en un expect y después en una lectura
 * (allTextContents, allInnerTexts...) hace que la página se cuelgue ("Page crashed")
 */
function seccion(page: Page) {
  return page.locator('section[aria-labelledby="reco-titulo"]');
}

function tarjetas(page: Page) {
  return seccion(page).locator('li.reco-tarjeta');
}

/** Textos de varios elementos, sin espacios sobrantes */
async function textos(locator: Locator): Promise<string[]> {
  return (await locator.allTextContents()).map((texto) => texto.trim());
}

async function titulosRecomendados(page: Page): Promise<string[]> {
  await expect(tarjetas(page).first()).toBeVisible();
  return textos(tarjetas(page).getByRole('heading', { level: 3 }));
}

/** Sustituye la respuesta del recomendador por la indicada */
async function simularRecomendaciones(page: Page, status: number, body: unknown) {
  await page.route('**/api/ofertas/recomendadas', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test.describe('Recomendaciones con los datos del seed', () => {
  test('Muestra 3 recomendaciones con afinidad, motivos e intereses del perfil', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/');

    await expect(seccion(page).getByRole('heading', { name: 'Recomendado para ti, Laura' })).toBeVisible();
    await expect(seccion(page).getByText('Según tus intereses:')).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(3);

    const intereses = await textos(seccion(page).locator('.reco-interes'));
    expect(intereses.length).toBeGreaterThan(0);

    for (const tarjeta of await tarjetas(page).all()) {
      await expect(tarjeta.getByText(/^\d{1,3}% afín$/)).toBeVisible();
      await expect(tarjeta.getByText('¿Por qué te la recomendamos?')).toBeVisible();
      await expect(tarjeta.getByRole('link', { name: 'Ver detalles' })).toHaveAttribute('href', /^\/ofertas\/.+/);
      // Cada interés que da como motivo es uno de los del perfil
      for (const motivo of await textos(tarjeta.locator('.reco-motivos li'))) {
        const nombres = motivo.match(/Te interesa (.+)$/)?.[1].split(' y ') ?? [];
        for (const nombre of nombres) expect(intereses).toContain(nombre.trim());
      }
    }
  });

  test('Las recomendaciones van ordenadas de más a menos afinidad', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/');
    await expect(tarjetas(page)).toHaveCount(3);

    const afinidades = (await textos(seccion(page).locator('.reco-afinidad'))).map((t) => parseInt(t));
    expect(afinidades).toEqual([...afinidades].sort((a, b) => b - a));
  });

  test('Está debajo de "Tu semana" y encima de "Les faltan manos"', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/');
    await expect(tarjetas(page).first()).toBeVisible();

    const y = async (nombre: string | RegExp) =>
      (await page.getByRole('heading', { name: nombre, level: 2 }).boundingBox())!.y;

    expect(await y(/Recomendado para ti/)).toBeGreaterThan(await y('Tu semana'));
    const faltanManos = page.getByRole('heading', { name: 'Les faltan manos', level: 2 });
    if (await faltanManos.isVisible()) {
      expect(await y(/Recomendado para ti/)).toBeLessThan(await y('Les faltan manos'));
    }
  });

  test('Dos voluntarios con intereses distintos reciben recomendaciones distintas', async ({ browser }) => {
    const contextoLaura = await browser.newContext();
    const contextoCarlos = await browser.newContext();
    const laura = await contextoLaura.newPage();
    const carlos = await contextoCarlos.newPage();

    await iniciarSesion(laura, VOLUNTARIO);
    await iniciarSesion(carlos, OTRO_VOLUNTARIO);
    await laura.goto('/');
    await carlos.goto('/');

    const deLaura = await titulosRecomendados(laura);
    const deCarlos = await titulosRecomendados(carlos);
    expect(deLaura).not.toEqual(deCarlos);

    await contextoLaura.close();
    await contextoCarlos.close();
  });

  test('"Ver detalles" abre la oferta recomendada', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/');

    const primera = tarjetas(page).first();
    const titulo = (await primera.getByRole('heading', { level: 3 }).textContent())?.trim() ?? '';
    await primera.getByRole('link', { name: 'Ver detalles' }).click();

    await expect(page).toHaveURL(/\/ofertas\/[^/]+$/);
    await expect(page.getByRole('heading', { name: titulo }).first()).toBeVisible();
  });
});

test.describe('Recomendaciones con respuestas simuladas', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
  });

  test('Muestra la afinidad y los motivos que envía el servidor', async ({ page }) => {
    await simularRecomendaciones(page, 200, {
      intereses: [{ id: 'c1', nombre: 'Medio ambiente' }],
      recomendaciones: [
        {
          oferta: ofertaFalsa(),
          afinidad: 100,
          motivos: [
            { tipo: 'interes', texto: 'Te interesa Medio ambiente' },
            { tipo: 'isla', texto: 'En tu isla: Tenerife' },
            { tipo: 'historial', texto: 'Parecida a «Reforestación»' },
          ],
        },
      ],
    });
    await page.goto('/');

    const tarjeta = tarjetas(page);
    await expect(tarjeta).toHaveCount(1);
    await expect(tarjeta.getByRole('heading', { name: 'Limpieza de la playa de Las Teresitas' })).toBeVisible();
    await expect(tarjeta.getByText('100% afín')).toBeVisible();
    await expect(tarjeta.getByText('Te interesa Medio ambiente')).toBeVisible();
    await expect(tarjeta.getByText('En tu isla: Tenerife')).toBeVisible();
    await expect(tarjeta.getByText('Parecida a «Reforestación»')).toBeVisible();
  });

  test('Sin intereses en el perfil invita a añadirlos y el enlace lleva al perfil', async ({ page }) => {
    await simularRecomendaciones(page, 200, { intereses: [], recomendaciones: [] });
    await page.goto('/');

    await expect(seccion(page).getByText('Aún no sabemos qué te gusta')).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(0);
    await seccion(page).getByRole('link', { name: 'tu perfil' }).click();
    await expect(page).toHaveURL(/\/perfil$/);
  });

  test('Avisa si ninguna oferta encaja con sus intereses', async ({ page }) => {
    await simularRecomendaciones(page, 200, {
      intereses: [{ id: 'c1', nombre: 'Animales' }],
      recomendaciones: [],
    });
    await page.goto('/');

    await expect(seccion(page).getByText('Ahora mismo no hay voluntariados que encajen contigo')).toBeVisible();
    await expect(seccion(page).getByRole('link', { name: 'todas las oportunidades' })).toHaveAttribute(
      'href',
      '/oportunidades',
    );
  });

  test('Muestra el error si el servidor falla', async ({ page }) => {
    await simularRecomendaciones(page, 500, { message: 'Error al calcular las recomendaciones' });
    await page.goto('/');

    await expect(seccion(page).getByText('Error al calcular las recomendaciones')).toBeVisible();
  });
});

test('La organización no ve la sección de recomendaciones', async ({ page }) => {
  await iniciarSesion(page, ORGANIZACION);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu semana' })).toBeVisible();
  await expect(seccion(page)).toHaveCount(0);
});
