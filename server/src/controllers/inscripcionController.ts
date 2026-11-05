/**
 * Gestiona las consultas de inscripciones del voluntario autenticado.
 */
import type { Request, Response } from 'express'
import { Inscripcion } from '../models/Inscripcion.js'

type Turno = {
  id: string
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
          inscripcion.turnoIds.some((turnoId) => turnoId.toString() === turno.id),
        )
        const fecha = fechaMasReciente(turnos)
        const horas = inscripcion.horasRealizadas ?? turnos.reduce(
          (total, turno) => total + horasEntre(turno.horaInicio, turno.horaFin),
          0,
        )

        return {
          id: inscripcion.id,
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
