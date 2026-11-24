/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del controlador de gamificacion: retos del voluntario y ranking mensual.
 */

import { Types } from 'mongoose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { User } from '../../src/models/User.js'
import { consulta, crearReq, crearRes, errorBd, nuevoId, usuarioVoluntario } from '../helpers.js'

const servicio = vi.hoisted(() => ({ leerProgreso: vi.fn() }))
vi.mock('../../src/services/logros.js', async (original) => ({
  ...(await original<typeof import('../../src/services/logros.js')>()),
  leerProgreso: servicio.leerProgreso
}))

const { RANKING_MAX, getMisLogros, getRanking, nombrePublico } = await import(
  '../../src/controllers/gamificacionController.js'
)

const voluntario = usuarioVoluntario()

describe('getMisLogros', () => {
  it('devuelve sus metricas, sus retos y cuantos ha conseguido', async () => {
    const metricas = { horas: 12, colaboraciones: 1, islas: 1, categorias: 1, valoracionMedia: 0, numValoraciones: 0 }
    servicio.leerProgreso.mockResolvedValue({ metricas, guardados: [] })
    const res = crearRes()

    await getMisLogros(crearReq({ usuario: voluntario }), res)

    expect(servicio.leerProgreso).toHaveBeenCalledWith(voluntario.id)
    const cuerpo = res.body as { metricas: unknown; conseguidos: number; logros: Array<{ id: string }> }
    expect(cuerpo.metricas).toEqual(metricas)
    // Primer paso y Diez horas
    expect(cuerpo.conseguidos).toBe(2)
    expect(cuerpo.logros.map(({ id }) => id)).toContain('horas-100')
  })

  it('responde 404 si el usuario no existe y 500 si falla la base de datos', async () => {
    servicio.leerProgreso.mockResolvedValueOnce(null)
    const res404 = crearRes()
    await getMisLogros(crearReq({ usuario: voluntario }), res404)
    expect(res404.statusCode).toBe(404)

    servicio.leerProgreso.mockRejectedValueOnce(errorBd())
    const res500 = crearRes()
    await getMisLogros(crearReq({ usuario: voluntario }), res500)
    expect(res500.statusCode).toBe(500)
    expect(res500.body).toEqual({ message: 'No se pudieron cargar tus retos' })
  })
})

describe('nombrePublico', () => {
  it.each([
    ['Laura Pérez Gil', 'Laura P.'],
    ['  carlos   díaz ', 'carlos D.'],
    ['Ana', 'Ana']
  ])('%s -> %s', (nombre, esperado) => {
    expect(nombrePublico(nombre)).toBe(esperado)
  })
})

describe('getRanking', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function simular(filas: Array<{ _id: ReturnType<typeof nuevoId>; horas: number; colaboraciones: number }>) {
    const agregar = vi.spyOn(Inscripcion, 'aggregate').mockResolvedValue(filas as never)
    const buscarUsuarios = vi.spyOn(User, 'find').mockReturnValue(
      consulta(
        filas.map((fila, indice) => ({
          id: fila._id.toString(),
          nombre: ['Laura Pérez', 'Carlos Díaz', 'Ana'][indice] ?? `Voluntario ${indice}`
        }))
      ) as never
    )
    return { agregar, buscarUsuarios }
  }

  it('por defecto usa el mes actual en todas las islas y filtra por la fecha de la actividad', async () => {
    const { agregar } = simular([])
    const res = crearRes()

    await getRanking(crearReq({ usuario: voluntario }), res)

    const etapas = agregar.mock.calls[0][0] as unknown as Array<Record<string, any>>
    expect(etapas[0]).toEqual({ $match: { estado: 'completada' } })
    expect(etapas.some((etapa) => etapa.$match?.['oferta.ubicacion.isla'])).toBe(false)
    expect(etapas).toContainEqual({
      $match: {
        fechaActividad: {
          $gte: new Date('2026-11-01T00:00:00.000Z'),
          $lt: new Date('2026-12-01T00:00:00.000Z')
        }
      }
    })
    expect(res.body).toEqual({ mes: '2026-11', isla: null, participantes: 0, ranking: [], tuPosicion: null })
  })

  it('con isla añade el filtro y el mes de diciembre termina en enero', async () => {
    const { agregar } = simular([])

    await getRanking(crearReq({ usuario: voluntario, query: { mes: '2025-12', isla: 'la_palma' } }), crearRes())

    const etapas = agregar.mock.calls[0][0] as unknown as Array<Record<string, any>>
    expect(etapas).toContainEqual({ $match: { 'oferta.ubicacion.isla': 'la_palma' } })
    expect(etapas).toContainEqual({
      $match: {
        fechaActividad: {
          $gte: new Date('2025-12-01T00:00:00.000Z'),
          $lt: new Date('2026-01-01T00:00:00.000Z')
        }
      }
    })
  })

  it('numera con empates, abrevia los nombres y marca al voluntario que pregunta', async () => {
    const yo = new Types.ObjectId(voluntario.id)
    simular([
      { _id: nuevoId(), horas: 10, colaboraciones: 2 },
      { _id: yo, horas: 10, colaboraciones: 1 },
      { _id: nuevoId(), horas: 2.333, colaboraciones: 1 }
    ])
    const res = crearRes()

    await getRanking(crearReq({ usuario: voluntario }), res)

    expect(res.body).toMatchObject({
      participantes: 3,
      ranking: [
        { posicion: 1, nombre: 'Laura P.', horas: 10, colaboraciones: 2, eresTu: false },
        { posicion: 1, nombre: 'Carlos D.', horas: 10, colaboraciones: 1, eresTu: true },
        { posicion: 3, nombre: 'Ana', horas: 2.33, colaboraciones: 1, eresTu: false }
      ],
      tuPosicion: { posicion: 1, horas: 10, colaboraciones: 1 }
    })
  })

  it(`muestra como mucho ${RANKING_MAX} y da la posicion de quien queda fuera`, async () => {
    const yo = new Types.ObjectId(voluntario.id)
    const filas = Array.from({ length: RANKING_MAX + 2 }, (_, indice) => ({
      _id: indice === RANKING_MAX + 1 ? yo : nuevoId(),
      horas: 100 - indice,
      colaboraciones: 1
    }))
    const { buscarUsuarios } = simular(filas)
    const res = crearRes()

    await getRanking(crearReq({ usuario: voluntario }), res)

    const cuerpo = res.body as { ranking: unknown[]; tuPosicion: { posicion: number } }
    expect(cuerpo.ranking).toHaveLength(RANKING_MAX)
    expect(cuerpo.tuPosicion.posicion).toBe(RANKING_MAX + 2)
    // Solo se leen los nombres que se muestran
    const filtro = buscarUsuarios.mock.calls[0][0] as unknown as { _id: { $in: unknown[] } }
    expect(filtro._id.$in).toHaveLength(RANKING_MAX)
  })

  it.each([
    [{ mes: '2026-13' }, 'El mes debe tener el formato AAAA-MM'],
    [{ mes: 'noviembre' }, 'El mes debe tener el formato AAAA-MM'],
    [{ isla: 'mallorca' }, 'La isla no es válida']
  ])('responde 400 con %o', async (query, mensaje) => {
    const agregar = vi.spyOn(Inscripcion, 'aggregate')
    const res = crearRes()

    await getRanking(crearReq({ usuario: voluntario, query }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: mensaje })
    expect(agregar).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Inscripcion, 'aggregate').mockRejectedValue(errorBd())
    const res = crearRes()

    await getRanking(crearReq({ usuario: voluntario }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo cargar el ranking' })
  })
})
