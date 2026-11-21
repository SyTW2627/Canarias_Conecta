/**
 * Panel del ofertante: validaciones del formulario, listado, candidatos y edición.
 * Nada se guarda: las validaciones ocurren antes de llamar a la API y, por si acaso,
 * fixtures.ts bloquea cualquier escritura en la API.
 */
import { test, expect, ORGANIZACION, fechaFutura, iniciarSesion } from './fixtures';

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page, ORGANIZACION);
  await page.goto('/gestionar-ofertas');
  await expect(page.getByRole('heading', { level: 1, name: 'Gestionar ofertas' })).toBeVisible();
});

test.afterEach(async ({ escriturasBloqueadas }) => {
  // Ninguno de estos tests debería ni intentar escribir en la base de datos
  expect(escriturasBloqueadas).toEqual([]);
});

test.describe('Validaciones del formulario de nueva oferta', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('link', { name: /Publicar voluntariado/ }).click();
    await expect(page).toHaveURL(/\/gestionar-ofertas\/nueva$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Publicar voluntariado' })).toBeVisible();
  });

  test('Sin título ni descripción', async ({ page }) => {
    await page.getByRole('button', { name: 'Publicar oferta' }).click();
    await expect(page.getByRole('alert')).toHaveText('El título y la descripción son obligatorios');
  });

  test('Sin categoría', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Título *' }).fill('Oferta de prueba');
    await page.getByRole('textbox', { name: 'Descripción *' }).fill('Descripción de prueba');
    await page.getByRole('button', { name: 'Publicar oferta' }).click();
    await expect(page.getByRole('alert')).toHaveText('Elige al menos una categoría');
  });

  test('Presencial sin isla ni municipio', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Título *' }).fill('Oferta de prueba');
    await page.getByRole('textbox', { name: 'Descripción *' }).fill('Descripción de prueba');
    await page.getByRole('checkbox', { name: 'Comunidad' }).check();
    await page.getByRole('button', { name: 'Publicar oferta' }).click();
    await expect(page.getByRole('alert')).toHaveText('Indica la isla y el municipio de la oferta');
  });

  test('Turno incompleto, con hora de fin anterior o sin plazas', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Título *' }).fill('Oferta de prueba');
    await page.getByRole('textbox', { name: 'Descripción *' }).fill('Descripción de prueba');
    await page.getByRole('checkbox', { name: 'Comunidad' }).check();
    await page.getByLabel(/Isla \*/i).selectOption('tenerife');
    await page.getByRole('textbox', { name: 'Municipio *' }).fill('La Laguna');

    const publicar = page.getByRole('button', { name: 'Publicar oferta' });
    const alerta = page.getByRole('alert');

    // Turno vacío
    await publicar.click();
    await expect(alerta).toHaveText('Completa todos los datos de cada turno');

    // Hora de fin anterior a la de inicio
    await page.getByRole('textbox', { name: 'Fecha' }).fill(fechaFutura(10));
    await page.getByRole('textbox', { name: 'Inicio' }).fill('12:00');
    await page.getByRole('textbox', { name: 'Fin' }).fill('10:00');
    await page.getByRole('spinbutton', { name: 'Plazas' }).fill('3');
    await publicar.click();
    await expect(alerta).toHaveText('La hora de fin debe ser posterior a la de inicio');

    // Cero plazas
    await page.getByRole('textbox', { name: 'Fin' }).fill('14:00');
    await page.getByRole('spinbutton', { name: 'Plazas' }).fill('0');
    await publicar.click();
    await expect(alerta).toHaveText('Cada turno necesita al menos una plaza');
  });

  test('Se pueden añadir y quitar turnos', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(1);

    await page.getByRole('button', { name: 'Añadir turno' }).click();
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(2);

    await page.getByRole('button', { name: 'Quitar el turno 2' }).click();
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(1);
  });
});

test('Si el servidor rechaza la publicación se muestra su mensaje', async ({ page }) => {
  // Simulamos un error del servidor (la oferta no llega a crearse)
  await page.route('**/api/ofertas', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, json: { message: 'Error simulado del servidor' } })
      : route.fallback(),
  );

  await page.getByRole('link', { name: /Publicar voluntariado/ }).click();
  await page.getByRole('textbox', { name: 'Título *' }).fill('Oferta de prueba');
  await page.getByRole('textbox', { name: 'Descripción *' }).fill('Descripción de prueba');
  await page.getByRole('checkbox', { name: 'Comunidad' }).check();
  await page.getByLabel(/Isla \*/i).selectOption('tenerife');
  await page.getByRole('textbox', { name: 'Municipio *' }).fill('La Laguna');
  await page.getByRole('textbox', { name: 'Fecha' }).fill(fechaFutura(10));
  await page.getByRole('textbox', { name: 'Inicio' }).fill('10:00');
  await page.getByRole('textbox', { name: 'Fin' }).fill('12:00');
  await page.getByRole('spinbutton', { name: 'Plazas' }).fill('3');
  await page.getByRole('button', { name: 'Publicar oferta' }).click();

  await expect(page.getByRole('alert')).toHaveText('Error simulado del servidor');
  // Los datos no se pierden para poder corregirlos
  await expect(page.getByRole('textbox', { name: 'Título *' })).toHaveValue('Oferta de prueba');
  await expect(page).toHaveURL(/\/gestionar-ofertas\/nueva$/);
});

test('Cancelar vuelve al listado sin publicar', async ({ page }) => {
  await page.getByRole('link', { name: /Publicar voluntariado/ }).click();
  await page.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/gestionar-ofertas$/);
  await expect(page.getByRole('heading', { name: 'Mis ofertas' })).toBeVisible();
});

test('El listado "Mis ofertas" muestra las ofertas de la organización', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Mis ofertas' })).toBeVisible();
  await expect(page.getByText('Cargando tus ofertas...')).toHaveCount(0);
  await expect(page.locator('.gestion-lista > li').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver candidatos/ }).first()).toBeVisible();
});

test('La página de candidatos muestra las pestañas y permite volver', async ({ page }) => {
  const titulo = await page.locator('.gestion-lista > li h3').first().innerText();
  await page.getByRole('link', { name: /Ver candidatos/ }).first().click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Candidatos: ${titulo}`);
  await expect(page.getByRole('tablist', { name: 'Filtrar candidatos' })).toBeVisible();

  for (const pestana of ['En espera', 'Aceptados', 'Finalizados', 'Rechazados', 'Todos']) {
    const tab = page.getByRole('tab', { name: pestana });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  await page.getByRole('link', { name: 'Volver a mis ofertas' }).click();
  await expect(page).toHaveURL(/\/gestionar-ofertas$/);
});