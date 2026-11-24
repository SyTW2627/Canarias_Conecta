/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la pantalla de retos: progreso de cada reto y ranking mensual con sus filtros.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Retos from '../pages/Retos.tsx'
import { mesActual, moverMes, nombreMes, type Logro, type RespuestaRanking } from '../gamificacion.ts'
import { VOLUNTARIO, simularApi } from './api.ts'

function logro(datos: Partial<Logro> = {}): Logro {
  return {
    id: 'horas-10',
    nombre: 'Diez horas',
    descripcion: 'Suma 10 horas de voluntariado',
    icono: '⏱️',
    objetivo: 10,
    progreso: 4,
    conseguido: false,
    fecha: null,
    detalle: null,
    ...datos,
  }
}

const LOGROS = {
  metricas: { horas: 4.5, colaboraciones: 2, islas: 1, categorias: 1, valoracionMedia: 0, numValoraciones: 0 },
  conseguidos: 1,
  logros: [
    logro({
      id: 'primera-colaboracion',
      nombre: 'Primer paso',
      objetivo: 1,
      progreso: 1,
      conseguido: true,
      fecha: '2026-11-10T10:00:00.000Z',
    }),
    logro(),
  ],
}

function ranking(datos: Partial<RespuestaRanking> = {}): RespuestaRanking {
  return {
    mes: mesActual(),
    isla: null,
    participantes: 2,
    ranking: [
      { posicion: 1, nombre: 'Carlos D.', avatarUrl: null, horas: 7, colaboraciones: 2, eresTu: false },
      { posicion: 2, nombre: 'Laura P.', avatarUrl: null, horas: 4.5, colaboraciones: 1, eresTu: true },
    ],
    tuPosicion: { posicion: 2, horas: 4.5, colaboraciones: 1 },
    ...datos,
  }
}

// La respuesta del ranking repite el mes y la isla pedidos, como el servidor
function simular(respuestaRanking: (mes: string, isla: string | null) => RespuestaRanking = (mes, isla) =>
  ranking({ mes, isla })) {
  simularApi({
    'GET /api/gamificacion/logros': { body: LOGROS },
    'GET /api/gamificacion/ranking': { body: null },
  })
  // simularApi no distingue la query: se envuelve fetch para responder segun mes e isla
  const original = vi.mocked(fetch).getMockImplementation()!
  vi.mocked(fetch).mockImplementation(async (url, opciones) => {
    const texto = String(url)
    if (texto.startsWith('/api/gamificacion/ranking')) {
      const parametros = new URLSearchParams(texto.split('?')[1])
      return new Response(JSON.stringify(respuestaRanking(parametros.get('mes')!, parametros.get('isla'))), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return original(url, opciones)
  })
}

const sinSesion = () => {}

describe('Retos', () => {
  it('muestra la actividad y cada reto con su progreso o la fecha en que se consiguió', async () => {
    simular()
    render(<Retos usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    const resumen = await screen.findByRole('list', { name: 'Tu actividad' })
    expect(resumen).toHaveTextContent('4,5 h de voluntariado')
    expect(resumen).toHaveTextContent('2 colaboraciones')
    expect(resumen).toHaveTextContent('1 / 2 retos conseguidos')

    const conseguido = screen.getByRole('heading', { name: 'Primer paso' }).closest('li')!
    expect(conseguido).toHaveClass('reto-conseguido')
    expect(within(conseguido).getByText('Conseguido el 10 de noviembre de 2026')).toBeInTheDocument()

    const pendiente = screen.getByRole('heading', { name: 'Diez horas' }).closest('li')!
    expect(within(pendiente).getByRole('progressbar', { name: 'Progreso de Diez horas' })).toHaveAttribute(
      'aria-valuenow',
      '4',
    )
    expect(within(pendiente).getByText('4 / 10')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retos' })).toHaveAttribute('aria-current', 'page')
  })

  it('muestra el ranking del mes y marca al voluntario', async () => {
    simular()
    render(<Retos usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    const seccion = screen.getByRole('region', { name: 'Ranking del mes' })
    const filas = await within(seccion).findAllByRole('listitem')
    expect(filas[0]).toHaveTextContent('1Carlos D.7 h2 colaboraciones')
    expect(filas[1]).toHaveTextContent('Laura P. (tú)')
    expect(filas[1]).toHaveClass('ranking-tu')
    expect(screen.getByText(nombreMes(mesActual()))).toBeInTheDocument()
    expect(screen.getByText('Participan 2 voluntarios.')).toBeInTheDocument()
  })

  it('si no aparece entre los primeros indica su puesto', async () => {
    simular((mes) =>
      ranking({
        mes,
        participantes: 15,
        ranking: [{ posicion: 1, nombre: 'Carlos D.', avatarUrl: null, horas: 30, colaboraciones: 4, eresTu: false }],
        tuPosicion: { posicion: 12, horas: 2, colaboraciones: 1 },
      }),
    )
    render(<Retos usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    expect(await screen.findByText('Vas en el puesto 12 de 15 con 2 h.')).toBeInTheDocument()
  })

  it('cambia de mes e isla y no deja avanzar más allá del mes actual', async () => {
    simular((mes, isla) => ranking({ mes, isla, ranking: [], participantes: 0, tuPosicion: null }))
    render(<Retos usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    expect(await screen.findByText(/Nadie ha completado todavía una colaboración este mes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await userEvent.selectOptions(screen.getByLabelText('Isla'), 'tenerife')

    const anterior = moverMes(mesActual(), -1)
    expect(await screen.findByText(nombreMes(anterior))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled()
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    expect(urls).toContain(`/api/gamificacion/ranking?mes=${anterior}&isla=tenerife`)
  })

  it('muestra el error del servidor', async () => {
    simularApi({
      'GET /api/gamificacion/logros': { status: 500, body: { message: 'No se pudieron cargar tus retos' } },
      'GET /api/gamificacion/ranking': { status: 500, body: { message: 'No se pudo cargar el ranking' } },
    })
    render(<Retos usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    expect(await screen.findByText('No se pudieron cargar tus retos')).toBeInTheDocument()
    expect(await screen.findByText('No se pudo cargar el ranking')).toBeInTheDocument()
  })
})
