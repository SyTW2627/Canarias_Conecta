/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tipos y textos de las ofertas compartidos por varias pantallas.
 */

export type Turno = {
  id: string
  fecha: string
  horaInicio: string
  horaFin: string
  plazas: number
  plazasLibres: number
}

export type Oferta = {
  id: string
  titulo: string
  descripcion: string
  organizacion: string
  categorias: { id: string; nombre: string; slug: string; imagen?: string }[]
  modalidad: string
  tipoDuracion: string
  ubicacion?: { isla: string; municipio: string; direccion?: string }
  requisitos?: string
  edadMinima?: number
  imagenes: string[]
  turnos: Turno[]
}

// Como la ve su propio ofertante: con su estado
export type MiOferta = Oferta & {
  estado: 'borrador' | 'publicada' | 'cerrada' | 'cancelada'
  terminada: boolean
  fechaPublicacion?: string
  creadaEn: string
  candidatosPendientes: number
}

export function cabecerasConSesion(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  }
}

export const ISLAS: Record<string, string> = {
  tenerife: 'Tenerife',
  gran_canaria: 'Gran Canaria',
  lanzarote: 'Lanzarote',
  fuerteventura: 'Fuerteventura',
  la_palma: 'La Palma',
  la_gomera: 'La Gomera',
  el_hierro: 'El Hierro',
  la_graciosa: 'La Graciosa',
}

export const MODALIDADES: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  mixta: 'Mixta',
}

export const DURACIONES: Record<string, string> = {
  jornada: 'Una jornada',
  periodo_corto: 'Periodo corto',
}

// Las imagenes llegan de la API. Sin imagen propia se usa la de su primera categoria
export function imagenDeOferta(oferta: Oferta): string {
  return (
    oferta.imagenes[0] ??
    oferta.categorias[0]?.imagen ??
    '/fotos/voluntariado-1.png'
  )
}

// La fecha llega a las 00:00 UTC: en otra zona horaria podria mostrarse el dia anterior
const FORMATO_FECHA = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

export function formatearFecha(fecha: string): string {
  const texto = FORMATO_FECHA.format(new Date(fecha))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function esTurnoProximo(turno: Turno): boolean {
  return turno.fecha.slice(0, 10) >= hoyIso()
}

// Las plazas de turnos pasados ya no se pueden pedir: solo cuentan las de los proximos
export function plazasDisponibles(oferta: Pick<Oferta, 'turnos'>): number {
  return oferta.turnos
    .filter(esTurnoProximo)
    .reduce((total, turno) => total + turno.plazasLibres, 0)
}

// Completa: tiene turnos proximos, pero ninguno con plazas libres. No es un estado guardado
export function estaCompleta(oferta: Pick<Oferta, 'turnos'>): boolean {
  return oferta.turnos.some(esTurnoProximo) && plazasDisponibles(oferta) === 0
}

export function textoPlazas(plazasLibres: number): string {
  if (plazasLibres === 0) return 'Sin plazas'
  return plazasLibres === 1 ? '1 plaza disponible' : `${plazasLibres} plazas disponibles`
}
