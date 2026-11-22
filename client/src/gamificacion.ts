/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tipos y utilidades de la gamificacion (retos y ranking).
 */

export type Logro = {
  id: string
  nombre: string
  descripcion: string
  icono: string
  objetivo: number
  progreso: number
  conseguido: boolean
  fecha: string | null
  detalle: string | null
}

export type RespuestaLogros = {
  metricas: {
    horas: number
    colaboraciones: number
    islas: number
    categorias: number
    valoracionMedia: number
    numValoraciones: number
  }
  conseguidos: number
  logros: Logro[]
}

export type FilaRanking = {
  posicion: number
  nombre: string
  avatarUrl: string | null
  horas: number
  colaboraciones: number
  eresTu: boolean
}

export type RespuestaRanking = {
  mes: string
  isla: string | null
  participantes: number
  ranking: FilaRanking[]
  tuPosicion: { posicion: number; horas: number; colaboraciones: number } | null
}

// "2026-11" desplazado n meses
export function moverMes(mes: string, meses: number): string {
  const [anio, numero] = mes.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, numero - 1 + meses, 1))
  return fecha.toISOString().slice(0, 7)
}

export function mesActual(): string {
  return new Date().toISOString().slice(0, 7)
}

// "2026-11" -> "Noviembre de 2026"
export function nombreMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number)
  const texto = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, numero - 1, 1)),
  )
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function formatearHoras(horas: number): string {
  const texto = Number.isInteger(horas) ? String(horas) : horas.toFixed(1).replace('.', ',')
  return `${texto} h`
}
