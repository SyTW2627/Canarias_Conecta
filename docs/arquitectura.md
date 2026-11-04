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
├── models/        esquemas de Mongoose
└── scripts/       seed con datos de ejemplo
```

Para añadir una funcionalidad se crean su modelo, su controlador y su fichero de rutas, se registra
en `index.ts` y se documenta en [`API.md`](API.md).

## Cliente

`App.tsx` muestra la pantalla pública y decide con un estado qué pantalla se ve: `publica`,
`login`, `registro` o `autenticada`. Cada pantalla tiene su `.tsx` y su `.css` en `pages/`
(`Login`, `Register` y `HomePage`). Las imágenes están en `public/fotos/`.

## Autenticación

Al registrarse o iniciar sesión, el servidor comprueba la contraseña con bcrypt y devuelve un token
JWT con `{ id, rol }`, válido 1 día. El cliente guarda el token y el usuario en `localStorage`.
Todavía no hay rutas protegidas. Cuando las haya, recibirán el token en la cabecera
`Authorization: Bearer <token>`.

## Ramas

`main` guarda las versiones cerradas, `Dev` el sprint en curso y cada tarea va en una
`feature/SCRUM-NN-...` que sale de `Dev`. La rama `doc` contiene esta documentación, va aparte y no
se fusiona.

Los diagramas `.puml` se ven con la extensión *PlantUML* de VS Code (`Alt+D`) o en
<https://www.plantuml.com/plantuml>.
