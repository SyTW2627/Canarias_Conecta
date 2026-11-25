/**
 * Catálogo de oportunidades visto por un voluntario: buscador, filtros y detalle.
 * Solo se leen datos: no se inscribe a nadie ni se crean ofertas.
 */
import { test, expect, VOLUNTARIO, iniciarSesion } from './fixtures';

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page, VOLUNTARIO);
});

test('El catálogo lista oportunidades y muestra el total', async ({ page }) => {
  // El catálogo va por páginas de 12: el total es el de la API, no el de tarjetas en pantalla
  const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/ofertas');
  await page.goto('/oportunidades');
  const { total }: { total: number } = await (await respuesta).json();

  await expect(page.getByRole('heading', { name: 'Todas las oportunidades' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver detalles' }).first()).toBeVisible();

  await expect(page.getByRole('link', { name: 'Ver detalles' })).toHaveCount(Math.min(total, 12));
  await expect(page.getByText(total === 1 ? '1 oportunidad' : `${total} oportunidades`, { exact: false })).toBeVisible();
});

test('Filtrar por isla solo muestra ofertas de esa isla y se pueden limpiar los filtros', async ({ page }) => {
  await page.goto('/oportunidades');
  await expect(page.getByRole('link', { name: 'Ver detalles' }).first()).toBeVisible();
  const totalSinFiltros = await page.getByRole('link', { name: 'Ver detalles' }).count();

  // La petición a la API lleva el filtro elegido
  const peticion = page.waitForRequest((r) => r.url().includes('/api/ofertas?') && r.url().includes('isla=tenerife'));
  await page.getByLabel('Isla').selectOption('tenerife');
  const respuesta = await (await peticion).response();
  const { ofertas }: { ofertas: { ubicacion?: { isla: string } }[] } = await respuesta!.json();
  expect(ofertas.every((o) => o.ubicacion?.isla === 'tenerife')).toBe(true);

  await expect(page.getByRole('link', { name: 'Ver detalles' })).toHaveCount(ofertas.length);

  // "Limpiar filtros" solo aparece si hay alguno puesto
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByLabel('Isla')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Limpiar filtros' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ver detalles' })).toHaveCount(totalSinFiltros);
});

test('El filtro de categoría se carga desde la API', async ({ page }) => {
  await page.goto('/oportunidades');
  const categoria = page.getByLabel('Categoría');

  // Además de "Todas" debe haber alguna categoría
  await expect.poll(() => categoria.locator('option').count()).toBeGreaterThan(1);
  await categoria.selectOption('educacion');
  await expect(categoria).toHaveValue('educacion');
});

test('Una búsqueda sin resultados muestra un mensaje', async ({ page }) => {
  await page.goto('/oportunidades');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('zzzz-esto-no-existe-zzzz');

  await expect(page.getByText('No hemos encontrado oportunidades con esos filtros.')).toBeVisible();
  await expect(page.getByText('0 oportunidades')).toBeVisible();
});

test('La isla de la URL (?isla=) se aplica al abrir el catálogo', async ({ page }) => {
  await page.goto('/oportunidades?isla=gran_canaria');
  await expect(page.getByLabel('Isla')).toHaveValue('gran_canaria');
});

test('El buscador del inicio lleva al catálogo con el texto buscado', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Buscar oportunidades' }).fill('alimentos');
  await page.getByRole('search').getByRole('button', { name: 'Buscar' }).click();

  await expect(page).toHaveURL(/\/oportunidades\?q=alimentos/);
  await expect(page.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('alimentos');
});

test('Desde una tarjeta se abre el detalle de la oferta y se puede volver', async ({ page }) => {
  await page.goto('/oportunidades');

  const primeraTarjeta = page.getByRole('link', { name: 'Ver detalles' }).first();
  await expect(primeraTarjeta).toBeVisible();
  const titulo = await page.locator('.catalogo-grid h3').first().innerText();

  await primeraTarjeta.click();
  await expect(page).toHaveURL(/\/ofertas\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();

  await page.getByRole('link', { name: 'Volver a oportunidades' }).click();
  await expect(page).toHaveURL(/\/oportunidades/);
});

test('Mis inscripciones se puede abrir desde el menú', async ({ page }) => {
  await page.goto('/oportunidades');
  await page.getByRole('link', { name: 'Mis inscripciones' }).click();

  await expect(page).toHaveURL(/\/mis_inscripciones/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mis inscripciones' })).toBeVisible();
});
