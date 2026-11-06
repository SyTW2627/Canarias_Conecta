/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona las peticiones relacionadas con las ofertas de voluntariado.
 */

import type { Request, Response } from 'express'
import mongoose, { isObjectIdOrHexString, type QueryFilter, type Types } from 'mongoose'
import { Categoria } from '../models/Categoria.js'
import { Inscripcion } from '../models/Inscripcion.js'
import { SolicitudAyuda } from '../models/SolicitudAyuda.js'
import { HORA_REGEX, ISLAS } from '../models/constantes.js'
import {
  Oferta,
  construirTextoBusqueda,
  normalizarTexto,
  type OfertaDoc
} from '../models/Oferta.js'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BUSQUEDA_MAX = 100
const CONSULTA_MAX_MS = 5000
const TURNOS_MAX = 50
// Un ofertante solo puede crear ofertas en estos estados
const ESTADOS_AL_CREAR = ['borrador', 'publicada']

// Los parametros repetidos (?isla=a&isla=b) llegan como array y se ignoran
function leerParametro(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
}

function esIslaValida(isla: string): isla is (typeof ISLAS)[number] {
  return (ISLAS as readonly string[]).includes(isla)
}

// Devuelve la fecha a las 00:00 UTC, como se guarda en los turnos, o null si no existe
function leerFecha(texto: string): Date | null {
  const fecha = new Date(`${texto}T00:00:00.000Z`)
  const esValida =
    FECHA_REGEX.test(texto) &&
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().startsWith(texto)

  return esValida ? fecha : null
}

function hoyEnUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
}

// El termino viene del usuario: sin escapar, un "(" romperia la expresion regular
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type DatosPoblados = {
  ofertanteId: { nombre: string }
  categoriaIds: Array<{ id: string; nombre: string; slug: string; imagenId?: Types.ObjectId }>
}

function urlImagen(id: Types.ObjectId): string {
  return `/api/imagenes/${id}`
}

// Por defecto, primero las que tienen el turno mas cercano
function consultarOfertas(
  filtro: QueryFilter<OfertaDoc>,
  orden: Record<string, 1 | -1> = { 'turnos.fecha': 1 }
) {
  return Oferta.find(filtro)
    .sort(orden)
    .maxTimeMS(CONSULTA_MAX_MS)
    .populate<DatosPoblados>([
      { path: 'ofertanteId', select: 'nombre' },
      { path: 'categoriaIds', select: 'nombre slug imagenId' }
    ])
}

function serializarOferta(oferta: Awaited<ReturnType<typeof consultarOfertas>>[number]) {
  return {
    id: oferta.id,
    titulo: oferta.titulo,
    descripcion: oferta.descripcion,
    organizacion: oferta.ofertanteId.nombre,
    categorias: oferta.categoriaIds.map(({ id, nombre, slug, imagenId }) => ({
      id,
      nombre,
      slug,
      imagen: imagenId && urlImagen(imagenId)
    })),
    modalidad: oferta.modalidad,
    tipoDuracion: oferta.tipoDuracion,
    // La direccion no se publica: puede ser un domicilio y esta API no exige sesion
    ubicacion: oferta.ubicacion && {
      isla: oferta.ubicacion.isla,
      municipio: oferta.ubicacion.municipio
    },
    requisitos: oferta.requisitos,
    edadMinima: oferta.edadMinima,
    imagenes: oferta.imagenes.map(urlImagen),
    turnos: oferta.turnos.map((turno) => ({
      id: turno._id,
      fecha: turno.fecha,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      plazas: turno.plazas,
      plazasLibres: turno.plazasLibres
    }))
  }
}

// GET /api/ofertas -> ofertas publicadas con algun turno en las fechas pedidas
export async function buscarOfertas(req: Request, res: Response): Promise<void> {
  const q = leerParametro(req.query.q)
  const categoria = leerParametro(req.query.categoria)
  const isla = leerParametro(req.query.isla)
  const municipio = leerParametro(req.query.municipio)
  const textoDesde = leerParametro(req.query.fechaDesde)
  const textoHasta = leerParametro(req.query.fechaHasta)

  if (q && q.length > BUSQUEDA_MAX) {
    res.status(400).json({ message: `La búsqueda no puede superar los ${BUSQUEDA_MAX} caracteres` })
    return
  }

  if (isla !== undefined && !esIslaValida(isla)) {
    res.status(400).json({ message: 'La isla no es válida' })
    return
  }

  const fechaDesde = textoDesde ? leerFecha(textoDesde) : hoyEnUtc()
  const fechaHasta = textoHasta ? leerFecha(textoHasta) : undefined

  if (!fechaDesde || fechaHasta === null) {
    res.status(400).json({ message: 'Las fechas deben tener el formato AAAA-MM-DD' })
    return
  }

  if (fechaHasta && fechaHasta < fechaDesde) {
    res.status(400).json({ message: 'La fecha de fin no puede ser anterior a la de inicio' })
    return
  }

  try {
    // $elemMatch: las dos condiciones de fecha deben cumplirse en el mismo turno
    const filtro: QueryFilter<OfertaDoc> = {
      estado: 'publicada',
      turnos: {
        $elemMatch: { fecha: { $gte: fechaDesde, ...(fechaHasta && { $lte: fechaHasta }) } }
      }
    }

    if (isla) filtro['ubicacion.isla'] = isla
    if (municipio) filtro['ubicacion.municipio'] = municipio

    if (categoria) {
      const encontrada = await Categoria.findOne({ slug: categoria.toLowerCase(), activa: true })
      if (!encontrada) {
        res.json([])
        return
      }
      filtro.categoriaIds = encontrada._id
    }

    // Cada palabra debe aparecer, en cualquier orden: "costa limpieza"
    if (q) {
      filtro.$and = normalizarTexto(q)
        .split(/\s+/)
        .map((palabra) => ({ textoBusqueda: new RegExp(escaparRegex(palabra)) }))
    }

    const ofertas = await consultarOfertas(filtro)

    res.json(ofertas.map(serializarOferta))
  } catch (error) {
    console.error('Error al buscar ofertas:', error)
    res.status(500).json({ message: 'Error al buscar las ofertas' })
  }
}

// Devuelve los turnos listos para guardar, o null si alguno no es valido
function leerTurnos(valor: unknown) {
  if (!Array.isArray(valor) || valor.length > TURNOS_MAX) return null

  const turnos = []

  for (const turno of valor) {
    const { fecha: textoFecha, horaInicio, horaFin, plazas } = turno ?? {}
    const fecha = typeof textoFecha === 'string' ? leerFecha(textoFecha) : null

    if (
      !fecha ||
      typeof horaInicio !== 'string' ||
      typeof horaFin !== 'string' ||
      !HORA_REGEX.test(horaInicio) ||
      !HORA_REGEX.test(horaFin) ||
      !Number.isInteger(plazas) ||
      plazas < 1
    ) {
      return null
    }

    turnos.push({ fecha, horaInicio, horaFin, plazas, plazasLibres: plazas })
  }

  return turnos
}

// POST /api/ofertas -> crea una oferta del ofertante que ha iniciado sesion
export async function crearOferta(req: Request, res: Response): Promise<void> {
  const {
    titulo,
    descripcion,
    categoriaIds = [],
    modalidad,
    tipoDuracion,
    ubicacion,
    requisitos,
    edadMinima,
    turnos: turnosRecibidos = [],
    estado = 'publicada'
  } = req.body ?? {}

  if (
    typeof titulo !== 'string' || !titulo.trim() ||
    typeof descripcion !== 'string' || !descripcion.trim()
  ) {
    res.status(400).json({ message: 'El título y la descripción son obligatorios' })
    return
  }

  if (!ESTADOS_AL_CREAR.includes(estado)) {
    res.status(400).json({ message: 'El estado no es válido' })
    return
  }

  if (
    !Array.isArray(categoriaIds) ||
    !categoriaIds.every((id) => typeof id === 'string' && isObjectIdOrHexString(id))
  ) {
    res.status(400).json({ message: 'Las categorías no son válidas' })
    return
  }

  const turnos = leerTurnos(turnosRecibidos)
  if (!turnos) {
    res.status(400).json({ message: 'Los turnos no son válidos' })
    return
  }

  const hoy = hoyEnUtc()
  if (turnos.some((turno) => turno.fecha < hoy)) {
    res.status(400).json({ message: 'Los turnos no pueden tener una fecha pasada' })
    return
  }

  // Solo se copian estos campos: el resto del body nunca llega a la base de datos
  const ubicacionRecibida =
    ubicacion && typeof ubicacion === 'object'
      ? { isla: ubicacion.isla, municipio: ubicacion.municipio, direccion: ubicacion.direccion }
      : undefined

  if (estado === 'publicada' && modalidad !== 'online' && !ubicacionRecibida) {
    res.status(400).json({ message: 'La oferta necesita una ubicación' })
    return
  }

  try {
    const idsUnicos = [...new Set<string>(categoriaIds)]
    const existentes = await Categoria.countDocuments({ _id: { $in: idsUnicos }, activa: true })

    if (existentes !== idsUnicos.length) {
      res.status(400).json({ message: 'Las categorías no son válidas' })
      return
    }

    const usuario = req.usuario!
    const oferta = await Oferta.create({
      ofertanteId: usuario.id,
      titulo,
      descripcion,
      categoriaIds: idsUnicos,
      modalidad,
      tipoDuracion,
      ubicacion: ubicacionRecibida,
      requisitos,
      edadMinima,
      turnos,
      textoBusqueda: construirTextoBusqueda([
        titulo,
        descripcion,
        usuario.nombre,
        ubicacionRecibida?.municipio
      ]),
      estado,
      fechaPublicacion: estado === 'publicada' ? new Date() : undefined
    })

    res.status(201).json({ id: oferta.id, estado: oferta.estado })
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      // Los validadores propios tienen mensaje en español; los de Mongoose no
      const propio = Object.values(error.errors).find(
        (detalle) => 'kind' in detalle && detalle.kind === 'user defined'
      )
      res.status(400).json({ message: propio?.message ?? 'Los datos de la oferta no son válidos' })
      return
    }

    console.error('Error al crear la oferta:', error)
    res.status(500).json({ message: 'Error al crear la oferta' })
  }
}

// Una oferta ha terminado cuando ya no le queda ningun turno de hoy en adelante
function estaTerminada(turnos: Array<{ fecha: Date }>): boolean {
  const hoy = hoyEnUtc()
  return turnos.every((turno) => turno.fecha < hoy)
}

const MENSAJE_NO_EXISTE = 'La oferta no existe o no es tuya'

// PATCH /api/ofertas/:id/cerrar -> deja de mostrar la oferta a los voluntarios
export async function cerrarOferta(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_EXISTE })
    return
  }

  try {
    // El filtro incluye el estado: si dos peticiones llegan a la vez, solo una la cierra
    const oferta = await Oferta.findOneAndUpdate(
      { _id: id, ofertanteId: req.usuario!.id, estado: { $in: ['borrador', 'publicada'] } },
      { estado: 'cerrada' },
      { returnDocument: 'after' }
    )

    if (!oferta) {
      const existe = await Oferta.exists({ _id: id, ofertanteId: req.usuario!.id })
      res
        .status(existe ? 409 : 404)
        .json({ message: existe ? 'La oferta ya está cerrada' : MENSAJE_NO_EXISTE })
      return
    }

    res.json({ id: oferta.id, estado: oferta.estado })
  } catch (error) {
    console.error('Error al cerrar la oferta:', error)
    res.status(500).json({ message: 'Error al cerrar la oferta' })
  }
}

// DELETE /api/ofertas/:id -> borra una oferta propia cuyos turnos ya han pasado
export async function eliminarOferta(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_EXISTE })
    return
  }

  try {
    const filtro = { _id: id, ofertanteId: req.usuario!.id }
    const oferta = await Oferta.findOne(filtro)

    if (!oferta) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }

    if (!estaTerminada(oferta.turnos)) {
      res.status(409).json({ message: 'Solo se pueden eliminar las ofertas que ya han terminado' })
      return
    }

    // Se repite la condicion de fecha por si alguien anadiera un turno entre las dos consultas
    const { deletedCount } = await Oferta.deleteOne({
      ...filtro,
      turnos: { $not: { $elemMatch: { fecha: { $gte: hoyEnUtc() } } } }
    })

    if (deletedCount === 0) {
      res.status(409).json({ message: 'Solo se pueden eliminar las ofertas que ya han terminado' })
      return
    }

    // Sin la oferta, sus inscripciones no se pueden mostrar; las solicitudes de ayuda se conservan
    await Promise.all([
      Inscripcion.deleteMany({ ofertaId: id }),
      SolicitudAyuda.updateMany({ ofertaId: id }, { $unset: { ofertaId: 1 } })
    ])

    res.status(204).end()
  } catch (error) {
    console.error('Error al eliminar la oferta:', error)
    res.status(500).json({ message: 'Error al eliminar la oferta' })
  }
}

// GET /api/ofertas/mias -> todas las ofertas del ofertante, en cualquier estado
export async function getMisOfertas(req: Request, res: Response): Promise<void> {
  try {
    const ofertas = await consultarOfertas({ ofertanteId: req.usuario!.id }, { createdAt: -1 })

    res.json(
      ofertas.map((oferta) => ({
        ...serializarOferta(oferta),
        // Son sus propios datos: aqui si se devuelve la direccion
        ubicacion: oferta.ubicacion && {
          isla: oferta.ubicacion.isla,
          municipio: oferta.ubicacion.municipio,
          direccion: oferta.ubicacion.direccion
        },
        estado: oferta.estado,
        terminada: estaTerminada(oferta.turnos),
        fechaPublicacion: oferta.fechaPublicacion,
        creadaEn: oferta.createdAt
      }))
    )
  } catch (error) {
    console.error('Error al obtener las ofertas del ofertante:', error)
    res.status(500).json({ message: 'Error al obtener tus ofertas' })
  }
}

// GET /api/ofertas/:id -> detalle de una oferta publicada
export async function getOferta(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: 'La oferta no existe o ya no está disponible' })
    return
  }

  try {
    const [oferta] = await consultarOfertas({ _id: id, estado: 'publicada' })

    if (!oferta) {
      res.status(404).json({ message: 'La oferta no existe o ya no está disponible' })
      return
    }

    res.json(serializarOferta(oferta))
  } catch (error) {
    console.error('Error al obtener la oferta:', error)
    res.status(500).json({ message: 'Error al obtener la oferta' })
  }
}
