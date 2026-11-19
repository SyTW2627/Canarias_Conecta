/**
 * Utilidades compartidas por los tests e2e (este archivo NO tiene tests).
 *
 * Importa `test` y `expect` desde este archivo en lugar de '@playwright/test':
 * cada test arranca con una protección que BLOQUEA cualquier petición que escriba
 * en la base de datos (POST/PUT/PATCH/DELETE a /api/...): crear ofertas, inscribirse,
 * registrarse, editar el perfil, marcar notificaciones...
 * Solo se deja pasar el inicio de sesión, que no guarda nada.
 * Así ejecutar `npx playwright test` nunca deja datos nuevos en la base de datos.
 *
 * Si un test quiere probar una de esas acciones, simula la respuesta del servidor
 * con `page.route(...)` (las rutas registradas después tienen prioridad sobre esta).
 */
import { test as base, expect, type Page } from '@playwright/test';

// Usuarios del seed del servidor (server/src/scripts/seed.ts).
// Se pueden cambiar con variables de entorno si usáis otros usuarios.
export const VOLUNTARIO = {
  email: process.env.E2E_VOLUNTARIO_EMAIL ?? 'laura@ejemplo.com',
  password: process.env.E2E_VOLUNTARIO_PASSWORD ?? 'Ejemplo123',
};

export const ORGANIZACION = {
  email: process.env.E2E_ORGANIZACION_EMAIL ?? 'horizonte@ejemplo.com',
  password: process.env.E2E_ORGANIZACION_PASSWORD ?? 'Ejemplo123',
};

const METODOS_DE_ESCRITURA = ['POST', 'PUT', 'PATCH', 'DELETE'];
const PERMITIDAS = ['/api/auth/login'];

type Fixtures = {
  /** Peticiones de escritura que se han bloqueado durante el test */
  escriturasBloqueadas: string[];
};

export const test = base.extend<Fixtures>({
  escriturasBloqueadas: [
    async ({ page }, use) => {
      const bloqueadas: string[] = [];

      await page.route('**/api/**', async (route) => {
        const peticion = route.request();
        const ruta = new URL(peticion.url()).pathname;
        if (METODOS_DE_ESCRITURA.includes(peticion.method()) && !PERMITIDAS.includes(ruta)) {
          bloqueadas.push(`${peticion.method()} ${ruta}`);
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Bloqueado por los tests e2e' }),
          });
          return;
        }
        await route.fallback();
      });

      await use(bloqueadas);
    },
    { auto: true },
  ],
});

export { expect };

/** Menú de navegación de la cabecera (hay enlaces repetidos en el resto de la página) */
export function menu(page: Page) {
  return page.getByRole('navigation', { name: 'Navegación principal' });
}

/** Inicia sesión rellenando el formulario de la web */
export async function iniciarSesionDesdeFormulario(
  page: Page,
  { email, password }: { email: string; password: string },
) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

/**
 * Inicia sesión sin pasar por el formulario: pide el token a la API y lo deja
 * en localStorage, igual que hace la pantalla de login. Es más rápido para los
 * tests cuyo objetivo no es probar el login.
 */
export async function iniciarSesion(
  page: Page,
  { email, password }: { email: string; password: string },
) {
  const respuesta = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(respuesta.ok(), `No se pudo iniciar sesión con ${email}`).toBeTruthy();
  const { token, user } = await respuesta.json();

  await page.addInitScript(
    ([t, u]) => {
      // Solo la primera vez: si el test cierra sesión, no se vuelve a iniciar al recargar
      if (!sessionStorage.getItem('e2e-sesion')) {
        sessionStorage.setItem('e2e-sesion', '1');
        localStorage.setItem('token', t);
        localStorage.setItem('usuario', u);
      }
    },
    [token, JSON.stringify(user)],
  );
}

/** Fecha (AAAA-MM-DD) dentro de `dias` días, para que los turnos nunca queden en el pasado */
export function fechaFutura(dias = 30): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
