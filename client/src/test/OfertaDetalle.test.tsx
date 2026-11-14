/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la inscripcion y la lista de espera desde el detalle de una oferta.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import OfertaDetalle from '../pages/OfertaDetalle.tsx'
import { OFERTANTE, VOLUNTARIO, oferta, simularApi, turno } from './api.ts'

function abrir(datos: ReturnType<typeof oferta>, usuario = VOLUNTARIO) {
  render(<OfertaDetalle ofertaId={datos.id} usuario={usuario} onCerrarSesion={() => {}} />)
}

describe('OfertaDetalle', () => {
  it('preselecciona solo los turnos con plaza', async () => {
    const datos = oferta([turno('lleno', 2, 0), turno('libre', 4, 1)])
    simularApi({ [`GET /api/ofertas/${datos.id}`]: { body: datos } })
    abrir(datos)

    const casillas = await screen.findAllByRole('checkbox', { name: 'Seleccionar' })
    expect(casillas[0]).not.toBeChecked()
    expect(casillas[1]).toBeChecked()
    expect(screen.getByRole('button', { name: 'Inscribirme' })).toBeInTheDocument()
  })

  it('envía la inscripción con los turnos elegidos', async () => {
    const datos = oferta([turno('t1', 2, 2)])
    const llamadas = simularApi({
      [`GET /api/ofertas/${datos.id}`]: { body: datos },
      'POST /api/inscripciones': { status: 201, body: { id: 'i1', estado: 'pendiente' } },
    })
    abrir(datos)

    await userEvent.click(await screen.findByRole('button', { name: 'Inscribirme' }))

    expect(await screen.findByText('Solicitud enviada correctamente')).toBeInTheDocument()
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
      ofertaId: datos.id,
      turnoIds: ['t1'],
      listaEspera: false,
    })
  })

  it('en una oferta completa ofrece la lista de espera y la pide al servidor', async () => {
    const datos = oferta([turno('t1', 2, 0)])
    const llamadas = simularApi({
      [`GET /api/ofertas/${datos.id}`]: { body: datos },
      'POST /api/inscripciones': { status: 201, body: { id: 'i1', estado: 'en_espera' } },
    })
    abrir(datos)

    expect(await screen.findByText(/Esta oferta está completa/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Apuntarme a la lista de espera' }))

    expect(await screen.findByText(/Te has apuntado a la lista de espera/)).toBeInTheDocument()
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({ listaEspera: true })
  })

  it('muestra el mensaje del servidor si la inscripción falla', async () => {
    const datos = oferta([turno('t1', 2, 1)])
    simularApi({
      [`GET /api/ofertas/${datos.id}`]: { body: datos },
      'POST /api/inscripciones': { status: 409, body: { message: 'Ya estás inscrito en esta oferta' } },
    })
    abrir(datos)

    await userEvent.click(await screen.findByRole('button', { name: 'Inscribirme' }))
    expect(await screen.findByText('Ya estás inscrito en esta oferta')).toBeInTheDocument()
  })

  it('un ofertante ve la oferta pero no puede inscribirse', async () => {
    const datos = oferta([turno('t1', 2, 1)])
    simularApi({ [`GET /api/ofertas/${datos.id}`]: { body: datos } })
    abrir(datos, OFERTANTE)

    expect(await screen.findByRole('heading', { name: datos.titulo })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument()
  })
})
