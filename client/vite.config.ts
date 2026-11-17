/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Configura Vite, el proxy de /api hacia el servidor y los tests con Vitest.
 */
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin:true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Los tests end-to-end de e2e/ los ejecuta Playwright, no Vitest
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    // Cada test empieza con mocks y localStorage limpios
    restoreMocks: true,
    unstubGlobals: true,
  },
})
