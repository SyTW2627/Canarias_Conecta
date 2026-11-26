/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tipos y calculos de los catalogos paginados (oportunidades y empleo).
 */
import { useCallback, useState } from 'react'

// Respuesta paginada de la API: GET /api/ofertas?pagina=N y GET /api/empleo
export type Pagina<T> = {
  ofertas: T[]
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
}

// Numeros de pagina a mostrar: siempre la primera, la ultima y las vecinas de la actual;
// null marca un hueco ("…")
export function paginasVisibles(actual: number, total: number): (number | null)[] {
  const paginas: (number | null)[] = []
  for (let n = 1; n <= total; n++) {
    if (n === 1 || n === total || Math.abs(n - actual) <= 1 || total <= 7) {
      paginas.push(n)
    } else if (paginas.at(-1) !== null) {
      paginas.push(null)
    }
  }
  return paginas
}

// Texto "Mostrando 13–24" del tramo visible
export function rangoVisible({ pagina, porPagina }: Pagina<unknown>, enPantalla: number): string {
  const desde = (pagina - 1) * porPagina + 1
  return `Mostrando ${desde}–${desde + enPantalla - 1}`
}

// La pagina va ligada a los filtros: si cambian, se vuelve a la primera sin una peticion de mas
export function usePaginaDeFiltros(filtros: string, inicial = 1) {
  const [elegida, setElegida] = useState({ filtros, pagina: inicial })
  const pagina = elegida.filtros === filtros ? elegida.pagina : 1
  // Estable mientras no cambien los filtros: se puede usar como dependencia de un efecto
  const cambiar = useCallback((nueva: number) => setElegida({ filtros, pagina: nueva }), [filtros])
  return [pagina, cambiar] as const
}
