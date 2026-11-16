/**
 * Editar, cerrar y eliminar ofertas (organización).
 * La oferta se simula y todas las acciones también: no se modifica nada real.
 */
import { test, expect, ORGANIZACION, iniciarSesion } from './fixtures';
import { miOfertaFalsa, turnoFalso } from './datos-falsos';
import type { Page } from '@playwright/test';

const ID = 'oferta-falsa-1';

/** El listado de "Mis ofertas" y el detalle devuelven las ofertas indicadas */
async function simularMisOfertas(page: Page, ofertas: () => Record<string, unknown>[]) {
  await page.route('**/api/ofertas/mias', (route) => route.fulfill({ json: ofertas() }));
  await page.route('**/api/ofertas/mias/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const oferta = ofertas().find((o) => o.id === id);
    return oferta ? route.fulfill({ json: oferta }) : route.fulfill({ status: 404, json: { message: 'Oferta no encontrada' } });
  });
}

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page, ORGANIZACION);
});

test.describe('Listado de "Mis ofertas" con datos simulados', () => {
  test('Sin ofertas muestra un mensaje', async ({ page }) => {
    await simularMisOfertas(page, () => []);
    await page.goto('/gestionar-ofertas');
    await expect(page.getByText('Todavía no has publicado ninguna oferta.')).toBeVisible();
  });

  test('Cada oferta muestra su estado, ubicación y plazas', async ({ page }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa()]);
    await page.goto('/gestionar-ofertas');

    const tarjeta = page.locator('.gestion-lista > li');
    await expect(tarjeta.getByRole('heading', { name: 'Limpieza de la playa de Las Teresitas' })).toBeVisible();
    await expect(tarjeta.getByText('Publicada')).toBeVisible();
    await expect(tarjeta.getByText(/Santa Cruz de Tenerife, Tenerife · Medio ambiente/)).toBeVisible();
    await expect(tarjeta.getByText(/2 de 5 plazas ocupadas/)).toBeVisible();
    await expect(tarjeta.getByText(/Próximo turno:/)).toBeVisible();
  });

  for (const [datos, texto] of [
    [{ estado: 'borrador' }, 'Borrador'],
    [{ estado: 'cerrada' }, 'Cerrada'],
    [{ estado: 'cancelada' }, 'Cancelada'],
    [{ terminada: true }, 'Finalizada'],
    [{ turnos: [turnoFalso({ plazasLibres: 0 })] }, 'Completa'],
  ] as const) {
    test(`Una oferta en estado "${texto}" se etiqueta así`, async ({ page }) => {
      await simularMisOfertas(page, () => [miOfertaFalsa(datos)]);
      await page.goto('/gestionar-ofertas');
      await expect(page.locator('.gestion-estado')).toHaveText(texto);
    });
  }

  test('Los candidatos pendientes se indican junto a "Ver candidatos"', async ({ page }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa({ candidatosPendientes: 3 })]);
    await page.goto('/gestionar-ofertas');
    await expect(page.getByRole('link', { name: /Ver candidatos\s*3 pendientes/ })).toBeVisible();
  });

  test('Una oferta finalizada solo se puede eliminar', async ({ page }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa({ terminada: true })]);
    await page.goto('/gestionar-ofertas');

    await expect(page.getByRole('button', { name: 'Eliminar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cerrar oferta' })).toHaveCount(0);
  });

  test('Si se cancela la confirmación, la oferta no se cierra', async ({ page, escriturasBloqueadas }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa()]);
    await page.goto('/gestionar-ofertas');

    page.once('dialog', (dialogo) => dialogo.dismiss());
    await page.getByRole('button', { name: 'Cerrar oferta' }).click();

    await expect(page.locator('.gestion-estado')).toHaveText('Publicada');
    expect(escriturasBloqueadas).toEqual([]);
  });

  test('Cerrar una oferta (simulado) pide confirmación y la marca como cerrada', async ({ page }) => {
    let estado = 'publicada';
    await simularMisOfertas(page, () => [miOfertaFalsa({ estado })]);
    await page.route(`**/api/ofertas/${ID}/cerrar`, (route) => {
      estado = 'cerrada';
      return route.fulfill({ json: { ok: true } });
    });

    await page.goto('/gestionar-ofertas');
    let mensaje = '';
    page.once('dialog', (dialogo) => {
      mensaje = dialogo.message();
      return dialogo.accept();
    });
    await page.getByRole('button', { name: 'Cerrar oferta' }).click();

    await expect(page.locator('.gestion-estado')).toHaveText('Cerrada');
    expect(mensaje).toContain('¿Cerrar "Limpieza de la playa de Las Teresitas"?');
  });

  test('Eliminar una oferta finalizada (simulado) la quita del listado', async ({ page }) => {
    let eliminada = false;
    await simularMisOfertas(page, () => (eliminada ? [] : [miOfertaFalsa({ terminada: true })]));
    await page.route(`**/api/ofertas/${ID}`, (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      eliminada = true;
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/gestionar-ofertas');
    page.once('dialog', (dialogo) => dialogo.accept());
    await page.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByText('Todavía no has publicado ninguna oferta.')).toBeVisible();
  });

  test('Si cerrar falla se muestra el error', async ({ page }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa()]);
    await page.route(`**/api/ofertas/${ID}/cerrar`, (route) =>
      route.fulfill({ status: 400, json: { message: 'No se puede cerrar ahora' } }),
    );

    await page.goto('/gestionar-ofertas');
    page.once('dialog', (dialogo) => dialogo.accept());
    await page.getByRole('button', { name: 'Cerrar oferta' }).click();

    await expect(page.getByRole('alert')).toHaveText('No se puede cerrar ahora');
  });

  test('Si falla la carga del listado se muestra el error', async ({ page }) => {
    await page.route('**/api/ofertas/mias', (route) => route.fulfill({ status: 500, json: { message: 'Error del servidor' } }));
    await page.goto('/gestionar-ofertas');
    await expect(page.getByText('Error del servidor')).toBeVisible();
  });
});

test.describe('Pantalla de editar oferta', () => {
  test('Carga todos los datos de la oferta en el formulario', async ({ page }) => {
    // La categoría tiene que existir de verdad para que aparezca marcada
    const categorias: { id: string; nombre: string; slug: string }[] = await (await page.request.get('/api/categorias')).json();
    const medioAmbiente = categorias.find((c) => c.slug === 'medio-ambiente')!;
    await simularMisOfertas(page, () => [miOfertaFalsa({ categorias: [medioAmbiente] })]);
    await page.goto(`/gestionar-ofertas/${ID}/editar`);

    await expect(page.getByRole('heading', { level: 1, name: 'Editar oferta' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Título *' })).toHaveValue('Limpieza de la playa de Las Teresitas');
    await expect(page.getByRole('textbox', { name: 'Descripción *' })).toHaveValue(/Recogemos plásticos/);
    await expect(page.getByRole('checkbox', { name: 'Medio ambiente' })).toBeChecked();
    await expect(page.getByLabel(/Isla \*/)).toHaveValue('tenerife');
    await expect(page.getByRole('textbox', { name: 'Municipio *' })).toHaveValue('Santa Cruz de Tenerife');
    await expect(page.getByRole('textbox', { name: 'Requisitos' })).toHaveValue('Traer agua y protector solar');
    await expect(page.getByRole('spinbutton', { name: 'Edad mínima' })).toHaveValue('16');
    await expect(page.getByRole('textbox', { name: 'Inicio' })).toHaveValue('10:00');
    await expect(page.getByRole('spinbutton', { name: 'Plazas' })).toHaveValue('5');
  });

  test('No deja bajar las plazas por debajo de las ya ocupadas', async ({ page, escriturasBloqueadas }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa()]);
    await page.goto(`/gestionar-ofertas/${ID}/editar`);

    await page.getByRole('spinbutton', { name: 'Plazas' }).fill('1');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByRole('alert')).toHaveText('Un turno ya tiene 2 plazas ocupadas: no puede tener menos plazas');
    expect(escriturasBloqueadas).toEqual([]);
  });

  test('Guardar los cambios (simulado) envía el nuevo título', async ({ page }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa()]);
    let enviado = '';
    await page.route(`**/api/ofertas/${ID}`, (route) => {
      if (!['PUT', 'PATCH'].includes(route.request().method())) return route.fallback();
      enviado = route.request().postData() ?? '';
      return route.fulfill({ json: miOfertaFalsa({ titulo: 'Título editado' }) });
    });

    await page.goto(`/gestionar-ofertas/${ID}/editar`);
    await page.getByRole('textbox', { name: 'Título *' }).fill('Título editado');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect.poll(() => enviado).toContain('Título editado');
  });

  test('Si guardar falla se muestra el error del servidor', async ({ page }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa()]);
    await page.route(`**/api/ofertas/${ID}`, (route) =>
      ['PUT', 'PATCH'].includes(route.request().method())
        ? route.fulfill({ status: 400, json: { message: 'Datos no válidos' } })
        : route.fallback(),
    );

    await page.goto(`/gestionar-ofertas/${ID}/editar`);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('alert')).toHaveText('Datos no válidos');
  });

  test('Una oferta que no existe muestra un error', async ({ page }) => {
    await simularMisOfertas(page, () => []);
    await page.goto('/gestionar-ofertas/no-existe/editar');
    await expect(page.getByRole('alert')).toHaveText('Oferta no encontrada');
  });

  test('"Volver a mis ofertas" vuelve al panel', async ({ page }) => {
    await simularMisOfertas(page, () => [miOfertaFalsa()]);
    await page.goto(`/gestionar-ofertas/${ID}/editar`);
    await page.getByRole('link', { name: 'Volver a mis ofertas' }).click();
    await expect(page).toHaveURL(/\/gestionar-ofertas$/);
  });
});
