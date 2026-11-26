/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Recomienda a la entidad los voluntarios mas compatibles con una de sus ofertas
 * y le permite invitarles a inscribirse con una notificacion.
 */

import type { Request, Response } from 'express'
import { isObjectIdOrHexString, type Types } from 'mongoose'
import { Inscripcion } from '../models/Inscripcion.js'
import { Notificacion } from '../models/Notificacion.js'
import { Oferta } from '../models/Oferta.js'
import { User } from '../models/User.js'
import { perfilPublicoVoluntario, edadDesde, type VoluntarioPoblado } from '../services/perfilVoluntario.js'
import { recomendarVoluntarios, type OfertaParaVoluntarios } from '../services/recomendaciones.js'
import { hoyEnUtc } from './ofertaController.js'

const MENSAJE_NO_EXISTE = 'La oferta no existe o no es tuya'
const MENSAJE_NO_ACTIVA =
  'Solo se pueden buscar voluntarios para ofertas publicadas con turnos próximos y plazas libres'
export const MENSAJE_INVITACION_MAX = 300

type OfertaPropia = {
  id: string
  titulo: string
  estado: string
  modalidad: string
  edadMinima?: number
  ubicacion?: { isla: string } | null
  categoriaIds: Array<{ _id: Types.ObjectId; id: string; nombre: string }>
  turnos: Array<{ fecha: Date; horaInicio: string; horaFin: string; plazasLibres: number }>
}

const enlaceDeOferta = (ofertaId: string) => `/ofertas/${ofertaId}`

// Busca la oferta del ofertante y la prepara para puntuar. null si no existe o no es suya;
// "activa" indica si aun se puede invitar a alguien (publicada con turnos futuros con plazas)
async function cargarOfertaPropia(req: Request) {
  const { id } = req.params
  if (typeof id !== 'string' || !isObjectIdOrHexString(id)) return null

  const oferta = (await Oferta.findOne({ _id: id, ofertanteId: req.usuario!.id }).populate(
    'categoriaIds',
    'nombre'
  )) as unknown as OfertaPropia | null
  if (!oferta) return null

  const hoy = hoyEnUtc()
  const turnos = oferta.turnos
    .filter((turno) => turno.fecha >= hoy && turno.plazasLibres > 0)
    .map(({ fecha, horaInicio, horaFin }) => ({ fecha, horaInicio, horaFin }))

  const datos: OfertaParaVoluntarios = {
    categorias: oferta.categoriaIds.map(({ id: categoriaId, nombre }) => ({ id: categoriaId, nombre })),
    modalidad: oferta.modalidad,
    isla: oferta.ubicacion?.isla,
    edadMinima: oferta.edadMinima,
    turnos
  }

  return { oferta, datos, activa: oferta.estado === 'publicada' && turnos.length > 0 }
}

// GET /api/ofertas/mias/:id/voluntarios-recomendados -> voluntarios mas compatibles con la
// oferta, con su afinidad (0-100), los motivos y si ya se les ha invitado
export async function getVoluntariosRecomendados(req: Request, res: Response): Promise<void> {
  try {
    const cargada = await cargarOfertaPropia(req)
    if (!cargada) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }

    const { oferta, datos, activa } = cargada
    if (!activa) {
      res.status(409).json({ message: MENSAJE_NO_ACTIVA })
      return
    }

    // Quien ya tiene una inscripcion (en cualquier estado) no necesita que le inviten
    const inscritos = await Inscripcion.distinct('voluntarioId', { ofertaId: oferta.id })

    // Se descartan en la consulta los que no podrian tener ningun motivo decisivo
    const dias = [...new Set(datos.turnos.map((turno) => turno.fecha.getUTCDay()))]
    const posibles: Array<Record<string, unknown>> = [
      { 'voluntario.interesIds': { $in: oferta.categoriaIds.map(({ _id }) => _id) } },
      { 'voluntario.disponibilidad.diaSemana': { $in: dias } }
    ]
    if (datos.modalidad !== 'online' && datos.isla) {
      posibles.push({ isla: datos.isla }, { 'voluntario.islasPreferidas': datos.isla })
    }

    const voluntarios = (await User.find({
      rol: 'voluntario',
      estado: 'activo',
      _id: { $nin: inscritos },
      $or: posibles
    })
      .select('nombre avatarUrl isla municipio voluntario')
      .populate('voluntario.interesIds', 'nombre')) as unknown as VoluntarioPoblado[]

    const recomendados = recomendarVoluntarios(
      voluntarios.map((voluntario) => {
        const perfil = voluntario.voluntario
        return {
          id: voluntario.id,
          interesIds: (perfil?.interesIds ?? []).map(({ id }) => id),
          islas: [...(perfil?.islasPreferidas ?? []), ...(voluntario.isla ? [voluntario.isla] : [])],
          disponibilidad: perfil?.disponibilidad ?? [],
          edad: edadDesde(perfil?.fechaNacimiento),
          valoracionMedia: perfil?.estadisticas?.valoracionMedia ?? 0,
          numValoraciones: perfil?.estadisticas?.numValoraciones ?? 0,
          documento: voluntario
        }
      }),
      datos
    )

    const invitados = recomendados.length
      ? await Notificacion.distinct('usuarioId', {
          tipo: 'invitacion_oferta',
          enlace: enlaceDeOferta(oferta.id),
          usuarioId: { $in: recomendados.map(({ voluntario }) => voluntario.id) }
        })
      : []
    const yaInvitados = new Set(invitados.map((usuarioId) => usuarioId.toString()))

    res.json({
      oferta: { id: oferta.id, titulo: oferta.titulo },
      recomendaciones: recomendados.map(({ voluntario, afinidad, motivos }) => ({
        voluntario: perfilPublicoVoluntario(voluntario.documento),
        afinidad,
        motivos,
        invitado: yaInvitados.has(voluntario.id)
      }))
    })
  } catch (error) {
    console.error('Error al recomendar voluntarios:', error)
    res.status(500).json({ message: 'No se pudieron calcular los voluntarios recomendados' })
  }
}

// POST /api/ofertas/mias/:id/invitaciones { voluntarioId, mensaje? } -> avisa al voluntario
// de que la entidad le invita a inscribirse. Solo una invitacion por voluntario y oferta
export async function invitarVoluntario(req: Request, res: Response): Promise<void> {
  const { voluntarioId, mensaje } = (req.body ?? {}) as { voluntarioId?: unknown; mensaje?: unknown }

  if (typeof voluntarioId !== 'string' || !isObjectIdOrHexString(voluntarioId)) {
    res.status(400).json({ message: 'Indica el voluntario al que quieres invitar' })
    return
  }
  if (mensaje !== undefined && typeof mensaje !== 'string') {
    res.status(400).json({ message: 'El mensaje no es válido' })
    return
  }
  const texto = mensaje?.trim() ?? ''
  if (texto.length > MENSAJE_INVITACION_MAX) {
    res.status(400).json({ message: `El mensaje no puede superar ${MENSAJE_INVITACION_MAX} caracteres` })
    return
  }

  try {
    const cargada = await cargarOfertaPropia(req)
    if (!cargada) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }
    if (!cargada.activa) {
      res.status(409).json({ message: MENSAJE_NO_ACTIVA })
      return
    }

    const { oferta } = cargada
    const enlace = enlaceDeOferta(oferta.id)

    const voluntario = await User.findOne({ _id: voluntarioId, rol: 'voluntario', estado: 'activo' }).select('_id')
    if (!voluntario) {
      res.status(404).json({ message: 'El voluntario no existe' })
      return
    }

    const [inscrito, invitado] = await Promise.all([
      Inscripcion.exists({ ofertaId: oferta.id, voluntarioId }),
      Notificacion.exists({ usuarioId: voluntarioId, tipo: 'invitacion_oferta', enlace })
    ])
    if (inscrito) {
      res.status(409).json({ message: 'Este voluntario ya se ha inscrito en la oferta' })
      return
    }
    if (invitado) {
      res.status(409).json({ message: 'Ya has invitado a este voluntario a esta oferta' })
      return
    }

    // Se crea directamente (no con notificar): aqui el aviso es la accion, si falla debe saberse
    await Notificacion.create({
      usuarioId: voluntarioId,
      tipo: 'invitacion_oferta',
      titulo: `${req.usuario!.nombre} te invita a colaborar`,
      mensaje: texto
        ? `«${oferta.titulo}»: ${texto}`
        : `Tu perfil encaja con «${oferta.titulo}». Échale un vistazo e inscríbete si te interesa.`,
      enlace
    })

    res.status(201).json({ voluntarioId, invitado: true })
  } catch (error) {
    console.error('Error al invitar al voluntario:', error)
    res.status(500).json({ message: 'No se pudo enviar la invitación' })
  }
}
