/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la paginacion del catalogo de oportunidades.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Oportunidades from '../pages/Oportunidades.tsx'
import type { Oferta } from '../ofertas.ts'
import { VOLUNTARIO, oferta, simularApi, turno } from './api.ts'

// n ofertas distintas, numeradas desde "desde"
const variasOfertas = (n: number, desde = 1): Oferta[] =>
  Array.from({ length: n }, (_, i) =>
    oferta([turno(`t${desde + i}`, 3, 2)], { id: `of${desde + i}`, titulo: `Oportunidad ${desde + i}` }),
  )

function pagina(ofertas: Oferta[], total: number, n: number) {
  return { body: { ofertas, total, pagina: n, porPagina: 12, totalPaginas: Math.ceil(total / 12) } }
}

const paginaDeUrl = (url: string) => Number(new URL(url, 'http://x').searchParams.get('pagina'))
const urlsCatalogo = () =>
  vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/ofertas'))

// 30 ofertas: paginas de 12, 12 y 6
const catalogo30 = (_cuerpo: unknown, url: string) => {
  const n = paginaDeUrl(url)
  return pagina(variasOfertas(n === 3 ? 6 : 12, (n - 1) * 12 + 1), 30, n)
}

function renderizar() {
  render(<Oportunidades usuario={VOLUNTARIO} onCerrarSesion={() => {}} />)
}

describe('Oportunidades: paginacion', () => {
  it('pide la primera pagina y muestra el total y el tramo visible', async () => {
    simularApi({ 'GET /api/categorias': { body: [] }, 'GET /api/ofertas': catalogo30 })
    renderizar()

    expect(await screen.findByText('30 oportunidades · Mostrando 1–12')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Ver detalles' })).toHaveLength(12)
    expect(urlsCatalogo()[0]).toBe('/api/ofertas?pagina=1')
    expect(screen.getByRole('navigation', { name: 'Páginas de oportunidades' })).toBeInTheDocument()
  })

  it('cambia de pagina y vuelve a la primera al filtrar', async () => {
    simularApi({ 'GET /api/categorias': { body: [] }, 'GET /api/ofertas': catalogo30 })
    renderizar()
    await screen.findByText('Oportunidad 1')

    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }))
    expect(await screen.findByText('30 oportunidades · Mostrando 25–30')).toBeInTheDocument()
    expect(screen.getByText('Oportunidad 25')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Isla'), 'tenerife')
    expect(await screen.findByText('Oportunidad 1')).toBeInTheDocument()
    expect(urlsCatalogo().at(-1)).toBe('/api/ofertas?isla=tenerife&pagina=1')
  })

  it('con una sola pagina no muestra la navegacion', async () => {
    simularApi({ 'GET /api/categorias': { body: [] }, 'GET /api/ofertas': pagina(variasOfertas(4), 4, 1) })
    renderizar()

    expect(await screen.findByText('4 oportunidades')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Páginas de oportunidades' })).not.toBeInTheDocument()
  })

  it('si la pagina pedida llega vacia, salta a la ultima que tenga ofertas', async () => {
    // Al llegar a la 3 solo quedan 20: la 3 viene vacia y se pide la 2
    simularApi({
      'GET /api/categorias': { body: [] },
      'GET /api/ofertas': (_cuerpo, url) => {
        const n = paginaDeUrl(url)
        if (n === 1) return pagina(variasOfertas(12), 30, 1)
        if (n === 3) return pagina([], 20, 3)
        return pagina(variasOfertas(8, 13), 20, n)
      },
    })
    renderizar()
    await screen.findByText('Oportunidad 1')

    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }))

    expect(await screen.findByText('20 oportunidades · Mostrando 13–20')).toBeInTheDocument()
    expect(urlsCatalogo().slice(-2)).toEqual(['/api/ofertas?pagina=3', '/api/ofertas?pagina=2'])
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })
})
