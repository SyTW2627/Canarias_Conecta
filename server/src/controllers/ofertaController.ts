/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona las peticiones relacionadas con las ofertas de voluntariado.
 */

import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import mongoose, { isObjectIdOrHexString, type QueryFilter, type Types } from 'mongoose'
import { Categoria } from '../models/Categoria.js'
import { Imagen } from '../models/Imagen.js'
import { Inscripcion } from '../models/Inscripcion.js'
import { SolicitudAyuda } from '../models/SolicitudAyuda.js'
import { HORA_REGEX, ISLAS } from '../models/constantes.js'
import { detectarTipoImagen } from '../middleware/subidaImagen.js'
import { notificar } from '../services/notificaciones.js'
import { promoverListaEspera } from '../services/plazas.js'
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
    const { id, fecha: textoFecha, horaInicio, horaFin, plazas } = turno ?? {}
    const fecha = typeof textoFecha === 'string' ? leerFecha(textoFecha) : null

    if (
      (id !== undefined && (typeof id !== 'string' || !isObjectIdOrHexString(id))) ||
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

    turnos.push({ id: id as string | undefined, fecha, horaInicio, horaFin, plazas, plazasLibres: plazas })
  }

  return turnos
}

// Con multipart/form-data los datos llegan como texto JSON en el campo "datos"
function leerCuerpo(req: Request): Record<string, unknown> | null {
  if (!req.is('multipart/form-data')) return req.body ?? {}

  try {
    const datos = JSON.parse(req.body?.datos ?? '{}')
    return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : null
  } catch {
    return null
  }
}

// Los validadores propios tienen mensaje en español; los de Mongoose no
function mensajeDeValidacion(error: mongoose.Error.ValidationError): string {
  const propio = Object.values(error.errors).find(
    (detalle) => 'kind' in detalle && detalle.kind === 'user defined'
  )
  return propio?.message ?? 'Los datos de la oferta no son válidos'
}

// Solo se guarda una imagen si la peticion trae una y su firma es valida
async function guardarImagenSubida(
  archivo: Express.Multer.File,
  tipo: { contentType: string; extension: string }
): Promise<Types.ObjectId> {
  const imagen = await Imagen.create({
    nombre: `oferta-${randomUUID()}${tipo.extension}`,
    contentType: tipo.contentType,
    data: archivo.buffer
  })
  return imagen._id
}

// POST /api/ofertas -> crea una oferta del ofertante que ha iniciado sesion.
// Acepta JSON o multipart/form-data con los campos "datos" (JSON) e "imagen" (opcional)
export async function crearOferta(req: Request, res: Response): Promise<void> {
  const cuerpo = leerCuerpo(req)
  if (!cuerpo) {
    res.status(400).json({ message: 'Los datos de la oferta no son válidos' })
    return
  }

  const tipoImagen = req.file ? detectarTipoImagen(req.file.buffer) : undefined
  if (tipoImagen === null) {
    res.status(400).json({ message: 'La imagen debe ser JPG, PNG o WebP' })
    return
  }

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
  } = cuerpo as Record<string, any>

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

  const turnosLeidos = leerTurnos(turnosRecibidos)
  if (!turnosLeidos) {
    res.status(400).json({ message: 'Los turnos no son válidos' })
    return
  }
  // Al crear no hay turnos previos: un id recibido no significa nada y se descarta
  const turnos = turnosLeidos.map(({ id: _id, ...turno }) => turno)

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

  let imagenId: Types.ObjectId | undefined

  try {
    const idsUnicos = [...new Set<string>(categoriaIds)]
    const existentes = await Categoria.countDocuments({ _id: { $in: idsUnicos }, activa: true })

    if (existentes !== idsUnicos.length) {
      res.status(400).json({ message: 'Las categorías no son válidas' })
      return
    }

    // Se guarda despues de validar todo lo demas para no dejar imagenes sueltas
    if (req.file && tipoImagen) {
      imagenId = await guardarImagenSubida(req.file, tipoImagen)
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
      imagenes: imagenId ? [imagenId] : [],
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
    // Si la oferta no se ha creado, su imagen no la usaria nadie
    if (imagenId) {
      await Imagen.deleteOne({ _id: imagenId }).catch((borrado) => {
        console.error('Error al borrar la imagen de una oferta no creada:', borrado)
      })
    }

    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: mensajeDeValidacion(error) })
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

    // Avisa a quien seguia pendiente o aceptado: la oferta ya no aparecera en la web
    const afectados = await Inscripcion.find({
      ofertaId: oferta._id,
      estado: { $in: ['pendiente', 'aceptada', 'en_espera'] }
    }).select('voluntarioId')
    await notificar(
      afectados.map((inscripcion) => ({
        usuarioId: inscripcion.voluntarioId,
        tipo: 'oferta_cerrada' as const,
        titulo: 'Oferta cerrada',
        mensaje: `${req.usuario!.nombre} ha cerrado la oferta "${oferta.titulo}".`,
        enlace: '/mis_inscripciones'
      }))
    )

    res.json({ id: oferta.id, estado: oferta.estado })
  } catch (error) {
    console.error('Error al cerrar la oferta:', error)
    res.status(500).json({ message: 'Error al cerrar la oferta' })
  }
}

// DELETE /api/ofertas/:id -> borra una oferta propia
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

    const { deletedCount } = await Oferta.deleteOne(filtro)

    if (deletedCount === 0) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }

    // Sin la oferta, sus inscripciones no se pueden mostrar; las solicitudes de ayuda se conservan
    // Las imagenes del seed se comparten entre ofertas; solo se borran las subidas con la oferta
    await Promise.all([
      Inscripcion.deleteMany({ ofertaId: id }),
      SolicitudAyuda.updateMany({ ofertaId: id }, { $unset: { ofertaId: 1 } }),
      Imagen.deleteMany({ _id: { $in: oferta.imagenes }, nombre: /^oferta-/ })
    ])

    res.status(204).end()
  } catch (error) {
    console.error('Error al eliminar la oferta:', error)
    res.status(500).json({ message: 'Error al eliminar la oferta' })
  }
}

// Para el propio ofertante: incluye la direccion y el estado de la oferta
function serializarOfertaPropia(oferta: Awaited<ReturnType<typeof consultarOfertas>>[number]) {
  return {
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
  }
}

// GET /api/ofertas/mias -> todas las ofertas del ofertante, en cualquier estado
export async function getMisOfertas(req: Request, res: Response): Promise<void> {
  try {
    const [ofertas, pendientes] = await Promise.all([
      consultarOfertas({ ofertanteId: req.usuario!.id }, { createdAt: -1 }),
      Inscripcion.aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { ofertanteId: new mongoose.Types.ObjectId(req.usuario!.id), estado: 'pendiente' } },
        { $group: { _id: '$ofertaId', total: { $sum: 1 } } }
      ])
    ])

    const pendientesPorOferta = new Map(pendientes.map(({ _id, total }) => [_id.toString(), total]))

    res.json(
      ofertas.map((oferta) => ({
        ...serializarOfertaPropia(oferta),
        candidatosPendientes: pendientesPorOferta.get(oferta.id) ?? 0
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

// GET /api/ofertas/mias/:id -> una oferta propia, en cualquier estado, para editarla
export async function getMiOferta(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_EXISTE })
    return
  }

  try {
    const [oferta] = await consultarOfertas({ _id: id, ofertanteId: req.usuario!.id })

    if (!oferta) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }

    res.json(serializarOfertaPropia(oferta))
  } catch (error) {
    console.error('Error al obtener la oferta del ofertante:', error)
    res.status(500).json({ message: 'Error al obtener la oferta' })
  }
}

const MENSAJE_NO_EDITABLE = 'Solo se pueden editar las ofertas publicadas que no han terminado'

// PUT /api/ofertas/:id -> modifica una oferta propia mientras esta activa.
// Acepta los mismos datos que crearOferta. Los turnos que ya existian llevan su "id";
// "quitarImagen": true vuelve a usar la imagen de la categoria
export async function editarOferta(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: MENSAJE_NO_EXISTE })
    return
  }

  const cuerpo = leerCuerpo(req)
  if (!cuerpo) {
    res.status(400).json({ message: 'Los datos de la oferta no son válidos' })
    return
  }

  const tipoImagen = req.file ? detectarTipoImagen(req.file.buffer) : undefined
  if (tipoImagen === null) {
    res.status(400).json({ message: 'La imagen debe ser JPG, PNG o WebP' })
    return
  }

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
    quitarImagen = false
  } = cuerpo as Record<string, any>

  if (
    typeof titulo !== 'string' || !titulo.trim() ||
    typeof descripcion !== 'string' || !descripcion.trim()
  ) {
    res.status(400).json({ message: 'El título y la descripción son obligatorios' })
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
  const idsTurnos = turnos?.flatMap((turno) => (turno.id ? [turno.id] : [])) ?? []
  if (!turnos || new Set(idsTurnos).size !== idsTurnos.length) {
    res.status(400).json({ message: 'Los turnos no son válidos' })
    return
  }

  const hoy = hoyEnUtc()
  if (turnos.length === 0) {
    res.status(400).json({ message: 'La oferta necesita al menos un turno próximo' })
    return
  }
  if (turnos.some((turno) => turno.fecha < hoy)) {
    res.status(400).json({ message: 'Los turnos no pueden tener una fecha pasada' })
    return
  }

  const ubicacionRecibida =
    modalidad !== 'online' && ubicacion && typeof ubicacion === 'object'
      ? { isla: ubicacion.isla, municipio: ubicacion.municipio, direccion: ubicacion.direccion }
      : undefined

  if (modalidad !== 'online' && !ubicacionRecibida) {
    res.status(400).json({ message: 'La oferta necesita una ubicación' })
    return
  }

  let imagenNueva: Types.ObjectId | undefined

  try {
    const oferta = await Oferta.findOne({ _id: id, ofertanteId: req.usuario!.id })

    if (!oferta) {
      res.status(404).json({ message: MENSAJE_NO_EXISTE })
      return
    }

    if (oferta.estado !== 'publicada' || estaTerminada(oferta.turnos)) {
      res.status(409).json({ message: MENSAJE_NO_EDITABLE })
      return
    }

    // Los turnos que ya pasaron forman parte del historial y no se tocan
    const pasados = oferta.turnos.filter((turno) => turno.fecha < hoy)
    const proximos = oferta.turnos.filter((turno) => turno.fecha >= hoy)

    const turnosFinales = []
    for (const { id: turnoId, ...turno } of turnos) {
      if (!turnoId) {
        turnosFinales.push(turno)
        continue
      }

      const actual = proximos.find((otro) => otro._id.toString() === turnoId)
      if (!actual) {
        res.status(400).json({ message: 'Los turnos no son válidos' })
        return
      }

      // Las plazas ya reservadas se mantienen: solo cambian las libres
      const ocupadas = actual.plazas - actual.plazasLibres
      if (turno.plazas < ocupadas) {
        res.status(409).json({
          message: `Un turno ya tiene ${ocupadas} plazas ocupadas: no puede tener menos plazas`
        })
        return
      }

      turnosFinales.push({ ...turno, _id: actual._id, plazasLibres: turno.plazas - ocupadas })
    }

    const quitadosConInscritos = proximos.some(
      (turno) => turno.plazasLibres < turno.plazas && !idsTurnos.includes(turno._id.toString())
    )
    if (quitadosConInscritos) {
      res.status(409).json({ message: 'No puedes quitar un turno que ya tiene voluntarios inscritos' })
      return
    }

    const idsUnicos = [...new Set<string>(categoriaIds)]
    const existentes = await Categoria.countDocuments({ _id: { $in: idsUnicos }, activa: true })
    if (existentes !== idsUnicos.length) {
      res.status(400).json({ message: 'Las categorías no son válidas' })
      return
    }

    const imagenesAnteriores = oferta.imagenes
    let imagenes = imagenesAnteriores
    if (req.file && tipoImagen) {
      imagenNueva = await guardarImagenSubida(req.file, tipoImagen)
      imagenes = [imagenNueva]
    } else if (quitarImagen === true) {
      imagenes = []
    }

    const usuario = req.usuario!
    oferta.set({
      titulo,
      descripcion,
      categoriaIds: idsUnicos,
      modalidad,
      tipoDuracion,
      ubicacion: ubicacionRecibida,
      requisitos: typeof requisitos === 'string' && requisitos.trim() ? requisitos : undefined,
      edadMinima: edadMinima ?? undefined,
      imagenes,
      turnos: [...pasados, ...turnosFinales],
      textoBusqueda: construirTextoBusqueda([
        titulo,
        descripcion,
        usuario.nombre,
        ubicacionRecibida?.municipio
      ])
    })

    await oferta.validate()

    // Una inscripcion o un cierre a la vez cambian updatedAt: asi no se pisan las plazas reservadas
    const { matchedCount } = await Oferta.updateOne(
      { _id: oferta._id, estado: 'publicada', updatedAt: oferta.updatedAt },
      oferta.$getChanges()
    )

    if (matchedCount === 0) {
      if (imagenNueva) await Imagen.deleteOne({ _id: imagenNueva })
      res.status(409).json({
        message: 'La oferta ha cambiado mientras la editabas. Recarga la página e inténtalo de nuevo'
      })
      return
    }

    // Las imagenes del seed se comparten entre ofertas; solo se borran las subidas con la oferta
    const sinUso = imagenesAnteriores.filter(
      (anterior) => !imagenes.some((actual) => actual.equals(anterior))
    )
    if (sinUso.length > 0) {
      await Imagen.deleteMany({ _id: { $in: sinUso }, nombre: /^oferta-/ }).catch((borrado) => {
        console.error('Error al borrar la imagen anterior de una oferta:', borrado)
      })
    }

    // Si se han ampliado las plazas, entra quien estaba en la lista de espera
    await promoverListaEspera(oferta._id).catch((errorCola) => {
      console.error('Error al avanzar la lista de espera:', errorCola)
    })

    res.json({ id: oferta.id, estado: oferta.estado })
  } catch (error) {
    if (imagenNueva) {
      await Imagen.deleteOne({ _id: imagenNueva }).catch((borrado) => {
        console.error('Error al borrar la imagen de una oferta no editada:', borrado)
      })
    }

    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: mensajeDeValidacion(error) })
      return
    }

    console.error('Error al editar la oferta:', error)
    res.status(500).json({ message: 'Error al editar la oferta' })
  }
}
