<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Describe el cliente web y remite al README principal.
-->

# Cliente de Canarias Conecta

Aplicación web en React 19 + TypeScript con Vite. En desarrollo se sirve en
<http://localhost:5173> y redirige `/api` al servidor (`vite.config.ts`).

```bash
npm install
npm run dev        # web con recarga automática
npm run lint       # ESLint
npm test           # tests de componentes (Vitest + Testing Library)
npm run build      # comprueba los tipos y genera dist/
npx playwright test --project=chromium   # end-to-end, con el servidor arrancado
```

La puesta en marcha completa, la guía de usuario y la estructura del proyecto están en el
[README principal](../README.md).
