/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la pantalla de voluntarios recomendados: afinidad, perfil e invitaciones.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import VoluntariosRecomendados from '../pages/VoluntariosRecomendados.tsx'
import { OFERTANTE, simularApi } from './api.ts'

const OFERTA_ID = 'of1'
const RUTA = `GET /api/ofertas/mias/${OFERTA_ID}/voluntarios-recomendados`
const INVITAR = `POST /api/ofertas/mias/${OFERTA_ID}/invitaciones`

function recomendado(id: string, nombre: string, afinidad: number, invitado = false) {
  return {
    voluntario: {
      id,
      nombre,
      avatarUrl: null,
      isla: 'tenerife',
      municipio: 'Adeje',
      edad: 25,
      biografia: 'Me encanta el mar',
      intereses: [{ id: 'c1', nombre: 'Medio ambiente' }],
      habilidades: ['Primeros auxilios'],
      idiomas: ['Inglés'],
      estadisticas: { horasTotales: 12, colaboraciones: 3, valoracionMedia: 4.5, numValoraciones: 2 },
    },
    afinidad,
    motivos: [
      { tipo: 'interes', texto: 'Le interesa Medio ambiente' },
      { tipo: 'isla', texto: 'Colabora en Tenerife' },
    ],
    invitado,
  }
}

function abrir() {
  render(<VoluntariosRecomendados ofertaId={OFERTA_ID} usuario={OFERTANTE} onCerrarSesion={() => {}} />)
}

describe('VoluntariosRecomendados', () => {
  it('muestra a los voluntarios con su compatibilidad, motivos y perfil', async () => {
    simularApi({
      [RUTA]: {
        body: {
          oferta: { id: OFERTA_ID, titulo: 'Limpieza de playa' },
          recomendaciones: [recomendado('v1', 'Ana', 90), recomendado('v2', 'Luis', 40, true)],
        },
      },
    })
    abrir()

    expect(await screen.findByRole('heading', { name: /Limpieza de playa/ })).toBeInTheDocument()
    expect(screen.getByText('90% compatible')).toBeInTheDocument()
    expect(screen.getAllByText('Le interesa Medio ambiente')).toHaveLength(2)
    // Luis ya estaba invitado
    expect(screen.getByText('✓ Invitación enviada')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Invitar' })).toHaveLength(1)

    await userEvent.click(screen.getAllByRole('button', { name: 'Ver perfil' })[0])
    expect(screen.getByText('Me encanta el mar')).toBeInTheDocument()
    expect(screen.getByText('4.5 / 5 (2)')).toBeInTheDocument()
  })

  it('envía la invitación con el mensaje y la marca como enviada', async () => {
    const llamadas = simularApi({
      [RUTA]: {
        body: {
          oferta: { id: OFERTA_ID, titulo: 'Limpieza de playa' },
          recomendaciones: [recomendado('v1', 'Ana', 90)],
        },
      },
      [INVITAR]: { status: 201, body: { voluntarioId: 'v1', invitado: true } },
    })
    abrir()

    await userEvent.click(await screen.findByRole('button', { name: 'Invitar' }))
    await userEvent.type(screen.getByLabelText(/Mensaje para Ana/), 'Te esperamos')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))

    expect(await screen.findByText('✓ Invitación enviada')).toBeInTheDocument()
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
      voluntarioId: 'v1',
      mensaje: 'Te esperamos',
    })
  })

  it('muestra el error del servidor si la oferta no admite recomendaciones', async () => {
    simularApi({
      [RUTA]: { status: 409, body: { message: 'Solo se pueden buscar voluntarios para ofertas publicadas' } },
    })
    abrir()

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se pueden buscar voluntarios')
  })

  it('avisa cuando no hay voluntarios compatibles', async () => {
    simularApi({
      [RUTA]: { body: { oferta: { id: OFERTA_ID, titulo: 'Limpieza de playa' }, recomendaciones: [] } },
    })
    abrir()

    expect(await screen.findByText(/no hay voluntarios cuyo perfil encaje/)).toBeInTheDocument()
  })
})
