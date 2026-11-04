<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Documenta los endpoints de la API REST del servidor.
-->
# API REST

Servidor Express en `server/`. Todas las rutas cuelgan de `/api`.

| Entorno | URL base |
|---|---|
| Desarrollo (desde el cliente) | `/api` — Vite redirige a `http://localhost:3000` (`client/vite.config.ts`) |
| Desarrollo (directo al servidor) | `http://localhost:3000/api` |
| Producción | `https://<dominio>/api` — ver [instalación en producción](instalacion.md#producción) |

## Convenciones

- Peticiones y respuestas en JSON (`Content-Type: application/json`).
- Los errores devuelven siempre `{ "message": "<texto para mostrar al usuario>" }`.
- **Autenticación:** el login y el registro devuelven un token JWT válido durante **1 día**, que
  contiene `{ id, rol }`. Las rutas protegidas lo recibirán en la cabecera
  `Authorization: Bearer <token>`. El cliente lo guarda en `localStorage` (`token` y `usuario`).

| Código | Significado |
|---|---|
| `200` / `201` | Correcto / recurso creado |
| `400` | Faltan datos o no son válidos |
| `401` | Credenciales incorrectas o token no válido |
| `409` | Conflicto (p. ej. email ya registrado) |
| `500` | Error del servidor (también si falta `JWT_SECRET` en el `.env`) |

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | No | Estado del servidor y de la base de datos |
| `POST` | `/api/auth/register` | No | Crea una cuenta e inicia sesión |
| `POST` | `/api/auth/login` | No | Inicia sesión |
| `GET` | `/api/users` | No ⚠️ | Lista de usuarios (ruta de prueba) |

### `GET /api/health`

Comprueba que la API funciona y si está conectada a MongoDB. `database` puede ser `conectado`,
`desconectado`, `conectando` o `desconectando`.

```json
200 OK
{ "status": "ok", "message": "Canarias Conecta API funcionando", "database": "conectado" }
```

### `POST /api/auth/register`

```json
{
  "nombre": "Laura Pérez",
  "email": "laura@ejemplo.com",
  "password": "Ejemplo123",
  "rol": "voluntario"
}
```

| Campo | Reglas |
|---|---|
| `nombre` | Obligatorio. Nombre completo o nombre de la entidad |
| `email` | Obligatorio, formato válido. Se guarda en minúsculas y sin espacios |
| `password` | Obligatoria, mínimo 8 caracteres. Se guarda como hash bcrypt |
| `rol` | `voluntario` u `ofertante` |

```json
201 Created
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "665f...", "nombre": "Laura Pérez", "email": "laura@ejemplo.com", "rol": "voluntario" }
}
```

| Error | Mensaje |
|---|---|
| `400` | `Nombre, email, contraseña y rol son obligatorios` · `El email no es válido` · `La contraseña debe tener al menos 8 caracteres` · `El rol no es válido` |
| `409` | `Ya existe una cuenta con ese email` |
| `500` | `Error al registrar el usuario` |

### `POST /api/auth/login`

```json
{ "email": "laura@ejemplo.com", "password": "Ejemplo123" }
```

Respuesta `200 OK` con el mismo formato que el registro (`token` + `user`).

| Error | Mensaje |
|---|---|
| `400` | `El email y la contraseña son obligatorios` |
| `401` | `Email o contraseña incorrectos` (el mismo para email inexistente y contraseña errónea, para no revelar qué emails están registrados) |
| `500` | `Error al iniciar sesión` |

### `GET /api/users`

Devuelve todos los usuarios ordenados por fecha de alta, sin la contraseña. Se creó para probar la
conexión con la base de datos (SCRUM-57).

```json
200 OK
[
  {
    "_id": "665f...",
    "nombre": "Laura Perez",
    "email": "laura@ejemplo.com",
    "rol": "voluntario",
    "createdAt": "2026-10-28T10:00:00.000Z",
    "updatedAt": "2026-10-28T10:00:00.000Z",
    "__v": 0
  }
]
```

> ⚠️ Es pública, devuelve el documento completo y expone los emails de todos los usuarios. Hay que
> protegerla (solo `admin`) o eliminarla antes de añadir datos de perfil a `users`, como el teléfono o
> la fecha de nacimiento.

## Pendiente

- Middleware que valide el JWT y el rol para las rutas protegidas (aún no existe ninguna).
- Endpoints de ofertas, inscripciones, valoraciones, etc., según el [diseño de la base de datos](base-de-datos.md).
  Al añadir uno, documentarlo aquí con el mismo formato.
