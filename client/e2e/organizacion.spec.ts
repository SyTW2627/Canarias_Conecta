import { test, expect, ORGANIZACION, fechaFutura, iniciarSesionDesdeFormulario, menu } from './fixtures';

test('Una organización puede publicar una oferta y gestionar sus candidatos', async ({ page }) => {
  const tituloOferta = `Limpieza de casa de persona mayor #${Date.now()}`;
  const fechaTurno = fechaFutura(30);

  // La publicación se SIMULA: la petición no llega al servidor y no se crea ninguna oferta.
  // Guardamos lo que la web envía para comprobar que el formulario manda los datos correctos.
  let datosEnviados: Record<string, unknown> | null = null;
  let ofertaSimulada: Record<string, unknown> | null = null;

  await page.route('**/api/ofertas', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();

    // El formulario se envía como multipart con un campo "datos" en JSON
    const cuerpo = route.request().postData() ?? '';
    const json = cuerpo.match(/name="datos"\r\n\r\n([\s\S]*?)\r\n--/)?.[1];
    datosEnviados = json ? JSON.parse(json) : null;

    ofertaSimulada = {
      id: 'oferta-simulada-e2e',
      titulo: tituloOferta,
      descripcion: 'Ayuda en la limpieza de un hogar de una persona mayor',
      organizacion: 'Organización de prueba',
      categorias: [{ id: 'x', nombre: 'Comunidad', slug: 'comunidad' }],
      modalidad: 'presencial',
      tipoDuracion: 'jornada',
      ubicacion: { isla: 'gran_canaria', municipio: 'Las Palmas' },
      imagenes: [],
      turnos: [
        { id: 't1', fecha: `${fechaTurno}T00:00:00.000Z`, horaInicio: '09:30', horaFin: '13:30', plazas: 2, plazasLibres: 2 },
      ],
      estado: 'publicada',
      terminada: false,
      creadaEn: new Date().toISOString(),
      candidatosPendientes: 0,
    };

    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(ofertaSimulada) });
  });

  // Tras "publicar", el listado real de "Mis ofertas" se devuelve con la oferta simulada al final
  await page.route('**/api/ofertas/mias', async (route) => {
    if (!ofertaSimulada) return route.fallback();
    const respuesta = await route.fetch();
    const ofertas = await respuesta.json();
    await route.fulfill({ response: respuesta, json: [...ofertas, ofertaSimulada] });
  });

  // 1. Iniciar sesión como organización
  await iniciarSesionDesdeFormulario(page, ORGANIZACION);

  // 2. Ir al panel de gestión y rellenar el formulario de nueva oferta
  await menu(page).getByRole('link', { name: 'Gestionar ofertas' }).click();
  await page.getByRole('link', { name: /Publicar voluntariado/ }).click();
  await expect(page).toHaveURL(/\/gestionar-ofertas\/nueva$/);
  await page.getByRole('textbox', { name: 'Título *' }).fill(tituloOferta);
  await page.getByRole('textbox', { name: 'Descripción *' }).fill('Ayuda en la limpieza de un hogar de una persona mayor');

  await page.getByRole('checkbox', { name: 'Comunidad' }).check();
  await page.getByRole('checkbox', { name: 'Personas mayores' }).check();

  await page.getByLabel(/Isla \*/i).selectOption('gran_canaria');
  await page.getByRole('textbox', { name: 'Municipio *' }).fill('Las Palmas');
  await page.getByRole('textbox', { name: 'Requisitos' }).fill('Ropa cómoda');
  await page.getByRole('spinbutton', { name: 'Edad mínima' }).fill('18');

  await page.getByRole('textbox', { name: 'Fecha' }).fill(fechaTurno);
  await page.getByRole('textbox', { name: 'Inicio' }).fill('09:30');
  await page.getByRole('textbox', { name: 'Fin' }).fill('13:30');
  await page.getByRole('spinbutton', { name: 'Plazas' }).fill('2');

  // 3. Publicar la oferta (simulado) y comprobar que se vuelve al listado con la oferta
  await page.getByRole('button', { name: 'Publicar oferta' }).click();
  await expect(page).toHaveURL(/\/gestionar-ofertas$/);
  await expect(page.getByRole('status')).toContainText('Oferta publicada. Los voluntarios ya pueden verla.');
  await expect(page.getByRole('heading', { name: tituloOferta })).toBeVisible();

  // Lo que se envió al servidor es lo que se rellenó
  expect(datosEnviados).toMatchObject({
    titulo: tituloOferta,
    estado: 'publicada',
    ubicacion: { isla: 'gran_canaria', municipio: 'Las Palmas' },
    requisitos: 'Ropa cómoda',
    edadMinima: 18,
    turnos: [{ fecha: fechaTurno, horaInicio: '09:30', horaFin: '13:30', plazas: 2 }],
  });

  // 4. Entrar a la gestión de candidatos de una oferta real y navegar por las pestañas de estado
  await page.getByRole('link', { name: 'Ver candidatos' }).first().click();
  await expect(page).toHaveURL(/\/gestionar-ofertas\/[^/]+\/candidatos/);

  for (const pestana of ['En espera', 'Aceptados', 'Finalizados', 'Rechazados', 'Todos']) {
    const tab = page.getByRole('tab', { name: pestana });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
});
