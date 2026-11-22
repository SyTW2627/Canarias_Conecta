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

Además, el ofertante puede publicar **ofertas de empleo**. El voluntario se **postula** con una
**candidatura** y la entidad la revisa junto a su trayectoria de voluntariado (horas, colaboraciones,
valoraciones y acreditaciones), que hace de currículum.

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
| `ofertas_empleo` | Oferta de empleo: contrato, jornada, ubicación, salario, vacantes y fecha límite |
| `candidaturas` | Voluntario + oferta de empleo, estado y carta de presentación |

**Estados de una inscripción:** `pendiente` → `aceptada` o `rechazada`. Una aceptada termina como
`completada` o `no_presentado`. Si no quedan plazas, la solicitud entra como `en_espera` y pasa a
`pendiente` cuando se libera una. Se puede `cancelar` (desde `pendiente`, `en_espera` o `aceptada`)
mientras no haya empezado.

**Estados de una oferta de empleo:** `publicada` → `cerrada`. Que haya pasado su fecha límite no
cambia el estado: se calcula al consultarla (`abierta` en la API).

**Estados de una candidatura:** `pendiente` → `preseleccionada` o `descartada`, y una preseleccionada
también puede acabar `descartada`. El voluntario la `retira` desde `pendiente` o `preseleccionada`.

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
- **La plaza se ocupa al solicitar.** Una inscripción `pendiente` ya reserva su plaza, y rechazarla
  la devuelve. Así nunca hay más solicitudes que plazas, el voluntario que ve una plaza libre y la
  solicita la conserva mientras no lo rechacen, y una oferta llena tiene sentido para la lista de
  espera. A cambio, un ofertante que no resuelve sus solicitudes mantiene esas plazas ocupadas.
- **Asistencia confirmada por el ofertante.** Cuando terminan todos los turnos de una inscripción
  aceptada, el ofertante la marca como `completada` (con las horas realizadas, que por defecto son
  las de sus turnos) o `no_presentado`. Al completarla se suman las horas y una colaboración a las
  `estadisticas` del voluntario. El cambio de estado filtra por `aceptada`, así dos peticiones a la
  vez no suman las horas dos veces.
- **Cancelación con plazo mínimo de 48 h.** El voluntario puede cancelar una inscripción `pendiente`
  o `aceptada` hasta que empiece su primer turno (fecha + `horaInicio`). Con menos de 48 h de
  antelación se permite igualmente, pero se guarda `cancelacionTardia: true`, que queda en su
  historial y ve el ofertante. Se eligió avisar en lugar de bloquear para no dejar al voluntario
  atrapado, y 48 h en lugar de 24 h para que dé tiempo a que la plaza pase a la lista de espera y el
  ofertante acepte al siguiente. El plazo es la constante `ANTELACION_CANCELAR_HORAS`.
- **Lista de espera con avance automático.** Una solicitud a un turno lleno se guarda como
  `en_espera` sin reservar plaza. Cuando se libera una (rechazo, cancelación o el ofertante amplía
  plazas al editar), `promoverListaEspera` (`server/src/services/plazas.ts`) recorre la cola por orden
  de llegada y pasa a `pendiente` a quien tenga plaza en **todos** sus turnos, con aviso al voluntario
  (`lista_espera_plaza`) y al ofertante. No se pide una segunda confirmación al voluntario: el
  ofertante ya acepta o rechaza, y si el voluntario no puede ir, cancela y la plaza pasa al siguiente.
  Así no hacen falta plazos ni tareas programadas. Quien espera varios turnos puede quedar detrás
  de alguien que pidió menos, porque solo entra cuando tiene plaza en todos.
- **Índice único y `syncIndexes`.** `en_espera` cuenta como inscripción activa en el índice único
  parcial (`voluntarioId` + `ofertaId`). Como cambió el filtro de ese índice, el servidor usa
  `Inscripcion.syncIndexes()` al arrancar: `init()` no modifica un índice existente con otras opciones
  y el arranque fallaría en las bases de datos ya creadas.
- **El historial sale de `inscripciones`.** Es la lista de inscripciones del voluntario en estado
  `completada`, con los datos de su oferta. No hay tabla ni atributo aparte: así incluye fecha, horas
  y valoración, y no hay dos copias que mantener.
- **Estados calculados.** Una oferta llena o con todos sus turnos pasados no cambia de estado: se
  calcula a partir de los turnos, porque ningún proceso actualizaría ese estado. El cliente la
  muestra como **Completa** cuando tiene turnos próximos pero ninguno con plazas libres
  (`estaCompleta` en `client/src/ofertas.ts`), y como **Finalizada** cuando ya no le quedan turnos
  próximos. Las plazas disponibles que se muestran suman solo los turnos próximos: las de un turno
  pasado ya no se pueden pedir.
- **Empleo en colecciones propias.** Una oferta de empleo no tiene turnos ni plazas, y una
  candidatura no reserva nada ni suma horas. Meterlas en `ofertas` e `inscripciones` habría llenado
  esos modelos de campos opcionales y de excepciones en la búsqueda, las recomendaciones y las
  estadísticas. Sí se reutilizan las categorías (sector del puesto), las islas y las modalidades.
- **El perfil de voluntariado como currículum.** La entidad no recibe un CV aparte: ve las
  estadísticas, habilidades, idiomas, intereses y acreditaciones que el voluntario ya tiene en su
  perfil, más una carta opcional. Así el voluntariado aporta algo tangible al buscar trabajo.
- **Contacto solo al preseleccionar.** Igual que en las inscripciones, el email y el teléfono del
  candidato no se envían a la entidad hasta que lo preselecciona.
- **Salario como texto libre.** Cada entidad lo expresa a su manera ("18.000 € brutos/año",
  "9,50 €/hora", "A convenir"); un rango numérico obligaría a elegir unidad y periodo.
- **Fecha límite calculada, no estado.** Como con las ofertas finalizadas, ningún proceso cerraría
  la oferta al llegar la fecha: se compara con hoy al buscar y al postularse.

## Reglas

- Email único y guardado en minúsculas. La contraseña se guarda como hash bcrypt y no se devuelve en las consultas.
- Un voluntario solo puede tener una inscripción activa en cada oferta, y solo si quedan plazas. Si
  su inscripción se canceló o se rechazó, puede volver a inscribirse.
- Un ofertante solo gestiona sus propias ofertas.
- No se puede solicitar un turno sin plazas libres. Rechazar o cancelar una inscripción devuelve la
  plaza.
- Solo se puede marcar como `completada` o `no_presentado` una inscripción `aceptada` cuyos turnos
  hayan terminado (fecha del turno + `horaFin`).
- Solo el propio voluntario cancela su inscripción, y solo antes de que empiece la actividad.
  Cancelar devuelve las plazas y avisa al ofertante (`inscripcion_cancelada`). Salir de la lista de
  espera no devuelve plazas (no tenía), nunca es tardío y no avisa al ofertante.
- La lista de espera se atiende por orden de llegada (`createdAt`).
- Las ofertas no se borran, se marcan como `cancelada`, para que el historial conserve sus datos.
- Al registrarse solo se puede elegir `voluntario` u `ofertante`, nunca `admin`.
- Una oferta necesita al menos un turno y una categoría para publicarse, y una ubicación salvo que
  sea `online`. Un borrador puede no tener nada de esto.
- Los usuarios empiezan como `activo`. `pendiente_verificacion` se usará cuando se envíen emails.
- Se guarda qué versión de los términos y la política de privacidad aceptó cada usuario (RGPD).
- Solo los voluntarios se postulan a ofertas de empleo, y solo mientras la oferta esté `publicada`
  y no haya pasado su fecha límite (incluida).
- Un voluntario solo puede tener una candidatura activa (`pendiente`, `preseleccionada` o
  `descartada`) en cada oferta de empleo. Si la retiró, puede volver a postularse; si se la
  descartaron, no. Lo garantiza un índice único parcial (`candidatoId` + `ofertaEmpleoId`).
- Solo la entidad que publicó la oferta ve sus candidaturas y decide sobre ellas. Las retiradas no
  se le muestran.
- Una oferta de empleo cerrada no se puede volver a abrir. Al cerrarla se avisa a los candidatos que
  seguían en el proceso (`oferta_cerrada`).

## Notas de implementación

- **Búsqueda.** `textoBusqueda` une título, descripción, organización y ubicación, en minúsculas y sin
  tildes, y se consulta con el término normalizado igual. Un índice `text` en español no encuentra
  "reforestacion" en "Reforestación" y no cubre la organización, que está en `users`.
- **Filtro por fecha.** Hay que usar `$elemMatch` sobre `turnos`. Sin él, una oferta con turnos el 10 y
  el 30 aparece al buscar entre el 15 y el 20.
- **Fechas de turno.** `fecha` guarda el día a las 00:00 UTC, y la hora va en `horaInicio` y `horaFin`.
  El cliente debe mostrarla con `timeZone: 'UTC'`: en otra zona horaria podría salir otro día.
- **Imágenes.** `imagenes` guarda rutas o URLs, no los ficheros, que hoy están en `client/public/fotos/`.
  La API todavía no permite subirlas.
- **Dirección de una oferta.** Se guarda, pero la API pública no la devuelve ni busca en ella, porque puede
  ser un domicilio. Se mostrará a los voluntarios aceptados cuando existan las inscripciones.
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
