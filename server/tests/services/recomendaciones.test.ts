/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del sistema de recomendacion (puntuacion y orden de las ofertas).
 */

import { describe, expect, it } from 'vitest'
import {
  type OfertaCandidata,
  type PerfilRecomendacion,
  puntuarOferta,
  recomendar
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
