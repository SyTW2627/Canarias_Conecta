/**
 * Gestiona las consultas de inscripciones del voluntario autenticado.
 */
import type { Request, Response } from 'express'
import { Inscripcion } from '../models/Inscripcion.js'
import { Oferta } from '../models/Oferta.js'
import { User } from '../models/User.js'
import { notificar } from '../services/notificaciones.js'
import { isObjectIdOrHexString } from 'mongoose'

const MOTIVO_MAX = 500

type Turno = {
  _id: { toString(): string }
  fecha: Date
  horaInicio: string
  horaFin: string
}

type OfertaPoblada = {
  id: string
  titulo: string
  ofertanteId: { nombre: string }
  turnos: Turno[]
}

function horasEntre(horaInicio: string, horaFin: string): number {
  const [inicioHoras, inicioMinutos] = horaInicio.split(':').map(Number)
  const [finHoras, finMinutos] = horaFin.split(':').map(Number)
  return (finHoras * 60 + finMinutos - inicioHoras * 60 - inicioMinutos) / 60
}

function fechaMasReciente(turnos: Turno[]): Date | null {
  return turnos.reduce<Date | null>(
    (reciente, turno) => (!reciente || turno.fecha > reciente ? turno.fecha : reciente),
    null,
  )
}

// POST /api/inscripciones -> crea una inscripcion y reserva los turnos elegidos
export async function crearInscripcion(req: Request, res: Response): Promise<void> {
  if (!req.usuario) {
    res.status(401).json({ message: 'Debes iniciar sesión' })
    return
  }

  const { ofertaId, turnoIds } = req.body ?? {}
  if (
    typeof ofertaId !== 'string' ||
    !isObjectIdOrHexString(ofertaId) ||
    !Array.isArray(turnoIds) ||
    turnoIds.length === 0 ||
    turnoIds.some((turnoId) => typeof turnoId !== 'string' || !isObjectIdOrHexString(turnoId))
  ) {
    res.status(400).json({ message: 'La oferta y los turnos seleccionados no son válidos' })
    return
  }

  const idsUnicos = [...new Set(turnoIds)]

  try {
    const oferta = await Oferta.findOne({ _id: ofertaId, estado: 'publicada' })
    if (!oferta) {
      res.status(404).json({ message: 'La oferta no existe o ya no está publicada' })
      return
    }

    const turnos = oferta.turnos.filter((turno) =>
      idsUnicos.some((turnoId) => turnoId === turno._id.toString()),
    )
    const hoy = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
    if (
      turnos.length !== idsUnicos.length ||
      turnos.some((turno) => turno.fecha < hoy || turno.plazasLibres < 1)
    ) {
      res.status(409).json({ message: 'Alguno de los turnos ya no está disponible' })
      return
    }

    const inscripcion = await Inscripcion.create({
      voluntarioId: req.usuario.id,
      ofertaId: oferta.id,
      ofertanteId: oferta.ofertanteId,
      turnoIds: idsUnicos,
      estado: 'pendiente',
    })

    const ofertaActualizada = await Oferta.findOneAndUpdate(
      {
        _id: oferta.id,
        estado: 'publicada',
        $and: idsUnicos.map((turnoId) => ({
          turnos: { $elemMatch: { _id: turnoId, plazasLibres: { $gte: 1 } } },
        })),
      },
      { $inc: { 'turnos.$[turno].plazasLibres': -1 } },
      { arrayFilters: [{ 'turno._id': { $in: idsUnicos } }], returnDocument: 'after' },
    )

    if (!ofertaActualizada) {
      await Inscripcion.findByIdAndDelete(inscripcion.id)
      res.status(409).json({ message: 'Alguno de los turnos ya no está disponible' })
      return
    }

    await notificar({
      usuarioId: oferta.ofertanteId,
      tipo: 'inscripcion_nueva',
      titulo: 'Nueva solicitud de voluntariado',
      mensaje: `${req.usuario.nombre} quiere participar en "${oferta.titulo}".`,
      enlace: `/gestionar-ofertas/${oferta.id}/candidatos`,
    })

    res.status(201).json({ id: inscripcion.id, estado: inscripcion.estado })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Ya estás inscrito en esta oferta' })
      return
    }
    console.error('Error al crear la inscripción:', error)
    res.status(500).json({ message: 'No se pudo completar la inscripción' })
  }
}

// GET /api/inscripciones/mias -> historial del voluntario autenticado
export async function getMisInscripciones(req: Request, res: Response): Promise<void> {
  if (!req.usuario) {
    res.status(401).json({ message: 'Debes iniciar sesión' })
    return
  }

  try {
    const inscripciones = await Inscripcion.find({ voluntarioId: req.usuario.id })
      .sort({ createdAt: -1 })
      .populate<{ ofertaId: OfertaPoblada }>({
        path: 'ofertaId',
        select: 'titulo ofertanteId turnos',
        populate: { path: 'ofertanteId', select: 'nombre' },
      })

    const historial = inscripciones
      .filter((inscripcion) => inscripcion.ofertaId)
      .map((inscripcion) => {
        const oferta = inscripcion.ofertaId
        const turnos = oferta.turnos.filter((turno) =>
          inscripcion.turnoIds.some((turnoId) => turnoId.toString() === turno._id.toString()),
        )
        const fecha = fechaMasReciente(turnos)
        const horas = inscripcion.horasRealizadas ?? turnos.reduce(
          (total, turno) => total + horasEntre(turno.horaInicio, turno.horaFin),
          0,
        )

        return {
          id: inscripcion.id,
          ofertaId: oferta.id,
          titulo: oferta.titulo,
          organizador: oferta.ofertanteId.nombre,
          fecha: fecha?.toISOString() ?? null,
          horas,
          estado: inscripcion.estado,
          motivoRechazo: inscripcion.motivoRechazo ?? null,
          valoracion: inscripcion.valoracionAlVoluntario
            ? {
                puntuacion: inscripcion.valoracionAlVoluntario.puntuacion,
                comentario: inscripcion.valoracionAlVoluntario.comentario ?? null,
              }
            : null,
        }
      })
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))

    res.json(historial)
  } catch (error) {
    console.error('Error al obtener el historial del voluntario:', error)
    res.status(500).json({ message: 'No se pudo cargar el historial' })
  }
}

type VoluntarioPoblado = {
  id: string
  nombre: string
  email: string
  telefono?: string
  avatarUrl?: string
  isla?: string
  municipio?: string
  voluntario?: {
    fechaNacimiento?: Date
    biografia?: string
    interesIds: Array<{ id: string; nombre: string }>
    habilidades: string[]
    idiomas: string[]
    estadisticas?: {
      horasTotales?: number
      colaboraciones?: number
      valoracionMedia?: number
      numValoraciones?: number
    }
  }
}

function edadDesde(fechaNacimiento?: Date): number | null {
  if (!fechaNacimiento) return null
  const hoy = new Date()
  let edad = hoy.getUTCFullYear() - fechaNacimiento.getUTCFullYear()
  const mes = hoy.getUTCMonth() - fechaNacimiento.getUTCMonth()
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < fechaNacimiento.getUTCDate())) edad--
  return edad
}

// GET /api/inscripciones/oferta/:ofertaId -> candidatos de una oferta propia con su perfil
export async function getCandidatosOferta(req: Request, res: Response): Promise<void> {
  const { ofertaId } = req.params

  if (!isObjectIdOrHexString(ofertaId)) {
    res.status(404).json({ message: 'La oferta no existe o no es tuya' })
    return
  }

  try {
    const oferta = await Oferta.findOne({ _id: ofertaId, ofertanteId: req.usuario!.id })
    if (!oferta) {
      res.status(404).json({ message: 'La oferta no existe o no es tuya' })
      return
    }

    const inscripciones = await Inscripcion.find({ ofertaId: oferta.id })
      .sort({ createdAt: 1 })
      .populate<{ voluntarioId: VoluntarioPoblado | null }>({
        path: 'voluntarioId',
        model: User,
        select: 'nombre email telefono avatarUrl isla municipio voluntario',
        populate: { path: 'voluntario.interesIds', select: 'nombre' },
      })

    const candidatos = inscripciones
      .filter((inscripcion) => inscripcion.voluntarioId)
      .map((inscripcion) => {
        const voluntario = inscripcion.voluntarioId!
        const perfil = voluntario.voluntario
        // El contacto solo se comparte con la entidad una vez aceptado el voluntario
        const compartirContacto = ['aceptada', 'completada'].includes(inscripcion.estado)

        return {
          id: inscripcion.id,
          estado: inscripcion.estado,
          mensaje: inscripcion.mensaje ?? null,
          motivoRechazo: inscripcion.motivoRechazo ?? null,
          fechaSolicitud: inscripcion.createdAt,
          fechaResolucion: inscripcion.fechaResolucion ?? null,
          turnoIds: inscripcion.turnoIds.map((turnoId) => turnoId.toString()),
          voluntario: {
            id: voluntario.id,
            nombre: voluntario.nombre,
            avatarUrl: voluntario.avatarUrl ?? null,
            isla: voluntario.isla ?? null,
            municipio: voluntario.municipio ?? null,
            edad: edadDesde(perfil?.fechaNacimiento),
            biografia: perfil?.biografia ?? null,
            intereses: (perfil?.interesIds ?? []).map(({ id, nombre }) => ({ id, nombre })),
            habilidades: perfil?.habilidades ?? [],
            idiomas: perfil?.idiomas ?? [],
            estadisticas: {
              horasTotales: perfil?.estadisticas?.horasTotales ?? 0,
              colaboraciones: perfil?.estadisticas?.colaboraciones ?? 0,
              valoracionMedia: perfil?.estadisticas?.valoracionMedia ?? 0,
              numValoraciones: perfil?.estadisticas?.numValoraciones ?? 0,
            },
            email: compartirContacto ? voluntario.email : null,
            telefono: compartirContacto ? (voluntario.telefono ?? null) : null,
          },
        }
      })

    res.json(candidatos)
  } catch (error) {
    console.error('Error al obtener los candidatos de la oferta:', error)
    res.status(500).json({ message: 'No se pudieron cargar los candidatos' })
  }
}

// PATCH /api/inscripciones/:id/aceptar y /rechazar -> el ofertante resuelve una solicitud pendiente
async function resolverInscripcion(
  req: Request,
  res: Response,
  decision: 'aceptada' | 'rechazada',
): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: 'La inscripción no existe' })
    return
  }

  const motivo = req.body?.motivo
  if (motivo !== undefined && motivo !== null && typeof motivo !== 'string') {
    res.status(400).json({ message: 'El motivo no es válido' })
    return
  }
  const motivoLimpio = typeof motivo === 'string' && motivo.trim() ? motivo.trim() : undefined
  if (motivoLimpio && motivoLimpio.length > MOTIVO_MAX) {
    res.status(400).json({ message: `El motivo no puede superar los ${MOTIVO_MAX} caracteres` })
    return
  }

  try {
    // El filtro incluye el estado: si llegan dos decisiones a la vez, solo se aplica una
    const inscripcion = await Inscripcion.findOneAndUpdate(
      { _id: id, ofertanteId: req.usuario!.id, estado: 'pendiente' },
      {
        estado: decision,
        fechaResolucion: new Date(),
        ...(decision === 'rechazada' && motivoLimpio && { motivoRechazo: motivoLimpio }),
      },
      { returnDocument: 'after' },
    )

    if (!inscripcion) {
      const existe = await Inscripcion.exists({ _id: id, ofertanteId: req.usuario!.id })
      res
        .status(existe ? 409 : 404)
        .json({ message: existe ? 'Esta solicitud ya se ha resuelto' : 'La inscripción no existe' })
      return
    }

    // Al rechazar, las plazas que reservo la solicitud vuelven a quedar libres
    if (decision === 'rechazada') {
      await Oferta.updateOne(
        { _id: inscripcion.ofertaId },
        { $inc: { 'turnos.$[turno].plazasLibres': 1 } },
        { arrayFilters: [{ 'turno._id': { $in: inscripcion.turnoIds } }] },
      )
    }

    const oferta = await Oferta.findById(inscripcion.ofertaId).select('titulo')
    const titulo = oferta?.titulo ?? 'una oferta'
    await notificar({
      usuarioId: inscripcion.voluntarioId,
      tipo: decision === 'aceptada' ? 'inscripcion_aceptada' : 'inscripcion_rechazada',
      titulo: decision === 'aceptada' ? 'Solicitud aceptada' : 'Solicitud rechazada',
      mensaje:
        decision === 'aceptada'
          ? `${req.usuario!.nombre} ha aceptado tu solicitud para "${titulo}".`
          : `${req.usuario!.nombre} ha rechazado tu solicitud para "${titulo}".` +
            (motivoLimpio ? ` Motivo: ${motivoLimpio}` : ''),
      enlace: '/mis_inscripciones',
    })

    res.json({ id: inscripcion.id, estado: inscripcion.estado })
  } catch (error) {
    console.error('Error al resolver la inscripción:', error)
    res.status(500).json({ message: 'No se pudo actualizar la solicitud' })
  }
}

export function aceptarInscripcion(req: Request, res: Response): Promise<void> {
  return resolverInscripcion(req, res, 'aceptada')
}

export function rechazarInscripcion(req: Request, res: Response): Promise<void> {
  return resolverInscripcion(req, res, 'rechazada')
}
