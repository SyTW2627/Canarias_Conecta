/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Analiza con axe-core la accesibilidad de lo renderizado en los tests (reglas WCAG 2.2 A/AA).
 */
import axe, { type Result } from 'axe-core'
import { vi } from 'vitest'

// Reglas que jsdom no puede evaluar o que no aplican a un componente suelto
const REGLAS_DESACTIVADAS = {
  // jsdom no calcula estilos ni colores reales: el contraste se comprueba en los tests e2e
  'color-contrast': { enabled: false },
  // Un componente aislado no esta dentro de los landmarks (main, nav...) de la pagina completa
  region: { enabled: false },
}

function describir(violaciones: Result[]): string {
  return violaciones
    .map((v) => `- [${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
    .join('\n')
}

// Devuelve las infracciones WCAG del contenedor; el mensaje de error dice cuales y donde
export async function infraccionesAccesibilidad(contenedor: Element = document.body): Promise<Result[]> {
  // axe usa un canvas para detectar iconos; jsdom no lo implementa y llenaria la salida de avisos
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const { violations } = await axe.run(contenedor, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: REGLAS_DESACTIVADAS,
  })
  if (violations.length) console.error(`Infracciones de accesibilidad:\n${describir(violations)}`)
  return violations
}
