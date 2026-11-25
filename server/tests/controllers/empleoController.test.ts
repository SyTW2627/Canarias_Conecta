/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del controlador de empleo: ofertas de empleo y candidaturas
 *          (modelos y servicio de notificaciones simulados).
 */

import mongoose from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Candidatura } from '../../src/models/Candidatura.js'
import { Categoria } from '../../src/models/Categoria.js'
import { OfertaEmpleo } from '../../src/models/OfertaEmpleo.js'
import {
  consulta,
  crearReq,
  crearRes,
  errorBd,
  fecha,
  fechaUtc,
  nuevoId,
  usuarioOfertante,
  usuarioVoluntario
} from '../helpers.js'

const servicio = vi.hoisted(() => ({ notificar: vi.fn() }))
vi.mock('../../src/services/notificaciones.js', () => servicio)

const {
  admiteCandidaturas,
  buscarEmpleos,
  cerrarEmpleo,
  EMPLEOS_POR_PAGINA,
  leerPagina,
  crearCandidatura,
  crearEmpleo,
  getCandidaturasEmpleo,
  getEmpleo,
  getMisCandidaturas,
  getMisEmpleos,
  resolverCandidatura,
  retirarCandidatura
} = await import('../../src/controllers/empleoController.js')

const ofertante = usuarioOfertante()
const voluntario = usuarioVoluntario()

beforeEach(() => {
  servicio.notificar.mockResolvedValue(undefined)
})

// Oferta de empleo como la devuelve la consulta, con ofertante y categorias poblados
function empleo(datos: Record<string, unknown> = {}) {
  const _id = nuevoId()
  return {
    _id,
    id: _id.toString(),
    titulo: 'Educador/a social',
    descripcion: 'Apoyo a familias',
    ofertanteId: { nombre: 'ONG Mar' },
    categoriaIds: [{ id: 'c1', nombre: 'Educación', slug: 'educacion' }],
    tipoContrato: 'temporal',
    jornada: 'parcial',
    modalidad: 'presencial',
    ubicacion: { isla: 'tenerife', municipio: 'La Laguna' },
    vacantes: 2,
    estado: 'publicada',
    fechaPublicacion: new Date('2026-11-01T10:00:00Z'),
    ...datos
  }
}

describe('admiteCandidaturas', () => {
  it.each([
    ['publicada sin fecha limite', { estado: 'publicada' }, true],
    ['publicada con fecha limite hoy (incluida)', { estado: 'publicada', fechaLimite: fechaUtc(0) }, true],
    ['publicada con fecha limite pasada', { estado: 'publicada', fechaLimite: fechaUtc(-1) }, false],
    ['cerrada', { estado: 'cerrada' }, false]
  ])('%s -> %s', (_caso, oferta, esperado) => {
    expect(admiteCandidaturas(oferta)).toBe(esperado)
  })
})

describe('buscarEmpleos', () => {
  it('sin filtros devuelve la primera pagina de las publicadas dentro de plazo, las mas recientes primero', async () => {
    const oferta = empleo({ salario: '1.200 €/mes' })
    const q = consulta([oferta])
    const buscar = vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(q as never)
    const contar = vi.spyOn(OfertaEmpleo, 'countDocuments').mockReturnValue(consulta(1) as never)
    const res = crearRes()

    await buscarEmpleos(crearReq(), res)

    const filtro = {
      estado: 'publicada',
      $or: [{ fechaLimite: { $exists: false } }, { fechaLimite: { $gte: fechaUtc(0) } }]
    }
    expect(buscar).toHaveBeenCalledWith(filtro)
    expect(contar).toHaveBeenCalledWith(filtro)
    expect(q.sort).toHaveBeenCalledWith({ fechaPublicacion: -1, _id: -1 })
    expect(q.skip).toHaveBeenCalledWith(0)
    expect(q.limit).toHaveBeenCalledWith(EMPLEOS_POR_PAGINA)
    expect(res.body).toEqual({
      total: 1,
      pagina: 1,
      porPagina: EMPLEOS_POR_PAGINA,
      totalPaginas: 1,
      ofertas: [
      {
        id: oferta.id,
        titulo: 'Educador/a social',
        descripcion: 'Apoyo a familias',
        organizacion: 'ONG Mar',
        categorias: [{ id: 'c1', nombre: 'Educación', slug: 'educacion' }],
        tipoContrato: 'temporal',
        jornada: 'parcial',
        modalidad: 'presencial',
        ubicacion: { isla: 'tenerife', municipio: 'La Laguna' },
        salario: '1.200 €/mes',
        requisitos: null,
        vacantes: 2,
        fechaLimite: null,
        fechaPublicacion: oferta.fechaPublicacion,
        abierta: true
      }
      ]
    })
  })

  it('combina los filtros y busca cada palabra sin tildes', async () => {
    const buscar = vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([]) as never)
    const contar = vi.spyOn(OfertaEmpleo, 'countDocuments').mockReturnValue(consulta(0) as never)

    await buscarEmpleos(
      crearReq({
        query: {
          q: 'Educación  Social',
          isla: 'gran_canaria',
          tipoContrato: 'practicas',
          jornada: 'completa',
          modalidad: 'online'
        }
      }),
      crearRes()
    )

    const filtro = buscar.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(filtro).toMatchObject({
      'ubicacion.isla': 'gran_canaria',
      tipoContrato: 'practicas',
      jornada: 'completa',
      modalidad: 'online',
      $and: [{ textoBusqueda: /educacion/ }, { textoBusqueda: /social/ }]
    })
    // El total se cuenta con los mismos filtros
    expect(contar).toHaveBeenCalledWith(filtro)
  })

  it('salta las ofertas de las paginas anteriores y calcula el total de paginas', async () => {
    const q = consulta([empleo()])
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(q as never)
    vi.spyOn(OfertaEmpleo, 'countDocuments').mockReturnValue(consulta(2 * EMPLEOS_POR_PAGINA + 1) as never)
    const res = crearRes()

    await buscarEmpleos(crearReq({ query: { pagina: '3', isla: 'tenerife' } }), res)

    expect(q.skip).toHaveBeenCalledWith(2 * EMPLEOS_POR_PAGINA)
    expect(q.limit).toHaveBeenCalledWith(EMPLEOS_POR_PAGINA)
    expect(res.body).toMatchObject({ total: 2 * EMPLEOS_POR_PAGINA + 1, pagina: 3, totalPaginas: 3 })
    expect((res.body as { ofertas: unknown[] }).ofertas).toHaveLength(1)
  })

  it('una pagina posterior a la ultima llega vacia, con el total real', async () => {
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([]) as never)
    vi.spyOn(OfertaEmpleo, 'countDocuments').mockReturnValue(consulta(EMPLEOS_POR_PAGINA) as never)
    const res = crearRes()

    await buscarEmpleos(crearReq({ query: { pagina: '5' } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ofertas: [], total: EMPLEOS_POR_PAGINA, pagina: 5, porPagina: EMPLEOS_POR_PAGINA, totalPaginas: 1 })
  })

  it('sin resultados hay cero paginas', async () => {
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([]) as never)
    vi.spyOn(OfertaEmpleo, 'countDocuments').mockReturnValue(consulta(0) as never)
    const res = crearRes()

    await buscarEmpleos(crearReq(), res)

    expect(res.body).toMatchObject({ ofertas: [], total: 0, pagina: 1, totalPaginas: 0 })
  })

  it.each([
    [{ q: 'x'.repeat(101) }, 'La búsqueda no puede superar los 100 caracteres'],
    [{ isla: 'mallorca' }, 'La isla no es válida'],
    [{ tipoContrato: 'becario' }, 'El tipo de contrato no es válido'],
    [{ jornada: 'nocturna' }, 'La jornada no es válida'],
    [{ modalidad: 'hibrida' }, 'La modalidad no es válida'],
    [{ pagina: '0' }, 'La página no es válida'],
    [{ pagina: '-2' }, 'La página no es válida'],
    [{ pagina: '1.5' }, 'La página no es válida'],
    [{ pagina: 'dos' }, 'La página no es válida'],
    [{ pagina: '1001' }, 'La página no es válida']
  ])('responde 400 con %o', async (query, mensaje) => {
    const buscar = vi.spyOn(OfertaEmpleo, 'find')
    const res = crearRes()

    await buscarEmpleos(crearReq({ query }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta(errorBd()) as never)
    vi.spyOn(OfertaEmpleo, 'countDocuments').mockReturnValue(consulta(0) as never)
    const res = crearRes()

    await buscarEmpleos(crearReq(), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al buscar las ofertas de empleo' })
  })

  it('responde 500 si falla el recuento', async () => {
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([empleo()]) as never)
    vi.spyOn(OfertaEmpleo, 'countDocuments').mockReturnValue(consulta(errorBd()) as never)
    const res = crearRes()

    await buscarEmpleos(crearReq(), res)

    expect(res.statusCode).toBe(500)
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

describe('getEmpleo', () => {
  it('devuelve una oferta publicada; fuera de plazo sale como no abierta', async () => {
    const oferta = empleo({ fechaLimite: fechaUtc(-2) })
    const buscar = vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([oferta]) as never)
    const res = crearRes()

    await getEmpleo(crearReq({ params: { id: oferta.id } }), res)

    expect(buscar).toHaveBeenCalledWith({ _id: oferta.id, estado: 'publicada' })
    expect(res.body).toMatchObject({ id: oferta.id, abierta: false, fechaLimite: fechaUtc(-2) })
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const buscar = vi.spyOn(OfertaEmpleo, 'find')
    const res = crearRes()

    await getEmpleo(crearReq({ params: { id: 'abc' } }), res)

    expect(res.statusCode).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 404 si no existe o esta cerrada', async () => {
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([]) as never)
    const res = crearRes()

    await getEmpleo(crearReq({ params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta de empleo no existe o ya no está disponible' })
  })
})

describe('crearEmpleo', () => {
  const categoriaId = nuevoId().toString()
  const valido = {
    titulo: 'Monitor/a de tiempo libre',
    descripcion: 'Campamentos de verano',
    categoriaIds: [categoriaId],
    tipoContrato: 'temporal',
    jornada: 'completa',
    modalidad: 'presencial',
    ubicacion: { isla: 'la_palma', municipio: 'Los Llanos', direccion: 'Calle Real 1' },
    salario: '  1.300 €/mes  ',
    requisitos: 'Titulo de monitor',
    vacantes: 4,
    fechaLimite: fecha(10)
  }

  function simularCreacion() {
    vi.spyOn(Categoria, 'countDocuments').mockResolvedValue(1 as never)
    return vi
      .spyOn(OfertaEmpleo, 'create')
      .mockImplementation((async () => ({ id: 'nueva', estado: 'publicada' })) as never)
  }

  it('crea la oferta con el ofertante del token y solo los campos admitidos', async () => {
    const crear = simularCreacion()
    const res = crearRes()

    await crearEmpleo(crearReq({ usuario: ofertante, body: { ...valido, estado: 'cerrada', extra: 1 } }), res)

    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ id: 'nueva', estado: 'publicada' })
    const datos = crear.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(datos).toMatchObject({
      ofertanteId: ofertante.id,
      categoriaIds: [categoriaId],
      // Sin la direccion: una oferta de empleo no la guarda
      ubicacion: { isla: 'la_palma', municipio: 'Los Llanos' },
      salario: '1.300 €/mes',
      vacantes: 4,
      fechaLimite: fechaUtc(10),
      textoBusqueda: 'monitor/a de tiempo libre campamentos de verano ong mar los llanos',
      // El estado no se puede elegir: se publica siempre
      estado: 'publicada'
    })
    expect(datos).not.toHaveProperty('extra')
  })

  it('una oferta online no guarda ubicacion; sin categorias no consulta el catalogo', async () => {
    const crear = simularCreacion()
    const contar = vi.mocked(Categoria.countDocuments)

    await crearEmpleo(
      crearReq({
        usuario: ofertante,
        body: { ...valido, categoriaIds: [], modalidad: 'online', fechaLimite: undefined, vacantes: undefined }
      }),
      crearRes()
    )

    const datos = crear.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(datos.ubicacion).toBeUndefined()
    expect(datos.fechaLimite).toBeUndefined()
    expect(datos.vacantes).toBe(1)
    expect(contar).not.toHaveBeenCalled()
  })

  it.each([
    [{ titulo: '  ' }, 'El título y la descripción son obligatorios'],
    [{ tipoContrato: 'becario' }, 'El tipo de contrato no es válido'],
    [{ jornada: undefined }, 'La jornada no es válida'],
    [{ modalidad: 'hibrida' }, 'La modalidad no es válida'],
    [{ vacantes: 0 }, 'Las vacantes deben ser un número entre 1 y 100'],
    [{ vacantes: 2.5 }, 'Las vacantes deben ser un número entre 1 y 100'],
    [{ categoriaIds: ['no-es-un-id'] }, 'Las categorías no son válidas'],
    [{ salario: 1200 }, 'El salario no es válido'],
    [{ salario: 'x'.repeat(101) }, 'El salario no puede superar los 100 caracteres'],
    [{ fechaLimite: '15/12/2026' }, 'La fecha límite debe tener el formato AAAA-MM-DD'],
    [{ fechaLimite: fecha(-1) }, 'La fecha límite no puede ser pasada'],
    [{ ubicacion: undefined }, 'La oferta necesita una ubicación'],
    [{ ubicacion: { isla: 'mallorca', municipio: 'Palma' } }, 'La isla no es válida'],
    [{ ubicacion: { isla: 'tenerife', municipio: ' ' } }, 'El municipio es obligatorio']
  ])('responde 400 con %o', async (cambio, mensaje) => {
    const crear = vi.spyOn(OfertaEmpleo, 'create')
    const res = crearRes()

    await crearEmpleo(crearReq({ usuario: ofertante, body: { ...valido, ...cambio } }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(crear).not.toHaveBeenCalled()
  })

  it('responde 400 si alguna categoria no existe o no esta activa', async () => {
    vi.spyOn(Categoria, 'countDocuments').mockResolvedValue(0 as never)
    const crear = vi.spyOn(OfertaEmpleo, 'create')
    const res = crearRes()

    await crearEmpleo(crearReq({ usuario: ofertante, body: valido }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Las categorías no son válidas' })
    expect(crear).not.toHaveBeenCalled()
  })

  it('responde 400 si Mongoose rechaza los datos y 500 si falla la base de datos', async () => {
    vi.spyOn(Categoria, 'countDocuments').mockResolvedValue(1 as never)
    const crear = vi.spyOn(OfertaEmpleo, 'create')

    crear.mockRejectedValueOnce(new mongoose.Error.ValidationError())
    const res400 = crearRes()
    await crearEmpleo(crearReq({ usuario: ofertante, body: valido }), res400)
    expect(res400.statusCode).toBe(400)
    expect(res400.body).toEqual({ message: 'Los datos de la oferta de empleo no son válidos' })

    crear.mockRejectedValueOnce(errorBd())
    const res500 = crearRes()
    await crearEmpleo(crearReq({ usuario: ofertante, body: valido }), res500)
    expect(res500.statusCode).toBe(500)
  })
})

describe('getMisEmpleos', () => {
  it('devuelve sus ofertas con el numero de candidaturas y las pendientes', async () => {
    const conCandidaturas = empleo()
    const sinCandidaturas = empleo({ estado: 'cerrada' })
    const q = consulta([conCandidaturas, sinCandidaturas])
    const buscar = vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(q as never)
    const agregar = vi
      .spyOn(Candidatura, 'aggregate')
      .mockResolvedValue([{ _id: conCandidaturas._id, total: 3, pendientes: 1 }] as never)
    const res = crearRes()

    await getMisEmpleos(crearReq({ usuario: ofertante }), res)

    expect(buscar).toHaveBeenCalledWith({ ofertanteId: ofertante.id })
    expect(q.sort).toHaveBeenCalledWith({ createdAt: -1 })
    // Las retiradas no cuentan
    const etapas = agregar.mock.calls[0][0] as unknown as Array<{ $match?: Record<string, unknown> }>
    expect(etapas[0].$match).toMatchObject({ estado: { $ne: 'retirada' } })
    expect(res.body).toMatchObject([
      { id: conCandidaturas.id, estado: 'publicada', candidaturas: 3, candidaturasPendientes: 1 },
      { id: sinCandidaturas.id, estado: 'cerrada', abierta: false, candidaturas: 0, candidaturasPendientes: 0 }
    ])
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([]) as never)
    vi.spyOn(Candidatura, 'aggregate').mockRejectedValue(errorBd())
    const res = crearRes()

    await getMisEmpleos(crearReq({ usuario: ofertante }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al obtener tus ofertas de empleo' })
  })
})

describe('cerrarEmpleo', () => {
  it('la cierra filtrando por dueño y estado, y avisa a los candidatos en proceso', async () => {
    const id = nuevoId()
    const actualizar = vi
      .spyOn(OfertaEmpleo, 'findOneAndUpdate')
      .mockResolvedValue({ _id: id, id: id.toString(), titulo: 'Educador/a', estado: 'cerrada' } as never)
    const candidato = nuevoId()
    const buscar = vi
      .spyOn(Candidatura, 'find')
      .mockReturnValue(consulta([{ candidatoId: candidato }]) as never)
    const res = crearRes()

    await cerrarEmpleo(crearReq({ usuario: ofertante, params: { id: id.toString() } }), res)

    expect(actualizar).toHaveBeenCalledWith(
      { _id: id.toString(), ofertanteId: ofertante.id, estado: 'publicada' },
      { estado: 'cerrada' },
      { returnDocument: 'after' }
    )
    expect(buscar).toHaveBeenCalledWith({ ofertaEmpleoId: id, estado: { $in: ['pendiente', 'preseleccionada'] } })
    expect(servicio.notificar).toHaveBeenCalledWith([
      {
        usuarioId: candidato,
        tipo: 'oferta_cerrada',
        titulo: 'Oferta de empleo cerrada',
        mensaje: 'ONG Mar ha cerrado la oferta de empleo "Educador/a".',
        enlace: '/empleo'
      }
    ])
    expect(res.body).toEqual({ id: id.toString(), estado: 'cerrada' })
  })

  it.each([
    [true, 409, 'La oferta de empleo ya está cerrada'],
    [false, 404, 'La oferta de empleo no existe o no es tuya']
  ])('si no la cierra y existe=%s responde %i', async (existe, codigo, mensaje) => {
    vi.spyOn(OfertaEmpleo, 'findOneAndUpdate').mockResolvedValue(null as never)
    vi.spyOn(OfertaEmpleo, 'exists').mockResolvedValue((existe ? { _id: nuevoId() } : null) as never)
    const res = crearRes()

    await cerrarEmpleo(crearReq({ usuario: ofertante, params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(codigo)
    expect(res.body).toEqual({ message: mensaje })
    expect(servicio.notificar).not.toHaveBeenCalled()
  })
})

describe('crearCandidatura', () => {
  function simularOferta(datos: Record<string, unknown> = {}) {
    const _id = nuevoId()
    const oferta = {
      _id,
      id: _id.toString(),
      titulo: 'Educador/a social',
      ofertanteId: nuevoId(),
      estado: 'publicada',
      ...datos
    }
    vi.spyOn(OfertaEmpleo, 'findOne').mockResolvedValue(oferta as never)
    return oferta
  }

  it('crea la candidatura pendiente con la carta limpia y avisa a la entidad', async () => {
    const oferta = simularOferta()
    const crear = vi
      .spyOn(Candidatura, 'create')
      .mockImplementation((async () => ({ id: 'cand', estado: 'pendiente' })) as never)
    const res = crearRes()

    await crearCandidatura(
      crearReq({ usuario: voluntario, params: { id: oferta.id }, body: { mensaje: '  Me interesa  ' } }),
      res
    )

    expect(crear).toHaveBeenCalledWith({
      ofertaEmpleoId: oferta._id,
      candidatoId: voluntario.id,
      ofertanteId: oferta.ofertanteId,
      mensaje: 'Me interesa',
      estado: 'pendiente'
    })
    expect(servicio.notificar).toHaveBeenCalledWith({
      usuarioId: oferta.ofertanteId,
      tipo: 'candidatura_nueva',
      titulo: 'Nueva candidatura',
      mensaje: 'Ana se ha postulado a "Educador/a social".',
      enlace: `/empleo/${oferta.id}`
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ id: 'cand', estado: 'pendiente' })
  })

  it('responde 409 si ha pasado la fecha limite', async () => {
    const oferta = simularOferta({ fechaLimite: fechaUtc(-1) })
    const crear = vi.spyOn(Candidatura, 'create')
    const res = crearRes()

    await crearCandidatura(crearReq({ usuario: voluntario, params: { id: oferta.id } }), res)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'El plazo para presentar candidaturas ha terminado' })
    expect(crear).not.toHaveBeenCalled()
  })

  it('responde 409 si ya tiene una candidatura activa (indice unico)', async () => {
    const oferta = simularOferta()
    vi.spyOn(Candidatura, 'create').mockRejectedValue({ code: 11000 })
    const res = crearRes()

    await crearCandidatura(crearReq({ usuario: voluntario, params: { id: oferta.id } }), res)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Ya te has postulado a esta oferta' })
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('responde 404 si la oferta no esta publicada', async () => {
    vi.spyOn(OfertaEmpleo, 'findOne').mockResolvedValue(null as never)
    const res = crearRes()

    await crearCandidatura(crearReq({ usuario: voluntario, params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(404)
  })

  it.each([
    [{ mensaje: 42 }, 'El mensaje no es válido'],
    [{ mensaje: 'x'.repeat(2001) }, 'El mensaje no puede superar los 2000 caracteres']
  ])('responde 400 con %o sin consultar', async (body, mensaje) => {
    const buscar = vi.spyOn(OfertaEmpleo, 'findOne')
    const res = crearRes()

    await crearCandidatura(crearReq({ usuario: voluntario, params: { id: nuevoId().toString() }, body }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(buscar).not.toHaveBeenCalled()
  })
})

describe('getCandidaturasEmpleo', () => {
  function candidatura(estado: string) {
    return {
      id: `cand-${estado}`,
      estado,
      mensaje: undefined,
      createdAt: new Date('2026-11-20T10:00:00Z'),
      candidatoId: {
        id: 'vol',
        nombre: 'Ana',
        email: 'ana@ejemplo.com',
        telefono: '600000000',
        voluntario: {
          interesIds: [{ id: 'c1', nombre: 'Educación' }],
          habilidades: ['Primeros auxilios'],
          idiomas: [],
          acreditaciones: [{ nombre: 'Monitor', fechaObtencion: new Date('2025-01-01T00:00:00Z') }],
          estadisticas: { horasTotales: 20, colaboraciones: 4, valoracionMedia: 4.5, numValoraciones: 2 }
        }
      }
    }
  }

  it('devuelve la oferta y sus candidaturas; el contacto solo si esta preseleccionada', async () => {
    const oferta = empleo()
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([oferta]) as never)
    const q = consulta([candidatura('pendiente'), candidatura('preseleccionada')])
    const buscar = vi.spyOn(Candidatura, 'find').mockReturnValue(q as never)
    const res = crearRes()

    await getCandidaturasEmpleo(crearReq({ usuario: ofertante, params: { id: oferta.id } }), res)

    expect(buscar).toHaveBeenCalledWith({ ofertaEmpleoId: oferta._id, estado: { $ne: 'retirada' } })
    expect(q.sort).toHaveBeenCalledWith({ createdAt: 1 })
    const cuerpo = res.body as {
      oferta: { id: string; estado: string }
      candidaturas: Array<{ estado: string; mensaje: unknown; candidato: Record<string, unknown> }>
    }
    expect(cuerpo.oferta).toMatchObject({ id: oferta.id, estado: 'publicada' })
    expect(cuerpo.candidaturas[0]).toMatchObject({
      estado: 'pendiente',
      mensaje: null,
      candidato: {
        nombre: 'Ana',
        habilidades: ['Primeros auxilios'],
        acreditaciones: [{ nombre: 'Monitor', fechaObtencion: new Date('2025-01-01T00:00:00Z') }],
        estadisticas: { horasTotales: 20, colaboraciones: 4, valoracionMedia: 4.5, numValoraciones: 2 },
        email: null,
        telefono: null
      }
    })
    expect(cuerpo.candidaturas[1].candidato).toMatchObject({
      email: 'ana@ejemplo.com',
      telefono: '600000000'
    })
  })

  it('responde 404 si la oferta no es suya', async () => {
    vi.spyOn(OfertaEmpleo, 'find').mockReturnValue(consulta([]) as never)
    const buscar = vi.spyOn(Candidatura, 'find')
    const res = crearRes()

    await getCandidaturasEmpleo(crearReq({ usuario: ofertante, params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta de empleo no existe o no es tuya' })
    expect(buscar).not.toHaveBeenCalled()
  })
})

describe('resolverCandidatura', () => {
  it.each([
    ['preseleccionada', ['pendiente'], 'candidatura_preseleccionada'],
    ['descartada', ['pendiente', 'preseleccionada'], 'candidatura_descartada']
  ])('%s solo desde %o y avisa al candidato', async (estado, origen, tipo) => {
    const id = nuevoId().toString()
    const candidato = nuevoId()
    const actualizar = vi.spyOn(Candidatura, 'findOneAndUpdate').mockResolvedValue({
      id,
      estado,
      candidatoId: candidato,
      ofertaEmpleoId: nuevoId()
    } as never)
    vi.spyOn(OfertaEmpleo, 'findById').mockReturnValue(consulta({ titulo: 'Educador/a' }) as never)
    const res = crearRes()

    await resolverCandidatura(crearReq({ usuario: ofertante, params: { id }, body: { estado } }), res)

    expect(actualizar).toHaveBeenCalledWith(
      { _id: id, ofertanteId: ofertante.id, estado: { $in: origen } },
      { estado, fechaResolucion: expect.any(Date) },
      { returnDocument: 'after' }
    )
    expect(servicio.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: candidato, tipo, enlace: '/empleo' })
    )
    expect(res.body).toEqual({ id, estado })
  })

  it.each(['pendiente', 'retirada', undefined])('responde 400 con estado %s', async (estado) => {
    const actualizar = vi.spyOn(Candidatura, 'findOneAndUpdate')
    const res = crearRes()

    await resolverCandidatura(
      crearReq({ usuario: ofertante, params: { id: nuevoId().toString() }, body: { estado } }),
      res
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'El estado no es válido' })
    expect(actualizar).not.toHaveBeenCalled()
  })

  it.each([
    [true, 409, 'Esta candidatura ya no se puede cambiar a ese estado'],
    [false, 404, 'La candidatura no existe']
  ])('si no cambia y existe=%s responde %i', async (existe, codigo, mensaje) => {
    vi.spyOn(Candidatura, 'findOneAndUpdate').mockResolvedValue(null as never)
    vi.spyOn(Candidatura, 'exists').mockResolvedValue((existe ? { _id: nuevoId() } : null) as never)
    const res = crearRes()

    await resolverCandidatura(
      crearReq({ usuario: ofertante, params: { id: nuevoId().toString() }, body: { estado: 'descartada' } }),
      res
    )

    expect(res.statusCode).toBe(codigo)
    expect(res.body).toEqual({ message: mensaje })
    expect(servicio.notificar).not.toHaveBeenCalled()
  })
})

describe('retirarCandidatura', () => {
  it('la retira si es suya y sigue en proceso', async () => {
    const id = nuevoId().toString()
    const actualizar = vi
      .spyOn(Candidatura, 'findOneAndUpdate')
      .mockResolvedValue({ id, estado: 'retirada' } as never)
    const res = crearRes()

    await retirarCandidatura(crearReq({ usuario: voluntario, params: { id } }), res)

    expect(actualizar).toHaveBeenCalledWith(
      { _id: id, candidatoId: voluntario.id, estado: { $in: ['pendiente', 'preseleccionada'] } },
      { estado: 'retirada' },
      { returnDocument: 'after' }
    )
    expect(res.body).toEqual({ id, estado: 'retirada' })
  })

  it.each([
    [true, 409, 'Esta candidatura ya no se puede retirar'],
    [false, 404, 'La candidatura no existe']
  ])('si no la retira y existe=%s responde %i', async (existe, codigo, mensaje) => {
    vi.spyOn(Candidatura, 'findOneAndUpdate').mockResolvedValue(null as never)
    vi.spyOn(Candidatura, 'exists').mockResolvedValue((existe ? { _id: nuevoId() } : null) as never)
    const res = crearRes()

    await retirarCandidatura(crearReq({ usuario: voluntario, params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(codigo)
    expect(res.body).toEqual({ message: mensaje })
  })
})

describe('getMisCandidaturas', () => {
  it('devuelve sus candidaturas con los datos de la oferta y omite las de ofertas borradas', async () => {
    const q = consulta([
      {
        id: 'c1',
        estado: 'pendiente',
        createdAt: new Date('2026-11-20T10:00:00Z'),
        ofertaEmpleoId: {
          id: 'o1',
          titulo: 'Educador/a',
          estado: 'publicada',
          fechaLimite: fechaUtc(-1),
          tipoContrato: 'temporal',
          jornada: 'parcial',
          modalidad: 'online',
          ofertanteId: { nombre: 'ONG Mar' }
        }
      },
      { id: 'c2', estado: 'pendiente', createdAt: new Date(), ofertaEmpleoId: null }
    ])
    const buscar = vi.spyOn(Candidatura, 'find').mockReturnValue(q as never)
    const res = crearRes()

    await getMisCandidaturas(crearReq({ usuario: voluntario }), res)

    expect(buscar).toHaveBeenCalledWith({ candidatoId: voluntario.id })
    expect(q.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(res.body).toEqual([
      {
        id: 'c1',
        estado: 'pendiente',
        fechaCandidatura: new Date('2026-11-20T10:00:00Z'),
        ofertaId: 'o1',
        titulo: 'Educador/a',
        organizacion: 'ONG Mar',
        tipoContrato: 'temporal',
        jornada: 'parcial',
        modalidad: 'online',
        ubicacion: null,
        // Ha pasado su fecha limite
        ofertaAbierta: false
      }
    ])
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Candidatura, 'find').mockReturnValue(consulta(errorBd()) as never)
    const res = crearRes()

    await getMisCandidaturas(crearReq({ usuario: voluntario }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudieron cargar tus candidaturas' })
  })
})
