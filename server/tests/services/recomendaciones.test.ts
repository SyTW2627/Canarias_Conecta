/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del sistema de recomendacion (puntuacion y orden de las ofertas).
 */

import { describe, expect, it } from 'vitest'
import {
  type OfertaCandidata,
  type OfertaParaVoluntarios,
  type PerfilRecomendacion,
  type VoluntarioCandidato,
  puntuarOferta,
  puntuarVoluntario,
  recomendar,
  recomendarVoluntarios
} from '../../src/services/recomendaciones.js'

const COSTA = { id: 'c-costa', nombre: 'Medio ambiente' }
const MAYORES = { id: 'c-mayores', nombre: 'Personas mayores' }
const ANIMALES = { id: 'c-animales', nombre: 'Animales' }

const perfil = (datos: Partial<PerfilRecomendacion> = {}): PerfilRecomendacion => ({
  interesIds: [],
  islas: [],
  historial: [],
  ...datos
})

const oferta = (datos: Partial<OfertaCandidata> = {}): OfertaCandidata => ({
  id: 'o1',
  categorias: [COSTA],
  modalidad: 'presencial',
  isla: 'tenerife',
  ...datos
})

describe('puntuarOferta', () => {
  it('da 0 y ningun motivo si la oferta no encaja con el perfil', () => {
    expect(puntuarOferta(oferta(), perfil())).toEqual({ afinidad: 0, motivos: [] })
  })

  it('suma el peso completo de intereses si todas sus categorias le interesan', () => {
    const resultado = puntuarOferta(oferta(), perfil({ interesIds: [COSTA.id] }))
    expect(resultado.afinidad).toBe(60)
    expect(resultado.motivos).toEqual([{ tipo: 'interes', texto: 'Te interesa Medio ambiente' }])
  })

  it('reparte el peso de intereses segun la proporcion de categorias en comun', () => {
    const resultado = puntuarOferta(
      oferta({ categorias: [COSTA, MAYORES] }),
      perfil({ interesIds: [MAYORES.id] })
    )
    expect(resultado.afinidad).toBe(30)
  })

  it('suma la isla si la oferta es en una de sus islas', () => {
    const resultado = puntuarOferta(oferta(), perfil({ islas: ['tenerife'] }))
    expect(resultado).toEqual({ afinidad: 20, motivos: [{ tipo: 'isla', texto: 'En tu isla: Tenerife' }] })
  })

  it('las ofertas online cuentan como cercanas para cualquiera', () => {
    const resultado = puntuarOferta(oferta({ modalidad: 'online', isla: undefined }), perfil())
    expect(resultado).toEqual({
      afinidad: 20,
      motivos: [{ tipo: 'online', texto: 'Online, desde cualquier isla' }]
    })
  })

  it('suma el historial si comparte categoria con algo en lo que ya participo', () => {
    const resultado = puntuarOferta(
      oferta(),
      perfil({ historial: [{ titulo: 'Reforestación', categoriaIds: [COSTA.id] }] })
    )
    expect(resultado).toEqual({
      afinidad: 20,
      motivos: [{ tipo: 'historial', texto: 'Parecida a «Reforestación»' }]
    })
  })

  it('llega a 100 si cumple todos los criterios', () => {
    const resultado = puntuarOferta(
      oferta(),
      perfil({
        interesIds: [COSTA.id],
        islas: ['tenerife'],
        historial: [{ titulo: 'Reforestación', categoriaIds: [COSTA.id] }]
      })
    )
    expect(resultado.afinidad).toBe(100)
    expect(resultado.motivos.map(({ tipo }) => tipo)).toEqual(['interes', 'isla', 'historial'])
  })
})

describe('recomendar', () => {
  it('ordena por afinidad, descarta las que no encajan y respeta el maximo', () => {
    const ofertas = [
      oferta({ id: 'solo-isla', categorias: [ANIMALES] }),
      oferta({ id: 'nada', categorias: [ANIMALES], isla: 'lanzarote' }),
      oferta({ id: 'interes-e-isla' }),
      oferta({ id: 'interes', isla: 'lanzarote' })
    ]
    const p = perfil({ interesIds: [COSTA.id], islas: ['tenerife'] })

    expect(recomendar(ofertas, p).map(({ oferta: o }) => o.id)).toEqual([
      'interes-e-isla',
      'interes',
      'solo-isla'
    ])
    expect(recomendar(ofertas, p, 2)).toHaveLength(2)
  })

  it('a igual afinidad mantiene el orden recibido', () => {
    const ofertas = [oferta({ id: 'a' }), oferta({ id: 'b' })]
    const ids = recomendar(ofertas, perfil({ interesIds: [COSTA.id] })).map(({ oferta: o }) => o.id)
    expect(ids).toEqual(['a', 'b'])
  })
})

describe('puntuarVoluntario', () => {
  // 2026-12-07 es lunes (getUTCDay = 1)
  const LUNES = new Date('2026-12-07T00:00:00.000Z')
  const MARTES = new Date('2026-12-08T00:00:00.000Z')

  const ofertaV = (datos: Partial<OfertaParaVoluntarios> = {}): OfertaParaVoluntarios => ({
    categorias: [COSTA],
    modalidad: 'presencial',
    isla: 'tenerife',
    turnos: [{ fecha: LUNES, horaInicio: '10:00', horaFin: '12:00' }],
    ...datos
  })

  const voluntario = (datos: Partial<VoluntarioCandidato> = {}): VoluntarioCandidato => ({
    id: 'v1',
    interesIds: [],
    islas: [],
    disponibilidad: [],
    edad: null,
    valoracionMedia: 0,
    numValoraciones: 0,
    ...datos
  })

  it('da 0 si el voluntario no encaja en nada', () => {
    expect(puntuarVoluntario(voluntario(), ofertaV())).toEqual({ afinidad: 0, motivos: [] })
  })

  it('suma intereses, isla, disponibilidad y valoracion hasta 100', () => {
    const resultado = puntuarVoluntario(
      voluntario({
        interesIds: [COSTA.id],
        islas: ['tenerife'],
        disponibilidad: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '14:00' }],
        valoracionMedia: 5,
        numValoraciones: 2
      }),
      ofertaV()
    )
    expect(resultado).toEqual({
      afinidad: 100,
      motivos: [
        { tipo: 'interes', texto: 'Le interesa Medio ambiente' },
        { tipo: 'isla', texto: 'Colabora en Tenerife' },
        { tipo: 'disponibilidad', texto: 'Disponible en el horario del turno' },
        { tipo: 'valoracion', texto: 'Valoración media 5.0 / 5' }
      ]
    })
  })

  it('reparte la disponibilidad segun los turnos que cubre su horario', () => {
    const resultado = puntuarVoluntario(
      voluntario({ disponibilidad: [{ diaSemana: 1, horaInicio: '10:00', horaFin: '12:00' }] }),
      ofertaV({
        turnos: [
          { fecha: LUNES, horaInicio: '10:00', horaFin: '12:00' },
          { fecha: MARTES, horaInicio: '10:00', horaFin: '12:00' }
        ]
      })
    )
    expect(resultado).toEqual({
      afinidad: 10,
      motivos: [{ tipo: 'disponibilidad', texto: 'Disponible en 1 de 2 turnos' }]
    })
  })

  it('no cuenta una franja que no cubre el turno entero', () => {
    const resultado = puntuarVoluntario(
      voluntario({ disponibilidad: [{ diaSemana: 1, horaInicio: '11:00', horaFin: '14:00' }] }),
      ofertaV()
    )
    expect(resultado?.afinidad).toBe(0)
  })

  it('descarta a quien no tiene la edad minima, pero no a quien no indico su edad', () => {
    expect(puntuarVoluntario(voluntario({ edad: 16 }), ofertaV({ edadMinima: 18 }))).toBeNull()
    expect(puntuarVoluntario(voluntario({ edad: null }), ofertaV({ edadMinima: 18 }))).not.toBeNull()
  })
})

describe('recomendarVoluntarios', () => {
  const ofertaOnline: OfertaParaVoluntarios = {
    categorias: [COSTA, MAYORES],
    modalidad: 'online',
    turnos: [{ fecha: new Date('2026-12-07T00:00:00.000Z'), horaInicio: '10:00', horaFin: '12:00' }]
  }
  const base = {
    islas: [],
    disponibilidad: [],
    edad: null,
    valoracionMedia: 0,
    numValoraciones: 0
  }

  it('ordena por afinidad y no recomienda a quien solo encaja por ser online o por valoraciones', () => {
    const resultado = recomendarVoluntarios(
      [
        { ...base, id: 'solo-online', interesIds: [], valoracionMedia: 5, numValoraciones: 3 },
        { ...base, id: 'medio', interesIds: [COSTA.id] },
        { ...base, id: 'completo', interesIds: [COSTA.id, MAYORES.id] }
      ],
      ofertaOnline
    )
    expect(resultado.map(({ voluntario, afinidad }) => [voluntario.id, afinidad])).toEqual([
      ['completo', 70],
      ['medio', 45]
    ])
  })

  it('se queda como maximo con los indicados', () => {
    const muchos = Array.from({ length: 5 }, (_, i) => ({ ...base, id: `v${i}`, interesIds: [COSTA.id] }))
    expect(recomendarVoluntarios(muchos, ofertaOnline, 2)).toHaveLength(2)
  })
})
