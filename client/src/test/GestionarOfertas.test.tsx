/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests del panel del ofertante: estados de sus ofertas, plazas, cerrar, eliminar y acceso a publicar.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import GestionarOfertas from '../pages/GestionarOfertas.tsx'
import type { MiOferta, Turno } from '../ofertas.ts'
import { OFERTANTE, oferta, simularApi, turno } from './api.ts'

function miOferta(id: string, titulo: string, turnos: Turno[], datos: Partial<MiOferta> = {}): MiOferta {
  return {
    ...oferta(turnos, { id, titulo }),
    estado: 'publicada',
    terminada: false,
    creadaEn: '2026-10-01T00:00:00.000Z',
    candidatosPendientes: 0,
    ...datos,
  }
}

function abrir() {
  render(<GestionarOfertas usuario={OFERTANTE} onCerrarSesion={() => {}} />)
}

// Elemento de la lista de "Mis ofertas" con ese titulo
async function fila(titulo: string) {
  return (await screen.findByRole('heading', { name: titulo })).closest('li') as HTMLElement
}

describe('GestionarOfertas', () => {
  it('muestra el estado visible de cada oferta y sus plazas ocupadas', async () => {
    simularApi({
      'GET /api/categorias': { body: [] },
      'GET /api/ofertas/mias': {
        body: [
          miOferta('a', 'Con plazas', [turno('t1', 2, 1), turno('t2', 5, 3)], { candidatosPendientes: 1 }),
          miOferta('b', 'Llena', [turno('t3', 2, 0)], { candidatosPendientes: 3 }),
          miOferta('c', 'Ya pasó', [turno('t4', -3, 0)], { terminada: true }),
          miOferta('d', 'Recogida antigua', [turno('t5', 2, 2)], { estado: 'cerrada' }),
          miOferta('e', 'Taller sin publicar', [turno('t6', 2, 3)], { estado: 'borrador' }),
        ],
      },
    })
    abrir()

    const conPlazas = await fila('Con plazas')
    expect(within(conPlazas).getByText('Publicada')).toBeInTheDocument()
    // 6 plazas, 4 libres
    expect(within(conPlazas).getByText(/2 de 6 plazas ocupadas/)).toBeInTheDocument()
    expect(within(conPlazas).getByText('1 pendiente')).toBeInTheDocument()

    const llena = await fila('Llena')
    expect(within(llena).getByText('Completa')).toHaveClass('gestion-estado-completa')
    expect(within(llena).getByText('3 pendientes')).toBeInTheDocument()

    const pasada = await fila('Ya pasó')
    expect(within(pasada).getByText('Finalizada')).toBeInTheDocument()
    expect(within(pasada).getByText(/Sin turnos próximos/)).toBeInTheDocument()

    expect(within(await fila('Recogida antigua')).getByText('Cerrada')).toHaveClass('gestion-estado-cerrada')
    expect(within(await fila('Taller sin publicar')).getByText('Borrador')).toBeInTheDocument()
  })

  it('solo deja editar y cerrar las ofertas que siguen activas', async () => {
    simularApi({
      'GET /api/categorias': { body: [] },
      'GET /api/ofertas/mias': {
        body: [
          miOferta('a', 'Activa', [turno('t1', 2, 1)]),
          miOferta('c', 'Ya pasó', [turno('t2', -3, 0)], { terminada: true }),
          miOferta('d', 'Recogida antigua', [turno('t3', 2, 2)], { estado: 'cerrada' }),
          miOferta('e', 'Taller sin publicar', [turno('t4', 2, 3)], { estado: 'borrador' }),
        ],
      },
    })
    abrir()

    const activa = await fila('Activa')
    expect(within(activa).getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/gestionar-ofertas/a/editar')
    expect(within(activa).getByRole('link', { name: 'Ver candidatos' })).toHaveAttribute('href', '/gestionar-ofertas/a/candidatos')
    expect(within(activa).getByRole('button', { name: 'Cerrar oferta' })).toBeInTheDocument()

    for (const titulo of ['Ya pasó', 'Recogida antigua']) {
      const otra = await fila(titulo)
      expect(within(otra).queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument()
      expect(within(otra).queryByRole('button', { name: 'Cerrar oferta' })).not.toBeInTheDocument()
      // Eliminar siempre se puede
      expect(within(otra).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    }
    // Un borrador se puede cerrar pero no editar
    const borrador = await fila('Taller sin publicar')
    expect(within(borrador).queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument()
    expect(within(borrador).getByRole('button', { name: 'Cerrar oferta' })).toBeInTheDocument()
  })

  it('avisa si todavía no hay ofertas o si no se pudieron cargar', async () => {
    simularApi({ 'GET /api/categorias': { body: [] }, 'GET /api/ofertas/mias': { body: [] } })
    abrir()
    expect(await screen.findByText('Todavía no has publicado ninguna oferta.')).toBeInTheDocument()
  })

  it('muestra el error del servidor al cargar el listado', async () => {
    simularApi({
      'GET /api/categorias': { body: [] },
      'GET /api/ofertas/mias': { status: 403, body: { message: 'Solo para ofertantes' } },
    })
    abrir()
    expect(await screen.findByText('Solo para ofertantes')).toBeInTheDocument()
  })

  it('cierra una oferta tras confirmarlo y recarga el listado', async () => {
    let cerrada = false
    const llamadas = simularApi({
      'GET /api/categorias': { body: [] },
      'GET /api/ofertas/mias': () => ({
        body: [miOferta('a', 'Activa', [turno('t1', 2, 1)], cerrada ? { estado: 'cerrada' } : {})],
      }),
      'PATCH /api/ofertas/a/cerrar': () => {
        cerrada = true
        return { body: {} }
      },
    })
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    abrir()

    await userEvent.click(within(await fila('Activa')).getByRole('button', { name: 'Cerrar oferta' }))

    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining('¿Cerrar "Activa"?'))
    expect(await screen.findByText('Cerrada')).toHaveClass('gestion-estado-cerrada')
    expect(within(await fila('Activa')).queryByRole('button', { name: 'Cerrar oferta' })).not.toBeInTheDocument()
    expect(llamadas.filter((l) => l.ruta === '/api/ofertas/mias')).toHaveLength(2)
  })

  it('no hace nada si se cancela la confirmación', async () => {
    const llamadas = simularApi({
      'GET /api/categorias': { body: [] },
      'GET /api/ofertas/mias': { body: [miOferta('a', 'Activa', [turno('t1', 2, 1)])] },
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    abrir()

    await userEvent.click(within(await fila('Activa')).getByRole('button', { name: 'Eliminar' }))

    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false)
  })

  it('muestra el motivo si no se pudo eliminar', async () => {
    const llamadas = simularApi({
      'GET /api/categorias': { body: [] },
      'GET /api/ofertas/mias': { body: [miOferta('a', 'Activa', [turno('t1', 2, 1)])] },
      'DELETE /api/ofertas/a': { status: 409, body: { message: 'Tiene voluntarios aceptados' } },
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    abrir()

    await userEvent.click(within(await fila('Activa')).getByRole('button', { name: 'Eliminar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tiene voluntarios aceptados')
    expect(llamadas.find((l) => l.metodo === 'DELETE')?.ruta).toBe('/api/ofertas/a')
  })

  it('enlaza a la pantalla de publicar un voluntariado', async () => {
    simularApi({ 'GET /api/ofertas/mias': { body: [] } })
    abrir()

    expect(screen.getByRole('link', { name: /Publicar voluntariado/ })).toHaveAttribute('href', '/gestionar-ofertas/nueva')
    expect(await screen.findByRole('link', { name: 'Publicar mi primer voluntariado' })).toHaveAttribute('href', '/gestionar-ofertas/nueva')
  })

  it('muestra el aviso de oferta publicada al volver de publicar', async () => {
    simularApi({ 'GET /api/ofertas/mias': { body: [] } })
    window.history.pushState({ mensajeExito: 'Oferta publicada. Los voluntarios ya pueden verla.' }, '', '/gestionar-ofertas')
    abrir()

    expect(screen.getByRole('status')).toHaveTextContent('Oferta publicada')
    // No vuelve a salir al recargar
    expect(window.history.state).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
