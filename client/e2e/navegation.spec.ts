/**
 * Campana de notificaciones de la cabecera.
 * Las notificaciones se simulan y marcarlas como leídas también.
 */
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion } from './fixtures';
import { notificacionFalsa } from './datos-falsos';
import type { Page } from '@playwright/test';

async function simularNotificaciones(page: Page, notificaciones: { leida: boolean }[]) {
  await page.route('**/api/notificaciones', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: { notificaciones, noLeidas: notificaciones.filter((n) => !n.leida).length },
        })
      : route.fallback(),
  );
}

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page, VOLUNTARIO);
});

test('La campana se ve en la cabecera y abre el panel', async ({ page }) => {
  await page.goto('/oportunidades');
  const campana = page.getByRole('button', { name: /^Notificaciones/ });
  await expect(campana).toHaveAttribute('aria-expanded', 'false');

  await campana.click();
  await expect(campana).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Notificaciones' })).toBeVisible();

  await campana.click();
  await expect(page.getByRole('region', { name: 'Notificaciones' })).toHaveCount(0);
});

test('Sin notificaciones muestra un mensaje', async ({ page }) => {
  await simularNotificaciones(page, []);
  await page.goto('/oportunidades');
  await page.getByRole('button', { name: 'Notificaciones' }).click();
  await expect(page.getByText('No tienes notificaciones.')).toBeVisible();
});

test('El contador indica cuántas hay sin leer', async ({ page }) => {
  await simularNotificaciones(page, [
    notificacionFalsa({ id: 'n1' }),
    notificacionFalsa({ id: 'n2' }),
    notificacionFalsa({ id: 'n3', leida: true }),
  ]);
  await page.goto('/oportunidades');

  const campana = page.getByRole('button', { name: 'Notificaciones, 2 sin leer' });
  await expect(campana).toBeVisible();
  await expect(campana.locator('.notificaciones-contador')).toHaveText('2');
});

test('Con más de 9 sin leer el contador muestra "9+"', async ({ page }) => {
  await simularNotificaciones(page, Array.from({ length: 12 }, (_, i) => notificacionFalsa({ id: `n${i}` })));
  await page.goto('/oportunidades');
  await expect(page.locator('.notificaciones-contador')).toHaveText('9+');
});

test('El panel lista título y mensaje de cada notificación', async ({ page }) => {
  await simularNotificaciones(page, [notificacionFalsa()]);
  await page.goto('/oportunidades');
  await page.getByRole('button', { name: /^Notificaciones/ }).click();

  const panel = page.getByRole('region', { name: 'Notificaciones' });
  await expect(panel.getByText('Te han aceptado')).toBeVisible();
  await expect(panel.getByText('Tu solicitud para la limpieza de la playa ha sido aceptada.')).toBeVisible();
});

test('"Marcar todas como leídas" (simulado) llama a la API', async ({ page }) => {
  let marcadas = false;
  await simularNotificaciones(page, [notificacionFalsa()]);
  await page.route('**/api/notificaciones/leidas', (route) => {
    marcadas = true;
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto('/oportunidades');
  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  await page.getByRole('button', { name: 'Marcar todas como leídas' }).click();

  await expect.poll(() => marcadas).toBe(true);
});

test('Pulsar una notificación (simulado) la marca como leída', async ({ page }) => {
  let marcada = '';
  await simularNotificaciones(page, [notificacionFalsa({ id: 'n-77' })]);
  await page.route('**/api/notificaciones/*/leida', (route) => {
    marcada = new URL(route.request().url()).pathname;
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto('/oportunidades');
  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  await page.getByRole('region', { name: 'Notificaciones' }).getByRole('button', { name: /Te han aceptado/ }).click();

  await expect.poll(() => marcada).toBe('/api/notificaciones/n-77/leida');
});

test('Una notificación con enlace lleva a su página', async ({ page }) => {
  await simularNotificaciones(page, [notificacionFalsa({ enlace: '/mis_inscripciones' })]);
  await page.route('**/api/notificaciones/*/leida', (route) => route.fulfill({ json: { ok: true } }));

  await page.goto('/oportunidades');
  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  await page.getByRole('region', { name: 'Notificaciones' }).getByRole('link', { name: /Te han aceptado/ }).click();

  await expect(page).toHaveURL(/\/mis_inscripciones/);
});

test('La organización también tiene campana en su panel', async ({ browser }) => {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  await iniciarSesion(pagina, ORGANIZACION);
  await pagina.goto('/gestionar-ofertas');
  await expect(pagina.getByRole('button', { name: /^Notificaciones/ })).toBeVisible();
  await contexto.close();
});
