/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la pantalla de publicar una oferta: envio y vuelta al listado.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, type Mock } from 'vitest'
import PublicarOferta from '../pages/PublicarOferta.tsx'
import { OFERTANTE, simularApi } from './api.ts'

function abrir() {
  render(<PublicarOferta usuario={OFERTANTE} onCerrarSesion={() => {}} />)
}

// Rellena una oferta online valida con un turno para mañana
async function rellenar(titulo: string) {
  await userEvent.type(screen.getByLabelText('Título *'), titulo)
  await userEvent.type(screen.getByLabelText('Descripción *'), 'Algo útil')
  await userEvent.click(await screen.findByLabelText('Medio ambiente'))
  await userEvent.selectOptions(screen.getByLabelText('Modalidad *'), 'online')
  const manana = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: manana } })
  fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '10:00' } })
  fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '12:00' } })
  fireEvent.change(screen.getByLabelText('Plazas'), { target: { value: '2' } })
}

describe('PublicarOferta', () => {
  it('permite volver al listado sin publicar', () => {
    simularApi({ 'GET /api/categorias': { body: [] } })
    abrir()

    expect(screen.getByRole('heading', { level: 1, name: 'Publicar voluntariado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/gestionar-ofertas')
  })

  it('publica la oferta como multipart con estado publicada y vuelve al listado', async () => {
    simularApi({
      'GET /api/categorias': { body: [{ id: 'c1', nombre: 'Medio ambiente', slug: 'm' }] },
      'POST /api/ofertas': { status: 201, body: { id: 'n' } },
    })
    localStorage.setItem('token', 'tok')
    window.history.pushState(null, '', '/gestionar-ofertas/nueva')
    abrir()

    await rellenar('Nueva oferta')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar oferta' }))

    const [, opciones] = (fetch as Mock).mock.calls.find(([url, o]) => url === '/api/ofertas' && o?.method === 'POST')!
    expect(opciones.headers).toEqual({ Authorization: 'Bearer tok' })
    const datos = JSON.parse((opciones.body as FormData).get('datos') as string)
    expect(datos).toMatchObject({ titulo: 'Nueva oferta', estado: 'publicada', modalidad: 'online' })

    expect(window.location.pathname).toBe('/gestionar-ofertas')
    expect(window.history.state).toEqual({ mensajeExito: 'Oferta publicada. Los voluntarios ya pueden verla.' })
  })

  it('si falla la publicación muestra el error y no sale de la pantalla', async () => {
    simularApi({
      'GET /api/categorias': { body: [{ id: 'c1', nombre: 'Medio ambiente', slug: 'm' }] },
      'POST /api/ofertas': { status: 400, body: { message: 'Datos no válidos' } },
    })
    window.history.pushState(null, '', '/gestionar-ofertas/nueva')
    abrir()

    await rellenar('X')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar oferta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Datos no válidos')
    expect(screen.getByLabelText('Título *')).toHaveValue('X')
    expect(window.location.pathname).toBe('/gestionar-ofertas/nueva')
  })
})
