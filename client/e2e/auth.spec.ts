import { test, expect, VOLUNTARIO, iniciarSesionDesdeFormulario, menu } from './fixtures';

test('Un usuario registrado puede iniciar sesión correctamente', async ({ page }) => {
  // 1-3. Acceder a la portada, abrir el login, rellenar credenciales y enviar
  await iniciarSesionDesdeFormulario(page, VOLUNTARIO);

  // 4. Comprobación: ha iniciado sesión y está en su inicio
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola,');
  await expect(menu(page).getByRole('link', { name: 'Mi perfil' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
});

test('Un nuevo voluntario puede registrarse y acceder a su perfil', async ({ page }) => {
  const emailNuevo = `daniela_${Date.now()}@gmail.com`;

  // El registro se SIMULA: no se crea ningún usuario en la base de datos.
  // Para que el resto de pantallas funcionen, la respuesta usa el token real del voluntario de prueba.
  const login = await page.request.post('/api/auth/login', { data: VOLUNTARIO });
  const { token, user } = await login.json();

  let datosEnviados: Record<string, unknown> | null = null;
  await page.route('**/api/auth/register', (route) => {
    datosEnviados = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: { token, user: { ...user, nombre: 'Daniela Fernández', email: emailNuevo } },
    });
  });

  // 1. Acceder a la web e ir al formulario de registro
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrarse' }).click();

  // 2. Seleccionar el rol de Voluntario y rellenar los datos
  await expect(page.getByRole('radio', { name: /^Voluntario/ })).toBeChecked();
  await page.getByRole('textbox', { name: 'Nombre completo' }).fill('Daniela Fernández');
  await page.getByRole('textbox', { name: 'Email' }).fill(emailNuevo);
  await page.getByRole('textbox', { name: 'Contraseña Mostrar contraseña' }).fill('123456789');
  await page.getByRole('textbox', { name: 'Repetir contraseña' }).fill('123456789');

  // 3. Enviar el formulario (simulado)
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  // La web envió los datos correctos
  expect(datosEnviados).toEqual({
    nombre: 'Daniela Fernández',
    email: emailNuevo,
    password: '123456789',
    rol: 'voluntario',
  });

  // 4. Comprobación: entrar en Mi perfil y verificar que aparece con su nombre
  await menu(page).getByRole('link', { name: 'Mi perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Daniela Fernández' })).toBeVisible();
});

test('Registrarse con un email ya usado muestra el error del servidor', async ({ page }) => {
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({ status: 409, json: { message: 'Ya existe una cuenta con ese email' } }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await page.getByRole('textbox', { name: 'Nombre completo' }).fill('Laura');
  await page.getByRole('textbox', { name: 'Email' }).fill(VOLUNTARIO.email);
  await page.getByRole('textbox', { name: 'Contraseña Mostrar contraseña' }).fill('123456789');
  await page.getByRole('textbox', { name: 'Repetir contraseña' }).fill('123456789');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByRole('alert')).toHaveText('Ya existe una cuenta con ese email');
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
});
