/**
 * Gestiona las consultas de inscripciones del voluntario autenticado.
 */
import type { Request, Response } from 'express'
import { ESTADOS_INSCRIPCION, Inscripcion } from '../models/Inscripcion.js'
import { Oferta } from '../models/Oferta.js'
import { User } from '../models/User.js'
import { notificar } from '../services/notificaciones.js'
import { liberarPlazas, promoverListaEspera, reservarPlazas } from '../services/plazas.js'
import { isObjectIdOrHexString, Types } from 'mongoose'

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

// La fecha del turno es el dia a las 00:00 UTC y la hora va aparte
function instante(fecha: Date, hora: string): Date {
  const [horas, minutos] = hora.split(':').map(Number)
  return new Date(fecha.getTime() + (horas * 60 + minutos) * 60 * 1000)
}

function finDelTurno(turno: Pick<Turno, 'fecha' | 'horaFin'>): Date {
  return instante(turno.fecha, turno.horaFin)
}

// Inicio del primer turno: desde ahi se cuenta el plazo para cancelar
function inicioDeTurnos(turnos: Array<Pick<Turno, 'fecha' | 'horaInicio'>>): Date | null {
  return turnos.reduce<Date | null>((primero, turno) => {
    const inicio = instante(turno.fecha, turno.horaInicio)
    return !primero || inicio < primero ? inicio : primero
  }, null)
}

// Antelacion minima para cancelar sin que quede como cancelacion tardia
export const ANTELACION_CANCELAR_HORAS = 48
const ESTADOS_CANCELABLES: Array<(typeof ESTADOS_INSCRIPCION)[number]> = ['pendiente', 'aceptada', 'en_espera']

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
  // Si algun turno no tiene plaza, entra en la lista de espera en lugar de recibir un 409
  const listaEspera = req.body?.listaEspera === true
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
      turnos.some((turno) => turno.fecha < hoy || (!listaEspera && turno.plazasLibres < 1))
    ) {
      res.status(409).json({ message: 'Alguno de los turnos ya no está disponible' })
      return
    }

    // Se crea primero: el indice unico impide inscribirse dos veces antes de tocar las plazas
    const inscripcion = await Inscripcion.create({
      voluntarioId: req.usuario.id,
      ofertaId: oferta.id,
      ofertanteId: oferta.ofertanteId,
      turnoIds: idsUnicos,
      estado: 'pendiente',
    })

    if (!(await reservarPlazas(oferta.id, idsUnicos))) {
      if (!listaEspera) {
        await Inscripcion.findByIdAndDelete(inscripcion.id)
        res.status(409).json({ message: 'Alguno de los turnos ya no está disponible' })
        return
      }

      inscripcion.estado = 'en_espera'
      await inscripcion.save()
      // Por si se libero una plaza mientras se creaba la inscripcion
      await promoverListaEspera(oferta.id)
      const actual = await Inscripcion.findById(inscripcion.id).select('estado')
      res.status(201).json({ id: inscripcion.id, estado: actual?.estado ?? inscripcion.estado })
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

    // Posicion en la cola: cuantas personas de la misma oferta llevan esperando mas tiempo
    const posiciones = new Map<string, number>()
    for (const inscripcion of inscripciones) {
      if (inscripcion.estado !== 'en_espera' || !inscripcion.ofertaId) continue
      const delante = await Inscripcion.countDocuments({
        ofertaId: inscripcion.ofertaId.id,
        estado: 'en_espera',
        createdAt: { $lt: inscripcion.createdAt },
      })
      posiciones.set(inscripcion.id, delante + 1)
    }

    const historial = inscripciones
      .filter((inscripcion) => inscripcion.ofertaId)
      .map((inscripcion) => {
        const oferta = inscripcion.ofertaId
        const turnos = oferta.turnos.filter((turno) =>
          inscripcion.turnoIds.some((turnoId) => turnoId.toString() === turno._id.toString()),
        )
        const fecha = fechaMasReciente(turnos)
        const inicio = inicioDeTurnos(turnos)
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
          inicio: inicio?.toISOString() ?? null,
          // Turnos elegidos, para colocar la inscripcion en su dia y su hora (inicio de la app)
          turnos: turnos.map((turno) => ({
            id: turno._id.toString(),
            fecha: turno.fecha.toISOString(),
            horaInicio: turno.horaInicio,
            horaFin: turno.horaFin,
          })),
          // Se puede cancelar mientras siga activa y no haya empezado su primer turno
          puedeCancelar:
            ESTADOS_CANCELABLES.includes(inscripcion.estado) && !!inicio && inicio > new Date(),
          cancelacionTardia: inscripcion.cancelacionTardia ?? false,
          posicionEspera: posiciones.get(inscripcion.id) ?? null,
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

const PUNTUACION_MIN = 1
const PUNTUACION_MAX = 5
const COMENTARIO_VALORACION_MAX = 1000

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
        const turnos = oferta.turnos.filter((turno) =>
          inscripcion.turnoIds.some((turnoId) => turnoId.toString() === turno._id.toString()),
        )

        return {
          id: inscripcion.id,
          estado: inscripcion.estado,
          // Solo se puede confirmar la asistencia cuando han terminado todos sus turnos
          terminada: turnos.length > 0 && turnos.every((turno) => finDelTurno(turno) <= new Date()),
          horasPrevistas: turnos.reduce(
            (total, turno) => total + horasEntre(turno.horaInicio, turno.horaFin),
            0,
          ),
          horasRealizadas: inscripcion.horasRealizadas ?? null,
          valoracion: inscripcion.valoracionAlVoluntario
            ? {
                puntuacion: inscripcion.valoracionAlVoluntario.puntuacion,
                comentario: inscripcion.valoracionAlVoluntario.comentario ?? null,
              }
            : null,
          cancelacionTardia: inscripcion.cancelacionTardia ?? false,
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

// PATCH /api/inscripciones/:id/valorar -> el ofertante valora a un voluntario tras completar la actividad
export async function valorarVoluntario(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const { puntuacion, comentario } = req.body ?? {}

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: 'La inscripción no existe' })
    return
  }
  if (
    typeof puntuacion !== 'number' ||
    !Number.isInteger(puntuacion) ||
    puntuacion < PUNTUACION_MIN ||
    puntuacion > PUNTUACION_MAX
  ) {
    res.status(400).json({ message: 'La valoración debe tener entre 1 y 5 palmeras' })
    return
  }
  if (comentario !== undefined && comentario !== null && typeof comentario !== 'string') {
    res.status(400).json({ message: 'El comentario no es válido' })
    return
  }
  const comentarioLimpio = typeof comentario === 'string' && comentario.trim()
    ? comentario.trim()
    : undefined
  if (comentarioLimpio && comentarioLimpio.length > COMENTARIO_VALORACION_MAX) {
    res.status(400).json({ message: `El comentario no puede superar los ${COMENTARIO_VALORACION_MAX} caracteres` })
    return
  }

  try {
    const inscripcion = await Inscripcion.findOne({ _id: id, ofertanteId: req.usuario!.id })
    if (!inscripcion) {
      res.status(404).json({ message: 'La inscripción no existe' })
      return
    }
    if (inscripcion.estado !== 'completada') {
      res.status(409).json({ message: 'Solo puedes valorar colaboraciones completadas' })
      return
    }
    if (inscripcion.valoracionAlVoluntario) {
      res.status(409).json({ message: 'Esta colaboración ya tiene una valoración' })
      return
    }

    inscripcion.valoracionAlVoluntario = {
      autorId: new Types.ObjectId(req.usuario!.id),
      puntuacion,
      comentario: comentarioLimpio,
      fecha: new Date(),
    }
    await inscripcion.save()

    const voluntario = await User.findById(inscripcion.voluntarioId).select('voluntario')
    const estadisticas = voluntario?.voluntario?.estadisticas
    const valoracionesPrevias = estadisticas?.numValoraciones ?? 0
    const mediaPrevia = estadisticas?.valoracionMedia ?? 0
    const nuevaMedia = (mediaPrevia * valoracionesPrevias + puntuacion) / (valoracionesPrevias + 1)

    await User.updateOne(
      { _id: inscripcion.voluntarioId },
      {
        $set: {
          'voluntario.estadisticas.valoracionMedia': nuevaMedia,
          'voluntario.estadisticas.numValoraciones': valoracionesPrevias + 1,
        },
      },
    )

    await notificar({
      usuarioId: inscripcion.voluntarioId,
      tipo: 'valoracion_recibida',
      titulo: 'Has recibido una valoración',
      mensaje: `${req.usuario!.nombre} ha valorado tu colaboración con ${puntuacion} palmeras.`,
      enlace: '/perfil',
    })

    res.json({
      id: inscripcion.id,
      valoracion: { puntuacion, comentario: comentarioLimpio ?? null },
    })
  } catch (error) {
    console.error('Error al valorar al voluntario:', error)
    res.status(500).json({ message: 'No se pudo guardar la valoración' })
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
      await liberarPlazas(inscripcion)
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

const HORAS_MAX = 24 * 30

// PATCH /api/inscripciones/:id/completar -> el ofertante confirma si el voluntario participo
export async function completarInscripcion(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const { asistio, horas } = req.body ?? {}

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: 'La inscripción no existe' })
    return
  }
  if (typeof asistio !== 'boolean') {
    res.status(400).json({ message: 'Indica si el voluntario asistió' })
    return
  }
  if (
    horas !== undefined &&
    (typeof horas !== 'number' || !Number.isFinite(horas) || horas <= 0 || horas > HORAS_MAX)
  ) {
    res.status(400).json({ message: 'Las horas realizadas no son válidas' })
    return
  }

  try {
    const inscripcion = await Inscripcion.findOne({
      _id: id,
      ofertanteId: req.usuario!.id,
    })
    if (!inscripcion) {
      res.status(404).json({ message: 'La inscripción no existe' })
      return
    }
    if (inscripcion.estado !== 'aceptada') {
      res.status(409).json({ message: 'Solo se puede completar una inscripción aceptada' })
      return
    }

    const oferta = await Oferta.findById(inscripcion.ofertaId).select('titulo turnos')
    const turnos = (oferta?.turnos ?? []).filter((turno) =>
      inscripcion.turnoIds.some((turnoId) => turnoId.toString() === turno._id.toString()),
    )
    if (turnos.length === 0 || turnos.some((turno) => finDelTurno(turno) > new Date())) {
      res.status(409).json({ message: 'La actividad todavía no ha terminado' })
      return
    }

    const horasRealizadasSinRedondear = asistio
      ? (horas ?? turnos.reduce((total, turno) => total + horasEntre(turno.horaInicio, turno.horaFin), 0))
      : 0
    const horasRealizadas = Math.round(horasRealizadasSinRedondear * 100) / 100

    // El filtro incluye el estado: si llegan dos peticiones a la vez, solo una suma las horas
    const actualizada = await Inscripcion.findOneAndUpdate(
      { _id: inscripcion._id, estado: 'aceptada' },
      {
        estado: asistio ? 'completada' : 'no_presentado',
        horasRealizadas,
      },
      { returnDocument: 'after' },
    )
    if (!actualizada) {
      res.status(409).json({ message: 'Esta inscripción ya se ha completado' })
      return
    }

    if (asistio) {
      await User.updateOne(
        { _id: inscripcion.voluntarioId },
        {
          $inc: {
            'voluntario.estadisticas.horasTotales': horasRealizadas,
            'voluntario.estadisticas.colaboraciones': 1,
          },
        },
      )
      await notificar({
        usuarioId: inscripcion.voluntarioId,
        tipo: 'inscripcion_completada',
        titulo: 'Colaboración completada',
        mensaje: `${req.usuario!.nombre} ha confirmado tu participación en "${oferta?.titulo ?? 'una oferta'}". Se han sumado ${horasRealizadas} h a tu perfil.`,
        enlace: '/mis_inscripciones',
      })
    }

    res.json({ id: actualizada.id, estado: actualizada.estado, horasRealizadas })
  } catch (error) {
    console.error('Error al completar la inscripción:', error)
    res.status(500).json({ message: 'No se pudo completar la inscripción' })
  }
}

// PATCH /api/inscripciones/:id/cancelar -> el voluntario cancela su inscripcion antes de que empiece
export async function cancelarInscripcion(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: 'La inscripción no existe' })
    return
  }

  try {
    const inscripcion = await Inscripcion.findOne({ _id: id, voluntarioId: req.usuario!.id })
    if (!inscripcion) {
      res.status(404).json({ message: 'La inscripción no existe' })
      return
    }
    if (!ESTADOS_CANCELABLES.includes(inscripcion.estado)) {
      res.status(409).json({ message: 'Esta inscripción ya no se puede cancelar' })
      return
    }

    const oferta = await Oferta.findById(inscripcion.ofertaId).select('titulo ofertanteId turnos')
    const turnos = (oferta?.turnos ?? []).filter((turno) =>
      inscripcion.turnoIds.some((turnoId) => turnoId.toString() === turno._id.toString()),
    )
    const inicio = inicioDeTurnos(turnos)
    const ahora = new Date()
    if (inicio && inicio <= ahora) {
      res.status(409).json({ message: 'La actividad ya ha empezado: no se puede cancelar' })
      return
    }

    // Salir de la lista de espera no deja a nadie sin plaza: nunca es tardio
    const teniaPlaza = inscripcion.estado !== 'en_espera'
    const tardia =
      teniaPlaza &&
      !!inicio &&
      inicio.getTime() - ahora.getTime() < ANTELACION_CANCELAR_HORAS * 60 * 60 * 1000

    // El filtro incluye el estado: si llegan dos peticiones a la vez, solo una devuelve las plazas
    const cancelada = await Inscripcion.findOneAndUpdate(
      { _id: inscripcion._id, estado: inscripcion.estado },
      { estado: 'cancelada', fechaCancelacion: ahora, cancelacionTardia: tardia },
      { returnDocument: 'after' },
    )
    if (!cancelada) {
      res.status(409).json({ message: 'Esta inscripción ha cambiado: vuelve a intentarlo' })
      return
    }

    if (teniaPlaza) await liberarPlazas(cancelada)

    if (teniaPlaza) await notificar({
      usuarioId: cancelada.ofertanteId,
      tipo: 'inscripcion_cancelada',
      titulo: tardia ? 'Cancelación de última hora' : 'Inscripción cancelada',
      mensaje:
        `${req.usuario!.nombre} ha cancelado su inscripción en "${oferta?.titulo ?? 'una oferta'}".` +
        (tardia ? ` Lo ha hecho con menos de ${ANTELACION_CANCELAR_HORAS} h de antelación.` : ''),
      enlace: `/gestionar-ofertas/${cancelada.ofertaId}/candidatos`,
    })

    res.json({ id: cancelada.id, estado: cancelada.estado, cancelacionTardia: tardia })
  } catch (error) {
    console.error('Error al cancelar la inscripción:', error)
    res.status(500).json({ message: 'No se pudo cancelar la inscripción' })
  }
}
