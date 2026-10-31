<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Explica el diseño de la base de datos y las decisiones de modelado.
-->
# Diseño de la base de datos

Base de datos MongoDB `canarias_conecta`, accedida desde el servidor con Mongoose.

| Diagrama | Contenido |
|---|---|
| [`modelo-conceptual.puml`](modelo-conceptual.puml) | Entidades, atributos y relaciones del dominio, sin depender del SGBD |
| [`modelo-mongodb.puml`](modelo-mongodb.puml) | Colecciones, subdocumentos embebidos, referencias, enumerados e índices |
| [`estados.puml`](estados.puml) | Ciclo de vida de `Oferta` e `Inscripcion` |

Para verlos: extensión *PlantUML* de VS Code (`Alt+D`), <https://www.plantuml.com/plantuml> o
`java -jar plantuml.jar docs/db/*.puml`.

## Dominio

Sale de lo que ya hay en la app (home, registro y modelo `User`):

1. Un **ofertante** (ONG, asociación, ayuntamiento…) publica **ofertas** de voluntariado de una
   jornada o un periodo corto, organizadas en **turnos** con fecha, horario y plazas.
2. Un **voluntario** filtra por isla, categoría, fecha y horario, y se **inscribe** en uno o varios turnos.
3. El ofertante **acepta o rechaza** la inscripción y, al terminar, confirma la asistencia y las horas.
4. Cada colaboración completada queda en la **trayectoria** del voluntario con su **valoración**
   (y el voluntario también puede valorar la oferta).
5. El botón *Necesito ayuda* genera una **solicitud de ayuda** que un admin/ofertante puede convertir en oferta.

## Colecciones

| Colección | Qué guarda | Crece con |
|---|---|---|
| `users` | Cuenta, perfil de voluntario u ofertante, consentimientos RGPD | usuarios |
| `categorias` | Catálogo de intereses (medio ambiente, mayores, animales…) | fijo |
| `ofertas` | Oferta + sus turnos + ubicación | ofertas |
| `inscripciones` | Relación voluntario–oferta, su estado y las 2 valoraciones | participación |
| `solicitudes_ayuda` | Peticiones del botón *Necesito ayuda* | peticiones |
| `notificaciones` | Avisos al usuario (inscripción aceptada, oferta cancelada…) | eventos (TTL 90 días) |
| `tokens` | Verificación de email y recuperación de contraseña | temporal (TTL) |

## Decisiones de modelado

**Embeber vs. referenciar.** Se embebe lo que se lee siempre junto al padre y está acotado;
se referencia lo que crece sin límite o se consulta desde varios lados.

- *Embebidos:* perfil de voluntario/ofertante, disponibilidad, consentimientos (en `users`);
  turnos y ubicación (en `ofertas`); valoraciones (en `inscripciones`, máximo 2).
- *Referenciados:* ofertas → ofertante, inscripciones → voluntario/oferta, notificaciones → usuario.
  Una oferta puede tener cientos de inscripciones, así que van en su propia colección.

**Un solo `users` con el perfil según el rol.** Mantiene compatible el modelo `User` actual
(`nombre`, `email`, `password`, `rol`) y el login no necesita saber el tipo de usuario. Se
implementaría con *discriminators* de Mongoose (`discriminatorKey: 'rol'`) o con los subdocumentos
`voluntario` / `ofertante`. El `nombre` actual pasaría a `voluntario.nombre` o `ofertante.nombreEntidad`
(o se mantiene arriba como nombre visible).

**Valoraciones dentro de la inscripción.** Una valoración solo tiene sentido sobre una colaboración
completada, y como mucho hay una en cada sentido. Así se evita otra colección y no se puede valorar
sin haber participado.

**Campos derivados (desnormalizados).** `turnos.plazasOcupadas` y `estadisticas` (horas, nº de
colaboraciones, valoración media) se podrían calcular con agregaciones, pero se guardan para no
recalcular en cada listado. Se actualizan al cambiar el estado de una inscripción o al valorar.
`plazasOcupadas` se incrementa con un `updateOne` condicional (`plazasOcupadas < plazas`) para que
dos aceptaciones simultáneas no superen el cupo.

**`ofertanteId` copiado en `inscripciones`.** Permite listar "solicitudes pendientes de mis ofertas"
con una sola consulta indexada, sin `$lookup`.

## Reglas de integridad (validar en el servidor)

- `email` único; `password` siempre hash bcrypt y `select: false` (como ya está).
- Un voluntario solo puede inscribirse una vez por oferta (índice único `voluntarioId + ofertaId`).
- Solo se aceptan inscripciones en ofertas `publicada` y turnos futuros con plazas libres.
- Si la oferta tiene `edadMinima`, se comprueba con `voluntario.fechaNacimiento`.
- Solo se puede valorar una inscripción `completada`; `puntuacion` entre 1 y 5.
- Un ofertante solo modifica sus ofertas y las inscripciones de sus ofertas.

## Protección de datos (RGPD / LOPDGDD)

- `consentimientos` guarda qué versión de términos/privacidad aceptó cada usuario y cuándo.
- Datos mínimos: `fechaNacimiento` y `telefono` opcionales; los contactos de `solicitudes_ayuda`
  solo los ven admins y el ofertante asignado.
- Baja: `estado = eliminado` y anonimizar datos personales, conservando inscripciones y valoraciones
  anónimas para no romper las estadísticas de los ofertantes.
- Tokens guardados como hash y con caducidad automática (índice TTL).

## Pendiente de confirmar con el equipo

- ¿*Necesito ayuda* es para particulares sin cuenta, o solo para ofertantes? (ahora admite ambos).
- ¿Hace falta rol `admin` para verificar entidades y moderar? (incluido, se puede quitar).
- ¿Se permiten menores de edad? Si sí, habría que guardar la autorización del tutor.
- ¿Chat entre voluntario y ofertante? No está modelado; sería una colección `mensajes` aparte.
- ¿Certificados de horas descargables? Se pueden generar a partir de las inscripciones `completada`.
