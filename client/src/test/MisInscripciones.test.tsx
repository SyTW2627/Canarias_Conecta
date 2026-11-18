/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la pantalla Mis inscripciones: estados, lista de espera y cancelacion.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import MisInscripciones from '../pages/MisInscripciones.tsx'
import { VOLUNTARIO, dia, simularApi } from './api.ts'

type Datos = Record<string, unknown>

function inscripcion(datos: Datos = {}) {
  return {
    id: 'i1',
    ofertaId: 'of1',
    titulo: 'Limpieza de playa',
    organizador: 'Asociación',
    fecha: dia(10),
    horas: 3,
    estado: 'aceptada',
    inicio: dia(10),
    puedeCancelar: true,
    cancelacionTardia: false,
    posicionEspera: null,
    motivoRechazo: null,
    valoracion: null,
    ...datos,
  }
}

function abrir() {
  render(<MisInscripciones usuario={VOLUNTARIO} onCerrarSesion={() => {}} />)
}

describe('MisInscripciones', () => {
  it('muestra la valoración recibida con palmeras', async () => {
    simularApi({
      'GET /api/inscripciones/mias': {
        body: [inscripcion({
          estado: 'completada',
          valoracion: { puntuacion: 4, comentario: 'Gran voluntario' },
        })],
      },
    })
    abrir()

    expect(await screen.findByLabelText('4 de 5 palmeras')).toBeInTheDocument()
    expect(screen.getByText('“Gran voluntario”')).toBeInTheDocument()
  })

  it('invita a buscar oportunidades si no hay inscripciones', async () => {
    simularApi({ 'GET /api/inscripciones/mias': { body: [] } })
    abrir()
    expect(await screen.findByText('Aún no tienes inscripciones')).toBeInTheDocument()
  })

  it('muestra el puesto en la lista de espera', async () => {
    simularApi({
      'GET /api/inscripciones/mias': { body: [inscripcion({ estado: 'en_espera', posicionEspera: 2 })] },
    })
    abrir()
    expect(await screen.findByText('En lista de espera')).toBeInTheDocument()
    expect(screen.getByText(/Puesto 2 en la lista de espera/)).toBeInTheDocument()
  })

  it('marca las cancelaciones tardías y no deja volver a cancelarlas', async () => {
    simularApi({
      'GET /api/inscripciones/mias': {
        body: [inscripcion({ estado: 'cancelada', cancelacionTardia: true, puedeCancelar: false })],
      },
    })
    abrir()
    expect(await screen.findByText('Cancelada (tardía)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar inscripción' })).not.toBeInTheDocument()
  })

  it('pide confirmación y cancela con tiempo de sobra', async () => {
    let cancelada = false
    const llamadas = simularApi({
      'GET /api/inscripciones/mias': () => ({
        body: [inscripcion(cancelada ? { estado: 'cancelada', puedeCancelar: false } : {})],
      }),
      'PATCH /api/inscripciones/i1/cancelar': () => {
        cancelada = true
        return { body: { id: 'i1', estado: 'cancelada', cancelacionTardia: false } }
      },
    })
    abrir()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar inscripción' }))
    expect(screen.getByText(/Tu plaza quedará libre para otra persona/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    expect(await screen.findByText('Cancelada')).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PATCH' && l.ruta === '/api/inscripciones/i1/cancelar')).toBe(true)
  })

  it('avisa de cancelación tardía si quedan menos de 48 h', async () => {
    const enUnDia = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    simularApi({ 'GET /api/inscripciones/mias': { body: [inscripcion({ inicio: enUnDia })] } })
    abrir()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar inscripción' }))
    expect(screen.getByText(/Quedan menos de 48 h/)).toBeInTheDocument()
  })

  it('"Volver" cierra la confirmación sin cancelar', async () => {
    const llamadas = simularApi({ 'GET /api/inscripciones/mias': { body: [inscripcion()] } })
    abrir()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar inscripción' }))
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))

    expect(screen.queryByRole('button', { name: 'Sí, cancelar' })).not.toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false)
  })
})
