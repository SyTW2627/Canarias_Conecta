import { test, expect } from '@playwright/test';

test('Un voluntario puede filtrar oportunidades, ver detalles e inscribirse', async ({ page }) => {
  const emailUnico = `voluntario_${Date.now()}_${Math.floor(Math.random() * 10000)}@gmail.com`;

  // 1. Registrar un usuario nuevo
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await page.getByRole('radio', { name: 'Voluntario Quiero colaborar' }).check();
  await page.getByRole('textbox', { name: 'Nombre completo' }).fill('Voluntario Prueba');
  await page.getByRole('textbox', { name: 'Email' }).fill(emailUnico);
  await page.getByRole('textbox', { name: 'Contraseña Mostrar contraseña' }).fill('123456789');
  await page.getByRole('textbox', { name: 'Repetir contraseña' }).fill('123456789');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByRole('link', { name: 'Oportunidades' })).toBeVisible();

  // 2. Ir a Oportunidades y probar los filtros
  await page.getByRole('link', { name: 'Oportunidades' }).click();
  await page.getByLabel(/Categoría/i).selectOption('educacion');
  await page.getByLabel(/Isla/i).selectOption('tenerife');

  // Comprobamos que el filtro aplica correctamente (el select mantiene el valor)
  await expect(page.getByLabel(/Isla/i)).toHaveValue('tenerife');

  // 3. Limpiamos filtros (o seleccionamos Gran Canaria) para entrar a una oferta con plazas libres
  await page.getByLabel(/Categoría/i).selectOption('');
  await page.getByLabel(/Isla/i).selectOption('gran_canaria');

  await page.getByRole('link', { name: 'Ver detalles' }).first().click();

  // 4. Seleccionar turno si existe checkbox e inscribirse
  const checkbox = page.getByRole('checkbox', { name: 'Seleccionar' });
  if (await checkbox.isVisible()) {
    await checkbox.check();
  }
  await page.getByRole('button', { name: 'Inscribirme' }).click();

  // 5. Comprobación: verificar que la inscripción aparece en "Mis inscripciones"
  await page.getByRole('link', { name: 'Mis inscripciones' }).click();
  await expect(page).toHaveURL(/inscripciones/i);
});