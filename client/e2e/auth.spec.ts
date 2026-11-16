import { test, expect } from '@playwright/test';

test('Un usuario registrado puede iniciar sesión correctamente', async ({ page }) => {
  // 1. Acceder a la página principal
  await page.goto('http://localhost:5173/');

  // 2. Navegar al formulario de inicio de sesión
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();

  // 3. Rellenar credenciales y enviar
  await page.getByRole('textbox', { name: 'Email' }).fill('estela@gmail.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('123456789');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // 4. Comprobación (Aserción): verificar que ha iniciado sesión
  await expect(page).not.toHaveURL(/login/i);
});

test('Un nuevo voluntario puede registrarse y acceder a su perfil', async ({ page }) => {
  // Generamos un email único para que el test no falle al ejecutarse varias veces
  const emailUnico = `daniela_${Date.now()}@gmail.com`;

  // 1. Acceder a la web e ir al formulario de registro
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'Registrarse' }).click();

  // 2. Seleccionar el rol de Voluntario y rellenar los datos
  await page.getByRole('radio', { name: 'Voluntario Quiero colaborar' }).check();
  await page.getByRole('textbox', { name: 'Nombre completo' }).fill('Daniela Fernández');
  await page.getByRole('textbox', { name: 'Email' }).fill(emailUnico);
  await page.getByRole('textbox', { name: 'Contraseña Mostrar contraseña' }).fill('123456789');
  await page.getByRole('textbox', { name: 'Repetir contraseña' }).fill('123456789');

  // 3. Enviar el formulario
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  // 4. Comprobación: entrar en Mi perfil y verificar que se ha creado correctamente
  await page.getByRole('link', { name: 'Mi perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Daniela Fernández' })).toBeVisible();
});