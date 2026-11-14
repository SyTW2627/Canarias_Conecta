/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de las funciones de plazas compartidas por las pantallas de ofertas.
 */
import { describe, expect, it } from 'vitest'
import { esTurnoProximo, estaCompleta, plazasDisponibles, textoPlazas } from '../ofertas.ts'
import { turno } from './api.ts'

describe('esTurnoProximo', () => {
  it('cuenta el turno de hoy como próximo y el de ayer no', () => {
    expect(esTurnoProximo(turno('t1', 0, 1))).toBe(true)
    expect(esTurnoProximo(turno('t2', -1, 1))).toBe(false)
  })
})

describe('plazasDisponibles', () => {
  it('suma solo las plazas libres de los turnos próximos', () => {
    const turnos = [turno('pasado', -3, 5), turno('a', 2, 1), turno('b', 4, 2)]
    expect(plazasDisponibles({ turnos })).toBe(3)
  })
})

describe('estaCompleta', () => {
  it('es completa si tiene turnos próximos y ninguno con plazas', () => {
    expect(estaCompleta({ turnos: [turno('pasado', -2, 4), turno('a', 3, 0)] })).toBe(true)
  })

  it('no es completa si algún turno próximo tiene plaza', () => {
    expect(estaCompleta({ turnos: [turno('a', 3, 0), turno('b', 5, 1)] })).toBe(false)
  })

  it('no es completa si ya no tiene turnos próximos: eso es finalizada', () => {
    expect(estaCompleta({ turnos: [turno('pasado', -2, 0)] })).toBe(false)
  })
})

describe('textoPlazas', () => {
  it('usa singular, plural y "Sin plazas"', () => {
    expect(textoPlazas(0)).toBe('Sin plazas')
    expect(textoPlazas(1)).toBe('1 plaza disponible')
    expect(textoPlazas(4)).toBe('4 plazas disponibles')
  })
})
