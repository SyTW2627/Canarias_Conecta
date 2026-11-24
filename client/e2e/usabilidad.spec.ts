/**
 * Pruebas de usabilidad: que la web se pueda usar con comodidad y de forma predecible.
 *
 * Complementan a accesibilidad.spec.ts (axe) con comprobaciones que una herramienta automática
 * no hace por sí sola: usar la web solo con teclado, ver dónde está el foco, que no haya scroll
 * horizontal en un móvil, que el menú sea el mismo en todas las pantallas o que cada pantalla
 * tenga un título principal claro.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion, menu } from './fixtures';

/** Pulsa Tab hasta que el foco llegue a `destino` (como mucho `maximo` veces) */
async function tabularHasta(page: Page, destino: Locator, maximo = 40) {
  for (let i = 0; i < maximo; i++) {
    await page.keyboard.press('Tab');
    if (await destino.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`No se llega con Tab a ${destino}`);
}

/** true si el elemento con el foco tiene un indicador visible (contorno o sombra) */
function focoVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const estilo = getComputedStyle(el);
    const conContorno = estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) > 0;
    const conSombra = estilo.boxShadow !== 'none';
    return conContorno || conSombra;
  });
}

/** true si la página es más ancha que la ventana (obliga a hacer scroll horizontal) */
function hayScrollHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

test.describe('Uso solo con teclado', () => {
  test('Se inicia sesión desde la portada sin usar el ratón', async ({ page }) => {
    await page.goto('/');

    await tabularHasta(page, page.getByRole('link', { name: 'Iniciar sesión' }));
    await page.keyboard.press('Enter');

    const email = page.getByRole('textbox', { name: 'Email' });
    await tabularHasta(page, email);
    await page.keyboard.type(VOLUNTARIO.email);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Contraseña' })).toBeFocused();
    await page.keyboard.type(VOLUNTARIO.password);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  test('El foco siempre se ve al recorrer la portada con Tab', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const descripcion = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
      expect(await focoVisible(page), `Sin indicador de foco en ${descripcion}`).toBe(true);
    }
  });

  test('El foco se ve en los campos del formulario de login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await page.getByRole('textbox', { name: 'Email' }).focus();
    expect(await focoVisible(page)).toBe(true);
  });

  test('Desde el menú se llega a cualquier sección con Tab y Enter', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/');

    await tabularHasta(page, menu(page).getByRole('link', { name: 'Mis inscripciones' }));
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/mis_inscripciones/);
  });

  test('Las islas del mapa se pueden elegir con el teclado', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/');

    await tabularHasta(page, page.getByRole('link', { name: /^Tenerife:/ }), 60);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/isla=tenerife/);
  });

  test('El panel de notificaciones se cierra con Escape', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/oportunidades');
    const campana = page.getByRole('button', { name: /^Notificaciones/ });

    await campana.focus();
    await page.keyboard.press('Enter');
    await expect(campana).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');

    await expect(campana).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Estructura y orientación', () => {
  test('La página está en español y tiene título', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle(/Canarias Conecta/);
  });

  for (const ruta of ['/', '/oportunidades', '/mis_inscripciones', '/perfil', '/empleo', '/retos']) {
    test(`${ruta} tiene un único título principal (h1)`, async ({ page }) => {
      await iniciarSesion(page, VOLUNTARIO);
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    });
  }

  test('El menú es el mismo en todas las pantallas del voluntario y marca la actual', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    const secciones = [
      ['Inicio', '/'],
      ['Oportunidades', '/oportunidades'],
      ['Mis inscripciones', '/mis_inscripciones'],
      ['Mi perfil', '/perfil'],
    ];

    for (const [nombre, ruta] of secciones) {
      await page.goto(ruta);
      for (const [otro] of secciones) {
        await expect(menu(page).getByRole('link', { name: otro })).toBeVisible();
      }
      await expect(menu(page).getByRole('link', { name: nombre })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('Los enlaces que abren otra pestaña son seguros', async ({ page }) => {
    await page.goto('/');
    const externos = page.locator('a[target="_blank"]');
    const total = await externos.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      await expect(externos.nth(i)).toHaveAttribute('rel', /noopener|noreferrer/);
    }
  });
});

test.describe('Diseño adaptable (móvil)', () => {
  // 320 px es el ancho mínimo de WCAG 1.4.10 (reflow): equivale a ver la web al 400 % de zoom
  for (const ancho of [320, 375, 768]) {
    test.describe(`Ventana de ${ancho} px`, () => {
      test.use({ viewport: { width: ancho, height: 800 } });

      test('La portada no obliga a hacer scroll horizontal', async ({ page }) => {
        await page.goto('/');
        expect(await hayScrollHorizontal(page)).toBe(false);
      });

      for (const ruta of ['/', '/oportunidades', '/mis_inscripciones', '/perfil', '/empleo', '/retos']) {
        test(`${ruta} del voluntario no obliga a hacer scroll horizontal`, async ({ page }) => {
          await iniciarSesion(page, VOLUNTARIO);
          await page.goto(ruta);
          await page.waitForLoadState('networkidle');
          expect(await hayScrollHorizontal(page)).toBe(false);
        });
      }

      test('Gestionar ofertas no obliga a hacer scroll horizontal', async ({ page }) => {
        await iniciarSesion(page, ORGANIZACION);
        await page.goto('/gestionar-ofertas');
        await page.waitForLoadState('networkidle');
        expect(await hayScrollHorizontal(page)).toBe(false);
      });
    });
  }

  test.describe('En un móvil táctil', () => {
    test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

    test('Se puede iniciar sesión tocando la pantalla', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: 'Iniciar sesión' }).tap();
      await page.getByRole('textbox', { name: 'Email' }).fill(VOLUNTARIO.email);
      await page.getByRole('textbox', { name: 'Contraseña' }).fill(VOLUNTARIO.password);
      await page.getByRole('button', { name: 'Iniciar sesión' }).tap();
      await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    });

    test('El menú principal sigue accesible y lleva a cada sección', async ({ page }) => {
      await iniciarSesion(page, VOLUNTARIO);
      await page.goto('/');
      await menu(page).getByRole('link', { name: 'Oportunidades' }).tap();
      await expect(page).toHaveURL(/\/oportunidades/);
      await expect(page.getByRole('link', { name: 'Ver detalles' }).first()).toBeVisible();
    });
  });
});

test.describe('Respuesta y mensajes al usuario', () => {
  test('El catálogo muestra ofertas en menos de 3 segundos', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    const inicio = Date.now();
    await page.goto('/oportunidades');
    await expect(page.getByRole('link', { name: 'Ver detalles' }).first()).toBeVisible({ timeout: 3_000 });
    expect(Date.now() - inicio).toBeLessThan(3_000);
  });

  test('Un error de login se explica en lenguaje claro y no borra el email', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill(VOLUNTARIO.email);
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    const alerta = page.getByRole('alert');
    await expect(alerta).toBeVisible();
    await expect(alerta).not.toHaveText(/error \d{3}|exception|undefined/i);
    // El usuario no tiene que volver a escribir el email para reintentar
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(VOLUNTARIO.email);
  });

  test('Si se cae la conexión, el login lo dice en vez de quedarse colgado', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await page.route('**/api/auth/login', (route) => route.abort('internetdisconnected'));
    await page.getByRole('textbox', { name: 'Email' }).fill(VOLUNTARIO.email);
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(VOLUNTARIO.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servidor');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  test('El botón de publicar avisa de qué falta en vez de fallar en silencio', async ({ page }) => {
    await iniciarSesion(page, ORGANIZACION);
    await page.goto('/gestionar-ofertas/nueva');
    await page.getByRole('button', { name: 'Publicar oferta' }).click();
    await expect(page.getByRole('alert')).not.toBeEmpty();
  });

  test('Los filtros del catálogo se conservan en la URL al recargar', async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/oportunidades?isla=gran_canaria');
    await page.reload();
    await expect(page.getByLabel('Isla')).toHaveValue('gran_canaria');
  });
});
