/**
 * Pantalla de inicio una vez iniciada la sesión (voluntario y organización).
 */
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion, menu } from './fixtures';

test.describe('Inicio del voluntario', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/');
  });

  test('Saluda por el nombre y muestra el buscador y el mapa', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola, Laura.');
    await expect(page.getByRole('searchbox', { name: 'Buscar oportunidades' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Mapa de las ocho islas Canarias' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tu semana' })).toBeVisible();
  });

  test('El menú tiene los enlaces del voluntario', async ({ page }) => {
    for (const enlace of ['Inicio', 'Oportunidades', 'Mis inscripciones', 'Mi perfil']) {
      await expect(menu(page).getByRole('link', { name: enlace })).toBeVisible();
    }
    await expect(menu(page).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  });

  test('El mapa tiene un enlace por cada una de las 8 islas', async ({ page }) => {
    await expect(page.locator('a.inicio-isla')).toHaveCount(8);
  });

  test('Pulsar una isla del mapa abre el catálogo filtrado por esa isla', async ({ page }) => {
    await page.getByRole('link', { name: /^Tenerife:/ }).click();
    await expect(page).toHaveURL(/\/oportunidades\?isla=tenerife/);
    await expect(page.getByLabel('Isla')).toHaveValue('tenerife');
  });

  test('Buscar sin texto lleva al catálogo completo', async ({ page }) => {
    await page.getByRole('search').getByRole('button', { name: 'Buscar' }).click();
    await expect(page).toHaveURL(/\/oportunidades$/);
  });

  test('"Ver todas las oportunidades" lleva al catálogo', async ({ page }) => {
    await page.getByRole('link', { name: 'Ver todas las oportunidades' }).click();
    await expect(page).toHaveURL(/\/oportunidades/);
  });

  test('Los días de la semana se muestran', async ({ page }) => {
    await expect(page.getByRole('region', { name: 'Días de la semana' })).toBeVisible();
  });

  test('El botón atrás del navegador vuelve a la pantalla anterior', async ({ page }) => {
    await menu(page).getByRole('link', { name: 'Oportunidades' }).click();
    await expect(page).toHaveURL(/\/oportunidades/);
    await page.goBack();
    await expect(page.getByRole('searchbox', { name: 'Buscar oportunidades' })).toBeVisible();
  });

  test('El pie de página tiene los enlaces de información y redes', async ({ page }) => {
    const pie = page.locator('footer');
    for (const enlace of ['Política de privacidad', 'Términos y condiciones', 'Contacto', 'Instagram', 'Facebook', 'LinkedIn']) {
      await expect(pie.getByRole('link', { name: enlace })).toBeVisible();
    }
    await expect(pie.getByRole('link', { name: 'Instagram' })).toHaveAttribute('target', '_blank');
  });
});

test.describe('Inicio de la organización', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, ORGANIZACION);
    await page.goto('/');
  });

  test('Muestra el resumen de la organización', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Ofertas publicadas')).toBeVisible();
    await expect(page.getByText('Voluntarios esta semana')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tu semana' })).toBeVisible();
  });

  test('El menú tiene los enlaces de la organización', async ({ page }) => {
    for (const enlace of ['Inicio', 'Mi perfil', 'Gestionar ofertas']) {
      await expect(menu(page).getByRole('link', { name: enlace })).toBeVisible();
    }
  });

  test('Desde el menú se llega a "Gestionar ofertas"', async ({ page }) => {
    await menu(page).getByRole('link', { name: 'Gestionar ofertas' }).click();
    await expect(page).toHaveURL(/\/gestionar-ofertas/);
    await expect(page.getByRole('heading', { level: 1, name: 'Gestionar ofertas' })).toBeVisible();
  });

  test('Cerrar sesión vuelve a la portada pública', async ({ page }) => {
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  });
});
