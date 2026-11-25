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
| `PATCH` | `/api/inscripciones/:id/completar` | Ofertante | Confirma si el voluntario participó en la actividad |
| `PATCH` | `/api/inscripciones/:id/cancelar` | Voluntario | Cancela una inscripción propia antes de que empiece |
| `GET` | `/api/empleo` | No | Busca ofertas de empleo que admiten candidaturas |
| `POST` | `/api/empleo` | Ofertante | Publica una oferta de empleo |
| `GET` | `/api/empleo/mias` | Ofertante | Ofertas de empleo propias con su número de candidaturas |
| `GET` | `/api/empleo/:id` | No | Devuelve una oferta de empleo publicada |
| `PATCH` | `/api/empleo/:id/cerrar` | Ofertante | Cierra una oferta de empleo propia |
| `POST` | `/api/empleo/:id/candidaturas` | Voluntario | Se postula a una oferta de empleo |
| `GET` | `/api/empleo/:id/candidaturas` | Ofertante | Oferta propia con sus candidaturas y el perfil de cada candidato |
| `PATCH` | `/api/empleo/candidaturas/:id` | Ofertante | Preselecciona o descarta una candidatura |
| `PATCH` | `/api/empleo/candidaturas/:id/retirar` | Voluntario | Retira una candidatura propia |
| `GET` | `/api/empleo/candidaturas/mias` | Voluntario | Candidaturas del voluntario |
| `GET` | `/api/gamificacion/logros` | Voluntario | Retos del voluntario con su progreso |
| `GET` | `/api/gamificacion/ranking` | Voluntario | Ranking mensual de horas de voluntariado |

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
| `pagina` | Entero de 1 a 1000. Si se envía, la respuesta va paginada (ver abajo) |

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

**Paginación.** Sin `pagina` llega la lista completa, como arriba (la usa la página de inicio para
elegir las destacadas). Con `pagina`, en páginas de 12, con el mismo formato que `GET /api/empleo`:

```json
GET /api/ofertas?pagina=2

200 OK
{
  "ofertas": [ ... ],
  "total": 30,
  "pagina": 2,
  "porPagina": 12,
  "totalPaginas": 3
}
```

- Las que empiezan el mismo día se desempatan por `_id`, así que ninguna se repite entre páginas.
- Una página posterior a la última llega con `ofertas: []` y el total real. Si `categoria` no existe, `total` es `0`.
- `400` `La página no es válida` si no es un entero de 1 a 1000.

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

### `PATCH /api/inscripciones/:id/completar`

El ofertante confirma, cuando han terminado todos los turnos de una inscripción `aceptada`, si el
voluntario participó. `horas` es opcional: por defecto son las horas de sus turnos.

```json
{ "asistio": true, "horas": 2.5 }
```

| `asistio` | Estado final | Efecto |
|---|---|---|
| `true` | `completada` | Suma `horas` y una colaboración a las estadísticas del voluntario y le envía una notificación (`inscripcion_completada`) |
| `false` | `no_presentado` | Guarda `horasRealizadas: 0` |

```json
200 OK
{ "id": "6aeb...", "estado": "completada", "horasRealizadas": 2.5 }
```

| Error | Mensaje |
|---|---|
| `400` | `Indica si el voluntario asistió` · `Las horas realizadas no son válidas` (≤ 0 o más de 720) |
| `403` | Si quien llama no es ofertante |
| `404` | `La inscripción no existe` (también si es de otro ofertante) |
| `409` | `Solo se puede completar una inscripción aceptada` · `La actividad todavía no ha terminado` · `Esta inscripción ya se ha completado` |
| `500` | `No se pudo completar la inscripción` |

`GET /api/inscripciones/oferta/:ofertaId` (candidatos) incluye además, en cada candidato, `terminada`
(si ya puede confirmarse), `horasPrevistas`, `horasRealizadas` y `cancelacionTardia`.

### `PATCH /api/inscripciones/:id/cancelar`

El voluntario cancela una inscripción suya en estado `pendiente` o `aceptada`, siempre que no haya
empezado su primer turno. Sin cuerpo. Devuelve las plazas a la oferta y avisa al ofertante
(`inscripcion_cancelada`). Si quedan menos de **48 h** para el inicio, se cancela igualmente pero
queda marcada como tardía.

```json
200 OK
{ "id": "6aeb...", "estado": "cancelada", "cancelacionTardia": true }
```

| Error | Mensaje |
|---|---|
| `403` | Si quien llama no es voluntario |
| `404` | `La inscripción no existe` (también si es de otro voluntario) |
| `409` | `Esta inscripción ya no se puede cancelar` · `La actividad ya ha empezado: no se puede cancelar` |
| `500` | `No se pudo cancelar la inscripción` |

`GET /api/inscripciones/mias` incluye además, en cada inscripción, `inicio` (inicio del primer turno),
`puedeCancelar`, `cancelacionTardia` y `posicionEspera` (puesto en la lista de espera, o `null`).

### Lista de espera en `POST /api/inscripciones`

El cuerpo admite `listaEspera: true`. Si alguno de los turnos elegidos no tiene plazas:

| `listaEspera` | Resultado |
|---|---|
| ausente o `false` | `409` `Alguno de los turnos ya no está disponible` (como antes) |
| `true` | `201` con `estado: "en_espera"`, sin reservar plazas |

```json
{ "ofertaId": "6aeb...", "turnoIds": ["6aec..."], "listaEspera": true }
```

```json
201 Created
{ "id": "6aed...", "estado": "en_espera" }
```

Si hay plazas, `listaEspera` no cambia nada: la inscripción queda `pendiente`. Cuando se libera una
plaza, la primera inscripción de la cola que quepa pasa sola a `pendiente`, y el voluntario recibe la
notificación `lista_espera_plaza`.

## Empleo

Las entidades (rol `ofertante`) publican ofertas de empleo y los voluntarios se postulan. No hay
turnos ni plazas: la entidad revisa cada candidatura y su perfil de voluntariado hace de currículum.
Todas las rutas cuelgan de `/api/empleo` (`server/src/routes/empleoRoutes.ts`).

### `GET /api/empleo`

Ofertas en estado `publicada` sin fecha límite o con una de hoy en adelante, las más recientes
primero, en páginas de 12. Todos los parámetros son opcionales y se combinan entre sí.

| Parámetro | Reglas |
|---|---|
| `q` | Como en `GET /api/ofertas`: título, descripción, entidad y municipio, sin tildes ni mayúsculas. Máximo 100 caracteres |
| `isla` | Mismos valores que en `GET /api/ofertas` |
| `tipoContrato` | `indefinido`, `temporal`, `practicas`, `formacion` o `autonomo` |
| `jornada` | `completa` o `parcial` |
| `modalidad` | `presencial`, `online` o `mixta` |
| `pagina` | Entero de 1 a 1000; por defecto, `1` |

```json
GET /api/empleo?isla=tenerife&pagina=2

200 OK
{
  "ofertas": [
    {
      "id": "6b01...",
      "titulo": "Técnico/a de logística en almacén solidario",
      "descripcion": "Coordinación de la recepción, clasificación y reparto...",
      "organizacion": "Banco de Alimentos Tenerife",
      "categorias": [{ "id": "6aeb...", "nombre": "Alimentación", "slug": "alimentacion" }],
      "tipoContrato": "indefinido",
      "jornada": "completa",
      "modalidad": "presencial",
      "ubicacion": { "isla": "tenerife", "municipio": "Santa Cruz de Tenerife" },
      "salario": "19.000 € brutos/año",
      "requisitos": "Carné de conducir B.",
      "vacantes": 1,
      "fechaLimite": "2026-12-22T00:00:00.000Z",
      "fechaPublicacion": "2026-11-22T10:00:00.000Z",
      "abierta": true
    }
  ],
  "total": 13,
  "pagina": 2,
  "porPagina": 12,
  "totalPaginas": 2
}
```

- `total` y `totalPaginas` cuentan todas las ofertas que cumplen los filtros. Una `pagina` posterior a la última devuelve `ofertas: []` con el total real, para que el cliente salte a la última (pasa si se cierran ofertas mientras se navega). Sin resultados, `totalPaginas` es `0`.
- Las ofertas publicadas a la vez se desempatan por `_id`, así que ninguna se repite ni se salta entre páginas.
- `abierta` indica si todavía admite candidaturas (publicada y dentro de plazo).
- `fechaLimite` es el último día incluido, a las 00:00 UTC (`null` si no tiene plazo): se muestra con `timeZone: 'UTC'`.
- `salario` y `requisitos` son `null` si la entidad no los indicó. `ubicacion` falta en las ofertas `online`.

| Error | Mensaje |
|---|---|
| `400` | `La búsqueda no puede superar los 100 caracteres` · `La isla no es válida` · `El tipo de contrato no es válido` · `La jornada no es válida` · `La modalidad no es válida` · `La página no es válida` |
| `500` | `Error al buscar las ofertas de empleo` |

### `GET /api/empleo/:id`

Una oferta `publicada` (aunque haya pasado su plazo, con `abierta: false`), con el mismo formato.

| Error | Mensaje |
|---|---|
| `404` | `La oferta de empleo no existe o ya no está disponible` (también si el id no es válido o está cerrada) |
| `500` | `Error al obtener la oferta de empleo` |

### `POST /api/empleo`

```json
{
  "titulo": "Auxiliar de acompañamiento a personas mayores",
  "descripcion": "Acompañamiento a domicilio y en centro de día.",
  "categoriaIds": ["6aeb..."],
  "tipoContrato": "temporal",
  "jornada": "parcial",
  "modalidad": "presencial",
  "ubicacion": { "isla": "gran_canaria", "municipio": "Telde" },
  "salario": "9,50 €/hora",
  "requisitos": "Certificado de atención sociosanitaria",
  "vacantes": 3,
  "fechaLimite": "2026-12-15"
}
```

| Campo | Reglas |
|---|---|
| `titulo` | Obligatorio, máximo 120 caracteres |
| `descripcion` | Obligatoria, máximo 5000 caracteres |
| `categoriaIds` | Opcional. Ids de `GET /api/categorias` (sector del puesto) |
| `tipoContrato` | Obligatorio: `indefinido`, `temporal`, `practicas`, `formacion` o `autonomo` |
| `jornada` | Obligatoria: `completa` o `parcial` |
| `modalidad` | Obligatoria: `presencial`, `online` o `mixta` |
| `ubicacion` | `isla` y `municipio`. Obligatoria salvo `online`. No tiene `direccion` |
| `salario` | Opcional, texto libre de hasta 100 caracteres |
| `requisitos` | Opcional, máximo 2000 caracteres |
| `vacantes` | Entero entre 1 y 100. Por defecto, 1 |
| `fechaLimite` | Opcional, `AAAA-MM-DD`, no pasada. Sin ella admite candidaturas hasta que se cierre |

Se publica directamente (no hay borradores). El ofertante sale del token y se ignora cualquier otro campo.

```json
201 Created
{ "id": "6b01...", "estado": "publicada" }
```

| Error | Mensaje |
|---|---|
| `400` | `El título y la descripción son obligatorios` · `El tipo de contrato no es válido` · `La jornada no es válida` · `La modalidad no es válida` · `Las vacantes deben ser un número entre 1 y 100` · `Las categorías no son válidas` · `El salario no es válido` · `El salario no puede superar los 100 caracteres` · `La fecha límite debe tener el formato AAAA-MM-DD` · `La fecha límite no puede ser pasada` · `La oferta necesita una ubicación` · `La isla no es válida` · `El municipio es obligatorio` · `Los datos de la oferta de empleo no son válidos` |
| `401` / `403` | Igual que en `POST /api/ofertas` |
| `500` | `Error al crear la oferta de empleo` |

### `GET /api/empleo/mias`

Todas las ofertas de empleo del ofertante, en cualquier estado y las más nuevas primero. Cada una
añade `estado` (`publicada` o `cerrada`), `candidaturas` (sin contar las retiradas) y
`candidaturasPendientes` (las que aún no ha revisado).

| Error | Mensaje |
|---|---|
| `500` | `Error al obtener tus ofertas de empleo` |

### `PATCH /api/empleo/:id/cerrar`

Deja de mostrar la oferta y de admitir candidaturas. Avisa (`oferta_cerrada`) a los candidatos
`pendiente` o `preseleccionada`. No se puede volver a abrir.

```json
200 OK
{ "id": "6b01...", "estado": "cerrada" }
```

| Error | Mensaje |
|---|---|
| `404` | `La oferta de empleo no existe o no es tuya` |
| `409` | `La oferta de empleo ya está cerrada` |
| `500` | `Error al cerrar la oferta de empleo` |

### `POST /api/empleo/:id/candidaturas`

El voluntario se postula. El cuerpo es opcional: `{ "mensaje": "..." }`, una carta de presentación de
hasta 2000 caracteres. Avisa a la entidad (`candidatura_nueva`).

```json
201 Created
{ "id": "6b02...", "estado": "pendiente" }
```

| Error | Mensaje |
|---|---|
| `400` | `El mensaje no es válido` · `El mensaje no puede superar los 2000 caracteres` |
| `404` | `La oferta de empleo no existe o ya no está disponible` |
| `409` | `El plazo para presentar candidaturas ha terminado` · `Ya te has postulado a esta oferta` |
| `500` | `No se pudo enviar la candidatura` |

### `GET /api/empleo/:id/candidaturas`

Solo para la entidad que publicó la oferta. Devuelve la oferta (con su `estado`) y sus candidaturas
por orden de llegada, sin las retiradas.

```json
200 OK
{
  "oferta": { "id": "6b01...", "titulo": "...", "estado": "publicada", "abierta": true },
  "candidaturas": [
    {
      "id": "6b02...",
      "estado": "pendiente",
      "mensaje": "Llevo dos años colaborando con mayores...",
      "fechaCandidatura": "2026-11-22T11:00:00.000Z",
      "fechaResolucion": null,
      "candidato": {
        "id": "665f...",
        "nombre": "Laura Pérez",
        "avatarUrl": null,
        "isla": "tenerife",
        "municipio": "La Laguna",
        "biografia": "...",
        "intereses": [{ "id": "6aeb...", "nombre": "Personas mayores" }],
        "habilidades": ["Primeros auxilios"],
        "idiomas": ["Inglés"],
        "acreditaciones": [{ "nombre": "Manipulador de alimentos", "fechaObtencion": "2025-03-01T00:00:00.000Z" }],
        "estadisticas": { "horasTotales": 42, "colaboraciones": 9, "valoracionMedia": 4.8, "numValoraciones": 6 },
        "email": null,
        "telefono": null
      }
    }
  ]
}
```

`email` y `telefono` solo se envían cuando la candidatura está `preseleccionada`.

| Error | Mensaje |
|---|---|
| `404` | `La oferta de empleo no existe o no es tuya` |
| `500` | `No se pudieron cargar las candidaturas` |

### `PATCH /api/empleo/candidaturas/:id`

La entidad decide sobre una candidatura de sus ofertas: `{ "estado": "preseleccionada" }` o
`{ "estado": "descartada" }`. Avisa al candidato (`candidatura_preseleccionada` o
`candidatura_descartada`).

| Estado pedido | Desde |
|---|---|
| `preseleccionada` | `pendiente` |
| `descartada` | `pendiente` o `preseleccionada` |

```json
200 OK
{ "id": "6b02...", "estado": "preseleccionada" }
```

| Error | Mensaje |
|---|---|
| `400` | `El estado no es válido` |
| `404` | `La candidatura no existe` (también si es de otra entidad) |
| `409` | `Esta candidatura ya no se puede cambiar a ese estado` |
| `500` | `No se pudo actualizar la candidatura` |

### `PATCH /api/empleo/candidaturas/:id/retirar`

El voluntario retira una candidatura suya `pendiente` o `preseleccionada`. Sin cuerpo. Después puede
volver a postularse a la misma oferta.

| Error | Mensaje |
|---|---|
| `404` | `La candidatura no existe` (también si es de otro voluntario) |
| `409` | `Esta candidatura ya no se puede retirar` |
| `500` | `No se pudo retirar la candidatura` |

### `GET /api/empleo/candidaturas/mias`

Candidaturas del voluntario, las más recientes primero, en cualquier estado:

```json
200 OK
[
  {
    "id": "6b02...",
    "estado": "pendiente",
    "fechaCandidatura": "2026-11-22T11:00:00.000Z",
    "ofertaId": "6b01...",
    "titulo": "Técnico/a de logística en almacén solidario",
    "organizacion": "Banco de Alimentos Tenerife",
    "tipoContrato": "indefinido",
    "jornada": "completa",
    "modalidad": "presencial",
    "ubicacion": { "isla": "tenerife", "municipio": "Santa Cruz de Tenerife" },
    "ofertaAbierta": true
  }
]
```

| Error | Mensaje |
|---|---|
| `500` | `No se pudieron cargar tus candidaturas` |

## Gamificación

Retos y ranking de los voluntarios (`server/src/routes/gamificacionRoutes.ts`). Todas las rutas
exigen sesión con rol `voluntario` (`401`/`403` como en el resto de la API).

### `GET /api/gamificacion/logros`

Retos del voluntario con su progreso. Se calculan con sus estadísticas y sus colaboraciones
completadas; los ya conseguidos llevan la fecha en que se lograron.

```json
200 OK
{
  "metricas": { "horas": 12, "colaboraciones": 3, "islas": 2, "categorias": 2, "valoracionMedia": 4.8, "numValoraciones": 5 },
  "conseguidos": 3,
  "logros": [
    {
      "id": "horas-50",
      "nombre": "Medio centenar",
      "descripcion": "Suma 50 horas de voluntariado",
      "icono": "⭐",
      "objetivo": 50,
      "progreso": 12,
      "conseguido": false,
      "fecha": null,
      "detalle": null
    }
  ]
}
```

| Reto (`id`) | Se consigue con |
|---|---|
| `primera-colaboracion`, `colaboraciones-5`, `colaboraciones-20` | 1, 5 y 20 colaboraciones completadas |
| `horas-10`, `horas-50`, `horas-100` | 10, 50 y 100 horas de voluntariado |
| `islas-3` | Colaboraciones completadas en 3 islas distintas |
| `categorias-4` | Colaboraciones completadas en 4 categorías distintas |
| `valoracion-excelente` | 5 valoraciones con una media de 4,5 palmeras o más (`detalle` indica la media actual) |

- `progreso` no pasa de `objetivo` (las horas se redondean hacia abajo).
- Un reto conseguido no se pierde aunque después baje la métrica (por ejemplo, la media).

| Error | Mensaje |
|---|---|
| `404` | `Usuario no encontrado` |
| `500` | `No se pudieron cargar tus retos` |

### `GET /api/gamificacion/ranking`

Voluntarios con más horas completadas en un mes, como mucho 10, y la posición de quien pregunta.
Cuenta cada inscripción `completada` en el mes de su actividad (el último de sus turnos), no en el
de la confirmación.

| Parámetro | Reglas |
|---|---|
| `mes` | `AAAA-MM`. Por defecto, el mes actual (UTC) |
| `isla` | Opcional. Solo cuenta las actividades de esa isla (las `online` no tienen isla) |

```json
GET /api/gamificacion/ranking?mes=2026-11&isla=tenerife

200 OK
{
  "mes": "2026-11",
  "isla": "tenerife",
  "participantes": 2,
  "ranking": [
    { "posicion": 1, "nombre": "Carlos D.", "avatarUrl": null, "horas": 7, "colaboraciones": 1, "eresTu": false },
    { "posicion": 2, "nombre": "Laura P.", "avatarUrl": null, "horas": 3, "colaboraciones": 1, "eresTu": true }
  ],
  "tuPosicion": { "posicion": 2, "horas": 3, "colaboraciones": 1 }
}
```

- Empate en horas = misma posición (1, 1, 3…). Dentro del empate se ordena por colaboraciones.
- `nombre` es el nombre y la inicial del primer apellido: el ranking lo ven otros voluntarios.
- `tuPosicion` es `null` si quien pregunta no ha completado nada ese mes.

| Error | Mensaje |
|---|---|
| `400` | `El mes debe tener el formato AAAA-MM` · `La isla no es válida` |
| `500` | `No se pudo cargar el ranking` |

### Avisos

Al confirmar una participación (`PATCH /api/inscripciones/:id/completar` con `asistio: true`) y al
valorar al voluntario (`PATCH /api/inscripciones/:id/valorar`), el servidor comprueba sus retos y le
envía una notificación `logro_conseguido` por cada reto nuevo, con enlace a `/retos`. Si esta
comprobación falla, la acción responde igualmente.

## Pendiente

- Resto de endpoints de ofertas, inscripciones, valoraciones, etc., según el [diseño de la base de datos](base-de-datos.md).
  Al añadir uno, documentarlo aquí con el mismo formato.
