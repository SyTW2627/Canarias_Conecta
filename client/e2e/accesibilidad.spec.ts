/**
 * Pruebas de accesibilidad automáticas con axe-core sobre la aplicación real.
 *
 * Cada test abre una pantalla (o un estado de ella: un error, un panel abierto, un modal...)
 * y la analiza con las reglas de WCAG 2.2 niveles A y AA. Si axe encuentra alguna infracción
 * el test falla y el mensaje dice qué regla se incumple y en qué elementos.
 *
 * A diferencia de los tests de Vitest (jsdom), aquí el navegador pinta la página de verdad,
 * así que también se comprueban el contraste de colores y el tamaño de los botones.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion } from './fixtures';
import { candidatoFalso, miOfertaFalsa } from './datos-falsos';

const NORMAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Analiza la página (o solo `zona`) y falla con un resumen legible si hay infracciones */
async function comprobarAccesibilidad(page: Page, zona?: string) {
  // Se espera a que terminen las peticiones para analizar la pantalla ya cargada
  await page.waitForLoadState('networkidle');
  let analisis = new AxeBuilder({ page }).withTags(NORMAS_WCAG);
  if (zona) analisis = analisis.include(zona);
  const { violations } = await analisis.analyze();

  const resumen = violations.map(
    (v) => `[${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`,
  );
  expect(resumen, `Infracciones WCAG en ${page.url()}`).toEqual([]);
}

test.describe('Pantallas públicas', () => {
  test('Portada', async ({ page }) => {
    await page.goto('/');
    await comprobarAccesibilidad(page);
  });

  test('Iniciar sesión', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await comprobarAccesibilidad(page);
  });

  test('Iniciar sesión con un error de credenciales visible', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill(VOLUNTARIO.email);
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await comprobarAccesibilidad(page);
  });

  test('Registro', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
    await comprobarAccesibilidad(page);
  });

  test('Recuperar la contraseña', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await page.getByText('¿Olvidaste tu contraseña?').click();
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await comprobarAccesibilidad(page);
  });
});

test.describe('Pantallas del voluntario', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
  });

  for (const [nombre, ruta] of [
    ['Inicio', '/'],
    ['Catálogo de oportunidades', '/oportunidades'],
    ['Catálogo filtrado por isla', '/oportunidades?isla=tenerife'],
    ['Mis inscripciones', '/mis_inscripciones'],
    ['Mi perfil', '/perfil'],
    ['Ofertas de empleo', '/empleo'],
    ['Retos y ranking', '/retos'],
  ]) {
    test(nombre, async ({ page }) => {
      await page.goto(ruta);
      await comprobarAccesibilidad(page);
    });
  }

  test('Detalle de una oferta de voluntariado', async ({ page }) => {
    await page.goto('/oportunidades');
    await page.getByRole('link', { name: 'Ver detalles' }).first().click();
    await expect(page).toHaveURL(/\/ofertas\//);
    await comprobarAccesibilidad(page);
  });

  test('Detalle de una oferta de empleo', async ({ page }) => {
    await page.goto('/empleo');
    await page.getByRole('link', { name: 'Ver oferta' }).first().click();
    await expect(page).toHaveURL(/\/empleo\/.+/);
    await comprobarAccesibilidad(page);
  });

  test('Modal de editar el perfil', async ({ page }) => {
    await page.goto('/perfil');
    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await expect(page.getByRole('dialog', { name: 'Editar perfil' })).toBeVisible();
    await comprobarAccesibilidad(page, '[role="dialog"]');
  });

  test('Panel de notificaciones abierto', async ({ page }) => {
    await page.goto('/oportunidades');
    await page.getByRole('button', { name: /^Notificaciones/ }).click();
    await expect(page.getByRole('button', { name: /^Notificaciones/ })).toHaveAttribute('aria-expanded', 'true');
    await comprobarAccesibilidad(page);
  });
});

test.describe('Pantallas de la organización', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, ORGANIZACION);
  });

  for (const [nombre, ruta] of [
    ['Inicio', '/'],
    ['Gestionar ofertas', '/gestionar-ofertas'],
    ['Publicar una oferta', '/gestionar-ofertas/nueva'],
    ['Perfil de la organización', '/perfil'],
  ]) {
    test(nombre, async ({ page }) => {
      await page.goto(ruta);
      await comprobarAccesibilidad(page);
    });
  }

  test('Publicar una oferta con errores de validación', async ({ page }) => {
    await page.goto('/gestionar-ofertas/nueva');
    await page.getByRole('button', { name: 'Publicar oferta' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await comprobarAccesibilidad(page);
  });

  test('Candidatos de una oferta (simulados)', async ({ page }) => {
    await page.route('**/api/ofertas/mias/oferta-falsa-1', (route) => route.fulfill({ json: miOfertaFalsa() }));
    await page.route('**/api/inscripciones/oferta/oferta-falsa-1', (route) =>
      route.fulfill({ json: [candidatoFalso(), candidatoFalso({ id: 'cand-2', estado: 'aceptada' })] }),
    );
    await page.goto('/gestionar-ofertas/oferta-falsa-1/candidatos');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Candidatos');
    await comprobarAccesibilidad(page);
  });
});

test.describe('Vista móvil', () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

  test('Portada en un móvil', async ({ page }) => {
    await page.goto('/');
    await comprobarAccesibilidad(page);
  });

  test('Catálogo en un móvil', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/oportunidades');
    await comprobarAccesibilidad(page);
  });
});
