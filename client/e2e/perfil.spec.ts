/**
 * Perfil del voluntario y de la organización.
 * Guardar cambios se SIMULA: el perfil real nunca se modifica.
 */
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion, menu } from './fixtures';

test.describe('Perfil del voluntario', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, VOLUNTARIO);
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible();
  });

  test('Muestra el nombre, las estadísticas y el historial', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2, name: 'Laura Perez' })).toBeVisible();
    const estadisticas = page.getByRole('region', { name: 'Estadísticas de colaboración' });
    await expect(estadisticas.getByText('Colaboraciones')).toBeVisible();
    await expect(estadisticas.getByText('Horas dedicadas')).toBeVisible();
    await expect(estadisticas.getByText('Valoración media')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historial de voluntariados' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mis acreditaciones' })).toBeVisible();
  });

  test('Se llega desde el menú y queda marcado como página actual', async ({ page }) => {
    await page.goto('/');
    await menu(page).getByRole('link', { name: 'Mi perfil' }).click();
    await expect(page).toHaveURL(/\/perfil/);
    await expect(menu(page).getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page');
  });

  test('El editor de perfil se abre con los datos actuales y se cierra sin guardar', async ({ page, escriturasBloqueadas }) => {
    await page.getByRole('button', { name: 'Editar perfil' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Laura Perez');
    await expect(dialogo.getByRole('textbox', { name: 'Email' })).toHaveValue(VOLUNTARIO.email);
    await expect(dialogo.getByText('Intereses')).toBeVisible();

    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toHaveCount(0);

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(escriturasBloqueadas).toEqual([]);
  });

  test('Guardar el perfil (simulado) envía el nuevo nombre y lo muestra', async ({ page }) => {
    let datos: Record<string, unknown> | null = null;
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const cuerpo = route.request().postData() ?? '';
      datos = JSON.parse(cuerpo.match(/name="datos"\r\n\r\n([\s\S]*?)\r\n--/)![1]);
      const usuario = JSON.parse((await page.evaluate(() => localStorage.getItem('usuario')))!);
      return route.fulfill({ json: { user: { ...usuario, nombre: 'Laura Pérez Editada' } } });
    });

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.getByRole('dialog').getByRole('textbox', { name: 'Nombre' }).fill('Laura Pérez Editada');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Laura Pérez Editada' })).toBeVisible();
    expect(datos).toMatchObject({ nombre: 'Laura Pérez Editada', email: VOLUNTARIO.email });
  });

  test('Si guardar el perfil falla se muestra el error y el editor sigue abierto', async ({ page }) => {
    await page.route('**/api/auth/me', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 400, json: { message: 'La contraseña actual no es correcta' } })
        : route.fallback(),
    );

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('La contraseña actual no es correcta');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('El formulario de acreditación se abre y se cierra', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir' }).click();
    await expect(page.getByRole('textbox', { name: 'Nombre de la acreditación' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'ID o número (opcional)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar acreditación' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('textbox', { name: 'Nombre de la acreditación' })).toHaveCount(0);
  });

  test('Añadir una acreditación (simulado) la envía al servidor', async ({ page }) => {
    let datos: { acreditaciones?: { nombre: string }[] } | null = null;
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const cuerpo = route.request().postData() ?? '';
      datos = JSON.parse(cuerpo.match(/name="datos"\r\n\r\n([\s\S]*?)\r\n--/)![1]);
      const usuario = JSON.parse((await page.evaluate(() => localStorage.getItem('usuario')))!);
      return route.fulfill({
        json: {
          user: {
            ...usuario,
            acreditaciones: [
              { id: 'a1', nombre: 'Socorrista', identificador: 'SOC-123', fechaObtencion: '2025-06-01T00:00:00.000Z' },
            ],
          },
        },
      });
    });

    await page.getByRole('button', { name: 'Añadir' }).click();
    await page.getByRole('textbox', { name: 'Nombre de la acreditación' }).fill('Socorrista');
    await page.getByRole('textbox', { name: 'ID o número (opcional)' }).fill('SOC-123');
    await page.getByLabel('Fecha de obtención').fill('2025-06-01');
    await page.getByRole('button', { name: 'Guardar acreditación' }).click();

    await expect.poll(() => datos?.acreditaciones?.at(-1)?.nombre).toBe('Socorrista');
    await expect(page.getByText('ID: SOC-123')).toBeVisible();
  });
});

test.describe('Perfil de la organización', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, ORGANIZACION);
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible();
  });

  test('Muestra el nombre, el resumen, el contacto y sus ofertas', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2, name: 'Asociación Horizonte' })).toBeVisible();
    const resumen = page.getByRole('region', { name: 'Resumen de la organización' });
    await expect(resumen.getByText('Ofertas publicadas')).toBeVisible();
    await expect(resumen.getByText('Ofertas activas')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sobre nuestra organización' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Información de contacto' })).toBeVisible();
    await expect(page.getByText(ORGANIZACION.email)).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Ofertas publicadas' })).toBeVisible();
  });

  test('El enlace "Gestionar ofertas" del perfil lleva al panel', async ({ page }) => {
    await page.locator('main').getByRole('link', { name: 'Gestionar ofertas' }).click();
    await expect(page).toHaveURL(/\/gestionar-ofertas/);
  });

  test('El editor de perfil se abre con todos los campos y se cierra sin guardar', async ({ page, escriturasBloqueadas }) => {
    await page.getByRole('button', { name: 'Editar perfil' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar perfil' });
    await expect(dialogo).toBeVisible();

    for (const campo of ['Nombre', 'Email', 'Municipio', 'Teléfono', 'Persona de contacto', 'CIF', 'Dirección']) {
      await expect(dialogo.getByLabel(campo, { exact: true })).toBeVisible();
    }
    await expect(dialogo.getByLabel('Tipo de entidad')).toBeVisible();
    await expect(dialogo.getByLabel('Isla')).toBeVisible();
    await expect(dialogo.getByLabel('Nombre', { exact: true })).toHaveValue('Asociación Horizonte');

    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toHaveCount(0);
    expect(escriturasBloqueadas).toEqual([]);
  });

  test('Guardar el perfil (simulado) actualiza la descripción', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const usuario = JSON.parse((await page.evaluate(() => localStorage.getItem('usuario')))!);
      return route.fulfill({ json: { user: usuario } });
    });

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar perfil' });
    await dialogo.getByLabel('Tipo de entidad').selectOption('asociacion');
    await dialogo.getByLabel('Isla').selectOption('tenerife');
    await dialogo.getByLabel('Municipio', { exact: true }).fill('La Laguna');
    await dialogo.getByLabel('Descripción').fill('Descripción escrita por el test e2e');
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(dialogo).toHaveCount(0);
    await expect(page.getByText('Descripción escrita por el test e2e')).toBeVisible();
  });
});
