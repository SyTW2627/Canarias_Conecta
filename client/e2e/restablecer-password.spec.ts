/**
 * Pantalla del enlace del correo para elegir una contraseña nueva.
 * El cambio de contraseña se SIMULA: ninguna contraseña real cambia.
 */
import { test, expect } from './fixtures';

test('Sin token en el enlace se avisa de que no es válido', async ({ page }) => {
  await page.goto('/restablecer-password');
  await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('El enlace no es válido');
});

test.describe('Con token', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/restablecer-password?token=token-de-prueba');
    await expect(page.getByText('Elige una contraseña nueva para tu cuenta.')).toBeVisible();
  });

  test('Avisa si la contraseña es demasiado corta', async ({ page }) => {
    await page.getByRole('textbox', { name: /Contraseña nueva/ }).fill('123');
    await page.getByRole('textbox', { name: 'Repite la contraseña' }).fill('123');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByRole('alert')).toContainText('La contraseña debe tener al menos');
  });

  test('Avisa si las contraseñas no coinciden', async ({ page }) => {
    await page.getByRole('textbox', { name: /Contraseña nueva/ }).fill('12345678');
    await page.getByRole('textbox', { name: 'Repite la contraseña' }).fill('87654321');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByRole('alert')).toHaveText('Las contraseñas no coinciden');
  });

  test('Cambiar la contraseña (simulado) envía el token y muestra la confirmación', async ({ page }) => {
    let cuerpo: unknown = null;
    await page.route('**/api/auth/restablecer-password', (route) => {
      cuerpo = route.request().postDataJSON();
      return route.fulfill({ json: { message: 'Contraseña cambiada. Ya puedes iniciar sesión.' } });
    });

    await page.getByRole('textbox', { name: /Contraseña nueva/ }).fill('NuevaClave123');
    await page.getByRole('textbox', { name: 'Repite la contraseña' }).fill('NuevaClave123');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByRole('status')).toHaveText('Contraseña cambiada. Ya puedes iniciar sesión.');
    expect(cuerpo).toMatchObject({ token: 'token-de-prueba' });

    // Tras cambiarla se ofrece ir al login, y la URL deja de tener el token
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page).not.toHaveURL(/token=/);
  });

  test('Un token caducado muestra el error del servidor', async ({ page }) => {
    await page.route('**/api/auth/restablecer-password', (route) =>
      route.fulfill({ status: 400, json: { message: 'El enlace ha caducado' } }),
    );

    await page.getByRole('textbox', { name: /Contraseña nueva/ }).fill('NuevaClave123');
    await page.getByRole('textbox', { name: 'Repite la contraseña' }).fill('NuevaClave123');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByRole('alert')).toHaveText('El enlace ha caducado');
  });

  test('"Volver a iniciar sesión" lleva al login', async ({ page }) => {
    await page.getByRole('button', { name: 'Volver a iniciar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});
