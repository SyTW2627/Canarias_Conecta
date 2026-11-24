/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gamificacion: retos del voluntario calculados a partir de su actividad (horas,
 *          colaboraciones, islas, categorias y valoraciones) y aviso al conseguir cada uno.
 */

import type { Types } from 'mongoose'
import { Inscripcion } from '../models/Inscripcion.js'
import { User } from '../models/User.js'
import { notificar } from './notificaciones.js'

// Lo que se mide de cada voluntario. Sale de sus estadisticas y de sus colaboraciones completadas
export type Metricas = {
  horas: number
  colaboraciones: number
  // Islas y categorias distintas de las ofertas en las que ha colaborado
  islas: number
  categorias: number
  valoracionMedia: number
  numValoraciones: number
}

type DefinicionLogro = {
  id: string
  nombre: string
  descripcion: string
  icono: string
  objetivo: number
  valor: (metricas: Metricas) => number
  // Condicion adicional al objetivo (p. ej. una media minima)
  requisito?: (metricas: Metricas) => boolean
  detalle?: (metricas: Metricas) => string
}

export const MEDIA_EXCELENTE = 4.5

// El id no debe cambiar nunca: es lo que se guarda en voluntario.logros
export const LOGROS: readonly DefinicionLogro[] = [
  {
    id: 'primera-colaboracion',
    nombre: 'Primer paso',
    descripcion: 'Completa tu primera colaboración',
    icono: '🌱',
    objetivo: 1,
    valor: (m) => m.colaboraciones
  },
  {
    id: 'colaboraciones-5',
    nombre: 'Constante',
    descripcion: 'Completa 5 colaboraciones',
    icono: '🤝',
    objetivo: 5,
    valor: (m) => m.colaboraciones
  },
  {
    id: 'colaboraciones-20',
    nombre: 'Imprescindible',
    descripcion: 'Completa 20 colaboraciones',
    icono: '🏅',
    objetivo: 20,
    valor: (m) => m.colaboraciones
  },
  {
    id: 'horas-10',
    nombre: 'Diez horas',
    descripcion: 'Suma 10 horas de voluntariado',
    icono: '⏱️',
    objetivo: 10,
    valor: (m) => m.horas
  },
  {
    id: 'horas-50',
    nombre: 'Medio centenar',
    descripcion: 'Suma 50 horas de voluntariado',
    icono: '⭐',
    objetivo: 50,
    valor: (m) => m.horas
  },
  {
    id: 'horas-100',
    nombre: 'Cien horas',
    descripcion: 'Suma 100 horas de voluntariado',
    icono: '🏆',
    objetivo: 100,
    valor: (m) => m.horas
  },
  {
    id: 'islas-3',
    nombre: 'Isla a isla',
    descripcion: 'Colabora en 3 islas distintas',
    icono: '🏝️',
    objetivo: 3,
    valor: (m) => m.islas
  },
  {
    id: 'categorias-4',
    nombre: 'Todoterreno',
    descripcion: 'Colabora en 4 categorías distintas',
    icono: '🧭',
    objetivo: 4,
    valor: (m) => m.categorias
  },
  {
    id: 'valoracion-excelente',
    nombre: 'Cinco palmeras',
    descripcion: `Recibe 5 valoraciones con una media de ${String(MEDIA_EXCELENTE).replace('.', ',')} palmeras o más`,
    icono: '🌴',
    objetivo: 5,
    valor: (m) => m.numValoraciones,
    requisito: (m) => m.valoracionMedia >= MEDIA_EXCELENTE,
    detalle: (m) =>
      m.numValoraciones > 0
        ? `Media actual: ${m.valoracionMedia.toFixed(1).replace('.', ',')} palmeras`
        : 'Todavía no tienes valoraciones'
  }
]

export type LogroGuardado = { id: string; fecha: Date }

export type EstadoLogro = {
  id: string
  nombre: string
  descripcion: string
  icono: string
  objetivo: number
  // Sin pasar del objetivo, para pintar la barra de progreso
  progreso: number
  conseguido: boolean
  fecha: Date | null
  detalle: string | null
}

function cumple(logro: DefinicionLogro, metricas: Metricas): boolean {
  return logro.valor(metricas) >= logro.objetivo && (logro.requisito?.(metricas) ?? true)
}

// Un reto guardado sigue conseguido aunque despues baje la metrica (p. ej. la media)
export function calcularLogros(metricas: Metricas, guardados: LogroGuardado[]): EstadoLogro[] {
  return LOGROS.map((logro) => {
    const guardado = guardados.find(({ id }) => id === logro.id)
    return {
      id: logro.id,
      nombre: logro.nombre,
      descripcion: logro.descripcion,
      icono: logro.icono,
      objetivo: logro.objetivo,
      progreso: Math.min(Math.floor(logro.valor(metricas)), logro.objetivo),
      conseguido: Boolean(guardado) || cumple(logro, metricas),
      fecha: guardado?.fecha ?? null,
      detalle: logro.detalle?.(metricas) ?? null
    }
  })
}

// Retos que cumple ahora y aun no tiene guardados
export function logrosNuevos(metricas: Metricas, guardados: LogroGuardado[]): DefinicionLogro[] {
  return LOGROS.filter(
    (logro) => cumple(logro, metricas) && !guardados.some(({ id }) => id === logro.id)
  )
}

type OfertaDeColaboracion = {
  ubicacion?: { isla?: string } | null
  categoriaIds: Types.ObjectId[]
} | null

// Lee las metricas y los retos ya guardados del voluntario
export async function leerProgreso(
  voluntarioId: Types.ObjectId | string
): Promise<{ metricas: Metricas; guardados: LogroGuardado[] } | null> {
  const [usuario, completadas] = await Promise.all([
    User.findById(voluntarioId).select('voluntario.estadisticas voluntario.logros'),
    Inscripcion.find({ voluntarioId, estado: 'completada' })
      .select('ofertaId')
      .populate<{ ofertaId: OfertaDeColaboracion }>({ path: 'ofertaId', select: 'ubicacion categoriaIds' })
  ])

  if (!usuario) return null

  const islas = new Set<string>()
  const categorias = new Set<string>()
  for (const { ofertaId: oferta } of completadas) {
    if (oferta?.ubicacion?.isla) islas.add(oferta.ubicacion.isla)
    for (const categoria of oferta?.categoriaIds ?? []) categorias.add(categoria.toString())
  }

  const estadisticas = usuario.voluntario?.estadisticas
  return {
    metricas: {
      horas: estadisticas?.horasTotales ?? 0,
      colaboraciones: estadisticas?.colaboraciones ?? 0,
      islas: islas.size,
      categorias: categorias.size,
      valoracionMedia: estadisticas?.valoracionMedia ?? 0,
      numValoraciones: estadisticas?.numValoraciones ?? 0
    },
    guardados: (usuario.voluntario?.logros ?? []).map(({ id, fecha }) => ({ id, fecha }))
  }
}

// Se llama cuando cambia la actividad del voluntario (colaboracion completada o valoracion).
// Guarda los retos recien conseguidos y avisa de cada uno. Devuelve sus ids
export async function actualizarLogros(voluntarioId: Types.ObjectId | string): Promise<string[]> {
  const progreso = await leerProgreso(voluntarioId)
  if (!progreso) return []

  const nuevos = logrosNuevos(progreso.metricas, progreso.guardados)
  if (nuevos.length === 0) return []

  const ids = nuevos.map(({ id }) => id)
  const fecha = new Date()
  // El filtro evita guardarlos dos veces si dos acciones terminan a la vez: solo una los añade
  const { modifiedCount } = await User.updateOne(
    { _id: voluntarioId, 'voluntario.logros.id': { $nin: ids } },
    { $push: { 'voluntario.logros': { $each: ids.map((id) => ({ id, fecha })) } } }
  )
  if (modifiedCount === 0) return []

  await notificar(
    nuevos.map((logro) => ({
      usuarioId: voluntarioId,
      tipo: 'logro_conseguido' as const,
      titulo: `${logro.icono} ¡Reto conseguido!`,
      mensaje: `Has conseguido "${logro.nombre}": ${logro.descripcion.toLowerCase()}.`,
      enlace: '/retos'
    }))
  )

  return ids
}
