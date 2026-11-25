import { test, expect, VOLUNTARIO, iniciarSesion, menu } from './fixtures';
import { inscripcionFalsa, ofertaFalsa } from './datos-falsos';

/*
 * El inicio de sesión es real, pero las categorías, el catálogo, la oferta y la
 * inscripción se SIMULAN. Así el test funciona con cualquier base de datos
 * (tenga las ofertas que tenga) y no ocupa ninguna plaza real.
 */
test('Un voluntario puede filtrar oportunidades, ver detalles e inscribirse', async ({ page }) => {
  const oferta = ofertaFalsa();
  const categorias = [
    { id: 'cat-edu', nombre: 'Educación', slug: 'educacion' },
    { id: 'cat-com', nombre: 'Comunidad', slug: 'comunidad' },
  ];

  // Filtros que la web ha pedido al catálogo
  const consultas: URLSearchParams[] = [];
  let inscripcionEnviada: { ofertaId: string; turnoIds: string[]; listaEspera: boolean } | null = null;

  await page.route('**/api/categorias', (route) => route.fulfill({ json: categorias }));

  // Catálogo: GET /api/ofertas?...
  await page.route(
    (url) => url.pathname === '/api/ofertas',
    (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const filtros = new URL(route.request().url()).searchParams;
      consultas.push(filtros);
      // Con el filtro de Tenerife + Educación no hay resultados; sin filtros sale nuestra oferta
      const conFiltros = filtros.has('isla') || filtros.has('categoria');
      const ofertas = conFiltros ? [] : [oferta];
      // Respuesta paginada (?pagina=N): todo cabe en una página
      return route.fulfill({
        json: { ofertas, total: ofertas.length, pagina: 1, porPagina: 12, totalPaginas: ofertas.length ? 1 : 0 },
      });
    },
  );

  // Detalle: GET /api/ofertas/oferta-falsa-1
  await page.route(`**/api/ofertas/${oferta.id}`, (route) => route.fulfill({ json: oferta }));

  // Inscripción: POST /api/inscripciones
  await page.route('**/api/inscripciones', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    inscripcionEnviada = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 'inscripcion-e2e', estado: 'pendiente' } });
  });

  // Mis inscripciones: vacía hasta que se inscribe, luego con la inscripción simulada
  await page.route('**/api/inscripciones/mias', (route) =>
    route.fulfill({
      json: inscripcionEnviada
        ? [inscripcionFalsa({ id: 'inscripcion-e2e', ofertaId: oferta.id, titulo: oferta.titulo, estado: 'pendiente', puedeCancelar: true })]
        : [],
    }),
  );

  // 1. Iniciar sesión como voluntario
  await iniciarSesion(page, VOLUNTARIO);

  // 2. Ir a Oportunidades: aparece la oferta
  await page.goto('/oportunidades');
  await expect(menu(page).getByRole('link', { name: 'Oportunidades' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: oferta.titulo })).toBeVisible();
  await expect(page.getByText('1 oportunidad')).toBeVisible();

  // 3. Probar los filtros: se envían a la API y, sin resultados, sale el mensaje
  await page.getByLabel('Categoría').selectOption('educacion');
  await page.getByLabel('Isla').selectOption('tenerife');
  await expect(page.getByLabel('Categoría')).toHaveValue('educacion');
  await expect(page.getByLabel('Isla')).toHaveValue('tenerife');
  await expect(page.getByText('No hemos encontrado oportunidades con esos filtros.')).toBeVisible();
  expect(consultas.some((c) => c.get('categoria') === 'educacion' && c.get('isla') === 'tenerife')).toBe(true);

  // 4. Limpiar filtros: vuelve a salir la oferta
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByLabel('Isla')).toHaveValue('');
  await expect(page.getByLabel('Categoría')).toHaveValue('');
  await expect(page.getByRole('heading', { name: oferta.titulo })).toBeVisible();

  // 5. Ver detalles de la oferta
  await page.getByRole('link', { name: 'Ver detalles' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/ofertas/${oferta.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: oferta.titulo })).toBeVisible();

  // 6. El turno con plazas viene marcado: inscribirse
  await expect(page.getByRole('checkbox', { name: 'Seleccionar' })).toBeChecked();
  await page.getByRole('button', { name: 'Inscribirme' }).click();
  await expect(page.getByText('Solicitud enviada correctamente')).toBeVisible();

  // La web envió la oferta y el turno correctos
  expect(inscripcionEnviada).toEqual({ ofertaId: oferta.id, turnoIds: ['turno-1'], listaEspera: false });

  // 7. Comprobación: la inscripción aparece en "Mis inscripciones"
  // (Se entra por URL: el enlace del menú en el detalle está roto, ver enlaces-menu.spec.ts)
  await page.goto('/mis_inscripciones');
  await expect(page.getByRole('heading', { level: 1, name: 'Mis inscripciones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: oferta.titulo })).toBeVisible();
  await expect(page.locator('.inscription-status')).toHaveText('Pendiente');
});

test('El catálogo de oportunidades se recorre por páginas (catálogo simulado de 30)', async ({ page }) => {
  // Páginas de 12, 12 y 6; con un filtro, una sola página de 3
  const paginasPedidas: string[] = [];
  await page.route('**/api/categorias', (route) => route.fulfill({ json: [] }));
  await page.route(
    (url) => url.pathname === '/api/ofertas',
    (route) => {
      const parametros = new URL(route.request().url()).searchParams;
      paginasPedidas.push(parametros.toString());
      const pagina = Number(parametros.get('pagina'));
      const filtrada = parametros.has('isla');
      const total = filtrada ? 3 : 30;
      const enPagina = filtrada ? 3 : pagina === 3 ? 6 : 12;
      const ofertas = Array.from({ length: enPagina }, (_, i) => {
        const n = (pagina - 1) * 12 + i + 1;
        return ofertaFalsa({ id: `oferta-falsa-${n}`, titulo: `Oportunidad simulada ${n}` });
      });
      return route.fulfill({
        json: { ofertas, total, pagina, porPagina: 12, totalPaginas: Math.ceil(total / 12) },
      });
    },
  );

  await iniciarSesion(page, VOLUNTARIO);
  await page.goto('/oportunidades');

  const paginacion = page.getByRole('navigation', { name: 'Páginas de oportunidades' });
  const titulo = (n: number) => page.getByRole('heading', { name: `Oportunidad simulada ${n}`, exact: true });
  await expect(page.getByText('30 oportunidades · Mostrando 1–12')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver detalles' })).toHaveCount(12);
  await expect(paginacion.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');
  await expect(paginacion.getByRole('button', { name: /Anterior/ })).toBeDisabled();

  await paginacion.getByRole('button', { name: /Siguiente/ }).click();
  await expect(titulo(13)).toBeVisible();
  await expect(titulo(1)).toHaveCount(0);
  await expect(page.getByText('30 oportunidades · Mostrando 13–24')).toBeVisible();

  await paginacion.getByRole('button', { name: 'Página 3' }).click();
  await expect(page.getByRole('link', { name: 'Ver detalles' })).toHaveCount(6);
  await expect(paginacion.getByRole('button', { name: /Siguiente/ })).toBeDisabled();

  // Un filtro vuelve a la primera página; con una sola página no hay navegación
  await page.getByLabel('Isla').selectOption('tenerife');
  await expect(page.getByText('3 oportunidades', { exact: true })).toBeVisible();
  await expect(paginacion).toHaveCount(0);
  // StrictMode repite la primera petición en desarrollo: se comparan sin duplicados
  expect([...new Set(paginasPedidas)]).toEqual(['pagina=1', 'pagina=2', 'pagina=3', 'isla=tenerife&pagina=1']);
});
