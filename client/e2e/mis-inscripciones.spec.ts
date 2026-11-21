/**
 * Pantalla "Mis inscripciones" del voluntario.
 * La lista se simula para poder probar cada estado; las cancelaciones también se simulan.
 */
import { test, expect, VOLUNTARIO, iniciarSesion } from './fixtures';
import { inscripcionFalsa } from './datos-falsos';
import type { Page } from '@playwright/test';

async function simularInscripciones(page: Page, inscripciones: unknown[]) {
  await page.route('**/api/inscripciones/mias', (route) => route.fulfill({ json: inscripciones }));
}

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page, VOLUNTARIO);
});

test('Carga las inscripciones reales del voluntario', async ({ page }) => {
  await page.goto('/mis_inscripciones');
  await expect(page.getByRole('heading', { level: 1, name: 'Mis inscripciones' })).toBeVisible();
  await expect(page.getByText('Cargando inscripciones...')).toHaveCount(0);
});

test('Sin inscripciones muestra un mensaje y un enlace a oportunidades', async ({ page }) => {
  await simularInscripciones(page, []);
  await page.goto('/mis_inscripciones');

  await expect(page.getByRole('heading', { name: 'Aún no tienes inscripciones' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver oportunidades' }).click();
  await expect(page).toHaveURL(/\/oportunidades/);
});

test('Muestra los datos de cada inscripción', async ({ page }) => {
  await simularInscripciones(page, [inscripcionFalsa()]);
  await page.goto('/mis_inscripciones');

  await expect(page.getByText('Limpieza de la playa de Las Teresitas')).toBeVisible();
  await expect(page.getByText('Mar y Comunidad')).toBeVisible();
  await expect(page.getByText('3 horas previstas')).toBeVisible();
});

for (const [estado, etiqueta] of [
  ['pendiente', 'Pendiente'],
  ['en_espera', 'En lista de espera'],
  ['rechazada', 'Rechazada'],
  ['cancelada', 'Cancelada'],
  ['completada', 'Completada'],
  ['no_presentado', 'No presentado'],
]) {
  test(`Una inscripción "${estado}" muestra la etiqueta "${etiqueta}"`, async ({ page }) => {
    await simularInscripciones(page, [inscripcionFalsa({ estado, puedeCancelar: false })]);
    await page.goto('/mis_inscripciones');
    await expect(page.locator('.inscription-status')).toHaveText(etiqueta);
  });
}

test('En lista de espera muestra el puesto', async ({ page }) => {
  await simularInscripciones(page, [inscripcionFalsa({ estado: 'en_espera', posicionEspera: 2 })]);
  await page.goto('/mis_inscripciones');
  await expect(page.getByText('Puesto 2 en la lista de espera', { exact: false })).toBeVisible();
});

test('Una inscripción rechazada muestra el motivo', async ({ page }) => {
  await simularInscripciones(page, [
    inscripcionFalsa({ estado: 'rechazada', puedeCancelar: false, motivoRechazo: 'Plazas cubiertas' }),
  ]);
  await page.goto('/mis_inscripciones');
  await expect(page.getByText('Motivo del rechazo: Plazas cubiertas')).toBeVisible();
});

test('Una cancelación tardía se marca como "(tardía)"', async ({ page }) => {
  await simularInscripciones(page, [
    inscripcionFalsa({ estado: 'cancelada', puedeCancelar: false, cancelacionTardia: true }),
  ]);
  await page.goto('/mis_inscripciones');
  await expect(page.locator('.inscription-status')).toHaveText('Cancelada (tardía)');
});

test('Una inscripción valorada muestra las palmeras', async ({ page }) => {
  await simularInscripciones(page, [
    inscripcionFalsa({ estado: 'completada', puedeCancelar: false, valoracion: { puntuacion: 4, comentario: '¡Genial!' } }),
  ]);
  await page.goto('/mis_inscripciones');
  await expect(page.getByLabel('4 de 5 palmeras')).toBeVisible();
});

test('Si no se puede cancelar no aparece el botón', async ({ page }) => {
  await simularInscripciones(page, [inscripcionFalsa({ puedeCancelar: false })]);
  await page.goto('/mis_inscripciones');
  await expect(page.getByRole('button', { name: 'Cancelar inscripción' })).toHaveCount(0);
});

test('Cancelar pide confirmación y "Volver" no cancela nada', async ({ page, escriturasBloqueadas }) => {
  await simularInscripciones(page, [inscripcionFalsa()]);
  await page.goto('/mis_inscripciones');

  await page.getByRole('button', { name: 'Cancelar inscripción' }).click();
  const dialogo = page.getByRole('alertdialog', { name: 'Confirmar cancelación' });
  await expect(dialogo).toContainText('¿Seguro que quieres cancelar?');

  await dialogo.getByRole('button', { name: 'Volver' }).click();
  await expect(dialogo).toHaveCount(0);
  expect(escriturasBloqueadas).toEqual([]);
});

test('Confirmar la cancelación (simulada) llama a la API y recarga la lista', async ({ page }) => {
  let cancelada = false;
  await page.route('**/api/inscripciones/mias', (route) =>
    route.fulfill({
      json: [inscripcionFalsa(cancelada ? { estado: 'cancelada', puedeCancelar: false } : {})],
    }),
  );
  await page.route('**/api/inscripciones/inscripcion-1/cancelar', (route) => {
    cancelada = true;
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto('/mis_inscripciones');
  await page.getByRole('button', { name: 'Cancelar inscripción' }).click();
  await page.getByRole('button', { name: 'Sí, cancelar' }).click();

  expect(cancelada).toBe(true);
  await expect(page.locator('.inscription-status')).toHaveText('Cancelada');
});

test('Si la cancelación falla se muestra el error', async ({ page }) => {
  await simularInscripciones(page, [inscripcionFalsa()]);
  await page.route('**/api/inscripciones/inscripcion-1/cancelar', (route) =>
    route.fulfill({ status: 400, json: { message: 'Ya no se puede cancelar' } }),
  );

  await page.goto('/mis_inscripciones');
  await page.getByRole('button', { name: 'Cancelar inscripción' }).click();
  await page.getByRole('button', { name: 'Sí, cancelar' }).click();

  await expect(page.getByRole('alert')).toHaveText('Ya no se puede cancelar');
});

test('Salir de la lista de espera tiene su propio mensaje', async ({ page }) => {
  await simularInscripciones(page, [inscripcionFalsa({ estado: 'en_espera', posicionEspera: 1 })]);
  await page.goto('/mis_inscripciones');

  await page.getByRole('button', { name: 'Cancelar inscripción' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('¿Seguro que quieres salir de la lista de espera?');
});

test('Si el servidor falla al cargar se muestra un error', async ({ page }) => {
  await page.route('**/api/inscripciones/mias', (route) =>
    route.fulfill({ status: 500, json: { message: 'Error al cargar' } }),
  );
  await page.goto('/mis_inscripciones');
  await expect(page.getByRole('alert')).toHaveText('Error al cargar');
});
