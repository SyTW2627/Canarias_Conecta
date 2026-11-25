/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la navegacion entre paginas y de sus calculos.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Paginacion from '../components/Paginacion.tsx'
import { paginasVisibles, rangoVisible } from '../paginacion.ts'

describe('paginasVisibles', () => {
  it.each([
    [1, 1, [1]],
    [2, 5, [1, 2, 3, 4, 5]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 10, [1, 2, null, 10]],
    [5, 10, [1, null, 4, 5, 6, null, 10]],
    [10, 10, [1, null, 9, 10]],
  ])('pagina %i de %i -> %o', (actual, total, esperado) => {
    expect(paginasVisibles(actual, total)).toEqual(esperado)
  })
})

describe('rangoVisible', () => {
  const pagina = { ofertas: [], total: 30, porPagina: 12, totalPaginas: 3 }

  it.each([
    [1, 12, 'Mostrando 1–12'],
    [2, 12, 'Mostrando 13–24'],
    [3, 6, 'Mostrando 25–30'],
  ])('pagina %i con %i en pantalla -> %s', (n, enPantalla, esperado) => {
    expect(rangoVisible({ ...pagina, pagina: n }, enPantalla)).toBe(esperado)
  })
})

describe('Paginacion', () => {
  it('con una sola pagina no muestra nada', () => {
    const { container } = render(<Paginacion actual={1} total={1} etiqueta="Páginas" onCambiar={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marca la pagina actual y oculta los huecos a los lectores de pantalla', () => {
    render(<Paginacion actual={5} total={10} etiqueta="Páginas de prueba" onCambiar={vi.fn()} />)

    const nav = screen.getByRole('navigation', { name: 'Páginas de prueba' })
    expect(screen.getByRole('button', { name: 'Página 5' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Página 4' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: 'Página 2' })).not.toBeInTheDocument()
    expect(nav.querySelectorAll('[aria-hidden="true"].paginacion-hueco')).toHaveLength(2)
  })

  it('avisa de la pagina elegida; la actual no hace nada', async () => {
    const onCambiar = vi.fn()
    render(<Paginacion actual={2} total={3} etiqueta="Páginas" onCambiar={onCambiar} />)

    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await userEvent.click(screen.getByRole('button', { name: /Anterior/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }))
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }))

    expect(onCambiar.mock.calls).toEqual([[3], [1], [3]])
  })

  it('desactiva Anterior en la primera y Siguiente en la ultima', () => {
    const { rerender } = render(<Paginacion actual={1} total={3} etiqueta="Páginas" onCambiar={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled()

    rerender(<Paginacion actual={3} total={3} etiqueta="Páginas" onCambiar={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled()
  })
})
