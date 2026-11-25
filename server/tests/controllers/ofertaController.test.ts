/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del controlador de ofertas (modelos y servicio de notificaciones simulados).
 */

import type { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Categoria } from '../../src/models/Categoria.js'
import { Imagen } from '../../src/models/Imagen.js'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { Oferta } from '../../src/models/Oferta.js'
import { SolicitudAyuda } from '../../src/models/SolicitudAyuda.js'
import {
  JPG,
  PNG,
  WEBP,
  type TurnoDatos,
  consulta,
  crearReq,
  crearRes,
  errorBd,
  fecha,
  fechaUtc,
  nuevoId,
  turno,
  usuarioOfertante
} from '../helpers.js'

const servicio = vi.hoisted(() => ({ notificar: vi.fn() }))
vi.mock('../../src/services/notificaciones.js', () => servicio)

const {
  buscarOfertas,
  cerrarOferta,
  crearOferta,
  editarOferta,
  eliminarOferta,
  getMiOferta,
  getMisOfertas,
  getOferta,
  leerPagina,
  POR_PAGINA
} = await import('../../src/controllers/ofertaController.js')

beforeEach(() => {
  servicio.notificar.mockResolvedValue(undefined)
})

const sesion = usuarioOfertante({ nombre: 'Asociación Verde' })

// Oferta con ofertante y categorias ya rellenados, como la devuelve consultarOfertas
function ofertaPoblada(datos: Record<string, unknown> = {}) {
  return {
    id: nuevoId().toString(),
    titulo: 'Limpieza de costa',
    descripcion: 'Recogemos residuos',
    ofertanteId: { nombre: 'ONG Mar' },
    categoriaIds: [{ id: 'c1', nombre: 'Costa', slug: 'costa', imagenId: undefined as Types.ObjectId | undefined }],
    modalidad: 'presencial',
    tipoDuracion: 'jornada',
    ubicacion: { isla: 'tenerife', municipio: 'Adeje', direccion: 'Calle Mar 1' },
    requisitos: 'Ganas',
    edadMinima: 18,
    imagenes: [] as Types.ObjectId[],
    turnos: [turno(5)],
    estado: 'publicada',
    fechaPublicacion: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    ...datos
  }
}

function simularConsulta(resultado: unknown) {
  const q = consulta(resultado)
  const buscar = vi.spyOn(Oferta, 'find').mockReturnValue(q as never)
  return { buscar, q }
}

const serializarTurno = (t: TurnoDatos) => ({
  id: t._id,
  fecha: t.fecha,
  horaInicio: t.horaInicio,
  horaFin: t.horaFin,
  plazas: t.plazas,
  plazasLibres: t.plazasLibres
})

describe('buscarOfertas', () => {
  async function buscar(query: Record<string, unknown> = {}) {
    const res = crearRes()
    await buscarOfertas(crearReq({ query }), res)
    return res
  }

  it('busca publicadas con un turno desde hoy, ordenadas por fecha y con tiempo limite', async () => {
    const { buscar: find, q } = simularConsulta([])

    await buscar()

    expect(find).toHaveBeenCalledWith({
      estado: 'publicada',
      turnos: { $elemMatch: { fecha: { $gte: fechaUtc(0) } } }
    })
    expect(q.sort).toHaveBeenCalledWith({ 'turnos.fecha': 1 })
    expect(q.maxTimeMS).toHaveBeenCalledWith(5000)
    expect(q.populate).toHaveBeenCalledWith([
      { path: 'ofertanteId', select: 'nombre' },
      { path: 'categoriaIds', select: 'nombre slug imagenId' }
    ])
  })

  it('devuelve los datos publicos de cada oferta, sin la direccion', async () => {
    const imagenId = nuevoId()
    const imagenCategoria = nuevoId()
    const oferta = ofertaPoblada({
      imagenes: [imagenId],
      categoriaIds: [{ id: 'c1', nombre: 'Costa', slug: 'costa', imagenId: imagenCategoria }]
    })
    simularConsulta([oferta])

    const res = await buscar()

    expect(res.body).toEqual([
      {
        id: oferta.id,
        titulo: 'Limpieza de costa',
        descripcion: 'Recogemos residuos',
        organizacion: 'ONG Mar',
        categorias: [{ id: 'c1', nombre: 'Costa', slug: 'costa', imagen: `/api/imagenes/${imagenCategoria}` }],
        modalidad: 'presencial',
        tipoDuracion: 'jornada',
        ubicacion: { isla: 'tenerife', municipio: 'Adeje' },
        requisitos: 'Ganas',
        edadMinima: 18,
        imagenes: [`/api/imagenes/${imagenId}`],
        turnos: oferta.turnos.map(serializarTurno)
      }
    ])
  })

  it('una categoria sin imagen y una oferta online no devuelven imagen ni ubicacion', async () => {
    simularConsulta([ofertaPoblada({ ubicacion: undefined, modalidad: 'online' })])

    const res = await buscar()
    const [oferta] = res.body as Array<{ ubicacion: unknown; categorias: Array<{ imagen: unknown }> }>

    expect(oferta.ubicacion).toBeUndefined()
    expect(oferta.categorias[0].imagen).toBeUndefined()
  })

  it('exige que cada palabra buscada aparezca, sin tildes ni mayusculas', async () => {
    const { buscar: find } = simularConsulta([])

    await buscar({ q: '  Reforestación   MONTE ' })

    const filtro = find.mock.calls[0][0] as unknown as { $and: Array<{ textoBusqueda: RegExp }> }
    expect(filtro.$and).toEqual([{ textoBusqueda: /reforestacion/ }, { textoBusqueda: /monte/ }])
  })

  it('escapa los caracteres especiales de la busqueda', async () => {
    const { buscar: find } = simularConsulta([])

    await buscar({ q: '(c++) .*' })

    const { $and } = find.mock.calls[0][0] as unknown as { $and: Array<{ textoBusqueda: RegExp }> }
    expect($and.map((c) => c.textoBusqueda.source)).toEqual(['\\(c\\+\\+\\)', '\\.\\*'])
    expect($and[0].textoBusqueda.test('taller (c++) basico')).toBe(true)
    expect($and[1].textoBusqueda.test('cualquier cosa')).toBe(false)
  })

  it('acepta una busqueda de exactamente 100 caracteres y rechaza 101', async () => {
    simularConsulta([])
    expect((await buscar({ q: 'a'.repeat(100) })).statusCode).toBe(200)

    const res = await buscar({ q: 'a'.repeat(101) })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La búsqueda no puede superar los 100 caracteres' })
  })

  it('ignora los parametros vacios o repetidos', async () => {
    const { buscar: find } = simularConsulta([])

    await buscar({ q: '   ', isla: ['tenerife', 'lanzarote'], municipio: '' })

    expect(find).toHaveBeenCalledWith({
      estado: 'publicada',
      turnos: { $elemMatch: { fecha: { $gte: fechaUtc(0) } } }
    })
  })

  it('filtra por isla y municipio', async () => {
    const { buscar: find } = simularConsulta([])

    await buscar({ isla: ' lanzarote ', municipio: 'Arrecife' })

    expect(find.mock.calls[0][0]).toMatchObject({ 'ubicacion.isla': 'lanzarote', 'ubicacion.municipio': 'Arrecife' })
  })

  it('responde 400 si la isla no existe', async () => {
    const res = await buscar({ isla: 'mallorca' })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La isla no es válida' })
  })

  it('filtra por el id de una categoria activa buscada por su slug', async () => {
    const categoria = { _id: nuevoId() }
    const buscarCategoria = vi.spyOn(Categoria, 'findOne').mockReturnValue(consulta(categoria) as never)
    const { buscar: find } = simularConsulta([])

    await buscar({ categoria: 'ANIMALES' })

    expect(buscarCategoria).toHaveBeenCalledWith({ slug: 'animales', activa: true })
    expect(find.mock.calls[0][0]).toMatchObject({ categoriaIds: categoria._id })
  })

  it('devuelve [] sin buscar ofertas si la categoria no existe o esta inactiva', async () => {
    vi.spyOn(Categoria, 'findOne').mockReturnValue(consulta(null) as never)
    const find = vi.spyOn(Oferta, 'find')

    const res = await buscar({ categoria: 'no-existe' })

    expect(res.body).toEqual([])
    expect(find).not.toHaveBeenCalled()
  })

  it('aplica el rango de fechas dentro del mismo turno', async () => {
    const { buscar: find } = simularConsulta([])

    await buscar({ fechaDesde: fecha(2), fechaHasta: fecha(5) })

    expect(find.mock.calls[0][0]).toMatchObject({
      turnos: { $elemMatch: { fecha: { $gte: fechaUtc(2), $lte: fechaUtc(5) } } }
    })
  })

  it('permite buscar ofertas pasadas y que desde y hasta sean el mismo dia', async () => {
    const { buscar: find } = simularConsulta([])

    await buscar({ fechaDesde: fecha(-10), fechaHasta: fecha(-10) })

    expect(find.mock.calls[0][0]).toMatchObject({
      turnos: { $elemMatch: { fecha: { $gte: fechaUtc(-10), $lte: fechaUtc(-10) } } }
    })
  })

  it.each([
    ['formato incorrecto', { fechaDesde: '01/02/2030' }],
    ['dia inexistente', { fechaDesde: '2030-02-30' }],
    ['mes inexistente', { fechaHasta: '2030-13-01' }],
    ['texto', { fechaHasta: 'mañana' }]
  ])('responde 400 con una fecha con %s', async (_caso, query) => {
    const res = await buscar(query)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Las fechas deben tener el formato AAAA-MM-DD' })
  })

  it('responde 400 si la fecha de fin es anterior a la de inicio', async () => {
    const res = await buscar({ fechaDesde: fecha(5), fechaHasta: fecha(2) })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La fecha de fin no puede ser anterior a la de inicio' })
  })

  it('responde 500 si falla la base de datos', async () => {
    simularConsulta(errorBd())

    const res = await buscar()

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al buscar las ofertas' })
  })
  describe('paginada (?pagina=N)', () => {
    function simularPaginada(ofertas: unknown[], total: number) {
      const simulada = simularConsulta(ofertas)
      const contar = vi.spyOn(Oferta, 'countDocuments').mockReturnValue(consulta(total) as never)
      return { ...simulada, contar }
    }

    it('devuelve la pagina pedida con el total, ordenada de forma estable', async () => {
      const { buscar: find, q, contar } = simularPaginada([ofertaPoblada()], 2 * POR_PAGINA + 1)

      const res = await buscar({ pagina: '3', isla: 'tenerife' })

      const filtro = find.mock.calls[0][0]
      expect(contar).toHaveBeenCalledWith(filtro)
      expect(q.sort).toHaveBeenCalledWith({ 'turnos.fecha': 1, _id: 1 })
      expect(q.skip).toHaveBeenCalledWith(2 * POR_PAGINA)
      expect(q.limit).toHaveBeenCalledWith(POR_PAGINA)
      expect(res.body).toMatchObject({
        total: 2 * POR_PAGINA + 1,
        pagina: 3,
        porPagina: POR_PAGINA,
        totalPaginas: 3
      })
      expect((res.body as { ofertas: unknown[] }).ofertas).toHaveLength(1)
    })

    it('con ?pagina= vacio devuelve la primera pagina', async () => {
      const { q } = simularPaginada([], 0)

      const res = await buscar({ pagina: '' })

      expect(q.skip).toHaveBeenCalledWith(0)
      expect(res.body).toEqual({ ofertas: [], total: 0, pagina: 1, porPagina: POR_PAGINA, totalPaginas: 0 })
    })

    it('sin ?pagina devuelve la lista completa, como antes', async () => {
      const { q } = simularConsulta([ofertaPoblada()])
      const contar = vi.spyOn(Oferta, 'countDocuments')

      const res = await buscar()

      expect(Array.isArray(res.body)).toBe(true)
      expect(q.skip).not.toHaveBeenCalled()
      expect(q.limit).not.toHaveBeenCalled()
      expect(contar).not.toHaveBeenCalled()
    })

    it('si la categoria no existe responde una pagina vacia', async () => {
      vi.spyOn(Categoria, 'findOne').mockReturnValue(consulta(null) as never)

      const res = await buscar({ categoria: 'inventada', pagina: '2' })

      expect(res.body).toEqual({ ofertas: [], total: 0, pagina: 2, porPagina: POR_PAGINA, totalPaginas: 0 })
    })

    it.each(['0', '-1', '2.5', 'dos', '1001'])('responde 400 sin consultar con pagina=%s', async (pagina) => {
      const find = vi.spyOn(Oferta, 'find')

      const res = await buscar({ pagina })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ message: 'La página no es válida' })
      expect(find).not.toHaveBeenCalled()
    })

    it('responde 500 si falla el recuento', async () => {
      simularConsulta([ofertaPoblada()])
      vi.spyOn(Oferta, 'countDocuments').mockReturnValue(consulta(errorBd()) as never)

      const res = await buscar({ pagina: '1' })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ message: 'Error al buscar las ofertas' })
    })
  })
})

describe('leerPagina', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['1', 1],
    [' 4 ', 4],
    ['1000', 1000],
    ['0', null],
    ['1001', null],
    ['-1', null],
    ['2.5', null],
    ['1e2', null],
    ['abc', null],
    // Repetido (?pagina=1&pagina=2) se ignora, como el resto de parametros
    [['1', '2'], 1]
  ])('%o -> %o', (valor, esperado) => {
    expect(leerPagina(valor)).toBe(esperado)
  })
})

describe('getOferta', () => {
  async function obtener(id: string) {
    const res = crearRes()
    await getOferta(crearReq({ params: { id } }), res)
    return res
  }

  it('busca la oferta solo si esta publicada y devuelve sus datos publicos', async () => {
    const oferta = ofertaPoblada()
    const { buscar } = simularConsulta([oferta])

    const res = await obtener(oferta.id)

    expect(buscar).toHaveBeenCalledWith({ _id: oferta.id, estado: 'publicada' })
    expect(res.body).toMatchObject({ id: oferta.id, ubicacion: { isla: 'tenerife', municipio: 'Adeje' } })
    expect(res.body).not.toHaveProperty('estado')
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const buscar = vi.spyOn(Oferta, 'find')
    const res = await obtener('xyz')

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta no existe o ya no está disponible' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 404 si no existe o no esta publicada', async () => {
    simularConsulta([])
    expect((await obtener(nuevoId().toString())).statusCode).toBe(404)
  })

  it('responde 500 si falla la base de datos', async () => {
    simularConsulta(errorBd())

    const res = await obtener(nuevoId().toString())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al obtener la oferta' })
  })
})

describe('getMiOferta', () => {
  async function obtener(id: string) {
    const res = crearRes()
    await getMiOferta(crearReq({ params: { id }, usuario: sesion }), res)
    return res
  }

  it('busca entre las del ofertante y devuelve tambien estado y direccion', async () => {
    const oferta = ofertaPoblada({ estado: 'borrador' })
    const { buscar } = simularConsulta([oferta])

    const res = await obtener(oferta.id)

    expect(buscar).toHaveBeenCalledWith({ _id: oferta.id, ofertanteId: sesion.id })
    expect(res.body).toMatchObject({
      id: oferta.id,
      estado: 'borrador',
      terminada: false,
      ubicacion: { isla: 'tenerife', municipio: 'Adeje', direccion: 'Calle Mar 1' },
      fechaPublicacion: oferta.fechaPublicacion,
      creadaEn: oferta.createdAt
    })
  })

  it('responde 404 si el id no es valido o la oferta no es suya', async () => {
    expect((await obtener('xyz')).statusCode).toBe(404)

    simularConsulta([])
    const res = await obtener(nuevoId().toString())
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta no existe o no es tuya' })
  })

  it('responde 500 si falla la base de datos', async () => {
    simularConsulta(errorBd())

    const res = await obtener(nuevoId().toString())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al obtener la oferta' })
  })
})

describe('getMisOfertas', () => {
  it('devuelve todas las propias, la mas nueva primero, con sus candidatos pendientes', async () => {
    const nueva = ofertaPoblada({ titulo: 'Nueva' })
    const terminada = ofertaPoblada({ titulo: 'Antigua', estado: 'cerrada', turnos: [turno(-3)], ubicacion: undefined })
    const { buscar, q } = simularConsulta([nueva, terminada])
    const agregar = vi.spyOn(Inscripcion, 'aggregate').mockResolvedValue([
      { _id: { toString: () => nueva.id }, total: 2 }
    ] as never)
    const res = crearRes()

    await getMisOfertas(crearReq({ usuario: sesion }), res)

    expect(buscar).toHaveBeenCalledWith({ ofertanteId: sesion.id })
    expect(q.sort).toHaveBeenCalledWith({ createdAt: -1 })
    const [pipeline] = agregar.mock.calls[0] as unknown as [Array<{ $match?: { ofertanteId: Types.ObjectId } }>]
    expect(pipeline[0].$match?.ofertanteId.toString()).toBe(sesion.id)
    expect(pipeline).toEqual([
      { $match: { ofertanteId: expect.anything(), estado: 'pendiente' } },
      { $group: { _id: '$ofertaId', total: { $sum: 1 } } }
    ])
    expect(res.body).toEqual([
      expect.objectContaining({ titulo: 'Nueva', estado: 'publicada', terminada: false, candidatosPendientes: 2 }),
      expect.objectContaining({ titulo: 'Antigua', estado: 'cerrada', terminada: true, candidatosPendientes: 0, ubicacion: undefined })
    ])
  })

  it('responde 500 si falla la base de datos', async () => {
    simularConsulta([])
    vi.spyOn(Inscripcion, 'aggregate').mockRejectedValue(errorBd())
    const res = crearRes()

    await getMisOfertas(crearReq({ usuario: sesion }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al obtener tus ofertas' })
  })
})

// Error de validacion real de Mongoose para una oferta con los datos indicados
// Parte de una oferta valida: solo falla lo que indique "datos"
async function errorDeValidacion(datos: Record<string, unknown>) {
  const valida = {
    ofertanteId: nuevoId(),
    titulo: 'T',
    descripcion: 'D',
    categoriaIds: [nuevoId()],
    modalidad: 'presencial',
    tipoDuracion: 'jornada',
    ubicacion: { isla: 'tenerife', municipio: 'Adeje' },
    turnos: [turno(1)],
    textoBusqueda: 't',
    estado: 'publicada'
  }
  return new Oferta({ ...valida, ...datos }).validate().catch((error: unknown) => error)
}

describe('crearOferta', () => {
  const categoriaId = nuevoId().toString()
  const turnoValido = { fecha: fecha(3), horaInicio: '09:00', horaFin: '13:00', plazas: 4 }
  const cuerpo = (datos: Record<string, unknown> = {}) => ({
    titulo: 'Reforestación del monte',
    descripcion: 'Plantamos pinos canarios',
    categoriaIds: [categoriaId],
    modalidad: 'presencial',
    tipoDuracion: 'jornada',
    ubicacion: { isla: 'tenerife', municipio: 'La Esperanza', direccion: 'Pista forestal' },
    requisitos: 'Calzado cómodo',
    edadMinima: 16,
    turnos: [turnoValido],
    ...datos
  })

  function simular({ categorias = 1 } = {}) {
    const ofertaId = nuevoId()
    return {
      contar: vi.spyOn(Categoria, 'countDocuments').mockResolvedValue(categorias as never),
      crear: vi.spyOn(Oferta, 'create').mockImplementation((async (datos: { estado: string }) => ({
        id: ofertaId.toString(),
        estado: datos.estado
      })) as never),
      crearImagen: vi.spyOn(Imagen, 'create').mockImplementation((async () => ({ _id: nuevoId() })) as never),
      borrarImagen: vi.spyOn(Imagen, 'deleteOne').mockResolvedValue({} as never),
      ofertaId
    }
  }

  async function crear(body: unknown, opciones: { multipart?: boolean; imagen?: Buffer } = {}) {
    const res = crearRes()
    const req = crearReq({
      body,
      usuario: sesion,
      multipart: opciones.multipart,
      file: opciones.imagen ? { buffer: opciones.imagen } : undefined
    })
    await crearOferta(req, res)
    return res
  }

  // Datos con los que se llamo a Oferta.create
  const creada = (mock: ReturnType<typeof simular>['crear']) => mock.mock.calls[0][0] as unknown as Record<string, any>

  it('crea una oferta publicada solo con los campos permitidos', async () => {
    const { crear: create, contar, ofertaId } = simular()
    const antes = Date.now()

    const res = await crear(
      cuerpo({
        titulo: '  Reforestación  ',
        ofertanteId: 'intento-de-suplantar',
        imagenes: ['x'],
        ubicacion: { isla: 'tenerife', municipio: 'La Esperanza', direccion: 'Pista forestal', extra: 'x' },
        categoriaIds: [categoriaId, categoriaId]
      })
    )

    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ id: ofertaId.toString(), estado: 'publicada' })
    expect(contar).toHaveBeenCalledWith({ _id: { $in: [categoriaId] }, activa: true })
    const datos = creada(create)
    expect(datos).toMatchObject({
      ofertanteId: sesion.id,
      titulo: '  Reforestación  ',
      descripcion: 'Plantamos pinos canarios',
      categoriaIds: [categoriaId],
      modalidad: 'presencial',
      tipoDuracion: 'jornada',
      ubicacion: { isla: 'tenerife', municipio: 'La Esperanza', direccion: 'Pista forestal' },
      requisitos: 'Calzado cómodo',
      edadMinima: 16,
      imagenes: [],
      turnos: [{ fecha: fechaUtc(3), horaInicio: '09:00', horaFin: '13:00', plazas: 4, plazasLibres: 4 }],
      // Titulo, descripcion, entidad y municipio, normalizados y con un solo espacio
      textoBusqueda: 'reforestacion plantamos pinos canarios asociacion verde la esperanza',
      estado: 'publicada'
    })
    expect(datos.ubicacion).not.toHaveProperty('extra')
    expect(datos.fechaPublicacion.getTime()).toBeGreaterThanOrEqual(antes)
  })

  it('crea un borrador incompleto sin fecha de publicacion ni turnos', async () => {
    const { crear: create } = simular({ categorias: 0 })

    const res = await crear({ titulo: 'Idea', descripcion: 'Por definir', estado: 'borrador' })

    expect(res.statusCode).toBe(201)
    expect(res.body).toMatchObject({ estado: 'borrador' })
    expect(creada(create)).toMatchObject({ categoriaIds: [], turnos: [], fechaPublicacion: undefined, ubicacion: undefined })
  })

  it('una oferta online no necesita ubicacion', async () => {
    simular()
    const res = await crear(cuerpo({ modalidad: 'online', ubicacion: undefined }))
    expect(res.statusCode).toBe(201)
  })

  it('descarta el id enviado en los turnos al crear', async () => {
    const { crear: create } = simular()

    await crear(cuerpo({ turnos: [{ ...turnoValido, id: nuevoId().toString() }] }))

    expect(creada(create).turnos[0]).not.toHaveProperty('id')
  })

  it.each([
    ['sin titulo', { titulo: undefined }],
    ['con titulo vacio', { titulo: '   ' }],
    ['sin descripcion', { descripcion: '' }],
    ['con titulo que no es texto', { titulo: 5 }]
  ])('responde 400 %s', async (_caso, cambios) => {
    const res = await crear(cuerpo(cambios))

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'El título y la descripción son obligatorios' })
  })

  it('responde 400 si no hay cuerpo', async () => {
    const res = await crear(undefined)
    expect(res.body).toEqual({ message: 'El título y la descripción son obligatorios' })
  })

  it.each(['cerrada', 'cancelada', 'otro'])('no permite crear una oferta en estado %s', async (estado) => {
    const res = await crear(cuerpo({ estado }))
    expect(res.body).toEqual({ message: 'El estado no es válido' })
  })

  it.each([
    ['no es una lista', 'abc'],
    ['tiene ids no validos', ['xyz']],
    ['tiene valores que no son texto', [1]]
  ])('responde 400 si categoriaIds %s', async (_caso, categoriaIds) => {
    const res = await crear(cuerpo({ categoriaIds }))
    expect(res.body).toEqual({ message: 'Las categorías no son válidas' })
  })

  it('responde 400 si alguna categoria no existe o esta inactiva', async () => {
    const { crear: create } = simular({ categorias: 1 })

    const res = await crear(cuerpo({ categoriaIds: [categoriaId, nuevoId().toString()] }))

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Las categorías no son válidas' })
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ['no son una lista', 'x'],
    ['un turno es null', [null]],
    ['la fecha falta', [{ ...turnoValido, fecha: undefined }]],
    ['la fecha no existe', [{ ...turnoValido, fecha: '2030-13-01' }]],
    ['la hora de inicio no es valida', [{ ...turnoValido, horaInicio: '25:00' }]],
    ['la hora de inicio no es texto', [{ ...turnoValido, horaInicio: 9 }]],
    ['la hora de fin no es valida', [{ ...turnoValido, horaFin: '9:00' }]],
    ['la hora de fin no es texto', [{ ...turnoValido, horaFin: 11 }]],
    ['las plazas son 0', [{ ...turnoValido, plazas: 0 }]],
    ['las plazas son decimales', [{ ...turnoValido, plazas: 1.5 }]],
    ['las plazas son texto', [{ ...turnoValido, plazas: '2' }]],
    ['el id no es valido', [{ ...turnoValido, id: 'xyz' }]],
    ['el id no es texto', [{ ...turnoValido, id: 5 }]],
    ['hay mas de 50', Array.from({ length: 51 }, () => turnoValido)]
  ])('responde 400 si los turnos %s', async (_caso, turnos) => {
    const res = await crear(cuerpo({ turnos }))

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Los turnos no son válidos' })
  })

  it('acepta exactamente 50 turnos', async () => {
    simular()
    const res = await crear(cuerpo({ turnos: Array.from({ length: 50 }, () => turnoValido) }))
    expect(res.statusCode).toBe(201)
  })

  it('acepta un turno para hoy pero no uno de ayer', async () => {
    simular()
    expect((await crear(cuerpo({ turnos: [{ ...turnoValido, fecha: fecha(0) }] }))).statusCode).toBe(201)

    const res = await crear(cuerpo({ turnos: [{ ...turnoValido, fecha: fecha(-1) }] }))
    expect(res.body).toEqual({ message: 'Los turnos no pueden tener una fecha pasada' })
  })

  it.each([undefined, 'Adeje', null])(
    'responde 400 si una oferta presencial publicada no tiene ubicacion (%s)',
    async (ubicacion) => {
      const res = await crear(cuerpo({ ubicacion }))
      expect(res.body).toEqual({ message: 'La oferta necesita una ubicación' })
    }
  )

  it('devuelve el mensaje propio de las validaciones del modelo', async () => {
    const { crear: create } = simular()
    create.mockRejectedValue(await errorDeValidacion({ categoriaIds: [] }))

    const res = await crear(cuerpo())

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La oferta necesita al menos una categoría' })
  })

  it('devuelve un mensaje generico en las validaciones sin mensaje propio', async () => {
    const { crear: create } = simular()
    create.mockRejectedValue(
      await errorDeValidacion({ modalidad: 'teletransporte' })
    )

    const res = await crear(cuerpo())

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Los datos de la oferta no son válidos' })
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Categoria, 'countDocuments').mockRejectedValue(errorBd())

    const res = await crear(cuerpo())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al crear la oferta' })
  })

  describe('con imagen (multipart/form-data)', () => {
    const multipart = (datos: unknown, imagen?: Buffer) =>
      crear({ datos: typeof datos === 'string' ? datos : JSON.stringify(datos) }, { multipart: true, imagen })

    it.each([
      ['PNG', PNG, 'image/png', '.png'],
      ['JPG', JPG, 'image/jpeg', '.jpg'],
      ['WebP', WEBP, 'image/webp', '.webp']
    ])('guarda una imagen %s con un nombre unico y la asocia a la oferta', async (_t, bytes, contentType, extension) => {
      const { crear: create, crearImagen } = simular()
      const imagenId = nuevoId()
      crearImagen.mockResolvedValue({ _id: imagenId } as never)

      const res = await multipart(cuerpo(), bytes)

      expect(res.statusCode).toBe(201)
      const guardada = crearImagen.mock.calls[0][0] as unknown as { nombre: string; contentType: string; data: Buffer }
      expect(guardada.contentType).toBe(contentType)
      expect(guardada.data).toBe(bytes)
      expect(guardada.nombre).toMatch(new RegExp(`^oferta-[0-9a-f-]{36}\\${extension}$`))
      expect(creada(create).imagenes).toEqual([imagenId])
    })

    it('lee los datos del campo "datos" aunque no haya imagen', async () => {
      const { crearImagen } = simular()

      const res = await multipart(cuerpo())

      expect(res.statusCode).toBe(201)
      expect(crearImagen).not.toHaveBeenCalled()
    })

    it('trata la ausencia del campo datos como un cuerpo vacio', async () => {
      const res = await crear({}, { multipart: true })
      expect(res.body).toEqual({ message: 'El título y la descripción son obligatorios' })
    })

    it('trata un cuerpo multipart vacio como un objeto vacio', async () => {
      const res = await crear(undefined, { multipart: true })
      expect(res.body).toEqual({ message: 'El título y la descripción son obligatorios' })
    })

    it.each(['{no es json', '[1,2]', '"texto"', 'null'])(
      'responde 400 si datos no es un objeto JSON (%s)',
      async (datos) => {
        const res = await multipart(datos)

        expect(res.statusCode).toBe(400)
        expect(res.body).toEqual({ message: 'Los datos de la oferta no son válidos' })
      }
    )

    it('rechaza ficheros que no son JPG, PNG ni WebP antes de validar nada mas', async () => {
      const { crear: create } = simular()

      const res = await multipart(cuerpo(), Buffer.from('<svg/>'))

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ message: 'La imagen debe ser JPG, PNG o WebP' })
      expect(create).not.toHaveBeenCalled()
    })

    it('no guarda la imagen si las categorias no son validas', async () => {
      const { crearImagen } = simular({ categorias: 0 })

      await multipart(cuerpo(), PNG)

      expect(crearImagen).not.toHaveBeenCalled()
    })

    it('borra la imagen ya guardada si la oferta no se puede crear', async () => {
      const { crear: create, crearImagen, borrarImagen } = simular()
      const imagenId = nuevoId()
      crearImagen.mockResolvedValue({ _id: imagenId } as never)
      create.mockRejectedValue(await errorDeValidacion({ categoriaIds: [] }))

      const res = await multipart(cuerpo(), PNG)

      expect(res.statusCode).toBe(400)
      expect(borrarImagen).toHaveBeenCalledWith({ _id: imagenId })
    })

    it('registra el error si tampoco se puede borrar la imagen', async () => {
      const { crear: create, borrarImagen } = simular()
      create.mockRejectedValue(errorBd())
      borrarImagen.mockRejectedValue(new Error('tambien caida'))

      const res = await multipart(cuerpo(), PNG)

      expect(res.statusCode).toBe(500)
      expect(console.error).toHaveBeenCalledWith('Error al borrar la imagen de una oferta no creada:', expect.any(Error))
    })

    it('no intenta borrar imagenes si la peticion no traia ninguna', async () => {
      const { crear: create, borrarImagen } = simular()
      create.mockRejectedValue(errorBd())

      await multipart(cuerpo())

      expect(borrarImagen).not.toHaveBeenCalled()
    })
  })
})

describe('cerrarOferta', () => {
  async function cerrar(id: string) {
    const res = crearRes()
    await cerrarOferta(crearReq({ params: { id }, usuario: sesion }), res)
    return res
  }

  function simularCierre(oferta: { _id: Types.ObjectId; id: string; titulo: string; estado: string } | null) {
    return vi.spyOn(Oferta, 'findOneAndUpdate').mockResolvedValue(oferta as never)
  }

  it('cierra la oferta solo si es propia y esta abierta, en una sola operacion', async () => {
    const _id = nuevoId()
    const actualizar = simularCierre({ _id, id: _id.toString(), titulo: 'Playa', estado: 'cerrada' })
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([]) as never)

    const res = await cerrar(_id.toString())

    expect(actualizar).toHaveBeenCalledWith(
      { _id: _id.toString(), ofertanteId: sesion.id, estado: { $in: ['borrador', 'publicada'] } },
      { estado: 'cerrada' },
      { returnDocument: 'after' }
    )
    expect(res.body).toEqual({ id: _id.toString(), estado: 'cerrada' })
  })

  it('avisa a los voluntarios pendientes o aceptados', async () => {
    const _id = nuevoId()
    simularCierre({ _id, id: _id.toString(), titulo: 'Playa', estado: 'cerrada' })
    const [v1, v2] = [nuevoId(), nuevoId()]
    const q = consulta([{ voluntarioId: v1 }, { voluntarioId: v2 }])
    const buscar = vi.spyOn(Inscripcion, 'find').mockReturnValue(q as never)

    await cerrar(_id.toString())

    expect(buscar).toHaveBeenCalledWith({ ofertaId: _id, estado: { $in: ['pendiente', 'aceptada', 'en_espera'] } })
    expect(q.select).toHaveBeenCalledWith('voluntarioId')
    const aviso = {
      tipo: 'oferta_cerrada',
      titulo: 'Oferta cerrada',
      mensaje: 'Asociación Verde ha cerrado la oferta "Playa".',
      enlace: '/mis_inscripciones'
    }
    expect(servicio.notificar).toHaveBeenCalledWith([
      { usuarioId: v1, ...aviso },
      { usuarioId: v2, ...aviso }
    ])
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const actualizar = vi.spyOn(Oferta, 'findOneAndUpdate')
    const res = await cerrar('xyz')

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta no existe o no es tuya' })
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('responde 409 si la oferta propia ya estaba cerrada', async () => {
    simularCierre(null)
    const existe = vi.spyOn(Oferta, 'exists').mockResolvedValue({ _id: nuevoId() } as never)
    const id = nuevoId().toString()

    const res = await cerrar(id)

    expect(existe).toHaveBeenCalledWith({ _id: id, ofertanteId: sesion.id })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'La oferta ya está cerrada' })
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('responde 404 si no existe o es de otro', async () => {
    simularCierre(null)
    vi.spyOn(Oferta, 'exists').mockResolvedValue(null as never)

    const res = await cerrar(nuevoId().toString())

    expect(res.statusCode).toBe(404)
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Oferta, 'findOneAndUpdate').mockRejectedValue(errorBd())

    const res = await cerrar(nuevoId().toString())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al cerrar la oferta' })
  })
})

describe('eliminarOferta', () => {
  async function eliminar(id: string) {
    const res = crearRes()
    await eliminarOferta(crearReq({ params: { id }, usuario: sesion }), res)
    return res
  }

  function simular(oferta: { turnos: TurnoDatos[]; imagenes?: Types.ObjectId[] } | null, borradas = 1) {
    return {
      buscar: vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(oferta && { imagenes: [], ...oferta }) as never),
      borrar: vi.spyOn(Oferta, 'deleteOne').mockResolvedValue({ deletedCount: borradas } as never),
      borrarInscripciones: vi.spyOn(Inscripcion, 'deleteMany').mockResolvedValue({} as never),
      desvincular: vi.spyOn(SolicitudAyuda, 'updateMany').mockResolvedValue({} as never),
      borrarImagenes: vi.spyOn(Imagen, 'deleteMany').mockResolvedValue({} as never)
    }
  }

  it('borra una oferta terminada con sus inscripciones e imagenes subidas', async () => {
    const id = nuevoId().toString()
    const imagenes = [nuevoId(), nuevoId()]
    const { buscar, borrar, borrarInscripciones, desvincular, borrarImagenes } = simular({
      turnos: [turno(-1)],
      imagenes
    })

    const res = await eliminar(id)

    expect(buscar).toHaveBeenCalledWith({ _id: id, ofertanteId: sesion.id })
    expect(borrar).toHaveBeenCalledWith({ _id: id, ofertanteId: sesion.id })
    expect(borrarInscripciones).toHaveBeenCalledWith({ ofertaId: id })
    // Las solicitudes de ayuda se conservan, solo pierden el enlace
    expect(desvincular).toHaveBeenCalledWith({ ofertaId: id }, { $unset: { ofertaId: 1 } })
    // Solo las imagenes subidas con la oferta: las del catalogo se comparten
    expect(borrarImagenes).toHaveBeenCalledWith({ _id: { $in: imagenes }, nombre: /^oferta-/ })
    expect(res.statusCode).toBe(204)
    expect(res.terminada).toBe(true)
  })

  it('una oferta sin turnos cuenta como terminada', async () => {
    simular({ turnos: [] })
    expect((await eliminar(nuevoId().toString())).statusCode).toBe(204)
  })

  it('permite eliminar una oferta aunque aun tenga turnos', async () => {
    const { borrar } = simular({ turnos: [turno(-3), turno(0)] })
    const id = nuevoId().toString()

    const res = await eliminar(id)

    expect(res.statusCode).toBe(204)
    expect(borrar).toHaveBeenCalledWith({ _id: id, ofertanteId: sesion.id })
  })

  it('responde 404 si el id no es valido o la oferta no es propia', async () => {
    expect((await eliminar('xyz')).statusCode).toBe(404)

    simular(null)
    const res = await eliminar(nuevoId().toString())
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta no existe o no es tuya' })
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(errorBd()) as never)

    const res = await eliminar(nuevoId().toString())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al eliminar la oferta' })
  })
})

describe('editarOferta', () => {
  const categoriaId = nuevoId().toString()
  const ACTUALIZADA = new Date('2026-03-01T10:00:00Z')

  // Oferta tal y como la devuelve la base de datos
  function ofertaGuardada(datos: Record<string, unknown> = {}) {
    return Oferta.hydrate({
      _id: nuevoId(),
      ofertanteId: nuevoId(),
      titulo: 'Limpieza de costa',
      descripcion: 'Recogemos residuos',
      categoriaIds: [nuevoId()],
      modalidad: 'presencial',
      tipoDuracion: 'jornada',
      ubicacion: { isla: 'tenerife', municipio: 'Adeje' },
      imagenes: [],
      turnos: [turno(4)],
      textoBusqueda: 'limpieza de costa',
      estado: 'publicada',
      updatedAt: ACTUALIZADA,
      ...datos
    })
  }

  type TurnoEnviado = { id?: string; fecha: string; horaInicio: string; horaFin: string; plazas: number }

  // Cuerpo que conserva los turnos proximos de la oferta
  function cuerpo(oferta: ReturnType<typeof ofertaGuardada>, datos: Record<string, unknown> = {}) {
    const turnos: TurnoEnviado[] = oferta.turnos
      .filter((t) => t.fecha >= fechaUtc(0))
      .map((t) => ({
        id: t._id.toString(),
        fecha: t.fecha.toISOString().slice(0, 10),
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        plazas: t.plazas
      }))
    return {
      titulo: 'Limpieza del litoral',
      descripcion: 'Recogemos residuos',
      categoriaIds: [categoriaId],
      modalidad: 'presencial',
      tipoDuracion: 'jornada',
      ubicacion: { isla: 'la_gomera', municipio: 'Hermigua', direccion: 'Playa' },
      turnos,
      ...datos
    }
  }

  function simular(oferta: ReturnType<typeof ofertaGuardada> | null, { categorias = 1, coincidencias = 1 } = {}) {
    return {
      buscar: vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(oferta) as never),
      contar: vi.spyOn(Categoria, 'countDocuments').mockResolvedValue(categorias as never),
      guardar: vi.spyOn(Oferta, 'updateOne').mockResolvedValue({ matchedCount: coincidencias } as never),
      crearImagen: vi.spyOn(Imagen, 'create').mockImplementation((async () => ({ _id: nuevoId() })) as never),
      borrarImagen: vi.spyOn(Imagen, 'deleteOne').mockResolvedValue({} as never),
      borrarImagenes: vi.spyOn(Imagen, 'deleteMany').mockResolvedValue({} as never)
    }
  }

  async function editar(id: string, body: unknown, opciones: { multipart?: boolean; imagen?: Buffer } = {}) {
    const res = crearRes()
    const req = crearReq({
      params: { id },
      usuario: sesion,
      body: opciones.multipart ? { datos: JSON.stringify(body) } : body,
      multipart: opciones.multipart,
      file: opciones.imagen ? { buffer: opciones.imagen } : undefined
    })
    await editarOferta(req, res)
    return res
  }

  it('guarda solo los cambios y solo si nadie modifico la oferta mientras tanto', async () => {
    const oferta = ofertaGuardada()
    const { buscar, guardar } = simular(oferta)

    const res = await editar(oferta.id, cuerpo(oferta))

    expect(buscar).toHaveBeenCalledWith({ _id: oferta.id, ofertanteId: sesion.id })
    expect(res.body).toEqual({ id: oferta.id, estado: 'publicada' })
    const [filtro, cambios] = guardar.mock.calls[0] as unknown as [unknown, { $set: Record<string, unknown> }]
    expect(filtro).toEqual({ _id: oferta._id, estado: 'publicada', updatedAt: ACTUALIZADA })
    expect(cambios.$set).toMatchObject({ titulo: 'Limpieza del litoral' })
    expect(cambios.$set).not.toHaveProperty('descripcion')
  })

  it('actualiza los datos, conserva los turnos existentes con sus plazas ocupadas y añade los nuevos', async () => {
    const existente = turno(4, { plazas: 3, plazasLibres: 2 })
    const oferta = ofertaGuardada({ turnos: [existente], requisitos: 'Antiguos', edadMinima: 18 })
    simular(oferta)
    const datos = cuerpo(oferta, { modalidad: 'mixta', requisitos: '   ', edadMinima: null })
    datos.turnos[0].plazas = 5
    datos.turnos.push({ fecha: fecha(8), horaInicio: '09:00', horaFin: '10:00', plazas: 2 })

    const res = await editar(oferta.id, datos)

    expect(res.statusCode).toBe(200)
    expect(oferta).toMatchObject({
      titulo: 'Limpieza del litoral',
      modalidad: 'mixta',
      ubicacion: { isla: 'la_gomera', municipio: 'Hermigua', direccion: 'Playa' }
    })
    expect(oferta.requisitos).toBeUndefined()
    expect(oferta.edadMinima).toBeUndefined()
    expect(oferta.textoBusqueda).toBe('limpieza del litoral recogemos residuos asociacion verde hermigua')
    expect(oferta.turnos[0]._id.equals(existente._id)).toBe(true)
    expect(oferta.turnos[0]).toMatchObject({ plazas: 5, plazasLibres: 4 })
    expect(oferta.turnos[1]).toMatchObject({ plazas: 2, plazasLibres: 2, horaInicio: '09:00' })
  })

  it('mantiene requisitos y edad minima si se envian', async () => {
    const oferta = ofertaGuardada()
    simular(oferta)

    await editar(oferta.id, cuerpo(oferta, { requisitos: 'Calzado', edadMinima: 16 }))

    expect(oferta).toMatchObject({ requisitos: 'Calzado', edadMinima: 16 })
  })

  it('mantiene intactos los turnos que ya pasaron, al principio de la lista', async () => {
    const pasado = turno(-2, { plazasLibres: 1 })
    const oferta = ofertaGuardada({ turnos: [pasado, turno(4)] })
    simular(oferta)

    await editar(oferta.id, cuerpo(oferta))

    expect(oferta.turnos).toHaveLength(2)
    expect(oferta.turnos[0]._id.equals(pasado._id)).toBe(true)
    expect(oferta.turnos[0].plazasLibres).toBe(1)
  })

  it('una oferta online pierde la ubicacion aunque se envie', async () => {
    const oferta = ofertaGuardada()
    simular(oferta)

    await editar(oferta.id, cuerpo(oferta, { modalidad: 'online' }))

    expect(oferta.ubicacion).toBeUndefined()
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const buscar = vi.spyOn(Oferta, 'findOne')
    const res = await editar('xyz', {})

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta no existe o no es tuya' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 400 si los datos multipart no son JSON', async () => {
    const res = crearRes()
    await editarOferta(
      crearReq({ params: { id: nuevoId().toString() }, usuario: sesion, multipart: true, body: { datos: '{malo' } }),
      res
    )
    expect(res.body).toEqual({ message: 'Los datos de la oferta no son válidos' })
  })

  it('responde 400 si la imagen no es valida', async () => {
    const oferta = ofertaGuardada()
    const res = await editar(oferta.id, cuerpo(oferta), { multipart: true, imagen: Buffer.from('GIF89a') })

    expect(res.body).toEqual({ message: 'La imagen debe ser JPG, PNG o WebP' })
  })

  it.each([
    ['sin cuerpo', undefined, 'El título y la descripción son obligatorios'],
    ['sin titulo', { titulo: '' }, 'El título y la descripción son obligatorios'],
    ['sin descripcion', { descripcion: 5 }, 'El título y la descripción son obligatorios'],
    ['con categorias que no son lista', { categoriaIds: 'x' }, 'Las categorías no son válidas'],
    ['con categorias invalidas', { categoriaIds: ['xyz'] }, 'Las categorías no son válidas'],
    ['con turnos invalidos', { turnos: [{ fecha: 'x' }] }, 'Los turnos no son válidos'],
    ['con turnos que no son lista', { turnos: 'x' }, 'Los turnos no son válidos'],
    ['sin turnos', { turnos: [] }, 'La oferta necesita al menos un turno próximo'],
    [
      'con un turno pasado',
      { turnos: [{ fecha: fecha(-1), horaInicio: '10:00', horaFin: '11:00', plazas: 1 }] },
      'Los turnos no pueden tener una fecha pasada'
    ],
    ['presencial sin ubicacion', { ubicacion: undefined }, 'La oferta necesita una ubicación'],
    ['presencial con ubicacion que no es objeto', { ubicacion: 'Adeje' }, 'La oferta necesita una ubicación']
  ])('responde 400 %s sin consultar la oferta', async (_caso, cambios, mensaje) => {
    const oferta = ofertaGuardada()
    const buscar = vi.spyOn(Oferta, 'findOne')

    const res = await editar(oferta.id, cambios === undefined ? undefined : cuerpo(oferta, cambios))

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 400 si se repite el id de un turno', async () => {
    const oferta = ofertaGuardada()
    const datos = cuerpo(oferta)
    datos.turnos.push(datos.turnos[0])

    const res = await editar(oferta.id, datos)
    expect(res.body).toEqual({ message: 'Los turnos no son válidos' })
  })

  it('responde 400 si un turno lleva un id que no es de sus turnos proximos', async () => {
    const pasado = turno(-2)
    const oferta = ofertaGuardada({ turnos: [pasado, turno(4)] })
    simular(oferta)
    const datos = cuerpo(oferta)
    // El id de un turno pasado no se puede reutilizar para "moverlo" al futuro
    datos.turnos[0].id = pasado._id.toString()

    const res = await editar(oferta.id, datos)
    expect(res.body).toEqual({ message: 'Los turnos no son válidos' })
  })

  it('responde 404 si la oferta no existe o es de otro', async () => {
    simular(null)
    const res = await editar(nuevoId().toString(), cuerpo(ofertaGuardada()))
    expect(res.statusCode).toBe(404)
  })

  it.each([
    ['cerrada', { estado: 'cerrada' }],
    ['borrador', { estado: 'borrador' }],
    ['terminada', { turnos: [turno(-1)] }]
  ])('responde 409 si la oferta esta %s', async (_caso, datos) => {
    const oferta = ofertaGuardada(datos)
    const { guardar } = simular(oferta)

    const res = await editar(oferta.id, cuerpo(ofertaGuardada()))

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Solo se pueden editar las ofertas publicadas que no han terminado' })
    expect(guardar).not.toHaveBeenCalled()
  })

  it('responde 409 si se reducen las plazas por debajo de las ocupadas', async () => {
    const oferta = ofertaGuardada({ turnos: [turno(3, { plazas: 3, plazasLibres: 1 })] })
    simular(oferta)
    const datos = cuerpo(oferta)
    datos.turnos[0].plazas = 1

    const res = await editar(oferta.id, datos)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Un turno ya tiene 2 plazas ocupadas: no puede tener menos plazas' })
  })

  it('permite dejar las plazas justo en las ocupadas', async () => {
    const oferta = ofertaGuardada({ turnos: [turno(3, { plazas: 3, plazasLibres: 1 })] })
    simular(oferta)
    const datos = cuerpo(oferta)
    datos.turnos[0].plazas = 2

    expect((await editar(oferta.id, datos)).statusCode).toBe(200)
    expect(oferta.turnos[0]).toMatchObject({ plazas: 2, plazasLibres: 0 })
  })

  it('responde 409 si se quita un turno con voluntarios inscritos', async () => {
    const oferta = ofertaGuardada({ turnos: [turno(3, { plazasLibres: 2 }), turno(6)] })
    simular(oferta)
    const datos = cuerpo(oferta)
    datos.turnos.shift()

    const res = await editar(oferta.id, datos)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'No puedes quitar un turno que ya tiene voluntarios inscritos' })
  })

  it('permite quitar un turno sin inscritos', async () => {
    const oferta = ofertaGuardada({ turnos: [turno(3), turno(6)] })
    simular(oferta)
    const datos = cuerpo(oferta)
    datos.turnos.shift()

    expect((await editar(oferta.id, datos)).statusCode).toBe(200)
    expect(oferta.turnos).toHaveLength(1)
  })

  it('responde 400 si alguna categoria no existe o esta inactiva', async () => {
    const oferta = ofertaGuardada()
    const { contar, guardar } = simular(oferta, { categorias: 0 })

    const res = await editar(oferta.id, cuerpo(oferta, { categoriaIds: [categoriaId, categoriaId] }))

    expect(contar).toHaveBeenCalledWith({ _id: { $in: [categoriaId] }, activa: true })
    expect(res.body).toEqual({ message: 'Las categorías no son válidas' })
    expect(guardar).not.toHaveBeenCalled()
  })

  it('devuelve el mensaje de la validacion del modelo sin guardar', async () => {
    const oferta = ofertaGuardada()
    const { guardar } = simular(oferta)
    const datos = cuerpo(oferta)
    datos.turnos[0].horaFin = '09:00'

    const res = await editar(oferta.id, datos)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La hora de fin debe ser posterior a la de inicio' })
    expect(guardar).not.toHaveBeenCalled()
  })

  it('responde 409 si la oferta cambio mientras se editaba', async () => {
    const oferta = ofertaGuardada()
    simular(oferta, { coincidencias: 0 })

    const res = await editar(oferta.id, cuerpo(oferta))

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      message: 'La oferta ha cambiado mientras la editabas. Recarga la página e inténtalo de nuevo'
    })
  })

  it('responde 500 si falla la base de datos', async () => {
    const oferta = ofertaGuardada()
    vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(errorBd()) as never)

    const res = await editar(oferta.id, cuerpo(oferta))

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al editar la oferta' })
  })

  describe('imagen', () => {
    it('sustituye la imagen y borra la anterior solo si se subio con una oferta', async () => {
      const anterior = nuevoId()
      const oferta = ofertaGuardada({ imagenes: [anterior] })
      const { crearImagen, borrarImagenes } = simular(oferta)
      const nueva = nuevoId()
      crearImagen.mockResolvedValue({ _id: nueva } as never)

      const res = await editar(oferta.id, cuerpo(oferta), { multipart: true, imagen: JPG })

      expect(res.statusCode).toBe(200)
      expect((crearImagen.mock.calls[0][0] as unknown as { contentType: string }).contentType).toBe('image/jpeg')
      expect(oferta.imagenes.map(String)).toEqual([nueva.toString()])
      expect(borrarImagenes).toHaveBeenCalledWith({ _id: { $in: [anterior] }, nombre: /^oferta-/ })
    })

    it('quitarImagen: true deja la oferta sin imagen propia', async () => {
      const anterior = nuevoId()
      const oferta = ofertaGuardada({ imagenes: [anterior] })
      const { borrarImagenes } = simular(oferta)

      await editar(oferta.id, { ...cuerpo(oferta), quitarImagen: true })

      expect(oferta.imagenes).toHaveLength(0)
      expect(borrarImagenes).toHaveBeenCalledWith({ _id: { $in: [anterior] }, nombre: /^oferta-/ })
    })

    it.each([undefined, 'si', 1])('conserva la imagen si quitarImagen es %s y no llega otra', async (quitarImagen) => {
      const anterior = nuevoId()
      const oferta = ofertaGuardada({ imagenes: [anterior] })
      const { borrarImagenes } = simular(oferta)

      await editar(oferta.id, { ...cuerpo(oferta), quitarImagen })

      expect(oferta.imagenes.map(String)).toEqual([anterior.toString()])
      expect(borrarImagenes).not.toHaveBeenCalled()
    })

    it('si falla el borrado de la imagen anterior, lo registra y responde 200', async () => {
      const oferta = ofertaGuardada({ imagenes: [nuevoId()] })
      const { borrarImagenes } = simular(oferta)
      borrarImagenes.mockRejectedValue(errorBd())

      const res = await editar(oferta.id, { ...cuerpo(oferta), quitarImagen: true })

      expect(res.statusCode).toBe(200)
      expect(console.error).toHaveBeenCalledWith('Error al borrar la imagen anterior de una oferta:', expect.any(Error))
    })

    it('borra la imagen nueva si la oferta cambio mientras se editaba', async () => {
      const oferta = ofertaGuardada()
      const { crearImagen, borrarImagen } = simular(oferta, { coincidencias: 0 })
      const nueva = nuevoId()
      crearImagen.mockResolvedValue({ _id: nueva } as never)

      const res = await editar(oferta.id, cuerpo(oferta), { multipart: true, imagen: PNG })

      expect(res.statusCode).toBe(409)
      expect(borrarImagen).toHaveBeenCalledWith({ _id: nueva })
    })

    it('borra la imagen nueva si la validacion del modelo falla', async () => {
      const oferta = ofertaGuardada()
      const { crearImagen, borrarImagen } = simular(oferta)
      const nueva = nuevoId()
      crearImagen.mockResolvedValue({ _id: nueva } as never)
      const datos = cuerpo(oferta)
      datos.turnos[0].horaFin = '09:00'

      const res = await editar(oferta.id, datos, { multipart: true, imagen: PNG })

      expect(res.statusCode).toBe(400)
      expect(borrarImagen).toHaveBeenCalledWith({ _id: nueva })
    })

    it('responde 500 y borra la imagen nueva si falla al guardar', async () => {
      const oferta = ofertaGuardada()
      const { guardar, crearImagen, borrarImagen } = simular(oferta)
      const nueva = nuevoId()
      crearImagen.mockResolvedValue({ _id: nueva } as never)
      guardar.mockRejectedValue(errorBd())

      const res = await editar(oferta.id, cuerpo(oferta), { multipart: true, imagen: PNG })

      expect(res.statusCode).toBe(500)
      expect(borrarImagen).toHaveBeenCalledWith({ _id: nueva })
    })

    it('registra el error si no puede borrar la imagen nueva tras un fallo', async () => {
      const oferta = ofertaGuardada()
      const { guardar, borrarImagen } = simular(oferta)
      guardar.mockRejectedValue(errorBd())
      borrarImagen.mockRejectedValue(new Error('tambien caida'))

      const res = await editar(oferta.id, cuerpo(oferta), { multipart: true, imagen: PNG })

      expect(res.statusCode).toBe(500)
      expect(console.error).toHaveBeenCalledWith('Error al borrar la imagen de una oferta no editada:', expect.any(Error))
    })

    it('no intenta borrar imagenes nuevas si la peticion no traia ninguna', async () => {
      const oferta = ofertaGuardada()
      const { guardar, borrarImagen } = simular(oferta)
      guardar.mockRejectedValue(errorBd())

      await editar(oferta.id, cuerpo(oferta))

      expect(borrarImagen).not.toHaveBeenCalled()
    })
  })
})
