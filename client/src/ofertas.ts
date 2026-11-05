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
  categorias: { id: string; nombre: string; slug: string }[]
  modalidad: string
  tipoDuracion: string
  ubicacion?: { isla: string; municipio: string; direccion?: string }
  requisitos?: string
  edadMinima?: number
  imagenes: string[]
  turnos: Turno[]
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

// Las ofertas aun no suben imagenes: se usa una foto segun su primera categoria
const IMAGENES_POR_CATEGORIA: Record<string, string> = {
  'medio-ambiente': '/fotos/reforestacion.jpg',
  'personas-mayores': '/fotos/imagen_personamayor.jpg',
  educacion: '/fotos/apoyo_escolar.jpeg',
  comunidad: '/fotos/voluntariado-2.png',
  alimentacion: '/fotos/recogida_alimentos.png',
  animales: '/fotos/voluntariado-3.png',
}

export function imagenDeOferta(oferta: Oferta): string {
  return (
    oferta.imagenes[0] ??
    IMAGENES_POR_CATEGORIA[oferta.categorias[0]?.slug] ??
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
