/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la pantalla de candidatos: filtros, lista de espera y confirmar asistencia.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Candidatos from '../pages/Candidatos.tsx'
import { OFERTANTE, oferta, simularApi, turno } from './api.ts'

type Datos = Record<string, unknown>

function candidato(id: string, nombre: string, datos: Datos = {}) {
  return {
    id,
    estado: 'pendiente',
    terminada: false,
    horasPrevistas: 3,
    horasRealizadas: null,
    cancelacionTardia: false,
    mensaje: null,
    motivoRechazo: null,
    fechaSolicitud: '2026-11-01T10:00:00.000Z',
    fechaResolucion: null,
    turnoIds: ['t1'],
    voluntario: {
      id: `v-${id}`,
      nombre,
      avatarUrl: null,
      isla: null,
      municipio: null,
      edad: null,
      biografia: null,
      intereses: [],
      habilidades: [],
      idiomas: [],
      estadisticas: { horasTotales: 0, colaboraciones: 0, valoracionMedia: 0, numValoraciones: 0 },
      email: null,
      telefono: null,
    },
    ...datos,
  }
}

const MI_OFERTA = {
  ...oferta([turno('t1', -1, 0)]),
  estado: 'publicada',
  terminada: true,
  creadaEn: '2026-10-01T00:00:00.000Z',
  candidatosPendientes: 0,
}

function abrir() {
  render(<Candidatos ofertaId={MI_OFERTA.id} usuario={OFERTANTE} onCerrarSesion={() => {}} />)
}

describe('Candidatos', () => {
  it('cuenta cada estado en su pestaña y muestra la lista de espera', async () => {
    simularApi({
      [`GET /api/ofertas/mias/${MI_OFERTA.id}`]: { body: MI_OFERTA },
      [`GET /api/inscripciones/oferta/${MI_OFERTA.id}`]: {
        body: [
          candidato('a', 'Ana'),
          candidato('b', 'Beatriz', { estado: 'en_espera' }),
          candidato('c', 'Carlos', { estado: 'no_presentado' }),
        ],
      },
    })
    abrir()

    expect(await screen.findByRole('tab', { name: 'Pendientes 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'En espera 1' })).toBeInTheDocument()
    // "Finalizados" agrupa completados y no presentados
    expect(screen.getByRole('tab', { name: 'Finalizados 1' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'En espera 1' }))
    expect(screen.getByText('Beatriz')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByText(/pasará a pendiente en cuanto se libere una plaza/)).toBeInTheDocument()
  })

  it('no deja confirmar la asistencia antes de que termine el turno', async () => {
    simularApi({
      [`GET /api/ofertas/mias/${MI_OFERTA.id}`]: { body: MI_OFERTA },
      [`GET /api/inscripciones/oferta/${MI_OFERTA.id}`]: {
        body: [candidato('a', 'Ana', { estado: 'aceptada', terminada: false })],
      },
    })
    abrir()

    await userEvent.click(await screen.findByRole('tab', { name: 'Aceptados 1' }))
    expect(screen.getByText(/Podrás confirmar su asistencia/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Participó' })).not.toBeInTheDocument()
  })

  it('confirma la participación con las horas previstas editadas', async () => {
    let completada = false
    const llamadas = simularApi({
      [`GET /api/ofertas/mias/${MI_OFERTA.id}`]: { body: MI_OFERTA },
      [`GET /api/inscripciones/oferta/${MI_OFERTA.id}`]: () => ({
        body: [
          candidato('a', 'Ana', completada
            ? { estado: 'completada', terminada: true, horasRealizadas: 2.5 }
            : { estado: 'aceptada', terminada: true }),
        ],
      }),
      'PATCH /api/inscripciones/a/completar': () => {
        completada = true
        return { body: { id: 'a', estado: 'completada', horasRealizadas: 2.5 } }
      },
    })
    abrir()

    await userEvent.click(await screen.findByRole('tab', { name: 'Aceptados 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Participó' }))

    const horas = screen.getByLabelText(/Horas realizadas/)
    expect(horas).toHaveValue(3)
    await userEvent.clear(horas)
    await userEvent.type(horas, '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar participación' }))

    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ asistio: true, horas: 2.5 })
    await userEvent.click(await screen.findByRole('tab', { name: 'Finalizados 1' }))
    expect(screen.getByText(/2.5 h sumadas a su perfil/)).toBeInTheDocument()
  })

  it('marca que no se presentó sin enviar horas', async () => {
    const llamadas = simularApi({
      [`GET /api/ofertas/mias/${MI_OFERTA.id}`]: { body: MI_OFERTA },
      [`GET /api/inscripciones/oferta/${MI_OFERTA.id}`]: {
        body: [candidato('a', 'Ana', { estado: 'aceptada', terminada: true })],
      },
      'PATCH /api/inscripciones/a/completar': { body: { id: 'a', estado: 'no_presentado', horasRealizadas: 0 } },
    })
    abrir()

    await userEvent.click(await screen.findByRole('tab', { name: 'Aceptados 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'No se presentó' }))

    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ asistio: false })
  })
})
