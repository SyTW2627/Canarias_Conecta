/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de los retos: progreso, retos nuevos, metricas y aviso al conseguirlos.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { User } from '../../src/models/User.js'
import { consulta, errorBd, nuevoId } from '../helpers.js'

const servicio = vi.hoisted(() => ({ notificar: vi.fn() }))
vi.mock('../../src/services/notificaciones.js', () => servicio)

const { LOGROS, actualizarLogros, calcularLogros, leerProgreso, logrosNuevos } = await import(
  '../../src/services/logros.js'
)

beforeEach(() => {
  servicio.notificar.mockResolvedValue(undefined)
})

const SIN_ACTIVIDAD = {
  horas: 0,
  colaboraciones: 0,
  islas: 0,
  categorias: 0,
  valoracionMedia: 0,
  numValoraciones: 0
}

const metricas = (datos: Partial<typeof SIN_ACTIVIDAD> = {}) => ({ ...SIN_ACTIVIDAD, ...datos })

function estado(lista: ReturnType<typeof calcularLogros>, id: string) {
  return lista.find((logro) => logro.id === id)!
}

describe('LOGROS', () => {
  it('cada reto tiene un id unico y un objetivo positivo', () => {
    const ids = LOGROS.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const logro of LOGROS) expect(logro.objetivo).toBeGreaterThan(0)
  })
})

describe('calcularLogros', () => {
  it('sin actividad no hay ninguno conseguido y el progreso es 0', () => {
    const lista = calcularLogros(metricas(), [])

    expect(lista).toHaveLength(LOGROS.length)
    expect(lista.every((logro) => !logro.conseguido && logro.progreso === 0 && logro.fecha === null)).toBe(true)
    expect(estado(lista, 'valoracion-excelente').detalle).toBe('Todavía no tienes valoraciones')
  })

  it('el progreso no pasa del objetivo y las horas decimales se redondean hacia abajo', () => {
    const lista = calcularLogros(metricas({ horas: 12.75, colaboraciones: 3 }), [])

    expect(estado(lista, 'horas-10')).toMatchObject({ progreso: 10, conseguido: true })
    expect(estado(lista, 'horas-50')).toMatchObject({ progreso: 12, conseguido: false })
    expect(estado(lista, 'primera-colaboracion')).toMatchObject({ progreso: 1, conseguido: true })
    expect(estado(lista, 'colaboraciones-5')).toMatchObject({ progreso: 3, objetivo: 5, conseguido: false })
  })

  it('el reto de valoraciones exige tambien la media minima', () => {
    const baja = calcularLogros(metricas({ numValoraciones: 6, valoracionMedia: 4.2 }), [])
    const alta = calcularLogros(metricas({ numValoraciones: 5, valoracionMedia: 4.5 }), [])

    expect(estado(baja, 'valoracion-excelente')).toMatchObject({
      progreso: 5,
      conseguido: false,
      detalle: 'Media actual: 4,2 palmeras'
    })
    expect(estado(alta, 'valoracion-excelente').conseguido).toBe(true)
  })

  it('un reto guardado sigue conseguido aunque la metrica baje, con su fecha', () => {
    const fecha = new Date('2026-11-01T10:00:00Z')
    const lista = calcularLogros(metricas({ numValoraciones: 6, valoracionMedia: 3 }), [
      { id: 'valoracion-excelente', fecha }
    ])

    expect(estado(lista, 'valoracion-excelente')).toMatchObject({ conseguido: true, fecha })
  })
})

describe('logrosNuevos', () => {
  it('devuelve los que se cumplen y aun no estan guardados', () => {
    const nuevos = logrosNuevos(metricas({ colaboraciones: 5, horas: 10, islas: 3 }), [
      { id: 'primera-colaboracion', fecha: new Date() }
    ])

    expect(nuevos.map(({ id }) => id)).toEqual(['colaboraciones-5', 'horas-10', 'islas-3'])
  })
})

describe('leerProgreso', () => {
  it('cuenta las islas y categorias distintas de sus colaboraciones completadas', async () => {
    const categoriaA = nuevoId()
    const categoriaB = nuevoId()
    const fecha = new Date('2026-11-01T10:00:00Z')
    const qUsuario = consulta({
      voluntario: {
        estadisticas: { horasTotales: 8, colaboraciones: 3, valoracionMedia: 4.5, numValoraciones: 2 },
        logros: [{ id: 'primera-colaboracion', fecha }]
      }
    })
    const qInscripciones = consulta([
      { ofertaId: { ubicacion: { isla: 'tenerife' }, categoriaIds: [categoriaA] } },
      { ofertaId: { ubicacion: { isla: 'tenerife' }, categoriaIds: [categoriaA, categoriaB] } },
      // Online: sin isla
      { ofertaId: { categoriaIds: [categoriaB] } },
      // Oferta borrada
      { ofertaId: null }
    ])
    vi.spyOn(User, 'findById').mockReturnValue(qUsuario as never)
    const buscar = vi.spyOn(Inscripcion, 'find').mockReturnValue(qInscripciones as never)
    const id = nuevoId()

    const progreso = await leerProgreso(id)

    expect(buscar).toHaveBeenCalledWith({ voluntarioId: id, estado: 'completada' })
    expect(progreso).toEqual({
      metricas: { horas: 8, colaboraciones: 3, islas: 1, categorias: 2, valoracionMedia: 4.5, numValoraciones: 2 },
      guardados: [{ id: 'primera-colaboracion', fecha }]
    })
  })

  it('devuelve null si el usuario no existe y ceros si no tiene perfil de voluntario', async () => {
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([]) as never)
    vi.spyOn(User, 'findById').mockReturnValueOnce(consulta(null) as never)
    expect(await leerProgreso(nuevoId())).toBeNull()

    vi.spyOn(User, 'findById').mockReturnValueOnce(consulta({}) as never)
    expect(await leerProgreso(nuevoId())).toEqual({ metricas: SIN_ACTIVIDAD, guardados: [] })
  })
})

describe('actualizarLogros', () => {
  function simular(estadisticas: Record<string, number>, logros: Array<{ id: string; fecha: Date }> = []) {
    vi.spyOn(User, 'findById').mockReturnValue(consulta({ voluntario: { estadisticas, logros } }) as never)
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([]) as never)
  }

  it('guarda los nuevos de una vez y avisa de cada uno', async () => {
    simular({ horasTotales: 10, colaboraciones: 1 })
    const guardar = vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never)
    const id = nuevoId()

    const ids = await actualizarLogros(id)

    expect(ids).toEqual(['primera-colaboracion', 'horas-10'])
    expect(guardar).toHaveBeenCalledWith(
      // Si otra peticion ya los guardo, el filtro no coincide y no se repiten
      { _id: id, 'voluntario.logros.id': { $nin: ids } },
      {
        $push: {
          'voluntario.logros': {
            $each: [
              { id: 'primera-colaboracion', fecha: expect.any(Date) },
              { id: 'horas-10', fecha: expect.any(Date) }
            ]
          }
        }
      }
    )
    expect(servicio.notificar).toHaveBeenCalledWith([
      expect.objectContaining({
        usuarioId: id,
        tipo: 'logro_conseguido',
        mensaje: 'Has conseguido "Primer paso": completa tu primera colaboración.',
        enlace: '/retos'
      }),
      expect.objectContaining({ tipo: 'logro_conseguido', mensaje: expect.stringContaining('"Diez horas"') })
    ])
  })

  it('no guarda ni avisa si no hay retos nuevos', async () => {
    simular({ colaboraciones: 1 }, [{ id: 'primera-colaboracion', fecha: new Date() }])
    const guardar = vi.spyOn(User, 'updateOne')

    expect(await actualizarLogros(nuevoId())).toEqual([])
    expect(guardar).not.toHaveBeenCalled()
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('no avisa si otra peticion los guardo antes', async () => {
    simular({ colaboraciones: 1 })
    vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as never)

    expect(await actualizarLogros(nuevoId())).toEqual([])
    expect(servicio.notificar).not.toHaveBeenCalled()
  })

  it('no hace nada si el usuario no existe y propaga los errores de la base de datos', async () => {
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([]) as never)
    vi.spyOn(User, 'findById').mockReturnValueOnce(consulta(null) as never)
    expect(await actualizarLogros(nuevoId())).toEqual([])

    vi.spyOn(User, 'findById').mockReturnValueOnce(consulta(errorBd()) as never)
    await expect(actualizarLogros(nuevoId())).rejects.toThrow('base de datos caida')
  })
})
