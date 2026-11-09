/**
 * Gestiona las consultas de inscripciones del voluntario autenticado.
 */
import type { Request, Response } from 'express'
import { Inscripcion } from '../models/Inscripcion.js'
import { Oferta } from '../models/Oferta.js'
import { isObjectIdOrHexString } from 'mongoose'

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
      { arrayFilters: [{ 'turno._id': { $in: idsUnicos } }], new: true },
    )

    if (!ofertaActualizada) {
      await Inscripcion.findByIdAndDelete(inscripcion.id)
      res.status(409).json({ message: 'Alguno de los turnos ya no está disponible' })
      return
    }

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
