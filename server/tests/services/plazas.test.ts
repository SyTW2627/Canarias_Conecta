/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del servicio de plazas y de la lista de espera (modelos simulados).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { Oferta } from '../../src/models/Oferta.js'
import { consulta, errorBd, nuevoId } from '../helpers.js'

const servicio = vi.hoisted(() => ({ notificar: vi.fn() }))
vi.mock('../../src/services/notificaciones.js', () => servicio)

const { liberarPlazas, promoverListaEspera, reservarPlazas } = await import('../../src/services/plazas.js')

beforeEach(() => {
  servicio.notificar.mockResolvedValue(undefined)
})

const ofertaId = nuevoId()

// Inscripcion en espera tal y como la devuelve find
function enEspera(turnos = 1) {
  return {
    _id: nuevoId(),
    ofertaId,
    ofertanteId: nuevoId(),
    voluntarioId: nuevoId(),
    turnoIds: Array.from({ length: turnos }, () => nuevoId())
  }
}

describe('reservarPlazas', () => {
  it('resta una plaza a cada turno solo si todos tienen hueco, en una operacion', async () => {
    const reservar = vi.spyOn(Oferta, 'findOneAndUpdate').mockResolvedValue({} as never)
    const turnoIds = [nuevoId(), nuevoId()]

    const ok = await reservarPlazas(ofertaId, turnoIds)

    expect(ok).toBe(true)
    expect(reservar).toHaveBeenCalledWith(
      {
        _id: ofertaId,
        estado: 'publicada',
        $and: turnoIds.map((id) => ({ turnos: { $elemMatch: { _id: id, plazasLibres: { $gte: 1 } } } }))
      },
      { $inc: { 'turnos.$[turno].plazasLibres': -1 } },
      { arrayFilters: [{ 'turno._id': { $in: turnoIds } }], returnDocument: 'after' }
    )
  })

  it('devuelve false si algun turno se ha quedado sin plazas', async () => {
    vi.spyOn(Oferta, 'findOneAndUpdate').mockResolvedValue(null as never)

    expect(await reservarPlazas(ofertaId, [nuevoId()])).toBe(false)
  })
})

describe('promoverListaEspera', () => {
  function simular(cola: ReturnType<typeof enEspera>[], { hayPlaza = [] as boolean[], sigueEnEspera = true, titulo = 'Playa limpia' as string | null } = {}) {
    const qCola = consulta(cola)
    const reservar = vi.spyOn(Oferta, 'findOneAndUpdate')
    for (const ok of hayPlaza) reservar.mockResolvedValueOnce((ok ? {} : null) as never)
    const qTitulo = consulta(titulo === null ? null : { titulo })
    return {
      qCola,
      reservar,
      buscarCola: vi.spyOn(Inscripcion, 'find').mockReturnValue(qCola as never),
      promover: vi.spyOn(Inscripcion, 'findOneAndUpdate').mockImplementation((async (filtro: { _id: unknown }) => {
        const inscripcion = cola.find((i) => i._id === filtro._id)
        return sigueEnEspera && inscripcion ? { ...inscripcion, estado: 'pendiente' } : null
      }) as never),
      devolver: vi.spyOn(Oferta, 'updateOne').mockResolvedValue({} as never),
      buscarTitulo: vi.spyOn(Oferta, 'findById').mockReturnValue(qTitulo as never),
      qTitulo
    }
  }

  it('recorre la cola de esa oferta por orden de llegada', async () => {
    const { buscarCola, qCola } = simular([])

    await promoverListaEspera(ofertaId)

    expect(buscarCola).toHaveBeenCalledWith({ ofertaId, estado: 'en_espera' })
    expect(qCola.sort).toHaveBeenCalledWith({ createdAt: 1 })
  })

  it('pasa a pendiente a la primera persona con plaza y avisa a ella y al ofertante', async () => {
    const primera = enEspera()
    const { reservar, promover, qTitulo } = simular([primera], { hayPlaza: [true] })

    await promoverListaEspera(ofertaId)

    expect(reservar.mock.calls[0][0]).toMatchObject({ _id: ofertaId, estado: 'publicada' })
    expect(reservar.mock.calls[0][2]).toMatchObject({ arrayFilters: [{ 'turno._id': { $in: primera.turnoIds } }] })
    // Solo la promueve si sigue en espera (no la ha cancelado mientras tanto)
    expect(promover).toHaveBeenCalledWith(
      { _id: primera._id, estado: 'en_espera' },
      { estado: 'pendiente' },
      { returnDocument: 'after' }
    )
    expect(qTitulo.select).toHaveBeenCalledWith('titulo')
    expect(servicio.notificar).toHaveBeenCalledWith([
      expect.objectContaining({
        usuarioId: primera.voluntarioId,
        tipo: 'lista_espera_plaza',
        titulo: 'Se ha liberado una plaza',
        mensaje: expect.stringContaining('Sales de la lista de espera de "Playa limpia"'),
        enlace: '/mis_inscripciones'
      }),
      expect.objectContaining({
        usuarioId: primera.ofertanteId,
        tipo: 'inscripcion_nueva',
        titulo: 'Nueva solicitud desde la lista de espera',
        enlace: `/gestionar-ofertas/${ofertaId}/candidatos`
      })
    ])
  })

  it('si no hay plaza para la primera, prueba con la siguiente (quien pidio menos turnos)', async () => {
    const variosTurnos = enEspera(2)
    const unTurno = enEspera(1)
    const { reservar, promover } = simular([variosTurnos, unTurno], { hayPlaza: [false, true] })

    await promoverListaEspera(ofertaId)

    expect(reservar).toHaveBeenCalledTimes(2)
    expect(promover).toHaveBeenCalledOnce()
    expect(promover.mock.calls[0][0]).toEqual({ _id: unTurno._id, estado: 'en_espera' })
    expect(servicio.notificar).toHaveBeenCalledOnce()
    expect(servicio.notificar.mock.calls[0][0][0].usuarioId).toBe(unTurno.voluntarioId)
  })

  it('promueve a varias personas si se liberaron varias plazas', async () => {
    const cola = [enEspera(), enEspera(), enEspera()]
    const { promover } = simular(cola, { hayPlaza: [true, true, false] })

    await promoverListaEspera(ofertaId)

    expect(promover).toHaveBeenCalledTimes(2)
    expect(servicio.notificar).toHaveBeenCalledTimes(2)
  })

  it('no hace nada si nadie de la cola tiene plaza', async () => {
    const { promover } = simular([enEspera(), enEspera()], { hayPlaza: [false, false] })

    await promoverListaEspera(ofertaId)

    expect(promover).not.toHaveBeenCalled()
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('devuelve la plaza sin avisar si la persona cancelo justo mientras se promovia', async () => {
    const primera = enEspera(2)
    const { devolver } = simular([primera], { hayPlaza: [true], sigueEnEspera: false })

    await promoverListaEspera(ofertaId)

    expect(devolver).toHaveBeenCalledWith(
      { _id: ofertaId },
      { $inc: { 'turnos.$[turno].plazasLibres': 1 } },
      { arrayFilters: [{ 'turno._id': { $in: primera.turnoIds } }] }
    )
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('usa un titulo generico si la oferta ya no existe', async () => {
    simular([enEspera()], { hayPlaza: [true], titulo: null })

    await promoverListaEspera(ofertaId)

    expect(servicio.notificar.mock.calls[0][0][0].mensaje).toContain('"una oferta"')
  })
})

describe('liberarPlazas', () => {
  const inscripcion = { ofertaId, turnoIds: [nuevoId(), nuevoId()] }

  it('devuelve una plaza a cada turno y avanza la lista de espera', async () => {
    const devolver = vi.spyOn(Oferta, 'updateOne').mockResolvedValue({} as never)
    const buscarCola = vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([]) as never)

    await liberarPlazas(inscripcion)

    expect(devolver).toHaveBeenCalledWith(
      { _id: ofertaId },
      { $inc: { 'turnos.$[turno].plazasLibres': 1 } },
      { arrayFilters: [{ 'turno._id': { $in: inscripcion.turnoIds } }] }
    )
    expect(buscarCola).toHaveBeenCalledWith({ ofertaId, estado: 'en_espera' })
  })

  it('no falla si falla la lista de espera: la plaza ya esta devuelta', async () => {
    const devolver = vi.spyOn(Oferta, 'updateOne').mockResolvedValue({} as never)
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta(errorBd()) as never)

    await expect(liberarPlazas(inscripcion)).resolves.toBeUndefined()
    expect(devolver).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('Error al avanzar la lista de espera:', expect.any(Error))
  })

  it('si falla al devolver la plaza el error llega a quien la llamo', async () => {
    vi.spyOn(Oferta, 'updateOne').mockRejectedValue(errorBd())
    const buscarCola = vi.spyOn(Inscripcion, 'find')

    await expect(liberarPlazas(inscripcion)).rejects.toThrow('base de datos caida')
    expect(buscarCola).not.toHaveBeenCalled()
  })
})
