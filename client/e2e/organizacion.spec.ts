import { test, expect } from '@playwright/test';

test('Una organización puede publicar una oferta y gestionar sus candidatos', async ({ page }) => {
  const tituloOferta = `Limpieza de casa de persona mayor #${Date.now()}`;

  // 1. Acceder a la web e iniciar sesión como Organización
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('arcoiris@gmail.com');
  await page.getByRole('textbox', { name: 'Contraseña Mostrar contraseña' }).fill('12345678');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // 2. Ir al panel de gestión y rellenar el formulario de nueva oferta
  await page.getByRole('link', { name: 'Gestionar ofertas' }).click();
  await page.getByRole('textbox', { name: 'Título *' }).fill(tituloOferta);
  await page.getByRole('textbox', { name: 'Descripción *' }).fill('Ayuda en la limpieza de un hogar de una persona mayor');

  await page.getByRole('checkbox', { name: 'Comunidad' }).check();
  await page.getByRole('checkbox', { name: 'Personas mayores' }).check();

  await page.getByLabel(/Isla \*/i).selectOption('gran_canaria');
  await page.getByRole('textbox', { name: 'Municipio *' }).fill('Las Palmas');
  await page.getByRole('textbox', { name: 'Requisitos' }).fill('Ropa cómoda');
  await page.getByRole('spinbutton', { name: 'Edad mínima' }).fill('18');

  await page.getByRole('textbox', { name: 'Fecha' }).fill('2026-12-11');
  await page.getByRole('textbox', { name: 'Inicio' }).fill('09:30');
  await page.getByRole('textbox', { name: 'Fin' }).fill('13:30');
  await page.getByRole('spinbutton', { name: 'Plazas' }).fill('2');

  // 3. Publicar la oferta y comprobar que aparece en pantalla
  await page.getByRole('button', { name: 'Publicar oferta' }).click();
  await expect(page.getByText(tituloOferta)).toBeVisible();

  // 4. Entrar a la gestión de candidatos y navegar por las pestañas de estado
  await page.getByRole('link', { name: 'Ver candidatos' }).first().click();
  await page.getByRole('tab', { name: 'En espera' }).click();
  await page.getByRole('tab', { name: 'Aceptados' }).click();
  await page.getByRole('tab', { name: 'Finalizados' }).click();
  await page.getByRole('tab', { name: 'Rechazados' }).click();
  await page.getByRole('tab', { name: 'Todos' }).click();

  await expect(page.getByRole('tab', { name: 'Todos' })).toHaveAttribute('aria-selected', 'true');
});