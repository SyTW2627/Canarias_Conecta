/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona las ofertas de empleo y las candidaturas de los voluntarios.
 */

import type { Request, Response } from 'express'
import mongoose, { isObjectIdOrHexString, type QueryFilter, type Types } from 'mongoose'
import { Categoria } from '../models/Categoria.js'
import {
  Candidatura,
  ESTADOS_CANDIDATURA,
  MENSAJE_CANDIDATURA_MAX
} from '../models/Candidatura.js'
import { MODALIDADES, construirTextoBusqueda, normalizarTexto } from '../models/Oferta.js'
import {
  JORNADAS,
  OfertaEmpleo,
  TIPOS_CONTRATO,
  VACANTES_MAX,
  type OfertaEmpleoDoc
} from '../models/OfertaEmpleo.js'
import { User } from '../models/User.js'
import { notificar } from '../services/notificaciones.js'
import {
  escaparRegex,
  esIslaValida,
  hoyEnUtc,
  leerFecha,
  leerParametro
} from './ofertaController.js'

const BUSQUEDA_MAX = 100
const CONSULTA_MAX_MS = 5000
const SALARIO_MAX = 100

const MENSAJE_NO_EXISTE = 'La oferta de empleo no existe o ya no está disponible'
const MENSAJE_NO_ES_TUYA = 'La oferta de empleo no existe o no es tuya'
const MENSAJE_CANDIDATURA_NO_EXISTE = 'La candidatura no existe'

type EstadoCandidatura = (typeof ESTADOS_CANDIDATURA)[number]

function incluye<T extends string>(lista: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (lista as readonly string[]).includes(valor)
}

type DatosPoblados = {
  ofertanteId: { nombre: string } | null
  categoriaIds: Array<{ id: string; nombre: string; slug: string }>
}

// Por defecto, primero las publicadas mas recientemente
function consultarEmpleos(
  filtro: QueryFilter<OfertaEmpleoDoc>,
  orden: Record<string, 1 | -1> = { fechaPublicacion: -1 }
) {
  return OfertaEmpleo.find(filtro)
    .sort(orden)
    .maxTimeMS(CONSULTA_MAX_MS)
    .populate<DatosPoblados>([
      { path: 'ofertanteId', select: 'nombre' },
      { path: 'categoriaIds', select: 'nombre slug' }
    ])
}

type EmpleoPoblado = Awaited<ReturnType<typeof consultarEmpleos>>[number]

// Admite candidaturas si sigue publicada y no ha pasado su fecha limite (incluida)
export function admiteCandidaturas(oferta: {
  estado?: string | null
  fechaLimite?: Date | null
}): boolean {
  return oferta.estado === 'publicada' && (!oferta.fechaLimite || oferta.fechaLimite >= hoyEnUtc())
}

function serializarEmpleo(oferta: EmpleoPoblado) {
  return {
    id: oferta.id as string,
    titulo: oferta.titulo,
    descripcion: oferta.descripcion,
    organizacion: oferta.ofertanteId?.nombre ?? '',
    categorias: oferta.categoriaIds.map(({ id, nombre, slug }) => ({ id, nombre, slug })),
    tipoContrato: oferta.tipoContrato,
    jornada: oferta.jornada,
    modalidad: oferta.modalidad,
    ubicacion: oferta.ubicacion && {
      isla: oferta.ubicacion.isla,
      municipio: oferta.ubicacion.municipio
    },
    salario: oferta.salario ?? null,
    requisitos: oferta.requisitos ?? null,
    vacantes: oferta.vacantes,
    fechaLimite: oferta.fechaLimite ?? null,
    fechaPublicacion: oferta.fechaPublicacion,
    abierta: admiteCandidaturas(oferta)
  }
}

// GET /api/empleo -> ofertas de empleo que admiten candidaturas, con filtros opcionales
export async function buscarEmpleos(req: Request, res: Response): Promise<void> {
  const q = leerParametro(req.query.q)
  const isla = leerParametro(req.query.isla)
  const tipoContrato = leerParametro(req.query.tipoContrato)
  const jornada = leerParametro(req.query.jornada)
  const modalidad = leerParametro(req.query.modalidad)

  if (q && q.length > BUSQUEDA_MAX) {
    res.status(400).json({ message: `La búsqueda no puede superar los ${BUSQUEDA_MAX} caracteres` })
    return
  }
  if (isla !== undefined && !esIslaValida(isla)) {
    res.status(400).json({ message: 'La isla no es válida' })
    return
  }
  if (tipoContrato !== undefined && !incluye(TIPOS_CONTRATO, tipoContrato)) {
    res.status(400).json({ message: 'El tipo de contrato no es válido' })
    return
  }
  if (jornada !== undefined && !incluye(JORNADAS, jornada)) {
    res.status(400).json({ message: 'La jornada no es válida' })
    return
  }
  if (modalidad !== undefined && !incluye(MODALIDADES, modalidad)) {
    res.status(400).json({ message: 'La modalidad no es válida' })
    return
  }

  try {
    // Sin fecha limite, o con una de hoy en adelante
    const filtro: QueryFilter<OfertaEmpleoDoc> = {
      estado: 'publicada',
      $or: [{ fechaLimite: { $exists: false } }, { fechaLimite: { $gte: hoyEnUtc() } }]
    }

    // Ya validados contra sus listas: el cast solo informa a TypeScript
    if (isla) filtro['ubicacion.isla'] = isla
    if (tipoContrato) filtro.tipoContrato = tipoContrato as (typeof TIPOS_CONTRATO)[number]
    if (jornada) filtro.jornada = jornada as (typeof JORNADAS)[number]
    if (modalidad) filtro.modalidad = modalidad as (typeof MODALIDADES)[number]

    // Cada palabra debe aparecer, en cualquier orden, como en la busqueda de voluntariado
    if (q) {
      filtro.$and = normalizarTexto(q)
        .split(/\s+/)
        .map((palabra) => ({ textoBusqueda: new RegExp(escaparRegex(palabra)) }))
    }

    const ofertas = await consultarEmpleos(filtro)
    res.json(ofertas.map(serializarEmpleo))
  } catch (error) {
    console.error('Error al buscar ofertas de empleo:', error)
    res.status(500).json({ message: 'Error al buscar las ofertas de empleo' })
  }
}

// GET /api/empleo/:id -> detalle de una oferta de empleo publicada
export async function getEmpleo(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_EXISTE })
    return
  }

  try {
    const [oferta] = await consultarEmpleos({ _id: id, estado: 'publicada' })

    if (!oferta) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }

    res.json(serializarEmpleo(oferta))
  } catch (error) {
    console.error('Error al obtener la oferta de empleo:', error)
    res.status(500).json({ message: 'Error al obtener la oferta de empleo' })
  }
}

// POST /api/empleo -> publica una oferta de empleo del ofertante que ha iniciado sesion
export async function crearEmpleo(req: Request, res: Response): Promise<void> {
  const {
    titulo,
    descripcion,
    categoriaIds = [],
    tipoContrato,
    jornada,
    modalidad,
    ubicacion,
    salario,
    requisitos,
    vacantes = 1,
    fechaLimite
  } = (req.body ?? {}) as Record<string, any>

  if (
    typeof titulo !== 'string' || !titulo.trim() ||
    typeof descripcion !== 'string' || !descripcion.trim()
  ) {
    res.status(400).json({ message: 'El título y la descripción son obligatorios' })
    return
  }
  if (!incluye(TIPOS_CONTRATO, tipoContrato)) {
    res.status(400).json({ message: 'El tipo de contrato no es válido' })
    return
  }
  if (!incluye(JORNADAS, jornada)) {
    res.status(400).json({ message: 'La jornada no es válida' })
    return
  }
  if (!incluye(MODALIDADES, modalidad)) {
    res.status(400).json({ message: 'La modalidad no es válida' })
    return
  }
  if (!Number.isInteger(vacantes) || vacantes < 1 || vacantes > VACANTES_MAX) {
    res.status(400).json({ message: `Las vacantes deben ser un número entre 1 y ${VACANTES_MAX}` })
    return
  }
  if (
    !Array.isArray(categoriaIds) ||
    !categoriaIds.every((id) => typeof id === 'string' && isObjectIdOrHexString(id))
  ) {
    res.status(400).json({ message: 'Las categorías no son válidas' })
    return
  }
  if (salario !== undefined && salario !== null && typeof salario !== 'string') {
    res.status(400).json({ message: 'El salario no es válido' })
    return
  }
  if (typeof salario === 'string' && salario.trim().length > SALARIO_MAX) {
    res.status(400).json({ message: `El salario no puede superar los ${SALARIO_MAX} caracteres` })
    return
  }

  let fechaLimiteLeida: Date | undefined
  if (fechaLimite !== undefined && fechaLimite !== null && fechaLimite !== '') {
    const fecha = typeof fechaLimite === 'string' ? leerFecha(fechaLimite) : null
    if (!fecha) {
      res.status(400).json({ message: 'La fecha límite debe tener el formato AAAA-MM-DD' })
      return
    }
    if (fecha < hoyEnUtc()) {
      res.status(400).json({ message: 'La fecha límite no puede ser pasada' })
      return
    }
    fechaLimiteLeida = fecha
  }

  // Solo se copian estos campos: el resto del body nunca llega a la base de datos
  const ubicacionRecibida =
    modalidad !== 'online' && ubicacion && typeof ubicacion === 'object'
      ? { isla: ubicacion.isla, municipio: ubicacion.municipio }
      : undefined

  if (modalidad !== 'online') {
    if (!ubicacionRecibida) {
      res.status(400).json({ message: 'La oferta necesita una ubicación' })
      return
    }
    if (!esIslaValida(String(ubicacionRecibida.isla))) {
      res.status(400).json({ message: 'La isla no es válida' })
      return
    }
    if (typeof ubicacionRecibida.municipio !== 'string' || !ubicacionRecibida.municipio.trim()) {
      res.status(400).json({ message: 'El municipio es obligatorio' })
      return
    }
  }

  try {
    const idsUnicos = [...new Set<string>(categoriaIds)]
    if (idsUnicos.length > 0) {
      const existentes = await Categoria.countDocuments({ _id: { $in: idsUnicos }, activa: true })
      if (existentes !== idsUnicos.length) {
        res.status(400).json({ message: 'Las categorías no son válidas' })
        return
      }
    }

    const usuario = req.usuario!
    const salarioLimpio = typeof salario === 'string' && salario.trim() ? salario.trim() : undefined
    const requisitosLimpios =
      typeof requisitos === 'string' && requisitos.trim() ? requisitos.trim() : undefined

    const oferta = await OfertaEmpleo.create({
      ofertanteId: usuario.id,
      titulo,
      descripcion,
      categoriaIds: idsUnicos,
      tipoContrato,
      jornada,
      modalidad,
      ubicacion: ubicacionRecibida,
      salario: salarioLimpio,
      requisitos: requisitosLimpios,
      vacantes,
      fechaLimite: fechaLimiteLeida,
      textoBusqueda: construirTextoBusqueda([
        titulo,
        descripcion,
        usuario.nombre,
        ubicacionRecibida?.municipio
      ]),
      estado: 'publicada',
      fechaPublicacion: new Date()
    })

    res.status(201).json({ id: oferta.id, estado: oferta.estado })
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Los datos de la oferta de empleo no son válidos' })
      return
    }
    console.error('Error al crear la oferta de empleo:', error)
    res.status(500).json({ message: 'Error al crear la oferta de empleo' })
  }
}

// GET /api/empleo/mias -> ofertas de empleo del ofertante, con el numero de candidaturas
export async function getMisEmpleos(req: Request, res: Response): Promise<void> {
  try {
    const [ofertas, conteos] = await Promise.all([
      consultarEmpleos({ ofertanteId: req.usuario!.id }, { createdAt: -1 }),
      Candidatura.aggregate<{ _id: Types.ObjectId; total: number; pendientes: number }>([
        {
          $match: {
            ofertanteId: new mongoose.Types.ObjectId(req.usuario!.id),
            estado: { $ne: 'retirada' }
          }
        },
        {
          $group: {
            _id: '$ofertaEmpleoId',
            total: { $sum: 1 },
            pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] } }
          }
        }
      ])
    ])

    const porOferta = new Map(conteos.map((conteo) => [conteo._id.toString(), conteo]))

    res.json(
      ofertas.map((oferta) => ({
        ...serializarEmpleo(oferta),
        estado: oferta.estado,
        candidaturas: porOferta.get(oferta.id)?.total ?? 0,
        candidaturasPendientes: porOferta.get(oferta.id)?.pendientes ?? 0
      }))
    )
  } catch (error) {
    console.error('Error al obtener las ofertas de empleo del ofertante:', error)
    res.status(500).json({ message: 'Error al obtener tus ofertas de empleo' })
  }
}

// PATCH /api/empleo/:id/cerrar -> deja de admitir candidaturas y de mostrarse
export async function cerrarEmpleo(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_ES_TUYA })
    return
  }

  try {
    // El filtro incluye el estado: si llegan dos peticiones a la vez, solo una la cierra
    const oferta = await OfertaEmpleo.findOneAndUpdate(
      { _id: id, ofertanteId: req.usuario!.id, estado: 'publicada' },
      { estado: 'cerrada' },
      { returnDocument: 'after' }
    )

    if (!oferta) {
      const existe = await OfertaEmpleo.exists({ _id: id, ofertanteId: req.usuario!.id })
      res
        .status(existe ? 409 : 404)
        .json({ message: existe ? 'La oferta de empleo ya está cerrada' : MENSAJE_NO_ES_TUYA })
      return
    }

    // Avisa a quien seguia en el proceso de seleccion
    const afectadas = await Candidatura.find({
      ofertaEmpleoId: oferta._id,
      estado: { $in: ['pendiente', 'preseleccionada'] }
    }).select('candidatoId')
    await notificar(
      afectadas.map((candidatura) => ({
        usuarioId: candidatura.candidatoId,
        tipo: 'oferta_cerrada' as const,
        titulo: 'Oferta de empleo cerrada',
        mensaje: `${req.usuario!.nombre} ha cerrado la oferta de empleo "${oferta.titulo}".`,
        enlace: '/empleo'
      }))
    )

    res.json({ id: oferta.id, estado: oferta.estado })
  } catch (error) {
    console.error('Error al cerrar la oferta de empleo:', error)
    res.status(500).json({ message: 'Error al cerrar la oferta de empleo' })
  }
}

// POST /api/empleo/:id/candidaturas -> el voluntario se postula, con una carta opcional
export async function crearCandidatura(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const mensaje = req.body?.mensaje

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_EXISTE })
    return
  }
  if (mensaje !== undefined && mensaje !== null && typeof mensaje !== 'string') {
    res.status(400).json({ message: 'El mensaje no es válido' })
    return
  }
  const mensajeLimpio = typeof mensaje === 'string' && mensaje.trim() ? mensaje.trim() : undefined
  if (mensajeLimpio && mensajeLimpio.length > MENSAJE_CANDIDATURA_MAX) {
    res
      .status(400)
      .json({ message: `El mensaje no puede superar los ${MENSAJE_CANDIDATURA_MAX} caracteres` })
    return
  }

  try {
    const oferta = await OfertaEmpleo.findOne({ _id: id, estado: 'publicada' })
    if (!oferta) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }
    if (!admiteCandidaturas(oferta)) {
      res.status(409).json({ message: 'El plazo para presentar candidaturas ha terminado' })
      return
    }

    // El indice unico impide postularse dos veces aunque lleguen dos peticiones a la vez
    const candidatura = await Candidatura.create({
      ofertaEmpleoId: oferta._id,
      candidatoId: req.usuario!.id,
      ofertanteId: oferta.ofertanteId,
      mensaje: mensajeLimpio,
      estado: 'pendiente'
    })

    await notificar({
      usuarioId: oferta.ofertanteId,
      tipo: 'candidatura_nueva',
      titulo: 'Nueva candidatura',
      mensaje: `${req.usuario!.nombre} se ha postulado a "${oferta.titulo}".`,
      enlace: `/empleo/${oferta.id}`
    })

    res.status(201).json({ id: candidatura.id, estado: candidatura.estado })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Ya te has postulado a esta oferta' })
      return
    }
    console.error('Error al crear la candidatura:', error)
    res.status(500).json({ message: 'No se pudo enviar la candidatura' })
  }
}

type CandidatoPoblado = {
  id: string
  nombre: string
  email: string
  telefono?: string
  avatarUrl?: string
  isla?: string
  municipio?: string
  voluntario?: {
    biografia?: string
    interesIds: Array<{ id: string; nombre: string }>
    habilidades: string[]
    idiomas: string[]
    acreditaciones?: Array<{ nombre: string; fechaObtencion: Date }>
    estadisticas?: {
      horasTotales?: number
      colaboraciones?: number
      valoracionMedia?: number
      numValoraciones?: number
    }
  }
}

// GET /api/empleo/:id/candidaturas -> la oferta propia y sus candidaturas, con el perfil de
// cada candidato. Su trayectoria de voluntariado hace de curriculum
export async function getCandidaturasEmpleo(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_ES_TUYA })
    return
  }

  try {
    const [oferta] = await consultarEmpleos({ _id: id, ofertanteId: req.usuario!.id })
    if (!oferta) {
      res.status(404).json({ message: MENSAJE_NO_ES_TUYA })
      return
    }

    // Las retiradas no se muestran: el candidato ya no quiere participar
    const candidaturas = await Candidatura.find({
      ofertaEmpleoId: oferta._id,
      estado: { $ne: 'retirada' }
    })
      .sort({ createdAt: 1 })
      .populate<{ candidatoId: CandidatoPoblado | null }>({
        path: 'candidatoId',
        model: User,
        select: 'nombre email telefono avatarUrl isla municipio voluntario',
        populate: { path: 'voluntario.interesIds', select: 'nombre' }
      })

    res.json({
      oferta: { ...serializarEmpleo(oferta), estado: oferta.estado },
      candidaturas: candidaturas
        .filter((candidatura) => candidatura.candidatoId)
        .map((candidatura) => {
          const candidato = candidatura.candidatoId!
          const perfil = candidato.voluntario
          // El contacto solo se comparte con la entidad cuando preselecciona al candidato
          const compartirContacto = candidatura.estado === 'preseleccionada'

          return {
            id: candidatura.id as string,
            estado: candidatura.estado,
            mensaje: candidatura.mensaje ?? null,
            fechaCandidatura: candidatura.createdAt,
            fechaResolucion: candidatura.fechaResolucion ?? null,
            candidato: {
              id: candidato.id,
              nombre: candidato.nombre,
              avatarUrl: candidato.avatarUrl ?? null,
              isla: candidato.isla ?? null,
              municipio: candidato.municipio ?? null,
              biografia: perfil?.biografia ?? null,
              intereses: (perfil?.interesIds ?? []).map(({ id: interesId, nombre }) => ({
                id: interesId,
                nombre
              })),
              habilidades: perfil?.habilidades ?? [],
              idiomas: perfil?.idiomas ?? [],
              acreditaciones: (perfil?.acreditaciones ?? []).map(({ nombre, fechaObtencion }) => ({
                nombre,
                fechaObtencion
              })),
              estadisticas: {
                horasTotales: perfil?.estadisticas?.horasTotales ?? 0,
                colaboraciones: perfil?.estadisticas?.colaboraciones ?? 0,
                valoracionMedia: perfil?.estadisticas?.valoracionMedia ?? 0,
                numValoraciones: perfil?.estadisticas?.numValoraciones ?? 0
              },
              email: compartirContacto ? candidato.email : null,
              telefono: compartirContacto ? (candidato.telefono ?? null) : null
            }
          }
        })
    })
  } catch (error) {
    console.error('Error al obtener las candidaturas:', error)
    res.status(500).json({ message: 'No se pudieron cargar las candidaturas' })
  }
}

// Desde que estado se puede llegar a cada decision de la entidad
const TRANSICIONES: Record<'preseleccionada' | 'descartada', EstadoCandidatura[]> = {
  preseleccionada: ['pendiente'],
  descartada: ['pendiente', 'preseleccionada']
}

// PATCH /api/empleo/candidaturas/:id -> la entidad preselecciona o descarta una candidatura
export async function resolverCandidatura(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const estado = req.body?.estado

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_CANDIDATURA_NO_EXISTE })
    return
  }
  if (estado !== 'preseleccionada' && estado !== 'descartada') {
    res.status(400).json({ message: 'El estado no es válido' })
    return
  }

  try {
    // El filtro incluye el estado de origen: dos decisiones a la vez no se pisan
    const candidatura = await Candidatura.findOneAndUpdate(
      { _id: id, ofertanteId: req.usuario!.id, estado: { $in: TRANSICIONES[estado] } },
      { estado, fechaResolucion: new Date() },
      { returnDocument: 'after' }
    )

    if (!candidatura) {
      const existe = await Candidatura.exists({ _id: id, ofertanteId: req.usuario!.id })
      res.status(existe ? 409 : 404).json({
        message: existe
          ? 'Esta candidatura ya no se puede cambiar a ese estado'
          : MENSAJE_CANDIDATURA_NO_EXISTE
      })
      return
    }

    const oferta = await OfertaEmpleo.findById(candidatura.ofertaEmpleoId).select('titulo')
    const titulo = oferta?.titulo ?? 'una oferta de empleo'
    await notificar({
      usuarioId: candidatura.candidatoId,
      tipo: estado === 'preseleccionada' ? 'candidatura_preseleccionada' : 'candidatura_descartada',
      titulo: estado === 'preseleccionada' ? 'Has sido preseleccionado' : 'Candidatura descartada',
      mensaje:
        estado === 'preseleccionada'
          ? `${req.usuario!.nombre} te ha preseleccionado para "${titulo}" y se pondrá en contacto contigo.`
          : `${req.usuario!.nombre} ha descartado tu candidatura para "${titulo}".`,
      enlace: '/empleo'
    })

    res.json({ id: candidatura.id, estado: candidatura.estado })
  } catch (error) {
    console.error('Error al resolver la candidatura:', error)
    res.status(500).json({ message: 'No se pudo actualizar la candidatura' })
  }
}

// PATCH /api/empleo/candidaturas/:id/retirar -> el candidato retira su candidatura
export async function retirarCandidatura(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_CANDIDATURA_NO_EXISTE })
    return
  }

  try {
    const candidatura = await Candidatura.findOneAndUpdate(
      { _id: id, candidatoId: req.usuario!.id, estado: { $in: ['pendiente', 'preseleccionada'] } },
      { estado: 'retirada' },
      { returnDocument: 'after' }
    )

    if (!candidatura) {
      const existe = await Candidatura.exists({ _id: id, candidatoId: req.usuario!.id })
      res.status(existe ? 409 : 404).json({
        message: existe ? 'Esta candidatura ya no se puede retirar' : MENSAJE_CANDIDATURA_NO_EXISTE
      })
      return
    }

    res.json({ id: candidatura.id, estado: candidatura.estado })
  } catch (error) {
    console.error('Error al retirar la candidatura:', error)
    res.status(500).json({ message: 'No se pudo retirar la candidatura' })
  }
}

type EmpleoDeCandidatura = {
  id: string
  titulo: string
  estado: string
  fechaLimite?: Date | null
  tipoContrato: string
  jornada: string
  modalidad: string
  ubicacion?: { isla: string; municipio: string } | null
  ofertanteId: { nombre: string } | null
}

// GET /api/empleo/candidaturas/mias -> candidaturas del voluntario, las mas recientes primero
export async function getMisCandidaturas(req: Request, res: Response): Promise<void> {
  try {
    const candidaturas = await Candidatura.find({ candidatoId: req.usuario!.id })
      .sort({ createdAt: -1 })
      .populate<{ ofertaEmpleoId: EmpleoDeCandidatura | null }>({
        path: 'ofertaEmpleoId',
        select: 'titulo estado fechaLimite tipoContrato jornada modalidad ubicacion ofertanteId',
        populate: { path: 'ofertanteId', select: 'nombre' }
      })

    res.json(
      candidaturas
        .filter((candidatura) => candidatura.ofertaEmpleoId)
        .map((candidatura) => {
          const oferta = candidatura.ofertaEmpleoId!
          return {
            id: candidatura.id as string,
            estado: candidatura.estado,
            fechaCandidatura: candidatura.createdAt,
            ofertaId: oferta.id,
            titulo: oferta.titulo,
            organizacion: oferta.ofertanteId?.nombre ?? '',
            tipoContrato: oferta.tipoContrato,
            jornada: oferta.jornada,
            modalidad: oferta.modalidad,
            ubicacion: oferta.ubicacion
              ? { isla: oferta.ubicacion.isla, municipio: oferta.ubicacion.municipio }
              : null,
            ofertaAbierta: admiteCandidaturas(oferta)
          }
        })
    )
  } catch (error) {
    console.error('Error al obtener las candidaturas del voluntario:', error)
    res.status(500).json({ message: 'No se pudieron cargar tus candidaturas' })
  }
}
