/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la campana de notificaciones: contador, panel, marcar como leidas y recarga.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Notificaciones from '../components/Notificaciones.tsx'
import { simularApi } from './api.ts'

function aviso(id: string, datos: Record<string, unknown> = {}) {
  return {
    id,
    tipo: 'inscripcion_aceptada',
    titulo: `Aviso ${id}`,
    mensaje: `Mensaje ${id}`,
    enlace: null,
    leida: false,
    fecha: new Date().toISOString(),
    ...datos,
  }
}

function simular(notificaciones: ReturnType<typeof aviso>[], noLeidas: number) {
  return simularApi({
    'GET /api/notificaciones': { body: { notificaciones, noLeidas } },
    'PATCH /api/notificaciones/leidas': { body: {} },
    ...Object.fromEntries(notificaciones.map((n) => [`PATCH /api/notificaciones/${n.id}/leida`, { body: {} }])),
  })
}

const campana = (nombre: string | RegExp = /Notificaciones/) => screen.findByRole('button', { name: nombre })

describe('Notificaciones', () => {
  it('muestra cuántas hay sin leer y como máximo "9+"', async () => {
    simular([aviso('a')], 3)
    const { unmount } = render(<Notificaciones />)
    expect(await campana('Notificaciones, 3 sin leer')).toHaveTextContent('3')
    unmount()

    simular([aviso('a')], 12)
    render(<Notificaciones />)
    expect(await campana('Notificaciones, 12 sin leer')).toHaveTextContent('9+')
  })

  it('sin avisos pendientes no muestra contador', async () => {
    simular([], 0)
    render(<Notificaciones />)

    await userEvent.click(await campana('Notificaciones'))

    expect(screen.getByText('No tienes notificaciones.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).not.toBeInTheDocument()
  })

  it('abre el panel con cada aviso, su enlace y hace cuánto llegó', async () => {
    const haceDosHoras = new Date(Date.now() - 2 * 3600e3).toISOString()
    const ayer = new Date(Date.now() - 26 * 3600e3).toISOString()
    simular(
      [
        aviso('a', { enlace: '/mis_inscripciones', fecha: haceDosHoras }),
        aviso('b', { leida: true, fecha: ayer }),
        aviso('c'),
      ],
      2,
    )
    render(<Notificaciones />)

    await userEvent.click(await campana('Notificaciones, 2 sin leer'))

    const panel = screen.getByRole('region', { name: 'Notificaciones' })
    expect(panel).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Aviso a/ })).toHaveAttribute('href', '/mis_inscripciones')
    expect(screen.getByRole('link', { name: /Aviso a/ })).toHaveTextContent('hace 2 horas')
    expect(screen.getByRole('button', { name: /Aviso b/ })).toHaveTextContent('ayer')
    expect(screen.getByRole('button', { name: /Aviso c/ })).toHaveTextContent('ahora mismo')
    // Las no leídas se destacan
    expect(screen.getByRole('button', { name: /Aviso b/ })).not.toHaveClass('no-leida')
    expect(screen.getByRole('button', { name: /Aviso c/ })).toHaveClass('no-leida')
  })

  it('al pulsar un aviso sin leer lo marca como leído y cierra el panel', async () => {
    const llamadas = simular([aviso('a'), aviso('b')], 2)
    render(<Notificaciones />)
    await userEvent.click(await campana('Notificaciones, 2 sin leer'))

    await userEvent.click(screen.getByRole('button', { name: /Aviso a/ }))

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificaciones, 1 sin leer' })).toBeInTheDocument()
    expect(llamadas).toContainEqual({ metodo: 'PATCH', ruta: '/api/notificaciones/a/leida', cuerpo: undefined })
  })

  it('pulsar un aviso ya leído no vuelve a marcarlo', async () => {
    const llamadas = simular([aviso('a', { leida: true })], 0)
    render(<Notificaciones />)
    await userEvent.click(await campana('Notificaciones'))

    await userEvent.click(screen.getByRole('button', { name: /Aviso a/ }))

    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false)
  })

  it('marca todas como leídas', async () => {
    const llamadas = simular([aviso('a'), aviso('b')], 2)
    render(<Notificaciones />)
    await userEvent.click(await campana('Notificaciones, 2 sin leer'))

    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }))

    expect(screen.getByRole('button', { name: 'Notificaciones' })).not.toHaveTextContent(/\d/)
    expect(screen.getByRole('button', { name: /Aviso a/ })).not.toHaveClass('no-leida')
    expect(llamadas).toContainEqual({ metodo: 'PATCH', ruta: '/api/notificaciones/leidas', cuerpo: undefined })
  })

  it('se cierra con Escape y al pulsar fuera', async () => {
    simular([aviso('a')], 1)
    render(
      <>
        <Notificaciones />
        <p>Fuera</p>
      </>,
    )
    const boton = await campana('Notificaciones, 1 sin leer')

    await userEvent.click(boton)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()

    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByText('Fuera'))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('avisa si no se pudieron cargar', async () => {
    simularApi({ 'GET /api/notificaciones': { status: 500, body: {} } })
    render(<Notificaciones />)

    await userEvent.click(await campana('Notificaciones'))

    expect(await screen.findByText('No se pudieron cargar las notificaciones.')).toBeInTheDocument()
  })

  it('vuelve a consultar al abrir el panel y al volver a la pestaña', async () => {
    let noLeidas = 1
    const llamadas = simularApi({
      'GET /api/notificaciones': () => ({ body: { notificaciones: [aviso('a')], noLeidas } }),
    })
    render(<Notificaciones />)
    await campana('Notificaciones, 1 sin leer')

    noLeidas = 4
    fireEvent(document, new Event('visibilitychange'))
    expect(await campana('Notificaciones, 4 sin leer')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Notificaciones, 4 sin leer' }))
    expect(llamadas.filter((l) => l.ruta === '/api/notificaciones')).toHaveLength(3)
  })
})
