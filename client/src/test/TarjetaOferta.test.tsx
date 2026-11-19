/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la tarjeta de oferta de los listados.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TarjetaOferta from '../components/TarjetaOferta.tsx'
import { oferta, turno } from './api.ts'

describe('TarjetaOferta', () => {
  it('muestra las plazas de los turnos próximos, sin contar los pasados', () => {
    render(<TarjetaOferta oferta={oferta([turno('pasado', -2, 5), turno('a', 3, 2)])} />)
    expect(screen.getByText('2 plazas disponibles')).toBeInTheDocument()
  })

  it('muestra "Completa" cuando no quedan plazas en los turnos próximos', () => {
    render(<TarjetaOferta oferta={oferta([turno('a', 3, 0), turno('b', 6, 0)])} />)
    expect(screen.getByText('Completa')).toBeInTheDocument()
    expect(screen.queryByText(/plazas? disponibles?/)).not.toBeInTheDocument()
  })

  it('enlaza al detalle de la oferta', () => {
    render(<TarjetaOferta oferta={oferta([turno('a', 3, 1)], { id: 'abc' })} />)
    expect(screen.getByRole('link', { name: 'Ver detalles' })).toHaveAttribute('href', '/ofertas/abc')
  })
})
