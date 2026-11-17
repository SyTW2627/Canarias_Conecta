/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests del hook que carga las ofertas publicadas con filtros, estado de carga y errores.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { useOfertasPublicadas, type FiltrosOfertas } from '../useOfertasPublicadas.ts'
import { oferta, simularApi, turno } from './api.ts'

const OFERTAS = [oferta([turno('t1', 2, 1)])]

describe('useOfertasPublicadas', () => {
  it('empieza cargando y después devuelve las ofertas', async () => {
    simularApi({ 'GET /api/ofertas': { body: OFERTAS } })

    const { result } = renderHook(() => useOfertasPublicadas())

    expect(result.current).toEqual({ ofertas: null, error: null, cargando: true })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current).toEqual({ ofertas: OFERTAS, error: null, cargando: false })
    expect(fetch).toHaveBeenCalledWith('/api/ofertas', expect.anything())
  })

  it('envía solo los filtros con valor, sin espacios', async () => {
    simularApi({ 'GET /api/ofertas': { body: [] } })

    const { result } = renderHook(() =>
      useOfertasPublicadas({ q: '  playa ', isla: 'tenerife', categoria: '', municipio: '   ', fechaDesde: undefined }),
    )

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect((fetch as Mock).mock.calls[0][0]).toBe('/api/ofertas?q=playa&isla=tenerife')
  })

  it('al cambiar los filtros conserva las ofertas anteriores mientras carga las nuevas', async () => {
    let responder: (valor: Response) => void = () => {}
    simularApi({ 'GET /api/ofertas': { body: OFERTAS } })
    const { result, rerender } = renderHook((filtros: FiltrosOfertas) => useOfertasPublicadas(filtros), {
      initialProps: {},
    })
    await waitFor(() => expect(result.current.ofertas).toEqual(OFERTAS))

    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { responder = r })))
    rerender({ q: 'perros' })

    expect(result.current).toEqual({ ofertas: OFERTAS, error: null, cargando: true })
    responder(new Response('[]', { status: 200 }))
    await waitFor(() => expect(result.current).toEqual({ ofertas: [], error: null, cargando: false }))
  })

  it('cancela la petición anterior si cambian los filtros antes de responder', async () => {
    const senales: AbortSignal[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, { signal }: RequestInit) => {
      senales.push(signal!)
      return new Promise<Response>(() => {})
    }))
    const { rerender } = renderHook((filtros: FiltrosOfertas) => useOfertasPublicadas(filtros), {
      initialProps: { q: 'a' },
    })

    rerender({ q: 'ab' })

    expect(senales[0].aborted).toBe(true)
    expect(senales[1].aborted).toBe(false)
  })

  it('devuelve el mensaje de error del servidor', async () => {
    simularApi({ 'GET /api/ofertas': { status: 400, body: { message: 'Fecha no válida' } } })

    const { result } = renderHook(() => useOfertasPublicadas({ fechaDesde: 'mal' }))

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current).toEqual({ ofertas: null, error: 'Fecha no válida', cargando: false })
  })

  it('usa un mensaje genérico si el servidor no da ninguno', async () => {
    simularApi({ 'GET /api/ofertas': { status: 500, body: {} } })

    const { result } = renderHook(() => useOfertasPublicadas())

    await waitFor(() => expect(result.current.error).toBe('No se pudieron cargar las ofertas'))
  })

  it.each([
    ['no hay conexión', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['la respuesta no es JSON', async () => new Response('<html>', { status: 502 })],
  ])('avisa de que no se pudo conectar si %s', async (_caso, respuesta) => {
    vi.stubGlobal('fetch', vi.fn(respuesta))

    const { result } = renderHook(() => useOfertasPublicadas())

    await waitFor(() => expect(result.current.error).toBe('No se pudo conectar con el servidor'))
    expect(result.current.cargando).toBe(false)
  })
})
