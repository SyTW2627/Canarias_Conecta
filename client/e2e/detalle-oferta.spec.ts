/**
 * Pantalla de detalle de una oferta (/ofertas/:id).
 * Las inscripciones se SIMULAN: nunca se envían al servidor.
 */
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion } from './fixtures';
import { ofertaFalsa, turnoFalso } from './datos-falsos';
import type { Page } from '@playwright/test';

/** Hace que GET /api/ofertas/oferta-falsa-1 devuelva la oferta indicada */
async function simularOferta(page: Page, oferta = ofertaFalsa()) {
  await page.route(`**/api/ofertas/${oferta.id}`, (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: oferta }) : route.fallback(),
  );
  return oferta;
}

test.describe('Detalle de una oferta real', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
  });

  test('Muestra título, descripción y turnos de una oferta del catálogo', async ({ page }) => {
    await page.goto('/oportunidades');
    await page.getByRole('link', { name: 'Ver detalles' }).first().click();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sobre esta oferta' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Próximos turnos' })).toBeVisible();
    await expect(page.getByText('Modalidad')).toBeVisible();
    await expect(page.getByText('Duración')).toBeVisible();
  });

  test('Una oferta que no existe muestra un error', async ({ page }) => {
    await page.goto('/ofertas/000000000000000000000000');
    await expect(page.getByText(/no se pudo|no encontrada|no existe/i).first()).toBeVisible();
  });
});

test.describe('Detalle con datos simulados (voluntario)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
  });

  test('Muestra toda la información de la oferta', async ({ page }) => {
    const oferta = await simularOferta(page);
    await page.goto(`/ofertas/${oferta.id}`);

    await expect(page.getByRole('heading', { level: 1, name: oferta.titulo })).toBeVisible();
    await expect(page.getByText(oferta.descripcion)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Requisitos' })).toBeVisible();
    await expect(page.getByText('Traer agua y protector solar')).toBeVisible();
    await expect(page.getByText('16 años')).toBeVisible();
    await expect(page.getByText('Presencial')).toBeVisible();
    await expect(page.getByText('Una jornada')).toBeVisible();
    await expect(page.getByText('10:00 - 13:00')).toBeVisible();
    await expect(page.getByText('3 plazas disponibles')).toBeVisible();
  });

  test('Los turnos con plazas vienen marcados y sin turnos no se puede inscribir', async ({ page }) => {
    const oferta = await simularOferta(page);
    await page.goto(`/ofertas/${oferta.id}`);

    const casilla = page.getByRole('checkbox', { name: 'Seleccionar' });
    const inscribirme = page.getByRole('button', { name: 'Inscribirme' });
    await expect(casilla).toBeChecked();
    await expect(inscribirme).toBeEnabled();

    await casilla.uncheck();
    await expect(inscribirme).toBeDisabled();

    await casilla.check();
    await expect(inscribirme).toBeEnabled();
  });

  test('Inscribirse (simulado) envía la oferta y el turno y muestra confirmación', async ({ page }) => {
    const oferta = await simularOferta(page);
    let cuerpo: unknown = null;
    await page.route('**/api/inscripciones', (route) => {
      cuerpo = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: 'i1', estado: 'pendiente' } });
    });

    await page.goto(`/ofertas/${oferta.id}`);
    await page.getByRole('checkbox', { name: 'Seleccionar' }).check();
    await page.getByRole('button', { name: 'Inscribirme' }).click();

    await expect(page.getByRole('status')).toHaveText('Solicitud enviada correctamente');
    expect(cuerpo).toEqual({ ofertaId: oferta.id, turnoIds: ['turno-1'], listaEspera: false });
  });

  test('Se pueden elegir varios turnos a la vez', async ({ page }) => {
    const oferta = await simularOferta(
      page,
      ofertaFalsa({ turnos: [turnoFalso(), turnoFalso({ id: 'turno-2', horaInicio: '16:00', horaFin: '19:00' })] }),
    );
    let cuerpo: { turnoIds?: string[] } | null = null;
    await page.route('**/api/inscripciones', (route) => {
      cuerpo = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { estado: 'pendiente' } });
    });

    await page.goto(`/ofertas/${oferta.id}`);
    const casillas = page.getByRole('checkbox', { name: 'Seleccionar' });
    await expect(casillas).toHaveCount(2);
    await casillas.nth(0).check();
    await casillas.nth(1).check();
    await page.getByRole('button', { name: 'Inscribirme' }).click();

    await expect(page.getByRole('status')).toHaveText('Solicitud enviada correctamente');
    expect(cuerpo!.turnoIds).toEqual(['turno-1', 'turno-2']);
  });

  test('Si el servidor rechaza la inscripción se muestra su mensaje', async ({ page }) => {
    const oferta = await simularOferta(page);
    await page.route('**/api/inscripciones', (route) =>
      route.fulfill({ status: 409, json: { message: 'Ya estás inscrito en esta oferta' } }),
    );

    await page.goto(`/ofertas/${oferta.id}`);
    await page.getByRole('checkbox', { name: 'Seleccionar' }).check();
    await page.getByRole('button', { name: 'Inscribirme' }).click();

    await expect(page.getByRole('status')).toHaveText('Ya estás inscrito en esta oferta');
  });

  test('Una oferta completa ofrece apuntarse a la lista de espera', async ({ page }) => {
    const oferta = await simularOferta(page, ofertaFalsa({ turnos: [turnoFalso({ plazasLibres: 0 })] }));
    let cuerpo: { listaEspera?: boolean } | null = null;
    await page.route('**/api/inscripciones', (route) => {
      cuerpo = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { estado: 'en_espera' } });
    });

    await page.goto(`/ofertas/${oferta.id}`);
    await expect(page.getByText('Sin plazas')).toBeVisible();
    await expect(page.getByText(/Esta oferta está completa/)).toBeVisible();

    await page.getByRole('checkbox', { name: 'Seleccionar' }).check();
    await page.getByRole('button', { name: 'Apuntarme a la lista de espera' }).click();

    await expect(page.getByText('Te has apuntado a la lista de espera. Te avisaremos si se libera una plaza.')).toBeVisible();
    expect(cuerpo!.listaEspera).toBe(true);
  });

  test('Con 1 plaza libre se indica en singular', async ({ page }) => {
    const oferta = await simularOferta(page, ofertaFalsa({ turnos: [turnoFalso({ plazasLibres: 1 })] }));
    await page.goto(`/ofertas/${oferta.id}`);
    await expect(page.getByText('1 plaza disponible')).toBeVisible();
  });

  test('Una oferta sin turnos próximos no permite inscribirse', async ({ page }) => {
    const oferta = await simularOferta(
      page,
      ofertaFalsa({ turnos: [turnoFalso({ fecha: '2020-01-01T00:00:00.000Z' })] }),
    );
    await page.goto(`/ofertas/${oferta.id}`);

    await expect(page.getByText('Esta oferta no tiene turnos próximos.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inscribirme' })).toHaveCount(0);
  });

  test('Una oferta online no muestra ubicación', async ({ page }) => {
    const oferta = await simularOferta(page, ofertaFalsa({ modalidad: 'online', ubicacion: undefined }));
    await page.goto(`/ofertas/${oferta.id}`);

    await expect(page.getByText('Online')).toBeVisible();
    await expect(page.getByText('Ubicación')).toHaveCount(0);
  });

  test('Si el servidor falla se muestra un error', async ({ page }) => {
    await page.route('**/api/ofertas/oferta-falsa-1', (route) =>
      route.fulfill({ status: 404, json: { message: 'Oferta no encontrada' } }),
    );
    await page.goto('/ofertas/oferta-falsa-1');
    await expect(page.getByText('Oferta no encontrada')).toBeVisible();
  });

  test('"Volver a oportunidades" lleva al catálogo', async ({ page }) => {
    const oferta = await simularOferta(page);
    await page.goto(`/ofertas/${oferta.id}`);
    await page.getByRole('link', { name: 'Volver a oportunidades' }).click();
    await expect(page).toHaveURL(/\/oportunidades/);
  });
});

test('Una organización ve el detalle pero no puede inscribirse', async ({ page }) => {
  await iniciarSesion(page, ORGANIZACION);
  const oferta = await simularOferta(page);
  await page.goto(`/ofertas/${oferta.id}`);

  await expect(page.getByRole('heading', { level: 1, name: oferta.titulo })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inscribirme' })).toHaveCount(0);
});
