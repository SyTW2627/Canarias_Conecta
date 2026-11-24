/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la seccion "Recomendado para ti": tarjetas con afinidad y motivos, y avisos sin intereses o sin ofertas.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Recomendaciones from '../components/Recomendaciones.tsx'
import { VOLUNTARIO, oferta, simularApi, turno } from './api.ts'

const MEDIO_AMBIENTE = { id: 'c1', nombre: 'Medio ambiente' }

const recomendacion = {
  oferta: oferta([turno('t1', 2, 3)]),
  afinidad: 80,
  motivos: [
    { tipo: 'interes', texto: 'Te interesa Medio ambiente' },
    { tipo: 'isla', texto: 'En tu isla: Tenerife' },
  ],
}

function simular(intereses: typeof MEDIO_AMBIENTE[], recomendaciones: unknown[]) {
  return simularApi({ 'GET /api/ofertas/recomendadas': { body: { intereses, recomendaciones } } })
}

describe('Recomendaciones', () => {
  it('muestra las ofertas recomendadas con su afinidad, sus motivos y los intereses del perfil', async () => {
    simular([MEDIO_AMBIENTE], [recomendacion])
    render(<Recomendaciones usuario={VOLUNTARIO} />)

    expect(await screen.findByText('Limpieza de playa')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recomendado para ti, Laura' })).toBeInTheDocument()
    expect(screen.getByText('80% afín')).toBeInTheDocument()
    expect(screen.getByText(/Te interesa Medio ambiente/)).toBeInTheDocument()
    expect(screen.getByText(/En tu isla: Tenerife/)).toBeInTheDocument()
    expect(screen.getByText('Medio ambiente', { selector: '.reco-interes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalles' })).toHaveAttribute('href', '/ofertas/of1')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('sin intereses en el perfil invita a añadirlos desde el perfil', async () => {
    simular([], [])
    render(<Recomendaciones usuario={VOLUNTARIO} />)

    expect(await screen.findByText('Aún no sabemos qué te gusta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'tu perfil' })).toHaveAttribute('href', '/perfil')
  })

  it('avisa si no hay ninguna oferta que encaje', async () => {
    simular([MEDIO_AMBIENTE], [])
    render(<Recomendaciones usuario={VOLUNTARIO} />)
    expect(await screen.findByText('Ahora mismo no hay voluntariados que encajen contigo')).toBeInTheDocument()
  })
})
