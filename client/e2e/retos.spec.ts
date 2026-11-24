/**
 * Gamificación: pantalla de retos y ranking mensual del voluntario.
 * Los usuarios del seed no tienen colaboraciones completadas, así que los primeros tests
 * comprueban el estado inicial real y los demás simulan las respuestas de la API.
 */
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion, menu } from './fixtures';

test.describe('Retos del voluntario', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
  });

  test('Llega desde el menú y ve todos los retos con su progreso', async ({ page }) => {
    await page.goto('/');
    await menu(page).getByRole('link', { name: 'Retos' }).click();

    await expect(page).toHaveURL(/\/retos$/);
    await expect(page.getByRole('heading', { name: 'Retos', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Primer paso' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cien horas' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Tu actividad' })).toContainText('retos conseguidos');
  });

  test('Un reto conseguido se distingue de uno pendiente (respuesta simulada)', async ({ page }) => {
    await page.route('**/api/gamificacion/logros', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metricas: { horas: 12, colaboraciones: 3, islas: 2, categorias: 2, valoracionMedia: 4.8, numValoraciones: 5 },
          conseguidos: 1,
          logros: [
            { id: 'horas-10', nombre: 'Diez horas', descripcion: 'Suma 10 horas', icono: '⏱️', objetivo: 10,
              progreso: 10, conseguido: true, fecha: '2026-11-10T10:00:00.000Z', detalle: null },
            { id: 'horas-50', nombre: 'Medio centenar', descripcion: 'Suma 50 horas', icono: '⭐', objetivo: 50,
              progreso: 12, conseguido: false, fecha: null, detalle: null },
          ],
        }),
      }),
    );

    await page.goto('/retos');

    const conseguido = page.locator('li.reto').filter({ hasText: 'Diez horas' });
    await expect(conseguido).toHaveClass(/reto-conseguido/);
    await expect(conseguido.getByText(/^Conseguido el/)).toBeVisible();
    const pendiente = page.locator('li.reto').filter({ hasText: 'Medio centenar' });
    await expect(pendiente.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12');
    await expect(pendiente.getByText('12 / 50')).toBeVisible();
  });

  test('El ranking cambia de mes y de isla', async ({ page }) => {
    await page.goto('/retos');
    const ranking = page.getByRole('region', { name: 'Ranking del mes' });
    await expect(ranking.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();

    const peticion = page.waitForRequest((r) => r.url().includes('/api/gamificacion/ranking') && r.url().includes('isla=tenerife'));
    await ranking.getByLabel('Isla').selectOption('tenerife');
    await peticion;

    await ranking.getByRole('button', { name: 'Mes anterior' }).click();
    await expect(ranking.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled();
  });

  test('Muestra el ranking con la posición del voluntario (respuesta simulada)', async ({ page }) => {
    await page.route('**/api/gamificacion/ranking**', (route) => {
      const mes = new URL(route.request().url()).searchParams.get('mes');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mes,
          isla: null,
          participantes: 2,
          ranking: [
            { posicion: 1, nombre: 'Carlos D.', avatarUrl: null, horas: 7, colaboraciones: 2, eresTu: false },
            { posicion: 2, nombre: 'Laura P.', avatarUrl: null, horas: 3, colaboraciones: 1, eresTu: true },
          ],
          tuPosicion: { posicion: 2, horas: 3, colaboraciones: 1 },
        }),
      });
    });

    await page.goto('/retos');

    const filas = page.getByRole('region', { name: 'Ranking del mes' }).locator('ol.ranking-lista li');
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText('Carlos D.');
    await expect(filas.nth(1)).toContainText('Laura P. (tú)');
  });
});

test('Una entidad no ve Retos en el menú', async ({ page }) => {
  await iniciarSesion(page, ORGANIZACION);
  await page.goto('/');

  await expect(menu(page).getByRole('link', { name: 'Empleo' })).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'Retos' })).toHaveCount(0);
});
