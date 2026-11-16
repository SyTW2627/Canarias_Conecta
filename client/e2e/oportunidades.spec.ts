import { test, expect } from '@playwright/test';

test('Un voluntario puede filtrar oportunidades, ver detalles e inscribirse', async ({ page }) => {
  const emailUnico = `voluntario_${Date.now()}@gmail.com`;

  // 1. Registrar un usuario nuevo para asegurar que no está inscrito previamente
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await page.getByRole('radio', { name: 'Voluntario Quiero colaborar' }).check();
  await page.getByRole('textbox', { name: 'Nombre completo' }).fill('Voluntario Prueba');
  await page.getByRole('textbox', { name: 'Email' }).fill(emailUnico);
  await page.getByRole('textbox', { name: 'Contraseña Mostrar contraseña' }).fill('123456789');
  await page.getByRole('textbox', { name: 'Repetir contraseña' }).fill('123456789');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  // 2. Ir a Oportunidades y aplicar filtros (Educación + Tenerife)
  await page.getByRole('link', { name: 'Oportunidades' }).click();
  await page.getByLabel(/Categoría/i).selectOption('educacion');
  await page.getByLabel(/Isla/i).selectOption('tenerife');

  // 3. Entrar al detalle de la oferta filtrada
  await page.getByRole('link', { name: 'Ver detalles' }).first().click();

  // 4. Seleccionar el turno/opción si no está marcado e inscribirse
  const checkbox = page.getByRole('checkbox', { name: 'Seleccionar' });
  if (!(await checkbox.isChecked())) {
    await checkbox.check();
  }
  await page.getByRole('button', { name: 'Inscribirme' }).click();

  // 5. Comprobación: verificar que la inscripción se realizó (el botón Inscribirme desaparece o cambia)
  await expect(page.getByRole('button', { name: 'Inscribirme' })).not.toBeVisible();
});