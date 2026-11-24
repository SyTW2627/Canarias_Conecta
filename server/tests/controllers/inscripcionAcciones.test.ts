/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de completar, cancelar, valorar y la lista de espera de las inscripciones.
 */

import { Types } from 'mongoose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// Las plazas tienen sus propios tests: aqui solo importa cuando se reservan o se liberan
const plazas = vi.hoisted(() => ({
  reservarPlazas: vi.fn(),
  liberarPlazas: vi.fn(),
  promoverListaEspera: vi.fn()
}))
vi.mock('../../src/services/plazas.js', () => plazas)

// Los retos tienen sus propios tests: aqui solo importa cuando se comprueban
const logros = vi.hoisted(() => ({ actualizarLogros: vi.fn() }))
vi.mock('../../src/services/logros.js', () => logros)

const {
  ANTELACION_CANCELAR_HORAS,
  cancelarInscripcion,
  completarInscripcion,
  crearInscripcion,
  getCandidatosOferta,
  getMisInscripciones,
  valorarVoluntario
} = await import('../../src/controllers/inscripcionController.js')

// Reloj fijo: los plazos (48 h, fin del turno) no dependen del dia en que se ejecuten los tests
const AHORA = new Date('2026-03-10T12:00:00.000Z')
const HORA = 60 * 60 * 1000

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
  servicio.notificar.mockResolvedValue(undefined)
  plazas.reservarPlazas.mockResolvedValue(true)
  plazas.liberarPlazas.mockResolvedValue(undefined)
  plazas.promoverListaEspera.mockResolvedValue(undefined)
  logros.actualizarLogros.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

const voluntario = usuarioVoluntario({ nombre: 'Ana' })
const ofertante = usuarioOfertante({ nombre: 'ONG Mar' })

// Turno que empieza "horas" despues de AHORA (negativo = ya empezo) y dura "duracion" horas
function turnoDesdeAhora(horas: number, duracion = 2): TurnoDatos {
  const inicio = new Date(AHORA.getTime() + horas * HORA)
  const fin = new Date(inicio.getTime() + duracion * HORA)
  const hhmm = (d: Date) => d.toISOString().slice(11, 16)
  return turno(0, {
    fecha: new Date(`${inicio.toISOString().slice(0, 10)}T00:00:00.000Z`),
    horaInicio: hhmm(inicio),
    horaFin: hhmm(fin)
  })
}

// Inscripcion tal y como la devuelve findOne (solo los campos que usa el controlador)
function inscripcionGuardada(turnos: TurnoDatos[], datos: Record<string, unknown> = {}) {
  return {
    _id: nuevoId(),
    id: nuevoId().toString(),
    voluntarioId: new Types.ObjectId(voluntario.id),
    ofertanteId: new Types.ObjectId(ofertante.id),
    ofertaId: nuevoId(),
    turnoIds: turnos.map((t) => t._id),
    estado: 'aceptada',
    save: vi.fn().mockResolvedValue(undefined),
    ...datos
  }
}

function ofertaConTurnos(turnos: TurnoDatos[], titulo = 'Playa limpia') {
  return { titulo, ofertanteId: new Types.ObjectId(ofertante.id), turnos }
}

describe('completarInscripcion', () => {
  function simular(
    inscripcion: ReturnType<typeof inscripcionGuardada> | null,
    oferta: ReturnType<typeof ofertaConTurnos> | null,
    { actualizada = true } = {}
  ) {
    const qOferta = consulta(oferta)
    return {
      buscar: vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(inscripcion) as never),
      buscarOferta: vi.spyOn(Oferta, 'findById').mockReturnValue(qOferta as never),
      actualizar: vi.spyOn(Inscripcion, 'findOneAndUpdate').mockImplementation((async (
        _filtro: unknown,
        cambios: { estado: string }
      ) => (actualizada && inscripcion ? { id: inscripcion.id, estado: cambios.estado } : null)) as never),
      sumar: vi.spyOn(User, 'updateOne').mockResolvedValue({} as never),
      qOferta
    }
  }

  async function completar(id: string, body: unknown) {
    const res = crearRes()
    await completarInscripcion(crearReq({ params: { id }, body, usuario: ofertante }), res)
    return res
  }

  // Dos turnos ya terminados: 2 h y 3,5 h
  const terminados = () => [turnoDesdeAhora(-48, 2), turnoDesdeAhora(-24, 3.5)]

  it('marca como completada, suma las horas previstas y una colaboracion y avisa al voluntario', async () => {
    const turnos = terminados()
    const inscripcion = inscripcionGuardada(turnos)
    const { buscar, actualizar, sumar, qOferta } = simular(inscripcion, ofertaConTurnos(turnos))

    const res = await completar(inscripcion.id, { asistio: true })

    expect(buscar).toHaveBeenCalledWith({ _id: inscripcion.id, ofertanteId: ofertante.id })
    expect(qOferta.select).toHaveBeenCalledWith('titulo turnos')
    // El filtro incluye el estado para que dos peticiones a la vez no sumen dos veces
    expect(actualizar).toHaveBeenCalledWith(
      { _id: inscripcion._id, estado: 'aceptada' },
      { estado: 'completada', horasRealizadas: 5.5 },
      { returnDocument: 'after' }
    )
    expect(sumar).toHaveBeenCalledWith(
      { _id: inscripcion.voluntarioId },
      { $inc: { 'voluntario.estadisticas.horasTotales': 5.5, 'voluntario.estadisticas.colaboraciones': 1 } }
    )
    expect(servicio.notificar).toHaveBeenCalledWith({
      usuarioId: inscripcion.voluntarioId,
      tipo: 'inscripcion_completada',
      titulo: 'Colaboración completada',
      mensaje: 'ONG Mar ha confirmado tu participación en "Playa limpia". Se han sumado 5.5 h a tu perfil.',
      enlace: '/mis_inscripciones'
    })
    expect(res.body).toEqual({ id: inscripcion.id, estado: 'completada', horasRealizadas: 5.5 })
  })

  it('usa las horas indicadas por el ofertante redondeadas a dos decimales', async () => {
    const turnos = terminados()
    const inscripcion = inscripcionGuardada(turnos)
    const { actualizar, sumar } = simular(inscripcion, ofertaConTurnos(turnos))

    const res = await completar(inscripcion.id, { asistio: true, horas: 4.126 })

    expect(actualizar.mock.calls[0][1]).toEqual({ estado: 'completada', horasRealizadas: 4.13 })
    expect(sumar.mock.calls[0][1]).toMatchObject({ $inc: { 'voluntario.estadisticas.horasTotales': 4.13 } })
    expect(res.body).toMatchObject({ horasRealizadas: 4.13 })
  })

  it('si no se presento lo marca con 0 horas sin tocar sus estadisticas ni avisar', async () => {
    const turnos = terminados()
    const inscripcion = inscripcionGuardada(turnos)
    const { actualizar, sumar } = simular(inscripcion, ofertaConTurnos(turnos))

    // Las horas se ignoran si no asistio
    const res = await completar(inscripcion.id, { asistio: false, horas: 3 })

    expect(actualizar.mock.calls[0][1]).toEqual({ estado: 'no_presentado', horasRealizadas: 0 })
    expect(sumar).not.toHaveBeenCalled()
    expect(servicio.notificar).not.toHaveBeenCalled()
    expect(res.body).toEqual({ id: inscripcion.id, estado: 'no_presentado', horasRealizadas: 0 })
  })

  it('solo cuenta los turnos que eligio el voluntario', async () => {
    const elegido = turnoDesdeAhora(-24, 2)
    const otro = turnoDesdeAhora(-10, 8)
    const inscripcion = inscripcionGuardada([elegido])
    const { actualizar } = simular(inscripcion, ofertaConTurnos([elegido, otro]))

    await completar(inscripcion.id, { asistio: true })

    expect(actualizar.mock.calls[0][1]).toEqual({ estado: 'completada', horasRealizadas: 2 })
  })

  it('acepta un turno que acaba justo ahora', async () => {
    const turnos = [turnoDesdeAhora(-2, 2)]
    const inscripcion = inscripcionGuardada(turnos)
    simular(inscripcion, ofertaConTurnos(turnos))

    const res = await completar(inscripcion.id, { asistio: true })
    expect(res.statusCode).toBe(200)
  })

  it('usa un titulo generico en el aviso si la oferta no tiene titulo', async () => {
    const turnos = terminados()
    const inscripcion = inscripcionGuardada(turnos)
    simular(inscripcion, { ...ofertaConTurnos(turnos), titulo: undefined as never })

    await completar(inscripcion.id, { asistio: true })

    expect(servicio.notificar.mock.lastCall![0].mensaje).toContain('"una oferta"')
  })

  it.each([
    ['sin cuerpo', undefined, 'Indica si el voluntario asistió'],
    ['sin asistio', {}, 'Indica si el voluntario asistió'],
    ['con asistio como texto', { asistio: 'true' }, 'Indica si el voluntario asistió'],
    ['con horas como texto', { asistio: true, horas: '3' }, 'Las horas realizadas no son válidas'],
    ['con 0 horas', { asistio: true, horas: 0 }, 'Las horas realizadas no son válidas'],
    ['con horas negativas', { asistio: true, horas: -1 }, 'Las horas realizadas no son válidas'],
    ['con horas infinitas', { asistio: true, horas: Infinity }, 'Las horas realizadas no son válidas'],
    ['con NaN horas', { asistio: true, horas: NaN }, 'Las horas realizadas no son válidas'],
    ['con mas de 720 horas', { asistio: true, horas: 720.5 }, 'Las horas realizadas no son válidas']
  ])('responde 400 sin consultar la base de datos %s', async (_caso, body, mensaje) => {
    const buscar = vi.spyOn(Inscripcion, 'findOne')

    const res = await completar(nuevoId().toString(), body)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('acepta el maximo de 720 horas', async () => {
    const turnos = terminados()
    const inscripcion = inscripcionGuardada(turnos)
    simular(inscripcion, ofertaConTurnos(turnos))

    const res = await completar(inscripcion.id, { asistio: true, horas: 720 })
    expect(res.statusCode).toBe(200)
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const buscar = vi.spyOn(Inscripcion, 'findOne')

    const res = await completar('xyz', { asistio: true })

    expect(res.statusCode).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 404 si la inscripcion no existe o es de otra entidad', async () => {
    simular(null, null)

    const res = await completar(nuevoId().toString(), { asistio: true })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La inscripción no existe' })
  })

  it.each(['pendiente', 'en_espera', 'rechazada', 'cancelada', 'completada', 'no_presentado'])(
    'responde 409 si la inscripcion esta %s',
    async (estado) => {
      const turnos = terminados()
      const inscripcion = inscripcionGuardada(turnos, { estado })
      const { actualizar } = simular(inscripcion, ofertaConTurnos(turnos))

      const res = await completar(inscripcion.id, { asistio: true })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({ message: 'Solo se puede completar una inscripción aceptada' })
      expect(actualizar).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['un turno no ha terminado', () => [turnoDesdeAhora(-48, 2), turnoDesdeAhora(-1, 2)], true],
    ['el turno no ha empezado', () => [turnoDesdeAhora(24, 2)], true],
    ['la oferta ya no tiene sus turnos', () => [turnoDesdeAhora(-48, 2)], false],
    ['la oferta ya no existe', () => [turnoDesdeAhora(-48, 2)], null]
  ])('responde 409 si %s', async (_caso, crearTurnos, conTurnos) => {
    const turnos = crearTurnos()
    const inscripcion = inscripcionGuardada(turnos)
    const oferta = conTurnos === null ? null : ofertaConTurnos(conTurnos ? turnos : [])
    const { actualizar } = simular(inscripcion, oferta)

    const res = await completar(inscripcion.id, { asistio: true })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'La actividad todavía no ha terminado' })
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('responde 409 sin sumar horas si otra peticion la completo a la vez', async () => {
    const turnos = terminados()
    const inscripcion = inscripcionGuardada(turnos)
    const { sumar } = simular(inscripcion, ofertaConTurnos(turnos), { actualizada: false })

    const res = await completar(inscripcion.id, { asistio: true })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Esta inscripción ya se ha completado' })
    expect(sumar).not.toHaveBeenCalled()
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(errorBd()) as never)

    const res = await completar(nuevoId().toString(), { asistio: true })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo completar la inscripción' })
  })
})

describe('cancelarInscripcion', () => {
  function simular(
    inscripcion: ReturnType<typeof inscripcionGuardada> | null,
    oferta: ReturnType<typeof ofertaConTurnos> | null,
    { cancelada = true } = {}
  ) {
    const qOferta = consulta(oferta)
    return {
      buscar: vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(inscripcion) as never),
      buscarOferta: vi.spyOn(Oferta, 'findById').mockReturnValue(qOferta as never),
      actualizar: vi.spyOn(Inscripcion, 'findOneAndUpdate').mockImplementation((async () =>
        cancelada && inscripcion ? { ...inscripcion, estado: 'cancelada' } : null) as never),
      qOferta
    }
  }

  async function cancelar(id: string, usuario = voluntario) {
    const res = crearRes()
    await cancelarInscripcion(crearReq({ params: { id }, usuario }), res)
    return res
  }

  it('cancela con antelacion: libera la plaza y avisa al ofertante sin marcarla como tardia', async () => {
    const turnos = [turnoDesdeAhora(72)]
    const inscripcion = inscripcionGuardada(turnos)
    const { buscar, actualizar, qOferta } = simular(inscripcion, ofertaConTurnos(turnos))

    const res = await cancelar(inscripcion.id)

    // Solo puede cancelar el propio voluntario
    expect(buscar).toHaveBeenCalledWith({ _id: inscripcion.id, voluntarioId: voluntario.id })
    expect(qOferta.select).toHaveBeenCalledWith('titulo ofertanteId turnos')
    expect(actualizar).toHaveBeenCalledWith(
      { _id: inscripcion._id, estado: 'aceptada' },
      { estado: 'cancelada', fechaCancelacion: AHORA, cancelacionTardia: false },
      { returnDocument: 'after' }
    )
    expect(plazas.liberarPlazas).toHaveBeenCalledWith(expect.objectContaining({ id: inscripcion.id }))
    expect(servicio.notificar).toHaveBeenCalledWith({
      usuarioId: inscripcion.ofertanteId,
      tipo: 'inscripcion_cancelada',
      titulo: 'Inscripción cancelada',
      mensaje: 'Ana ha cancelado su inscripción en "Playa limpia".',
      enlace: `/gestionar-ofertas/${inscripcion.ofertaId}/candidatos`
    })
    expect(res.body).toEqual({ id: inscripcion.id, estado: 'cancelada', cancelacionTardia: false })
  })

  it('con menos de 48 h de antelacion la marca como tardia y lo dice en el aviso', async () => {
    const turnos = [turnoDesdeAhora(ANTELACION_CANCELAR_HORAS - 1)]
    const inscripcion = inscripcionGuardada(turnos)
    const { actualizar } = simular(inscripcion, ofertaConTurnos(turnos))

    const res = await cancelar(inscripcion.id)

    expect(actualizar.mock.calls[0][1]).toMatchObject({ cancelacionTardia: true })
    expect(plazas.liberarPlazas).toHaveBeenCalled()
    expect(servicio.notificar).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Cancelación de última hora',
        mensaje: 'Ana ha cancelado su inscripción en "Playa limpia". Lo ha hecho con menos de 48 h de antelación.'
      })
    )
    expect(res.body).toMatchObject({ cancelacionTardia: true })
  })

  it('justo 48 h antes todavia no es tardia', async () => {
    const turnos = [turnoDesdeAhora(ANTELACION_CANCELAR_HORAS)]
    const inscripcion = inscripcionGuardada(turnos)
    simular(inscripcion, ofertaConTurnos(turnos))

    const res = await cancelar(inscripcion.id)
    expect(res.body).toMatchObject({ cancelacionTardia: false })
  })

  it('cuenta el plazo desde el primero de sus turnos', async () => {
    const turnos = [turnoDesdeAhora(100), turnoDesdeAhora(10)]
    const inscripcion = inscripcionGuardada(turnos)
    simular(inscripcion, ofertaConTurnos(turnos))

    const res = await cancelar(inscripcion.id)
    expect(res.body).toMatchObject({ cancelacionTardia: true })
  })

  it('tambien se puede cancelar una solicitud pendiente', async () => {
    const turnos = [turnoDesdeAhora(72)]
    const inscripcion = inscripcionGuardada(turnos, { estado: 'pendiente' })
    const { actualizar } = simular(inscripcion, ofertaConTurnos(turnos))

    const res = await cancelar(inscripcion.id)

    expect(actualizar.mock.calls[0][0]).toEqual({ _id: inscripcion._id, estado: 'pendiente' })
    expect(plazas.liberarPlazas).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
  })

  it('salir de la lista de espera no libera plazas, no avisa y nunca es tardio', async () => {
    const turnos = [turnoDesdeAhora(1)]
    const inscripcion = inscripcionGuardada(turnos, { estado: 'en_espera' })
    const { actualizar } = simular(inscripcion, ofertaConTurnos(turnos))

    const res = await cancelar(inscripcion.id)

    expect(actualizar.mock.calls[0]).toEqual([
      { _id: inscripcion._id, estado: 'en_espera' },
      { estado: 'cancelada', fechaCancelacion: AHORA, cancelacionTardia: false },
      { returnDocument: 'after' }
    ])
    expect(plazas.liberarPlazas).not.toHaveBeenCalled()
    expect(servicio.notificar).not.toHaveBeenCalled()
    expect(res.body).toEqual({ id: inscripcion.id, estado: 'cancelada', cancelacionTardia: false })
  })

  it('si la oferta ya no existe cancela igualmente con un titulo generico', async () => {
    const inscripcion = inscripcionGuardada([turnoDesdeAhora(72)])
    simular(inscripcion, null)

    const res = await cancelar(inscripcion.id)

    expect(res.body).toMatchObject({ estado: 'cancelada', cancelacionTardia: false })
    expect(servicio.notificar.mock.lastCall![0].mensaje).toBe('Ana ha cancelado su inscripción en "una oferta".')
  })

  it.each([
    ['ya empezo', -1],
    ['empieza justo ahora', 0]
  ])('responde 409 sin cancelar si la actividad %s', async (_caso, horas) => {
    const turnos = [turnoDesdeAhora(horas)]
    const inscripcion = inscripcionGuardada(turnos)
    const { actualizar } = simular(inscripcion, ofertaConTurnos(turnos))

    const res = await cancelar(inscripcion.id)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'La actividad ya ha empezado: no se puede cancelar' })
    expect(actualizar).not.toHaveBeenCalled()
    expect(plazas.liberarPlazas).not.toHaveBeenCalled()
  })

  it.each(['rechazada', 'cancelada', 'completada', 'no_presentado'])(
    'responde 409 si la inscripcion esta %s',
    async (estado) => {
      const turnos = [turnoDesdeAhora(72)]
      const inscripcion = inscripcionGuardada(turnos, { estado })
      const { actualizar } = simular(inscripcion, ofertaConTurnos(turnos))

      const res = await cancelar(inscripcion.id)

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({ message: 'Esta inscripción ya no se puede cancelar' })
      expect(actualizar).not.toHaveBeenCalled()
    }
  )

  it('responde 409 sin liberar plazas si la inscripcion cambio a la vez', async () => {
    const turnos = [turnoDesdeAhora(72)]
    const inscripcion = inscripcionGuardada(turnos)
    simular(inscripcion, ofertaConTurnos(turnos), { cancelada: false })

    const res = await cancelar(inscripcion.id)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Esta inscripción ha cambiado: vuelve a intentarlo' })
    expect(plazas.liberarPlazas).not.toHaveBeenCalled()
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const buscar = vi.spyOn(Inscripcion, 'findOne')

    const res = await cancelar('xyz')

    expect(res.statusCode).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 404 si la inscripcion no existe o es de otro voluntario', async () => {
    simular(null, null)

    const res = await cancelar(nuevoId().toString(), usuarioVoluntario())

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La inscripción no existe' })
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(errorBd()) as never)

    const res = await cancelar(nuevoId().toString())

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo cancelar la inscripción' })
  })
})

describe('crearInscripcion con lista de espera', () => {
  function simular(turnos: TurnoDatos[], { estadoFinal = 'en_espera' as string | null } = {}) {
    const oferta = Oferta.hydrate({
      _id: nuevoId(),
      ofertanteId: nuevoId(),
      titulo: 'Playa limpia',
      estado: 'publicada',
      turnos
    })
    const inscripcion = { id: nuevoId().toString(), estado: 'pendiente', save: vi.fn().mockResolvedValue(undefined) }
    const qEstado = consulta(estadoFinal === null ? null : { estado: estadoFinal })
    return {
      oferta,
      inscripcion,
      qEstado,
      buscar: vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(oferta) as never),
      crear: vi.spyOn(Inscripcion, 'create').mockResolvedValue(inscripcion as never),
      deshacer: vi.spyOn(Inscripcion, 'findByIdAndDelete').mockResolvedValue(null as never),
      releer: vi.spyOn(Inscripcion, 'findById').mockReturnValue(qEstado as never)
    }
  }

  async function inscribir(body: unknown) {
    const res = crearRes()
    await crearInscripcion(crearReq({ body, usuario: voluntario }), res)
    return res
  }

  const lleno = () => turno(2, { plazasLibres: 0 })

  it('con la oferta llena y listaEspera entra en la lista sin avisar al ofertante', async () => {
    const { oferta, inscripcion, crear, deshacer, releer, qEstado } = simular([lleno()])
    plazas.reservarPlazas.mockResolvedValue(false)
    const ids = [oferta.turnos[0]._id.toString()]

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: ids, listaEspera: true })

    // Se crea pendiente y pasa a en_espera al no poder reservar
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ estado: 'pendiente', turnoIds: ids }))
    expect(plazas.reservarPlazas).toHaveBeenCalledWith(oferta.id, ids)
    expect(inscripcion.estado).toBe('en_espera')
    expect(inscripcion.save).toHaveBeenCalled()
    expect(deshacer).not.toHaveBeenCalled()
    // Por si se libero una plaza mientras tanto
    expect(plazas.promoverListaEspera).toHaveBeenCalledWith(oferta.id)
    expect(releer).toHaveBeenCalledWith(inscripcion.id)
    expect(qEstado.select).toHaveBeenCalledWith('estado')
    expect(servicio.notificar).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ id: inscripcion.id, estado: 'en_espera' })
  })

  it('devuelve pendiente si al promover la lista ya consiguio plaza', async () => {
    const { oferta, inscripcion } = simular([lleno()], { estadoFinal: 'pendiente' })
    plazas.reservarPlazas.mockResolvedValue(false)

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()], listaEspera: true })

    expect(res.body).toEqual({ id: inscripcion.id, estado: 'pendiente' })
  })

  it('si no puede releer la inscripcion responde con en_espera', async () => {
    const { oferta } = simular([lleno()], { estadoFinal: null })
    plazas.reservarPlazas.mockResolvedValue(false)

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()], listaEspera: true })

    expect(res.body).toMatchObject({ estado: 'en_espera' })
  })

  it('con listaEspera pero con plaza libre queda pendiente y avisa al ofertante', async () => {
    const { oferta, inscripcion } = simular([turno(2)])

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()], listaEspera: true })

    expect(inscripcion.save).not.toHaveBeenCalled()
    expect(plazas.promoverListaEspera).not.toHaveBeenCalled()
    expect(servicio.notificar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'inscripcion_nueva' }))
    expect(res.body).toEqual({ id: inscripcion.id, estado: 'pendiente' })
  })

  it.each([
    ['sin listaEspera', undefined],
    ['con listaEspera que no es true', 'true']
  ])('responde 409 con la oferta llena %s', async (_caso, listaEspera) => {
    const { oferta, crear } = simular([lleno()])

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()], listaEspera })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Alguno de los turnos ya no está disponible' })
    expect(crear).not.toHaveBeenCalled()
  })

  it('la lista de espera no admite turnos que ya pasaron', async () => {
    const { oferta, crear } = simular([turno(-1, { plazasLibres: 0 })])

    const res = await inscribir({ ofertaId: oferta.id, turnoIds: [oferta.turnos[0]._id.toString()], listaEspera: true })

    expect(res.statusCode).toBe(409)
    expect(crear).not.toHaveBeenCalled()
  })
})

describe('getMisInscripciones con lista de espera', () => {
  function inscripcionPoblada(ofertaId: string, datos: Record<string, unknown> = {}) {
    const t = turnoDesdeAhora(72)
    return {
      id: nuevoId().toString(),
      ofertaId: { id: ofertaId, titulo: 'Playa limpia', ofertanteId: { nombre: 'ONG Mar' }, turnos: [t] },
      turnoIds: [t._id],
      estado: 'en_espera',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      ...datos
    }
  }

  async function mias() {
    const res = crearRes()
    await getMisInscripciones(crearReq({ usuario: voluntario }), res)
    return res
  }

  it('calcula la posicion en la cola contando quien espera desde antes en la misma oferta', async () => {
    const ofertaA = nuevoId().toString()
    const enEspera = inscripcionPoblada(ofertaA)
    const aceptada = inscripcionPoblada(nuevoId().toString(), { estado: 'aceptada' })
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([enEspera, aceptada]) as never)
    const contar = vi.spyOn(Inscripcion, 'countDocuments').mockResolvedValue(2 as never)

    const res = await mias()
    const lista = res.body as Array<{ id: string; posicionEspera: number | null; puedeCancelar: boolean }>

    // Solo se cuenta la cola de las que estan en espera
    expect(contar).toHaveBeenCalledOnce()
    expect(contar).toHaveBeenCalledWith({
      ofertaId: ofertaA,
      estado: 'en_espera',
      createdAt: { $lt: enEspera.createdAt }
    })
    expect(lista.find((i) => i.id === enEspera.id)).toMatchObject({ posicionEspera: 3, puedeCancelar: true })
    expect(lista.find((i) => i.id === aceptada.id)).toMatchObject({ posicionEspera: null, puedeCancelar: true })
  })

  it('no busca la posicion de una inscripcion en espera cuya oferta ya no existe', async () => {
    vi.spyOn(Inscripcion, 'find').mockReturnValue(
      consulta([{ ...inscripcionPoblada('x'), ofertaId: null }]) as never
    )
    const contar = vi.spyOn(Inscripcion, 'countDocuments')

    const res = await mias()

    expect(contar).not.toHaveBeenCalled()
    expect(res.body).toEqual([])
  })

  it('no deja cancelar si el turno ya empezo y marca las cancelaciones tardias', async () => {
    const empezada = inscripcionPoblada('o1', { estado: 'aceptada' })
    empezada.ofertaId.turnos = [turnoDesdeAhora(-1)]
    empezada.turnoIds = [empezada.ofertaId.turnos[0]._id]
    const tardia = inscripcionPoblada('o2', { estado: 'cancelada', cancelacionTardia: true })
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([empezada, tardia]) as never)

    const res = await mias()
    const lista = res.body as Array<Record<string, unknown>>

    expect(lista.find((i) => i.id === empezada.id)).toMatchObject({ puedeCancelar: false })
    expect(lista.find((i) => i.id === tardia.id)).toMatchObject({ puedeCancelar: false, cancelacionTardia: true })
  })
})

describe('getCandidatosOferta para confirmar la asistencia', () => {
  async function candidatos(turnos: TurnoDatos[], elegidos: TurnoDatos[][]) {
    vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta({ id: 'o1', turnos }) as never)
    vi.spyOn(Inscripcion, 'find').mockReturnValue(
      consulta(
        elegidos.map((t) => ({
          id: nuevoId().toString(),
          estado: 'aceptada',
          createdAt: AHORA,
          turnoIds: t.map((x) => x._id),
          voluntarioId: { id: nuevoId().toString(), nombre: 'Ana', email: 'a@test.com' }
        }))
      ) as never
    )
    const res = crearRes()
    await getCandidatosOferta(crearReq({ params: { ofertaId: nuevoId().toString() }, usuario: ofertante }), res)
    return res.body as Array<{ terminada: boolean; horasPrevistas: number }>
  }

  it('solo esta terminada cuando han acabado todos sus turnos y suma sus horas', async () => {
    const pasado = turnoDesdeAhora(-48, 2)
    const acabaAhora = turnoDesdeAhora(-1.5, 1.5)
    const futuro = turnoDesdeAhora(24, 3)

    const lista = await candidatos([pasado, acabaAhora, futuro], [[pasado, acabaAhora], [pasado, futuro], []])

    expect(lista).toEqual([
      expect.objectContaining({ terminada: true, horasPrevistas: 3.5 }),
      expect.objectContaining({ terminada: false, horasPrevistas: 5 }),
      // Sin turnos (la oferta los borro): nunca se da por terminada
      expect.objectContaining({ terminada: false, horasPrevistas: 0 })
    ])
  })
})

describe('valorarVoluntario', () => {
  function simular(
    inscripcion: ReturnType<typeof inscripcionGuardada> | null,
    estadisticas: { valoracionMedia?: number; numValoraciones?: number } | null = {}
  ) {
    const qVoluntario = consulta(estadisticas === null ? null : { voluntario: { estadisticas } })
    return {
      buscar: vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(inscripcion) as never),
      buscarVoluntario: vi.spyOn(User, 'findById').mockReturnValue(qVoluntario as never),
      guardarMedia: vi.spyOn(User, 'updateOne').mockResolvedValue({} as never),
      qVoluntario
    }
  }

  async function valorar(id: string, body: unknown) {
    const res = crearRes()
    await valorarVoluntario(crearReq({ params: { id }, body, usuario: ofertante }), res)
    return res
  }

  const completada = (datos: Record<string, unknown> = {}) =>
    inscripcionGuardada([turnoDesdeAhora(-24)], { estado: 'completada', ...datos })

  it('guarda la valoracion, recalcula la media del voluntario y le avisa', async () => {
    const inscripcion = completada()
    const { buscar, guardarMedia, qVoluntario } = simular(inscripcion, { valoracionMedia: 4, numValoraciones: 3 })

    const res = await valorar(inscripcion.id, { puntuacion: 5, comentario: '  Muy puntual  ' })

    expect(buscar).toHaveBeenCalledWith({ _id: inscripcion.id, ofertanteId: ofertante.id })
    expect(inscripcion).toMatchObject({
      valoracionAlVoluntario: { puntuacion: 5, comentario: 'Muy puntual', fecha: AHORA }
    })
    expect(String((inscripcion as Record<string, any>).valoracionAlVoluntario.autorId)).toBe(ofertante.id)
    expect(inscripcion.save).toHaveBeenCalled()
    expect(qVoluntario.select).toHaveBeenCalledWith('voluntario')
    // (4 * 3 + 5) / 4
    expect(guardarMedia).toHaveBeenCalledWith(
      { _id: inscripcion.voluntarioId },
      {
        $set: {
          'voluntario.estadisticas.valoracionMedia': 4.25,
          'voluntario.estadisticas.numValoraciones': 4
        }
      }
    )
    expect(servicio.notificar).toHaveBeenCalledWith({
      usuarioId: inscripcion.voluntarioId,
      tipo: 'valoracion_recibida',
      titulo: 'Has recibido una valoración',
      mensaje: 'ONG Mar ha valorado tu colaboración con 5 palmeras.',
      enlace: '/perfil'
    })
    expect(res.body).toEqual({ id: inscripcion.id, valoracion: { puntuacion: 5, comentario: 'Muy puntual' } })
  })

  it.each([
    ['sin estadisticas previas', {}],
    ['si el voluntario ya no existe', null]
  ])('la primera valoracion es la media %s', async (_caso, estadisticas) => {
    const inscripcion = completada()
    const { guardarMedia } = simular(inscripcion, estadisticas)

    await valorar(inscripcion.id, { puntuacion: 3 })

    expect(guardarMedia.mock.calls[0][1]).toEqual({
      $set: { 'voluntario.estadisticas.valoracionMedia': 3, 'voluntario.estadisticas.numValoraciones': 1 }
    })
  })

  it.each([undefined, null, '', '   '])('guarda sin comentario si llega %o', async (comentario) => {
    const inscripcion = completada()
    simular(inscripcion)

    const res = await valorar(inscripcion.id, { puntuacion: 4, comentario })

    expect((inscripcion as Record<string, any>).valoracionAlVoluntario.comentario).toBeUndefined()
    expect(res.body).toMatchObject({ valoracion: { puntuacion: 4, comentario: null } })
  })

  it.each([
    ['sin cuerpo', undefined, 'La valoración debe tener entre 1 y 5 palmeras'],
    ['sin puntuacion', {}, 'La valoración debe tener entre 1 y 5 palmeras'],
    ['con puntuacion como texto', { puntuacion: '5' }, 'La valoración debe tener entre 1 y 5 palmeras'],
    ['con puntuacion decimal', { puntuacion: 4.5 }, 'La valoración debe tener entre 1 y 5 palmeras'],
    ['con puntuacion 0', { puntuacion: 0 }, 'La valoración debe tener entre 1 y 5 palmeras'],
    ['con puntuacion 6', { puntuacion: 6 }, 'La valoración debe tener entre 1 y 5 palmeras'],
    ['con comentario que no es texto', { puntuacion: 5, comentario: 7 }, 'El comentario no es válido'],
    ['con comentario demasiado largo', { puntuacion: 5, comentario: 'x'.repeat(1001) }, 'El comentario no puede superar los 1000 caracteres']
  ])('responde 400 sin consultar la base de datos %s', async (_caso, body, mensaje) => {
    const buscar = vi.spyOn(Inscripcion, 'findOne')

    const res = await valorar(nuevoId().toString(), body)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(buscar).not.toHaveBeenCalled()
  })

  it.each([1, 5])('acepta la puntuacion limite %i', async (puntuacion) => {
    const inscripcion = completada()
    simular(inscripcion)

    const res = await valorar(inscripcion.id, { puntuacion })
    expect(res.statusCode).toBe(200)
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const buscar = vi.spyOn(Inscripcion, 'findOne')

    const res = await valorar('xyz', { puntuacion: 5 })

    expect(res.statusCode).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 404 si la inscripcion no existe o es de otra entidad', async () => {
    simular(null)

    const res = await valorar(nuevoId().toString(), { puntuacion: 5 })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La inscripción no existe' })
  })

  it.each(['pendiente', 'aceptada', 'no_presentado', 'cancelada'])(
    'responde 409 si la inscripcion esta %s',
    async (estado) => {
      const inscripcion = completada({ estado })
      simular(inscripcion)

      const res = await valorar(inscripcion.id, { puntuacion: 5 })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({ message: 'Solo puedes valorar colaboraciones completadas' })
      expect(inscripcion.save).not.toHaveBeenCalled()
    }
  )

  it('responde 409 si ya estaba valorada', async () => {
    const inscripcion = completada({ valoracionAlVoluntario: { puntuacion: 4 } })
    const { guardarMedia } = simular(inscripcion)

    const res = await valorar(inscripcion.id, { puntuacion: 5 })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Esta colaboración ya tiene una valoración' })
    expect(inscripcion.save).not.toHaveBeenCalled()
    expect(guardarMedia).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(errorBd()) as never)

    const res = await valorar(nuevoId().toString(), { puntuacion: 5 })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo guardar la valoración' })
  })
})

describe('retos al completar y al valorar', () => {
  const terminado = () => [turnoDesdeAhora(-24)]

  function simularCompletar(inscripcion: ReturnType<typeof inscripcionGuardada>, turnos: TurnoDatos[]) {
    vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(inscripcion) as never)
    vi.spyOn(Oferta, 'findById').mockReturnValue(consulta(ofertaConTurnos(turnos)) as never)
    vi.spyOn(Inscripcion, 'findOneAndUpdate').mockImplementation((async (
      _filtro: unknown,
      cambios: { estado: string }
    ) => ({ id: inscripcion.id, estado: cambios.estado })) as never)
    vi.spyOn(User, 'updateOne').mockResolvedValue({} as never)
  }

  it('comprueba los retos del voluntario cuando se confirma que participo', async () => {
    const turnos = terminado()
    const inscripcion = inscripcionGuardada(turnos)
    simularCompletar(inscripcion, turnos)
    const res = crearRes()

    await completarInscripcion(crearReq({ params: { id: inscripcion.id }, body: { asistio: true }, usuario: ofertante }), res)

    expect(logros.actualizarLogros).toHaveBeenCalledWith(inscripcion.voluntarioId)
    expect(res.body).toMatchObject({ estado: 'completada' })
  })

  it('no los comprueba si no se presento', async () => {
    const turnos = terminado()
    const inscripcion = inscripcionGuardada(turnos)
    simularCompletar(inscripcion, turnos)

    await completarInscripcion(
      crearReq({ params: { id: inscripcion.id }, body: { asistio: false }, usuario: ofertante }),
      crearRes()
    )

    expect(logros.actualizarLogros).not.toHaveBeenCalled()
  })

  it('comprueba los retos tras una valoracion', async () => {
    const inscripcion = inscripcionGuardada(terminado(), { estado: 'completada' })
    vi.spyOn(Inscripcion, 'findOne').mockReturnValue(consulta(inscripcion) as never)
    vi.spyOn(User, 'findById').mockReturnValue(consulta({ voluntario: { estadisticas: {} } }) as never)
    vi.spyOn(User, 'updateOne').mockResolvedValue({} as never)

    await valorarVoluntario(
      crearReq({ params: { id: inscripcion.id }, body: { puntuacion: 5 }, usuario: ofertante }),
      crearRes()
    )

    expect(logros.actualizarLogros).toHaveBeenCalledWith(inscripcion.voluntarioId)
  })

  it('si fallan los retos la accion responde igualmente', async () => {
    logros.actualizarLogros.mockRejectedValue(errorBd())
    const turnos = terminado()
    const inscripcion = inscripcionGuardada(turnos)
    simularCompletar(inscripcion, turnos)
    const res = crearRes()

    await completarInscripcion(crearReq({ params: { id: inscripcion.id }, body: { asistio: true }, usuario: ofertante }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ estado: 'completada' })
  })
})
