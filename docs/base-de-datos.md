<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Explica el diseño de la base de datos de la aplicacion.
-->
# Base de datos

MongoDB `canarias_conecta`, usada desde el servidor con Mongoose. Todas las colecciones están
implementadas en `server/src/models/`, salvo el campo `geo` de las ofertas. Al arrancar, el servidor
crea las colecciones, sus índices y las categorías, así que la aplicación no depende de
`npm run seed`, que solo añade datos de ejemplo.

| Diagrama | Contenido |
|---|---|
| [`diagramas/modelo-conceptual.puml`](diagramas/modelo-conceptual.puml) | Entidades y relaciones, sin depender de MongoDB |
| [`diagramas/modelo-mongodb.puml`](diagramas/modelo-mongodb.puml) | Colecciones, campos, referencias e índices |

## Funcionamiento

Un **ofertante** publica **ofertas** de voluntariado organizadas en **turnos** (fecha, horario y
plazas). Un **voluntario** se **inscribe**. El ofertante acepta o rechaza la inscripción y, al
terminar, confirma la asistencia. Cada colaboración completada queda en el perfil del voluntario con
su **valoración**.

## Colecciones

| Colección | Qué guarda |
|---|---|
| `users` | Cuenta y perfil del voluntario o del ofertante (según `rol`) |
| `categorias` | Intereses: medio ambiente, mayores, animales… |
| `ofertas` | La oferta, con sus turnos y su ubicación dentro |
| `inscripciones` | Voluntario + oferta, estado y las valoraciones de los dos lados |
| `solicitudes_ayuda` | Peticiones del botón *Necesito ayuda* |
| `notificaciones` | Avisos al usuario |
| `tokens` | Verificación de email y recuperación de contraseña (caducan solos) |

**Estados de una inscripción:** `pendiente` → `aceptada` o `rechazada`. Una aceptada termina como
`completada` o `no_presentado`. Se puede `cancelar` mientras no haya terminado.

## Decisiones

- **Dentro del documento o en colección aparte.** Va dentro lo que siempre se lee con el documento
  y es pequeño, como el perfil del usuario o los turnos de una oferta. Va aparte lo que puede crecer
  sin límite: una oferta puede tener cientos de inscripciones.
- **Un solo `users` para los dos roles.** El login no necesita saber qué tipo de usuario es. `nombre`
  se queda en la raíz, como en el modelo actual: es el nombre de la persona o de la entidad.
- **Valoraciones dentro de la inscripción.** Solo se puede valorar una colaboración completada, y
  como mucho una vez por cada lado.
- **Contadores guardados.** Las plazas libres y las estadísticas del perfil (horas, valoración
  media) se guardan para no recalcularlas en cada listado.
- **`plazasLibres` en lugar de `plazasOcupadas`.** MongoDB no permite comparar dos campos de un turno
  dentro de `$elemMatch`. Con `plazasLibres` basta filtrar por `$gt: 0` y restar en la misma operación,
  así dos personas no pueden ocupar la última plaza.
- **Sin transacciones.** Un MongoDB sin replica set no las admite, y la plaza y la inscripción están
  en colecciones distintas. Primero se reserva la plaza, después se cambia la inscripción y, si esto
  falla, se devuelve la plaza.
- **La plaza se ocupa al aceptar.** Una inscripción `pendiente` no reserva plaza, así las solicitudes
  sin resolver no bloquean la oferta. Puede haber más solicitudes que plazas.
- **El historial sale de `inscripciones`.** Es la lista de inscripciones del voluntario en estado
  `completada`, con los datos de su oferta. No hay tabla ni atributo aparte: así incluye fecha, horas
  y valoración, y no hay dos copias que mantener.
- **Estados calculados.** Una oferta llena o con todos sus turnos pasados no cambia de estado: se
  calcula a partir de los turnos, porque ningún proceso actualizaría ese estado.

## Reglas

- Email único y guardado en minúsculas. La contraseña se guarda como hash bcrypt y no se devuelve en las consultas.
- Un voluntario solo puede tener una inscripción activa en cada oferta, y solo si quedan plazas. Si
  su inscripción se canceló o se rechazó, puede volver a inscribirse.
- Un ofertante solo gestiona sus propias ofertas.
- No se puede aceptar una inscripción si no quedan plazas. Cancelar una inscripción aceptada devuelve
  la plaza.
- Las ofertas no se borran, se marcan como `cancelada`, para que el historial conserve sus datos.
- Al registrarse solo se puede elegir `voluntario` u `ofertante`, nunca `admin`.
- Una oferta necesita al menos un turno y una categoría para publicarse, y una ubicación salvo que
  sea `online`. Un borrador puede no tener nada de esto.
- Los usuarios empiezan como `activo`. `pendiente_verificacion` se usará cuando se envíen emails.
- Se guarda qué versión de los términos y la política de privacidad aceptó cada usuario (RGPD).

## Notas de implementación

- **Búsqueda.** `textoBusqueda` une título, descripción, organización y ubicación, en minúsculas y sin
  tildes, y se consulta con el término normalizado igual. Un índice `text` en español no encuentra
  "reforestacion" en "Reforestación" y no cubre la organización, que está en `users`.
- **Filtro por fecha.** Hay que usar `$elemMatch` sobre `turnos`. Sin él, una oferta con turnos el 10 y
  el 30 aparece al buscar entre el 15 y el 20.
- **Fechas de turno.** `fecha` guarda el día a las 00:00 UTC, y la hora va en `horaInicio` y `horaFin`.
  El cliente debe mostrarla con `timeZone: 'UTC'`: en otra zona horaria podría salir otro día.
- **Edición de turnos.** Hay que conservar el `_id` de cada turno, porque `turnoIds` lo referencia.
- **`geo`.** No se implementa de momento. Cuando se haga, `coordinates` no puede quedar como array
  vacío (es el valor por defecto de Mongoose) porque el índice `2dsphere` rechaza el documento.
- **`cif`.** Un valor vacío se guarda como `undefined`: el índice `sparse` ignora los campos ausentes,
  pero no las cadenas vacías.
- **Consentimientos.** El registro aún no los recoge, por eso no son obligatorios en el modelo.

## Pendiente de decidir

- ¿Quién puede usar *Necesito ayuda*: cualquiera o solo usuarios registrados?
- ¿Hace falta un rol `admin` para verificar entidades?
- ¿Se admiten menores de edad?
