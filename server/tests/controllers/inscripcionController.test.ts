/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del controlador de inscripciones y candidatos (modelos y notificaciones simulados).
 */

import type { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { Oferta } from '../../src/models/Oferta.js'
import { User } from '../../src/models/User.js'
import {
  type TurnoDatos,
  consulta,
  crearReq,
  crearRes,
  errorBd,
  nuevoId,
  turno,
  usuarioOfertante,
  usuarioVoluntario
} from '../helpers.js'

const servicio = vi.hoisted(() => ({ notificar: vi.fn() }))
vi.mock('../../src/services/notificaciones.js', () => servicio)

const {
  aceptarInscripcion,
  crearInscripcion,
  getCandidatosOferta,
  getMisInscripciones,
  rechazarInscripcion
} = await import('../../src/controllers/inscripcionController.js')

beforeEach(() => {
  servicio.notificar.mockResolvedValue(undefined)
})

const voluntario = usuarioVoluntario({ nombre: 'Ana' })
const ofertante = usuarioOfertante({ nombre: 'ONG Mar' })

// Oferta tal y como la devuelve la base de datos
function ofertaGuardada(turnos: TurnoDatos[] = [turno(2)], datos: Record<string, unknown> = {}) {
  return Oferta.hydrate({
    _id: nuevoId(),
    ofertanteId: nuevoId(),
    titulo: 'Playa limpia',
    estado: 'publicada',
    turnos,
    ...datos
  })
}

describe('crearInscripcion', () => {
  function simular(oferta: ReturnType<typeof ofertaGuardada> | null, { reservada = true } = {}) {
    const inscripcionId = nuevoId()
    return {
      buscar: vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(oferta) as never),
      crear: vi.spyOn(Inscripcion, 'create').mockImplementation((async (datos: { estado: string }) => ({
        id: inscripcionId.toString(),
        estado: datos.estado
      })) as never),
      reservar: vi.spyOn(Oferta, 'findOneAndUpdate').mockResolvedValue((reservada ? oferta : null) as never),
      deshacer: vi.spyOn(Inscripcion, 'findByIdAndDelete').mockResolvedValue(null as never),
      inscripcionId
    }
  }

  // null = sin sesion (undefined activaria el valor por defecto)
  async function inscribir(body: unknown, usuario: typeof voluntario | null = voluntario) {
    const res = crearRes()
    await crearInscripcion(crearReq({ body, usuario: usuario ?? undefined }), res)
    return res
  }

  it('responde 401 si no hay usuario autenticado', async () => {
    const res = await inscribir({}, null)
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ message: 'Debes iniciar sesión' })
  })

  it('crea la inscripcion pendiente con los turnos sin repetir y responde 201', async () => {
    const oferta = ofertaGuardada([turno(2), turno(4)])
    const { buscar, crear, inscripcionId } = simular(oferta)
    const ids = oferta.turnos.map((t) => t._id.toString())

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [...ids, ids[0]] })

    expect(buscar).toHaveBeenCalledWith({ _id: oferta.id, estado: 'publicada' })
    expect(crear).toHaveBeenCalledWith({
      voluntarioId: voluntario.id,
      ofertaId: oferta.id,
      ofertanteId: oferta.ofertanteId,
      turnoIds: ids,
      estado: 'pendiente'
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ id: inscripcionId.toString(), estado: 'pendiente' })
  })

  it('reserva una plaza en cada turno elegido de forma atomica', async () => {
    const oferta = ofertaGuardada([turno(2), turno(4), turno(6)])
    const { reservar } = simular(oferta)
    const elegidos = [oferta.turnos[0]._id.toString(), oferta.turnos[2]._id.toString()]

    await inscribir({ ofertaId: oferta.id, turnoIds: elegidos })

    // Solo se actualiza si cada turno sigue teniendo al menos una plaza libre
    expect(reservar).toHaveBeenCalledWith(
      {
        _id: oferta.id,
        estado: 'publicada',
        $and: elegidos.map((id) => ({ turnos: { $elemMatch: { _id: id, plazasLibres: { $gte: 1 } } } }))
      },
      { $inc: { 'turnos.$[turno].plazasLibres': -1 } },
      { arrayFilters: [{ 'turno._id': { $in: elegidos } }], returnDocument: 'after' }
    )
  })

  it('avisa al ofertante de la nueva solicitud', async () => {
    const oferta = ofertaGuardada()
    simular(oferta)

    await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()] })

    expect(servicio.notificar).toHaveBeenCalledWith({
      usuarioId: oferta.ofertanteId,
      tipo: 'inscripcion_nueva',
      titulo: 'Nueva solicitud de voluntariado',
      mensaje: 'Ana quiere participar en "Playa limpia".',
      enlace: `/gestionar-ofertas/${oferta.id}/candidatos`
    })
  })

  it.each([
    ['sin cuerpo', undefined],
    ['sin ofertaId', { turnoIds: [nuevoId().toString()] }],
    ['con ofertaId que no es texto', { ofertaId: 5, turnoIds: [nuevoId().toString()] }],
    ['con ofertaId invalido', { ofertaId: 'xyz', turnoIds: [nuevoId().toString()] }],
    ['sin turnos', { ofertaId: nuevoId().toString(), turnoIds: [] }],
    ['con turnos que no son lista', { ofertaId: nuevoId().toString(), turnoIds: 'x' }],
    ['con un turno invalido', { ofertaId: nuevoId().toString(), turnoIds: ['xyz'] }],
    ['con un turno que no es texto', { ofertaId: nuevoId().toString(), turnoIds: [1] }]
  ])('responde 400 %s sin consultar la base de datos', async (_caso, body) => {
    const buscar = vi.spyOn(Oferta, 'findOne')
    const res = await inscribir(body)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La oferta y los turnos seleccionados no son válidos' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 404 si la oferta no existe o no esta publicada', async () => {
    const { crear } = simular(null)

    const res = await inscribir({ ofertaId: nuevoId().toString(), turnoIds: [nuevoId().toString()] })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta no existe o ya no está publicada' })
    expect(crear).not.toHaveBeenCalled()
  })

  it.each([
    ['el turno no es de la oferta', [turno(2)], () => nuevoId().toString()],
    ['el turno ya paso', [turno(-1)], null],
    ['el turno no tiene plazas', [turno(2, { plazasLibres: 0 })], null]
  ])('responde 409 sin crear nada si %s', async (_caso, turnos, otroTurno) => {
    const oferta = ofertaGuardada(turnos)
    const { crear } = simular(oferta)
    const turnoId = otroTurno ? otroTurno() : oferta.turnos[0]._id.toString()

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [turnoId] })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Alguno de los turnos ya no está disponible' })
    expect(crear).not.toHaveBeenCalled()
  })

  it('acepta un turno de hoy', async () => {
    const oferta = ofertaGuardada([turno(0)])
    simular(oferta)

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()] })
    expect(res.statusCode).toBe(201)
  })

  it('deshace la inscripcion sin avisar si otro ocupo la ultima plaza a la vez', async () => {
    const oferta = ofertaGuardada()
    const { deshacer, inscripcionId } = simular(oferta, { reservada: false })

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()] })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Alguno de los turnos ya no está disponible' })
    expect(deshacer).toHaveBeenCalledWith(inscripcionId.toString())
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('responde 409 si ya tiene una inscripcion activa en la oferta (indice unico)', async () => {
    const oferta = ofertaGuardada()
    const { crear, reservar } = simular(oferta)
    crear.mockRejectedValue({ code: 11000 })

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()] })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Ya estás inscrito en esta oferta' })
    expect(reservar).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(errorBd()) as never)

    const res = await inscribir({ ofertaId: nuevoId().toString(), turnoIds: [nuevoId().toString()] })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo completar la inscripción' })
  })
})

describe('getMisInscripciones', () => {
  // Inscripcion con la oferta y su ofertante ya rellenados
  function inscripcionPoblada(turnos: TurnoDatos[], datos: Record<string, unknown> = {}) {
    return {
      id: nuevoId().toString(),
      ofertaId: { id: nuevoId().toString(), titulo: 'Playa limpia', ofertanteId: { nombre: 'ONG Mar' }, turnos },
      turnoIds: turnos.map((t) => t._id),
      estado: 'pendiente',
      ...datos
    }
  }

  function simular(inscripciones: unknown[] | Error) {
    const q = consulta(inscripciones)
    const buscar = vi.spyOn(Inscripcion, 'find').mockReturnValue(q as never)
    return { buscar, q }
  }

  async function mias(usuario: typeof voluntario | null = voluntario) {
    const res = crearRes()
    await getMisInscripciones(crearReq({ usuario: usuario ?? undefined }), res)
    return res
  }

  it('responde 401 si no hay usuario autenticado', async () => {
    expect((await mias(null)).statusCode).toBe(401)
  })

  it('pide las del voluntario con su oferta y organizador', async () => {
    const { buscar, q } = simular([])

    await mias()

    expect(buscar).toHaveBeenCalledWith({ voluntarioId: voluntario.id })
    expect(q.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(q.populate).toHaveBeenCalledWith({
      path: 'ofertaId',
      select: 'titulo ofertanteId turnos',
      populate: { path: 'ofertanteId', select: 'nombre' }
    })
  })

  it('calcula la fecha mas reciente y las horas de los turnos elegidos', async () => {
    const tarde = turno(5, { horaInicio: '16:00', horaFin: '17:00' })
    const manana = turno(2, { horaInicio: '09:00', horaFin: '11:30' })
    const noElegido = turno(9, { horaInicio: '08:00', horaFin: '20:00' })
    const inscripcion = inscripcionPoblada([tarde, manana, noElegido], {
      turnoIds: [tarde._id, manana._id],
      estado: 'completada',
      valoracionAlVoluntario: { puntuacion: 5, comentario: 'Genial' }
    })
    simular([inscripcion])

    const res = await mias()

    expect(res.body).toEqual([
      {
        id: inscripcion.id,
        ofertaId: inscripcion.ofertaId.id,
        titulo: 'Playa limpia',
        organizador: 'ONG Mar',
        fecha: tarde.fecha.toISOString(),
        horas: 3.5,
        estado: 'completada',
        motivoRechazo: null,
        valoracion: { puntuacion: 5, comentario: 'Genial' }
      }
    ])
  })

  it('usa las horas realizadas si estan registradas y muestra el motivo de rechazo', async () => {
    simular([
      inscripcionPoblada([turno(2)], { estado: 'rechazada', motivoRechazo: 'Completo', horasRealizadas: 0 }),
      inscripcionPoblada([turno(3)], { horasRealizadas: 1.5, valoracionAlVoluntario: { puntuacion: 3 } })
    ])

    const res = await mias()
    const [primera, segunda] = res.body as Array<Record<string, unknown>>

    expect(segunda).toMatchObject({ estado: 'rechazada', horas: 0, motivoRechazo: 'Completo', valoracion: null })
    expect(primera).toMatchObject({ horas: 1.5, valoracion: { puntuacion: 3, comentario: null } })
  })

  it('ordena por fecha descendente y deja al final las que no tienen turno', async () => {
    const sinTurno = () => inscripcionPoblada([turno(1)], { turnoIds: [nuevoId()] })
    const cercana = inscripcionPoblada([turno(1)])
    const lejana = inscripcionPoblada([turno(10)])
    simular([sinTurno(), cercana, sinTurno(), lejana])

    const res = await mias()
    const lista = res.body as Array<{ id: string; fecha: string | null; horas: number }>

    expect(lista.slice(0, 2).map((i) => i.id)).toEqual([lejana.id, cercana.id])
    expect(lista.slice(2)).toEqual([
      expect.objectContaining({ fecha: null, horas: 0 }),
      expect.objectContaining({ fecha: null, horas: 0 })
    ])
  })

  it('omite las inscripciones cuya oferta ya no existe', async () => {
    simular([{ ...inscripcionPoblada([turno(1)]), ofertaId: null }])

    const res = await mias()
    expect(res.body).toEqual([])
  })

  it('responde 500 si falla la base de datos', async () => {
    simular(errorBd())

    const res = await mias()

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo cargar el historial' })
  })
})

describe('getCandidatosOferta', () => {
  // Inscripcion con el perfil del voluntario ya rellenado
  function candidato(datos: Record<string, unknown> = {}, voluntarioDatos: Record<string, unknown> | null = {}) {
    return {
      id: nuevoId().toString(),
      estado: 'pendiente',
      createdAt: new Date('2026-02-01T10:00:00Z'),
      turnoIds: [nuevoId()],
      voluntarioId: voluntarioDatos && {
        id: nuevoId().toString(),
        nombre: 'Ana',
        email: 'ana@test.com',
        telefono: '600111222',
        ...voluntarioDatos
      },
      ...datos
    }
  }

  function simular(oferta: { id: string } | null, inscripciones: unknown[] | Error = []) {
    const q = consulta(inscripciones)
    return {
      buscarOferta: vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(oferta) as never),
      buscar: vi.spyOn(Inscripcion, 'find').mockReturnValue(q as never),
      q
    }
  }

  async function candidatos(ofertaId: string) {
    const res = crearRes()
    await getCandidatosOferta(crearReq({ params: { ofertaId }, usuario: ofertante }), res)
    return res
  }

  type Candidato = { voluntario: Record<string, unknown> } & Record<string, unknown>

  it('comprueba que la oferta es suya y pide los candidatos del mas antiguo al mas nuevo', async () => {
    const ofertaId = nuevoId().toString()
    const { buscarOferta, buscar, q } = simular({ id: ofertaId })

    await candidatos(ofertaId)

    expect(buscarOferta).toHaveBeenCalledWith({ _id: ofertaId, ofertanteId: ofertante.id })
    expect(buscar).toHaveBeenCalledWith({ ofertaId })
    expect(q.sort).toHaveBeenCalledWith({ createdAt: 1 })
    expect(q.populate).toHaveBeenCalledWith({
      path: 'voluntarioId',
      model: User,
      select: 'nombre email telefono avatarUrl isla municipio voluntario',
      populate: { path: 'voluntario.interesIds', select: 'nombre' }
    })
  })

  it('devuelve el perfil completo sin el contacto mientras la solicitud esta pendiente', async () => {
    const inscripcion = candidato(
      { mensaje: 'Tengo experiencia' },
      {
        avatarUrl: '/avatar.png',
        isla: 'tenerife',
        municipio: 'Adeje',
        voluntario: {
          fechaNacimiento: new Date('2000-01-01T00:00:00Z'),
          biografia: 'Me gusta ayudar',
          interesIds: [{ id: 'c1', nombre: 'Mar', slug: 'mar' }],
          habilidades: ['Primeros auxilios'],
          idiomas: ['Inglés'],
          estadisticas: { horasTotales: 12, colaboraciones: 3, valoracionMedia: 4.5, numValoraciones: 2 }
        }
      }
    )
    simular({ id: 'o1' }, [inscripcion])

    const res = await candidatos(nuevoId().toString())

    expect(res.body).toEqual([
      {
        id: inscripcion.id,
        estado: 'pendiente',
        mensaje: 'Tengo experiencia',
        motivoRechazo: null,
        fechaSolicitud: inscripcion.createdAt,
        fechaResolucion: null,
        turnoIds: inscripcion.turnoIds.map(String),
        voluntario: {
          id: inscripcion.voluntarioId!.id,
          nombre: 'Ana',
          avatarUrl: '/avatar.png',
          isla: 'tenerife',
          municipio: 'Adeje',
          // Nacida el 1 de enero: ya ha cumplido años cualquier dia del año
          edad: new Date().getUTCFullYear() - 2000,
          biografia: 'Me gusta ayudar',
          intereses: [{ id: 'c1', nombre: 'Mar' }],
          habilidades: ['Primeros auxilios'],
          idiomas: ['Inglés'],
          estadisticas: { horasTotales: 12, colaboraciones: 3, valoracionMedia: 4.5, numValoraciones: 2 },
          email: null,
          telefono: null
        }
      }
    ])
  })

  it('rellena con valores vacios el perfil de un voluntario sin datos', async () => {
    simular({ id: 'o1' }, [
      candidato({}, { telefono: undefined }),
      candidato({}, { voluntario: { estadisticas: {} } })
    ])

    const res = await candidatos(nuevoId().toString())
    const vacio = {
      avatarUrl: null,
      isla: null,
      municipio: null,
      edad: null,
      biografia: null,
      intereses: [],
      habilidades: [],
      idiomas: [],
      estadisticas: { horasTotales: 0, colaboraciones: 0, valoracionMedia: 0, numValoraciones: 0 }
    }

    for (const c of res.body as Candidato[]) expect(c.voluntario).toMatchObject(vacio)
  })

  it.each([
    ['ya los cumplio ayer', -1, 30],
    ['los cumple mañana', 1, 29],
    ['los cumple el mes que viene', 31, 29],
    ['los cumplio el mes pasado', -31, 30]
  ])('calcula bien la edad de quien cumple 30 años y %s', async (_caso, dias, edad) => {
    const hoy = new Date()
    const nacimiento = new Date(Date.UTC(hoy.getUTCFullYear() - 30, hoy.getUTCMonth(), hoy.getUTCDate() + dias))
    simular({ id: 'o1' }, [candidato({}, { voluntario: { fechaNacimiento: nacimiento } })])

    const res = await candidatos(nuevoId().toString())

    expect((res.body as Candidato[])[0].voluntario.edad).toBe(edad)
  })

  it('cumple años justo hoy', async () => {
    const hoy = new Date()
    const nacimiento = new Date(Date.UTC(hoy.getUTCFullYear() - 25, hoy.getUTCMonth(), hoy.getUTCDate()))
    simular({ id: 'o1' }, [candidato({}, { voluntario: { fechaNacimiento: nacimiento } })])

    const res = await candidatos(nuevoId().toString())

    expect((res.body as Candidato[])[0].voluntario.edad).toBe(25)
  })

  it.each(['aceptada', 'completada'])('muestra el contacto si la solicitud esta %s', async (estado) => {
    simular({ id: 'o1' }, [candidato({ estado })])

    const res = await candidatos(nuevoId().toString())

    expect((res.body as Candidato[])[0].voluntario).toMatchObject({ email: 'ana@test.com', telefono: '600111222' })
  })

  it.each(['rechazada', 'cancelada', 'no_presentado'])('oculta el contacto si la solicitud esta %s', async (estado) => {
    simular({ id: 'o1' }, [candidato({ estado, motivoRechazo: 'x', fechaResolucion: new Date(0) })])

    const res = await candidatos(nuevoId().toString())
    const [c] = res.body as Candidato[]

    expect(c.voluntario).toMatchObject({ email: null, telefono: null })
    expect(c).toMatchObject({ motivoRechazo: 'x', fechaResolucion: new Date(0) })
  })

  it('muestra el email aunque el aceptado no tenga telefono', async () => {
    simular({ id: 'o1' }, [candidato({ estado: 'aceptada' }, { telefono: undefined })])

    const res = await candidatos(nuevoId().toString())

    expect((res.body as Candidato[])[0].voluntario).toMatchObject({ email: 'ana@test.com', telefono: null })
  })

  it('omite los candidatos cuya cuenta ya no existe', async () => {
    simular({ id: 'o1' }, [candidato({}, null)])

    const res = await candidatos(nuevoId().toString())
    expect(res.body).toEqual([])
  })

  it('responde 404 si el id no es valido o la oferta no es suya', async () => {
    const buscarOferta = vi.spyOn(Oferta, 'findOne')
    expect((await candidatos('xyz')).statusCode).toBe(404)
    expect(buscarOferta).not.toHaveBeenCalled()

    simular(null)
    const res = await candidatos(nuevoId().toString())
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La oferta no existe o no es tuya' })
  })

  it('responde 500 si falla la base de datos', async () => {
    simular({ id: 'o1' }, errorBd())

    const res = await candidatos(nuevoId().toString())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudieron cargar los candidatos' })
  })
})

describe('aceptarInscripcion y rechazarInscripcion', () => {
  type Resuelta = { id: string; estado: string; ofertaId: Types.ObjectId; voluntarioId: Types.ObjectId; turnoIds: Types.ObjectId[] }

  function simular(
    resultado: 'aceptada' | 'rechazada' | null,
    { existe = false, titulo = 'Playa limpia' as string | null } = {}
  ) {
    const inscripcion: Resuelta | null = resultado && {
      id: nuevoId().toString(),
      estado: resultado,
      ofertaId: nuevoId(),
      voluntarioId: nuevoId(),
      turnoIds: [nuevoId(), nuevoId()]
    }
    const qTitulo = consulta(titulo === null ? null : { titulo })
    return {
      resolver: vi.spyOn(Inscripcion, 'findOneAndUpdate').mockResolvedValue(inscripcion as never),
      existe: vi.spyOn(Inscripcion, 'exists').mockResolvedValue((existe ? { _id: nuevoId() } : null) as never),
      liberar: vi.spyOn(Oferta, 'updateOne').mockResolvedValue({} as never),
      buscarTitulo: vi.spyOn(Oferta, 'findById').mockReturnValue(qTitulo as never),
      qTitulo,
      inscripcion
    }
  }

  async function resolver(decision: 'aceptar' | 'rechazar', id: string, body: unknown = {}) {
    const res = crearRes()
    const controlador = decision === 'aceptar' ? aceptarInscripcion : rechazarInscripcion
    await controlador(crearReq({ params: { id }, body, usuario: ofertante }), res)
    return res
  }

  it('acepta solo si la solicitud es suya y sigue pendiente, en una sola operacion', async () => {
    const { resolver: actualizar, liberar, inscripcion } = simular('aceptada')
    const id = nuevoId().toString()
    const antes = Date.now()

    const res = await resolver('aceptar', id, { motivo: 'No aplica al aceptar' })

    const [filtro, cambios, opciones] = actualizar.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown]
    expect(filtro).toEqual({ _id: id, ofertanteId: ofertante.id, estado: 'pendiente' })
    expect(cambios).toEqual({ estado: 'aceptada', fechaResolucion: expect.any(Date) })
    expect((cambios.fechaResolucion as Date).getTime()).toBeGreaterThanOrEqual(antes)
    expect(opciones).toEqual({ returnDocument: 'after' })
    // Al aceptar, la plaza sigue ocupada
    expect(liberar).not.toHaveBeenCalled()
    expect(res.body).toEqual({ id: inscripcion!.id, estado: 'aceptada' })
  })

  it('avisa al voluntario de que ha sido aceptado', async () => {
    const { inscripcion, buscarTitulo, qTitulo } = simular('aceptada')

    await resolver('aceptar', nuevoId().toString())

    expect(buscarTitulo).toHaveBeenCalledWith(inscripcion!.ofertaId)
    expect(qTitulo.select).toHaveBeenCalledWith('titulo')
    expect(servicio.notificar).toHaveBeenCalledWith({
      usuarioId: inscripcion!.voluntarioId,
      tipo: 'inscripcion_aceptada',
      titulo: 'Solicitud aceptada',
      mensaje: 'ONG Mar ha aceptado tu solicitud para "Playa limpia".',
      enlace: '/mis_inscripciones'
    })
  })

  it('al rechazar guarda el motivo, libera las plazas de sus turnos y avisa con el motivo', async () => {
    const { resolver: actualizar, liberar, inscripcion } = simular('rechazada')

    const res = await resolver('rechazar', nuevoId().toString(), { motivo: '  Plazas cubiertas  ' })

    expect(actualizar.mock.calls[0][1]).toEqual({
      estado: 'rechazada',
      fechaResolucion: expect.any(Date),
      motivoRechazo: 'Plazas cubiertas'
    })
    expect(liberar).toHaveBeenCalledWith(
      { _id: inscripcion!.ofertaId },
      { $inc: { 'turnos.$[turno].plazasLibres': 1 } },
      { arrayFilters: [{ 'turno._id': { $in: inscripcion!.turnoIds } }] }
    )
    expect(servicio.notificar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'inscripcion_rechazada',
        titulo: 'Solicitud rechazada',
        mensaje: 'ONG Mar ha rechazado tu solicitud para "Playa limpia". Motivo: Plazas cubiertas'
      })
    )
    expect(res.body).toEqual({ id: inscripcion!.id, estado: 'rechazada' })
  })

  it.each([undefined, null, '', '   '])('rechaza sin motivo si llega %o', async (motivo) => {
    const { resolver: actualizar } = simular('rechazada')

    await resolver('rechazar', nuevoId().toString(), { motivo })

    expect(actualizar.mock.calls[0][1]).not.toHaveProperty('motivoRechazo')
    expect(servicio.notificar.mock.lastCall![0].mensaje).toBe(
      'ONG Mar ha rechazado tu solicitud para "Playa limpia".'
    )
  })

  it('acepta una peticion sin cuerpo', async () => {
    simular('rechazada')
    const res = await resolver('rechazar', nuevoId().toString(), undefined)
    expect(res.statusCode).toBe(200)
  })

  it('usa un titulo generico en el aviso si la oferta ya no existe', async () => {
    simular('aceptada', { titulo: null })

    await resolver('aceptar', nuevoId().toString())

    expect(servicio.notificar.mock.lastCall![0].mensaje).toBe('ONG Mar ha aceptado tu solicitud para "una oferta".')
  })

  it.each([
    ['un numero', 5, 'El motivo no es válido'],
    ['una lista', ['a'], 'El motivo no es válido'],
    ['demasiado largo', 'x'.repeat(501), 'El motivo no puede superar los 500 caracteres']
  ])('responde 400 sin tocar nada si el motivo es %s', async (_caso, motivo, mensaje) => {
    const actualizar = vi.spyOn(Inscripcion, 'findOneAndUpdate')

    const res = await resolver('rechazar', nuevoId().toString(), { motivo })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('acepta un motivo de exactamente 500 caracteres (sin contar espacios de los extremos)', async () => {
    simular('rechazada')
    const res = await resolver('rechazar', nuevoId().toString(), { motivo: `  ${'x'.repeat(500)}  ` })
    expect(res.statusCode).toBe(200)
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const actualizar = vi.spyOn(Inscripcion, 'findOneAndUpdate')

    const res = await resolver('aceptar', 'xyz')

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La inscripción no existe' })
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('responde 404 si no existe o es de otra entidad', async () => {
    const { existe } = simular(null)
    const id = nuevoId().toString()

    const res = await resolver('rechazar', id)

    expect(existe).toHaveBeenCalledWith({ _id: id, ofertanteId: ofertante.id })
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La inscripción no existe' })
  })

  it('responde 409 sin liberar plazas ni avisar si ya estaba resuelta', async () => {
    const { liberar } = simular(null, { existe: true })

    const res = await resolver('rechazar', nuevoId().toString())

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Esta solicitud ya se ha resuelto' })
    expect(liberar).not.toHaveBeenCalled()
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Inscripcion, 'findOneAndUpdate').mockRejectedValue(errorBd())

    const res = await resolver('aceptar', nuevoId().toString())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo actualizar la solicitud' })
  })
})
