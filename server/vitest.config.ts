/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Configuracion de Vitest para los tests del servidor.
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Cada test empieza sin dobles de prueba de los anteriores
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts solo arranca el servidor y seed.ts es un script manual de datos de ejemplo
      exclude: ['src/index.ts', 'src/scripts/**'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage'
    }
  }
})
