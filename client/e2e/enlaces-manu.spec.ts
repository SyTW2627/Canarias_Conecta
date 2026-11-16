/**
 * Comprueba que los enlaces del menú llevan a la página correcta desde todas las pantallas.
 *
 * FALLO CONOCIDO: en algunas pantallas el menú usa enlaces antiguos ("/#perfil",
 * "/#inscripciones") que llevan al inicio en vez de a la página buena.
 * Esos casos están marcados con `test.fail()`: Playwright los da por buenos mientras
 * el fallo exista y avisará (en rojo) cuando alguien lo arregle, para quitar la marca.
 */
import { test, expect, VOLUNTARIO, ORGANIZACION, iniciarSesion, menu } from './fixtures';

type Caso = { desde: string; enlace: string; destino: RegExp; usuario: typeof VOLUNTARIO; roto?: boolean };

// La primera oferta real del catálogo, para probar el menú del detalle
let ofertaId = '';
test.beforeAll(async ({ request }) => {
  const ofertas = await (await request.get('/api/ofertas')).json();
  ofertaId = ofertas[0]?.id ?? '';
});

const casos: Caso[] = [
  // Voluntario
  { desde: '/', enlace: 'Oportunidades', destino: /\/oportunidades$/, usuario: VOLUNTARIO },
  { desde: '/', enlace: 'Mis inscripciones', destino: /\/mis_inscripciones$/, usuario: VOLUNTARIO },
  { desde: '/', enlace: 'Mi perfil', destino: /\/perfil$/, usuario: VOLUNTARIO },
  { desde: '/oportunidades', enlace: 'Mis inscripciones', destino: /\/mis_inscripciones$/, usuario: VOLUNTARIO },
  { desde: '/oportunidades', enlace: 'Mi perfil', destino: /\/perfil$/, usuario: VOLUNTARIO, roto: true },
  { desde: '/mis_inscripciones', enlace: 'Oportunidades', destino: /\/oportunidades$/, usuario: VOLUNTARIO },
  { desde: '/mis_inscripciones', enlace: 'Mi perfil', destino: /\/perfil$/, usuario: VOLUNTARIO },
  { desde: '/perfil', enlace: 'Oportunidades', destino: /\/oportunidades$/, usuario: VOLUNTARIO },
  { desde: '/perfil', enlace: 'Mis inscripciones', destino: /\/mis_inscripciones$/, usuario: VOLUNTARIO },
  { desde: 'DETALLE', enlace: 'Oportunidades', destino: /\/oportunidades$/, usuario: VOLUNTARIO },
  { desde: 'DETALLE', enlace: 'Mis inscripciones', destino: /\/mis_inscripciones$/, usuario: VOLUNTARIO, roto: true },
  { desde: 'DETALLE', enlace: 'Mi perfil', destino: /\/perfil$/, usuario: VOLUNTARIO, roto: true },
  // Organización
  { desde: '/', enlace: 'Gestionar ofertas', destino: /\/gestionar-ofertas$/, usuario: ORGANIZACION },
  { desde: '/', enlace: 'Mi perfil', destino: /\/perfil$/, usuario: ORGANIZACION },
  { desde: '/gestionar-ofertas', enlace: 'Mi perfil', destino: /\/perfil$/, usuario: ORGANIZACION, roto: true },
  { desde: '/perfil', enlace: 'Gestionar ofertas', destino: /\/gestionar-ofertas$/, usuario: ORGANIZACION },
];

for (const caso of casos) {
  const quien = caso.usuario === VOLUNTARIO ? 'voluntario' : 'organización';
  const nombre = `(${quien}) Desde ${caso.desde === 'DETALLE' ? 'el detalle de una oferta' : caso.desde}, "${caso.enlace}" lleva a su página`;

  test(nombre, async ({ page }) => {
    test.fail(!!caso.roto, 'Fallo conocido: el enlace del menú apunta a una dirección antigua');

    await iniciarSesion(page, caso.usuario);
    await page.goto(caso.desde === 'DETALLE' ? `/ofertas/${ofertaId}` : caso.desde);
    await menu(page).getByRole('link', { name: caso.enlace }).click();
    await expect(page).toHaveURL(caso.destino);
  });
}

test('El enlace "Inicio" vuelve al inicio desde cualquier pantalla', async ({ page }) => {
  await iniciarSesion(page, VOLUNTARIO);
  for (const desde of ['/oportunidades', '/mis_inscripciones', '/perfil']) {
    await page.goto(desde);
    await menu(page).getByRole('link', { name: 'Inicio' }).click();
    await expect(page.getByRole('searchbox', { name: 'Buscar oportunidades' })).toBeVisible();
  }
});
