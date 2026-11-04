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
  contiene `{ id, rol }`. Las rutas protegidas lo reciben en la cabecera
  `Authorization: Bearer <token>`. El cliente lo guarda en `localStorage` (`token` y `usuario`).

| Código | Significado |
|---|---|
| `200` / `201` | Correcto / recurso creado |
| `400` | Faltan datos o no son válidos |
| `401` | Credenciales incorrectas, falta el token o no es válido |
| `403` | Sesión correcta, pero sin permiso para esa acción |
| `404` | El recurso no existe |
| `409` | Conflicto (p. ej. email ya registrado) |
| `500` | Error del servidor (también si falta `JWT_SECRET` en el `.env`) |

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | No | Estado del servidor y de la base de datos |
| `POST` | `/api/auth/register` | No | Crea una cuenta e inicia sesión |
| `POST` | `/api/auth/login` | No | Inicia sesión |
| `GET` | `/api/ofertas` | No | Busca ofertas publicadas con filtros |
| `POST` | `/api/ofertas` | Ofertante | Crea una oferta |
| `GET` | `/api/ofertas/:id` | No | Devuelve una oferta publicada |
| `GET` | `/api/categorias` | No | Lista las categorías activas |

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

### `GET /api/ofertas`

Devuelve las ofertas en estado `publicada` con algún turno entre `fechaDesde` y `fechaHasta`. Todos
los parámetros son opcionales y se combinan entre sí.

| Parámetro | Reglas |
|---|---|
| `q` | Busca en título, descripción, organización y municipio. No distingue tildes ni mayúsculas, y cada palabra debe aparecer, en cualquier orden. Máximo 100 caracteres |
| `categoria` | Slug de la categoría (`medio-ambiente`). Si no existe, la lista sale vacía |
| `isla` | `tenerife`, `gran_canaria`, `lanzarote`, `fuerteventura`, `la_palma`, `la_gomera`, `el_hierro` o `la_graciosa` |
| `municipio` | Texto exacto (`La Laguna`) |
| `fechaDesde` | Formato `AAAA-MM-DD`. Por defecto, hoy |
| `fechaHasta` | Formato `AAAA-MM-DD`, incluida. Por defecto, sin límite |

```json
GET /api/ofertas?isla=gran_canaria&q=costa

200 OK
[
  {
    "id": "6aeb...",
    "titulo": "Limpieza y cuidado de la costa",
    "descripcion": "Recogida de residuos y cuidado del litoral junto a vecinos de la zona.",
    "organizacion": "Mar y Comunidad",
    "categorias": [{ "id": "6aeb...", "nombre": "Medio ambiente", "slug": "medio-ambiente" }],
    "modalidad": "presencial",
    "tipoDuracion": "jornada",
    "ubicacion": { "isla": "gran_canaria", "municipio": "Las Palmas de Gran Canaria" },
    "imagenes": ["/fotos/limpieza_costa.jpg"],
    "turnos": [
      {
        "id": "6aeb...",
        "fecha": "2026-11-15T00:00:00.000Z",
        "horaInicio": "09:00",
        "horaFin": "12:00",
        "plazas": 15,
        "plazasLibres": 15
      }
    ]
  }
]
```

- `turnos` incluye todos los de la oferta, también los pasados.
- `fecha` hay que mostrarla con `timeZone: 'UTC'`.
- `ubicacion` puede faltar en las ofertas `online`, y nunca incluye `direccion`, que puede ser un domicilio.
- `requisitos` y `edadMinima` solo aparecen si la oferta los tiene.
- La lista no está paginada todavía (SCRUM-34).

| Error | Mensaje |
|---|---|
| `400` | `La búsqueda no puede superar los 100 caracteres` · `La isla no es válida` · `Las fechas deben tener el formato AAAA-MM-DD` · `La fecha de fin no puede ser anterior a la de inicio` |
| `500` | `Error al buscar las ofertas` |

### `POST /api/ofertas`

Crea una oferta del ofertante que ha iniciado sesión. Necesita la cabecera
`Authorization: Bearer <token>` y una cuenta activa con rol `ofertante`.

```json
{
  "titulo": "Limpieza y cuidado de la costa",
  "descripcion": "Recogida de residuos junto a vecinos de la zona.",
  "categoriaIds": ["6aeb..."],
  "modalidad": "presencial",
  "tipoDuracion": "jornada",
  "ubicacion": { "isla": "gran_canaria", "municipio": "Telde", "direccion": "Calle Real, 12" },
  "requisitos": "Ropa cómoda",
  "edadMinima": 18,
  "turnos": [{ "fecha": "2026-12-05", "horaInicio": "10:00", "horaFin": "12:00", "plazas": 7 }],
  "estado": "publicada"
}
```

| Campo | Reglas |
|---|---|
| `titulo` | Obligatorio, máximo 120 caracteres |
| `descripcion` | Obligatoria, máximo 5000 caracteres |
| `categoriaIds` | Ids de `GET /api/categorias`. Al menos uno para publicar |
| `modalidad` | `presencial`, `online` o `mixta` |
| `tipoDuracion` | `jornada` o `periodo_corto` |
| `ubicacion` | `isla` y `municipio`, y `direccion` opcional. Obligatoria para publicar, salvo `online` |
| `requisitos` | Opcional, máximo 2000 caracteres |
| `edadMinima` | Opcional |
| `turnos` | Máximo 50, al menos uno para publicar. `fecha` en formato `AAAA-MM-DD` y no pasada, horas en `HH:mm` y `plazas` entero mayor que 0 |
| `estado` | `publicada` (por defecto) o `borrador` |

El servidor ignora cualquier otro campo. El ofertante sale del token, y las plazas libres, la fecha de
publicación y el texto de búsqueda se calculan. Las imágenes todavía no se pueden enviar.

```json
201 Created
{ "id": "6aeb...", "estado": "publicada" }
```

| Error | Mensaje |
|---|---|
| `400` | `El título y la descripción son obligatorios` · `El estado no es válido` · `Las categorías no son válidas` · `Los turnos no son válidos` · `Los turnos no pueden tener una fecha pasada` · `La hora de fin debe ser posterior a la de inicio` · `La oferta necesita una ubicación` · `La oferta necesita al menos una categoría` · `La oferta necesita al menos un turno` · `Los datos de la oferta no son válidos` |
| `401` | `Debes iniciar sesión` · `La sesión no es válida o ha caducado` |
| `403` | `No tienes permiso para realizar esta acción` · `Tu cuenta no puede realizar esta acción` |
| `500` | `Error al crear la oferta` · `Error al comprobar la sesión` |

### `GET /api/ofertas/:id`

Devuelve una oferta en estado `publicada`, con el mismo formato que cada elemento de `GET /api/ofertas`.

| Error | Mensaje |
|---|---|
| `404` | `La oferta no existe o ya no está disponible` (también si el id no es válido o la oferta no está publicada) |
| `500` | `Error al obtener la oferta` |

### `GET /api/categorias`

Devuelve las categorías activas ordenadas por nombre.

```json
200 OK
[{ "id": "6aeb...", "nombre": "Alimentación", "slug": "alimentacion" }]
```

| Error | Mensaje |
|---|---|
| `500` | `Error al obtener las categorías` |

## Pendiente

- Resto de endpoints de ofertas, inscripciones, valoraciones, etc., según el [diseño de la base de datos](base-de-datos.md).
  Al añadir uno, documentarlo aquí con el mismo formato.
