<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Describe la arquitectura de la aplicacion.
-->
# Arquitectura

Diagrama: [`diagramas/arquitectura.puml`](diagramas/arquitectura.puml)

| Parte | Tecnología | Carpeta |
|---|---|---|
| Cliente | React 19 + TypeScript, Vite | `client/` |
| Servidor | Node.js 22, Express 5 + TypeScript | `server/` |
| Base de datos | MongoDB 8 con Mongoose | `server/src/models`, `server/db` |

En desarrollo, Vite sirve el cliente en el puerto 5173 y redirige `/api` al servidor (puerto 3000).

## Servidor

```
server/src/
├── index.ts       arranca Express y registra las rutas, solo si conecta con MongoDB
├── config/        conexión con MongoDB y preparación de colecciones y categorías
├── routes/        URL → función del controlador
├── controllers/   validan la petición, aplican las reglas y responden
├── middleware/    comprueban el token y el rol en las rutas protegidas
├── models/        esquemas de Mongoose
└── scripts/       seed con datos de ejemplo
```

Para añadir una funcionalidad se crean su modelo, su controlador y su fichero de rutas, se registra
en `index.ts` y se documenta en [`API.md`](API.md).

## Cliente

`App.tsx` muestra la pantalla pública y decide con un estado qué pantalla se ve: `publica`,
`login`, `registro` o `autenticada`. Cada pantalla tiene su `.tsx` y su `.css` en `pages/`
(`Login`, `Register`, `HomePage` y `OfertaDetalle`). Las imágenes están en `public/fotos/`.

Con sesión iniciada, cada pantalla tiene su URL. `rutaDe()` en `App.tsx` la traduce a una página y
captura los clics en los enlaces para cambiar la URL sin recargar, así que para navegar basta con un
`<a href="...">` normal.

| Ruta | Pantalla | Rol |
|---|---|---|
| `/` | `HomePage` | Los dos |
| `/oportunidades`, `/ofertas/<id>` | `Oportunidades`, `OfertaDetalle` | Voluntario |
| `/mis_inscripciones` | `MisInscripciones` | Voluntario |
| `/gestionar-ofertas`, `/gestionar-ofertas/nueva` | `GestionarOfertas`, `PublicarOferta` | Ofertante |
| `/gestionar-ofertas/<id>/editar`, `/gestionar-ofertas/<id>/candidatos` | `EditarOferta`, `Candidatos` | Ofertante |
| `/empleo` | `Empleo`: catálogo y candidaturas (voluntario) o sus ofertas de empleo (ofertante) | Los dos |
| `/empleo/<id>` | `OfertaEmpleoDetalle`: postularse (voluntario) o revisar candidaturas (ofertante) | Los dos |
| `/retos` | `Retos`: retos con su progreso y ranking mensual | Voluntario |
| `/perfil` | `VolunteerProfile` u `OrganizationProfile` | Los dos |

Las pantallas de empleo y de retos usan `components/MarcoAutenticado.tsx`, que pinta la cabecera con la
navegación (según el rol y con la sección actual marcada) y el pie. Las pantallas anteriores aún
repiten ese código; al tocarlas conviene pasarlas al marco. Los tipos y textos compartidos de las
ofertas están en `ofertas.ts`, y los de empleo en `empleo.ts`.

## Autenticación

Al registrarse o iniciar sesión, el servidor comprueba la contraseña con bcrypt y devuelve un token
JWT con `{ id, rol }`, válido 1 día. El cliente guarda el token y el usuario en `localStorage`.
Las rutas protegidas reciben el token en la cabecera `Authorization: Bearer <token>`. Para proteger una
ruta se añaden `requireAuth` y, si hace falta, `requireRol` (`server/src/middleware/auth.ts`):

```ts
router.post('/', requireAuth, requireRol('ofertante'), crearOferta)
```

`requireAuth` consulta el usuario en cada petición, porque el token sigue siendo válido aunque la cuenta
se suspenda o se borre, y lo deja en `req.usuario` con `id`, `nombre` y `rol`.

## Ramas

`main` guarda las versiones cerradas, `Dev` el sprint en curso y cada tarea va en una
`feature/SCRUM-NN-...` que sale de `Dev`. La rama `doc` contiene esta documentación, va aparte y no
se fusiona.

Los diagramas `.puml` se ven con la extensión *PlantUML* de VS Code (`Alt+D`) o en
<https://www.plantuml.com/plantuml>.
