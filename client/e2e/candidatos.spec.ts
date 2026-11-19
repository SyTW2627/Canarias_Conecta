/**
 * Gestión de candidatos de una oferta (organización).
 * La oferta y los candidatos se simulan, y también aceptar/rechazar/completar:
 * no se modifica ninguna inscripción real.
 */
import { test, expect, ORGANIZACION, iniciarSesion } from './fixtures';
import { candidatoFalso, miOfertaFalsa } from './datos-falsos';
import type { Page } from '@playwright/test';

const OFERTA_ID = 'oferta-falsa-1';
const URL_CANDIDATOS = `/gestionar-ofertas/${OFERTA_ID}/candidatos`;

/** Simula la oferta y su lista de candidatos (la lista puede cambiar entre recargas) */
async function simular(page: Page, candidatos: () => unknown[]) {
  await page.route(`**/api/ofertas/mias/${OFERTA_ID}`, (route) => route.fulfill({ json: miOfertaFalsa() }));
  await page.route(`**/api/inscripciones/oferta/${OFERTA_ID}`, (route) => route.fulfill({ json: candidatos() }));
}

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page, ORGANIZACION);
});

test('Sin candidatos muestra un mensaje', async ({ page }) => {
  await simular(page, () => []);
  await page.goto(URL_CANDIDATOS);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidatos: Limpieza de la playa de Las Teresitas');
  await expect(page.getByText('Todavía no se ha inscrito nadie en esta oferta.')).toBeVisible();
});

test('Las pestañas cuentan y filtran los candidatos por estado', async ({ page }) => {
  await simular(page, () => [
    candidatoFalso({ id: 'c1', estado: 'pendiente' }),
    candidatoFalso({ id: 'c2', estado: 'pendiente', voluntario: { ...candidatoFalso().voluntario, nombre: 'Pedro Pérez' } }),
    candidatoFalso({ id: 'c3', estado: 'aceptada', voluntario: { ...candidatoFalso().voluntario, nombre: 'Lucía Gómez' } }),
    candidatoFalso({ id: 'c4', estado: 'rechazada', voluntario: { ...candidatoFalso().voluntario, nombre: 'Juan Díaz' } }),
  ]);
  await page.goto(URL_CANDIDATOS);

  await expect(page.getByRole('tab', { name: /Pendientes/ })).toContainText('2');
  await expect(page.getByRole('tab', { name: /Aceptados/ })).toContainText('1');
  await expect(page.getByRole('tab', { name: /Rechazados/ })).toContainText('1');

  await page.getByRole('tab', { name: /Aceptados/ }).click();
  await expect(page.locator('.candidatos-lista > li')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Lucía Gómez' })).toBeVisible();

  await page.getByRole('tab', { name: /Todos/ }).click();
  await expect(page.locator('.candidatos-lista > li')).toHaveCount(4);

  await page.getByRole('tab', { name: /En espera/ }).click();
  await expect(page.getByText('No hay candidatos en este estado.')).toBeVisible();
});

test('Muestra los datos del candidato y su perfil al pulsar "Ver perfil"', async ({ page }) => {
  await simular(page, () => [candidatoFalso()]);
  await page.goto(URL_CANDIDATOS);
  await page.getByRole('tab', { name: /Todos/ }).click();

  await expect(page.getByRole('heading', { name: 'Ana Rodríguez' })).toBeVisible();
  await expect(page.getByText('25 años · La Laguna · Tenerife')).toBeVisible();
  await expect(page.getByText('“Me encantaría ayudar”')).toBeVisible();
  await expect(page.getByText('Turnos solicitados')).toBeVisible();

  await page.getByRole('button', { name: 'Ver perfil' }).click();
  await expect(page.getByText('Me gusta el mar y ayudar a los demás.')).toBeVisible();
  await expect(page.getByText('Primeros auxilios')).toBeVisible();
  await expect(page.getByText('Español, Inglés')).toBeVisible();
  await expect(page.getByText('4.5 / 5 (2)')).toBeVisible();
  await expect(page.getByText('Los datos de contacto se muestran al aceptar la solicitud.')).toBeVisible();

  await page.getByRole('button', { name: 'Ocultar perfil' }).click();
  await expect(page.getByText('Me gusta el mar y ayudar a los demás.')).toHaveCount(0);
});

test('Aceptar un candidato (simulado) lo pasa a aceptados', async ({ page }) => {
  let estado = 'pendiente';
  await simular(page, () => [candidatoFalso({ estado })]);
  await page.route('**/api/inscripciones/candidato-1/aceptar', (route) => {
    estado = 'aceptada';
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto(URL_CANDIDATOS);
  await page.getByRole('button', { name: 'Aceptar' }).click();

  await expect(page.getByRole('tab', { name: /Aceptados/ })).toContainText('1');
  await page.getByRole('tab', { name: /Aceptados/ }).click();
  await expect(page.getByText('Podrás confirmar su asistencia cuando terminen sus turnos.')).toBeVisible();
});

test('Rechazar pide un motivo opcional y lo envía (simulado)', async ({ page }) => {
  let estado = 'pendiente';
  let cuerpo: unknown = null;
  await simular(page, () => [candidatoFalso({ estado })]);
  await page.route('**/api/inscripciones/candidato-1/rechazar', (route) => {
    cuerpo = route.request().postDataJSON();
    estado = 'rechazada';
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto(URL_CANDIDATOS);
  await page.getByRole('button', { name: 'Rechazar' }).click();
  await page.getByLabel(/Motivo del rechazo/).fill('Ya tenemos todas las plazas cubiertas');
  await page.getByRole('button', { name: 'Confirmar rechazo' }).click();

  expect(cuerpo).toEqual({ motivo: 'Ya tenemos todas las plazas cubiertas' });
  await expect(page.getByRole('tab', { name: /Rechazados/ })).toContainText('1');
});

test('Si aceptar falla se muestra el error del servidor', async ({ page }) => {
  await simular(page, () => [candidatoFalso()]);
  await page.route('**/api/inscripciones/candidato-1/aceptar', (route) =>
    route.fulfill({ status: 409, json: { message: 'No quedan plazas en ese turno' } }),
  );

  await page.goto(URL_CANDIDATOS);
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByRole('alert')).toHaveText('No quedan plazas en ese turno');
});

test('Un candidato en lista de espera muestra el aviso', async ({ page }) => {
  await simular(page, () => [candidatoFalso({ estado: 'en_espera' })]);
  await page.goto(URL_CANDIDATOS);
  await page.getByRole('tab', { name: /En espera/ }).click();
  await expect(page.getByText(/En lista de espera: pasará a pendiente/)).toBeVisible();
});

test('Tras terminar el turno se puede confirmar la participación con horas (simulado)', async ({ page }) => {
  let cuerpo: unknown = null;
  await simular(page, () => [candidatoFalso({ estado: 'aceptada', terminada: true })]);
  await page.route('**/api/inscripciones/candidato-1/completar', (route) => {
    cuerpo = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto(URL_CANDIDATOS);
  await page.getByRole('tab', { name: /Aceptados/ }).click();
  await page.getByRole('button', { name: 'Participó' }).click();

  const horas = page.getByLabel('Horas realizadas (se suman a su perfil)');
  await expect(horas).toHaveValue('3');
  await horas.fill('2.5');
  await page.getByRole('button', { name: 'Confirmar participación' }).click();

  await expect.poll(() => cuerpo).toEqual({ asistio: true, horas: 2.5 });
});

test('Confirmar participación sin horas muestra un error', async ({ page, escriturasBloqueadas }) => {
  await simular(page, () => [candidatoFalso({ estado: 'aceptada', terminada: true })]);
  await page.goto(URL_CANDIDATOS);
  await page.getByRole('tab', { name: /Aceptados/ }).click();
  await page.getByRole('button', { name: 'Participó' }).click();
  await page.getByLabel('Horas realizadas (se suman a su perfil)').fill('');
  await page.getByRole('button', { name: 'Confirmar participación' }).click();

  await expect(page.getByRole('alert')).toHaveText('Indica las horas realizadas');
  expect(escriturasBloqueadas).toEqual([]);
});

test('"Cancelar" cierra el formulario de horas sin enviar nada', async ({ page, escriturasBloqueadas }) => {
  await simular(page, () => [candidatoFalso({ estado: 'aceptada', terminada: true })]);
  await page.goto(URL_CANDIDATOS);
  await page.getByRole('tab', { name: /Aceptados/ }).click();
  await page.getByRole('button', { name: 'Participó' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Participó' })).toBeVisible();
  expect(escriturasBloqueadas).toEqual([]);
});

test('Una colaboración ya valorada muestra las palmeras', async ({ page }) => {
  await simular(page, () => [
    candidatoFalso({ estado: 'completada', horasRealizadas: 3, valoracion: { puntuacion: 3, comentario: null } }),
  ]);
  await page.goto(URL_CANDIDATOS);
  await page.getByRole('tab', { name: /Finalizados/ }).click();
  await expect(page.getByText('Valoración enviada: 🌴🌴🌴')).toBeVisible();
});

test('Si la oferta no existe se muestra un error', async ({ page }) => {
  await page.route(`**/api/ofertas/mias/${OFERTA_ID}`, (route) =>
    route.fulfill({ status: 404, json: { message: 'Oferta no encontrada' } }),
  );
  await page.route(`**/api/inscripciones/oferta/${OFERTA_ID}`, (route) => route.fulfill({ json: [] }));
  await page.goto(URL_CANDIDATOS);
  await expect(page.getByRole('alert')).toHaveText('Oferta no encontrada');
});
