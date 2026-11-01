<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Explica el diseño de la base de datos de la aplicacion.
-->
# Base de datos

MongoDB `canarias_conecta`, usada desde el servidor con Mongoose. Hoy solo existe la colección
`users` (`server/src/models/User.ts`). Este documento es el diseño completo que se irá implementando.

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
- **Un solo `users` para los dos roles.** Es compatible con el modelo actual y el login no necesita
  saber qué tipo de usuario es.
- **Valoraciones dentro de la inscripción.** Solo se puede valorar una colaboración completada, y
  como mucho una vez por cada lado.
- **Contadores guardados.** Las plazas ocupadas y las estadísticas del perfil (horas, valoración
  media) se guardan para no recalcularlas en cada listado.

## Reglas

- Email único y guardado en minúsculas. La contraseña se guarda como hash bcrypt y no se devuelve en las consultas.
- Un voluntario solo puede inscribirse una vez en cada oferta, y solo si quedan plazas.
- Un ofertante solo gestiona sus propias ofertas.
- Se guarda qué versión de los términos y la política de privacidad aceptó cada usuario (RGPD).

## Pendiente de decidir

- ¿Quién puede usar *Necesito ayuda*: cualquiera o solo usuarios registrados?
- ¿Hace falta un rol `admin` para verificar entidades?
- ¿Se admiten menores de edad?
