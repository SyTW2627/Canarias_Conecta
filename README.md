<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Presenta el proyecto, explica como ponerlo en marcha y como se usa.
-->

# Canarias Conecta

> El voluntariado se adapta a tu tiempo, no al revés.

Plataforma web que conecta a personas voluntarias con entidades de las Islas Canarias para
colaborar en tareas solidarias de **una jornada o un periodo corto**. Proyecto de la asignatura
*Sistemas y Tecnologías Web* (Universidad de La Laguna), **equipo 18**:

- Estela Fernández Trujillo
- Airam Prieto González
- Sergio González Sánchez

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=canarias-conecta_canarias-conecta-project&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=canarias-conecta_canarias-conecta-project)
[![Coverage Status](https://coveralls.io/repos/github/SyTW2627/Canarias_Conecta/badge.svg?branch=main)](https://coveralls.io/github/SyTW2627/Canarias_Conecta?branch=main)

## Índice

- [Qué ofrece](#qué-ofrece)
- [Tecnologías](#tecnologías)
- [Puesta en marcha](#puesta-en-marcha)
- [Scripts](#scripts)
- [Tests](#tests)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Guía de usuario](#guía-de-usuario)
- [Flujo de trabajo](#flujo-de-trabajo)
- [Documentación técnica](#documentación-técnica)

## Qué ofrece

| Para voluntarios | Para entidades |
|---|---|
| Buscador de voluntariados por texto, categoría, isla, municipio y fechas | Publicar ofertas con turnos, plazas, ubicación y foto |
| Inscripción por turnos y lista de espera automática si no hay plazas | Revisar candidatos, aceptarlos o rechazarlos |
| Recomendaciones según sus intereses, islas e historial | Confirmar la asistencia (con las horas reales) y valorar al voluntario |
| Historial con horas, colaboraciones y valoraciones en palmeras | Editar, cerrar o eliminar sus ofertas |
| Ofertas de empleo: postularse con su trayectoria como currículum | Publicar ofertas de empleo y gestionar las candidaturas |
| Retos con insignias y ranking mensual de horas | Panel de inicio con sus turnos y las ofertas que necesitan voluntarios |

Los dos roles reciben **notificaciones** de todo lo que les afecta y pueden recuperar la
contraseña por correo.

## Tecnologías

| Parte | Tecnología | Carpeta |
|---|---|---|
| Cliente | React 19 + TypeScript, Vite | `client/` |
| Servidor | Node.js 22, Express 5 + TypeScript | `server/` |
| Base de datos | MongoDB 8 con Mongoose | `server/src/models/` |
| Tests | Vitest, Testing Library y Playwright | `server/tests/`, `client/src/test/`, `client/e2e/` |
| Integración continua | GitHub Actions | `.github/workflows/ci.yml` |

## Puesta en marcha

Necesitas **Node.js 22** (versión fijada en `.nvmrc`) y **MongoDB 8**. La guía completa, con la
instalación en Linux y el despliegue en producción, está en
[docs/instalacion.md](https://github.com/SyTW2627/Canarias_Conecta/blob/doc/docs/instalacion.md)
(rama `doc`).

### 1. Instalar Node.js y MongoDB (Windows)

```powershell
winget install CoreyButler.NVMforWindows
winget install MongoDB.Server
winget install MongoDB.Shell
```

Abre una terminal nueva y selecciona la versión de Node:

```powershell
nvm install 22
nvm use 22
```

### 2. Arrancar el servidor

```bash
git clone https://github.com/SyTW2627/Canarias_Conecta.git
cd Canarias_Conecta
git switch Dev

mongosh "mongodb://127.0.0.1:27017" server/db/init.js   # crea la base de datos

cd server
npm install
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
npm run seed                # usuarios, voluntariados y ofertas de empleo de ejemplo
npm run dev                 # API en http://localhost:3000
```

Comprueba que <http://localhost:3000/api/health> devuelve `"database": "conectado"`.

### 3. Arrancar el cliente

En otra terminal:

```bash
cd client
npm install
npm run dev                 # web en http://localhost:5173
```

### Usuarios de ejemplo

`npm run seed` crea estas cuentas, todas con la contraseña `Ejemplo123`:

| Rol | Email |
|---|---|
| Voluntaria | `laura@ejemplo.com` |
| Voluntario | `carlos@ejemplo.com` |
| Entidad | `horizonte@ejemplo.com` (Asociación Horizonte) |
| Entidad | `banco@ejemplo.com` (Banco de Alimentos Tenerife) |

### Variables de entorno (`server/.env`)

| Variable | Para qué sirve |
|---|---|
| `PORT` | Puerto de la API (por defecto `3000`) |
| `MONGODB_URI` | Conexión a MongoDB |
| `JWT_SECRET` | Firma de las sesiones. En producción, una cadena aleatoria larga |
| `CLIENT_URL` | URL de la web, para los enlaces de los correos |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Correo saliente. Sin `SMTP_HOST`, los correos se muestran en la consola del servidor |

### Problemas habituales

| Síntoma | Solución |
|---|---|
| `Error al conectar con MongoDB` | MongoDB no está arrancado: `Start-Service MongoDB` (Windows) o `sudo systemctl start mongod` (Linux) |
| `Falta la variable MONGODB_URI` | Falta `server/.env`: cópialo de `.env.example` |
| La web dice *No se pudo conectar con el servidor* | El servidor no está arrancado en el puerto 3000 |

## Scripts

| Carpeta | Comando | Qué hace |
|---|---|---|
| `server/` | `npm run dev` | API con recarga automática |
| `server/` | `npm run build` / `npm start` | Compila a `dist/` y lo ejecuta (producción) |
| `server/` | `npm run seed` | Añade datos de ejemplo (no duplica si se repite) |
| `server/` | `npm test` | Tests unitarios |
| `server/` | `npm run test:types` | Comprueba los tipos de los tests |
| `server/` | `npm run test:coverage` | Tests con informe de cobertura en `server/coverage/` |
| `client/` | `npm run dev` | Web con recarga automática |
| `client/` | `npm run build` | Comprueba los tipos y genera `client/dist/` |
| `client/` | `npm run lint` | ESLint |
| `client/` | `npm test` | Tests de componentes |

## Tests

```bash
cd server && npm test                 # unitarios del servidor, sin MongoDB
cd client && npm test                 # componentes con Testing Library, sin servidor

# End-to-end: con el servidor (con seed) y el cliente arrancados
cd client
npx playwright install                # solo la primera vez
npx playwright test --project=chromium
npx playwright show-report            # informe en el navegador
```

Los tests end-to-end **no escriben en la base de datos**: bloquean las peticiones que crean o
modifican datos y simulan su respuesta (ver `client/e2e/fixtures.ts`).

### Accesibilidad y usabilidad

Se comprueban las pautas WCAG 2.2 (niveles A y AA) con [axe-core](https://github.com/dequelabs/axe-core):

| Fichero | Qué prueba |
|---|---|
| `client/src/test/Accesibilidad.test.tsx` | axe sobre los componentes en jsdom, etiquetas de formularios, avisos con `role="alert"` y uso solo con teclado |
| `client/e2e/accesibilidad.spec.ts` | axe (`@axe-core/playwright`) sobre todas las pantallas y estados (errores, modales, panel de notificaciones, móvil), incluido el contraste de color |
| `client/e2e/usabilidad.spec.ts` | Navegación con teclado y foco visible, un único `h1` por pantalla, menú consistente, sin scroll horizontal a 320/375/768 px, uso táctil, mensajes de error claros y tiempo de carga |

```bash
cd client
npx vitest run src/test/Accesibilidad.test.tsx
npx playwright test accesibilidad usabilidad --project=chromium
```

GitHub Actions ejecuta en cada push el build y los tests del servidor y del cliente, el lint del
cliente y `test:types` del servidor. Antes de subir, ejecuta lo mismo en local.

## Estructura del repositorio

```text
Canarias_Conecta/
├── .github/workflows/ci.yml   integración continua
├── server/
│   ├── db/init.js             crea la base de datos
│   ├── src/
│   │   ├── index.ts           conecta con MongoDB y arranca Express
│   │   ├── app.ts             rutas de la API
│   │   ├── config/            conexión y preparación de colecciones
│   │   ├── routes/            URL -> controlador
│   │   ├── controllers/       validan, aplican las reglas y responden
│   │   ├── middleware/        sesión, roles y subida de imágenes
│   │   ├── models/            esquemas de Mongoose
│   │   ├── services/          plazas, notificaciones, correo, recomendaciones, retos
│   │   └── scripts/seed.ts    datos de ejemplo
│   └── tests/
└── client/
    ├── src/
    │   ├── App.tsx            decide qué pantalla se muestra según la URL
    │   ├── pages/             una pantalla por fichero, con su CSS
    │   ├── components/        piezas reutilizables (cabecera, tarjetas, formularios...)
    │   └── test/
    └── e2e/                   tests de Playwright
```

Para añadir una funcionalidad al servidor se crean su modelo, su controlador y su fichero de rutas,
y se registra en `app.ts`. En el cliente, la pantalla va en `pages/` y su ruta en `rutaDe()` de
`App.tsx`.

## Guía de usuario

### Crear una cuenta

En la página principal, **Registrarse**. Elige si eres **voluntario** o **entidad** (ONG,
asociación, administración...). Si olvidas la contraseña, en **Iniciar sesión** puedes pedir un
enlace para restablecerla por correo.

### Como voluntario

1. **Completa tu perfil** (**Mi perfil**): foto, intereses y acreditaciones (cursos o títulos con
   su fecha). Ahí ves también tus horas, colaboraciones, valoración media e historial. Con tus
   intereses, el inicio te muestra la sección *Recomendado para ti*.
2. **Busca un voluntariado** en **Oportunidades**, o pulsa una isla del mapa del inicio. Filtra por
   texto, categoría, isla, municipio y fechas.
3. **Inscríbete**: en el detalle de la oferta elige los turnos y pulsa **Inscribirme**. La entidad
   revisa tu solicitud y te llega una notificación cuando la acepta o la rechaza.
4. **Si no quedan plazas**, apúntate a la **lista de espera**. Cuando se libere una plaza entrarás
   automáticamente y te avisaremos.
5. **Sigue tus inscripciones** en **Mis inscripciones**. Puedes cancelar hasta que empiece la
   actividad; si lo haces con menos de **48 h** de antelación, queda como cancelación tardía.
6. **Después de la actividad**, la entidad confirma tu asistencia: las horas se suman a tu perfil y
   puede valorarte con palmeras (de 1 a 5).
7. **Empleo**: busca ofertas de trabajo de las entidades y postúlate con un mensaje. La entidad ve
   tu trayectoria de voluntariado; tu email y tu teléfono solo se comparten si te preselecciona.
   Sigue el estado en la pestaña **Mis candidaturas**.
8. **Retos**: cada colaboración suma para conseguir insignias (primeras horas, varias islas, buenas
   valoraciones...). El ranking mensual muestra quién ha hecho más horas, en todas las islas o en
   una.

### Como entidad

1. **Completa tu perfil** (**Mi perfil**): tipo de entidad, descripción, web y persona de contacto.
2. **Publica un voluntariado** en **Gestionar ofertas → Publicar voluntariado**: título,
   descripción, categorías, modalidad, ubicación, requisitos, foto y uno o varios **turnos** con su
   fecha, horario y plazas.
3. **Revisa los candidatos** desde **Ver candidatos** en cada oferta: su perfil, horas y
   valoraciones. Acepta o rechaza cada solicitud; al aceptarla ves su email y su teléfono.
4. **Cuando termina la actividad**, confirma si cada voluntario asistió (puedes ajustar las horas) y
   valóralo.
5. **Gestiona tus ofertas**: edítalas mientras estén activas (sin bajar de las plazas ya ocupadas),
   ciérralas o elimínalas. Al cerrar una oferta se avisa a los inscritos.
6. **Empleo**: publica ofertas de trabajo (contrato, jornada, salario, vacantes y fecha límite).
   En cada oferta revisas las candidaturas y **preseleccionas** o **descartas** a cada candidato.

## Flujo de trabajo

- `main`: versiones cerradas de cada sprint.
- `Dev`: el sprint en curso. Cada tarea se desarrolla en una rama local `feature/SCRUM-NN-...` que
  sale de `Dev` y se fusiona en ella; en el repositorio remoto solo están `main`, `Dev`, `doc` y las
  ramas personales del equipo.
- `doc`: documentación técnica. Va aparte y no se fusiona.
- Las tareas se gestionan en Jira con el prefijo `SCRUM-`.

## Documentación técnica

La documentación detallada está en la rama
[`doc`](https://github.com/SyTW2627/Canarias_Conecta/tree/doc/docs):

| Documento | Contenido |
|---|---|
| [API.md](https://github.com/SyTW2627/Canarias_Conecta/blob/doc/docs/API.md) | Todos los endpoints de la API REST, con ejemplos y errores |
| [arquitectura.md](https://github.com/SyTW2627/Canarias_Conecta/blob/doc/docs/arquitectura.md) | Organización del cliente y del servidor, rutas y autenticación |
| [base-de-datos.md](https://github.com/SyTW2627/Canarias_Conecta/blob/doc/docs/base-de-datos.md) | Colecciones, estados, decisiones de diseño y reglas |
| [instalacion.md](https://github.com/SyTW2627/Canarias_Conecta/blob/doc/docs/instalacion.md) | Instalación, tests y despliegue en producción |
| [diagramas/](https://github.com/SyTW2627/Canarias_Conecta/tree/doc/docs/diagramas) | Modelo conceptual, modelo de MongoDB y arquitectura (PlantUML) |
