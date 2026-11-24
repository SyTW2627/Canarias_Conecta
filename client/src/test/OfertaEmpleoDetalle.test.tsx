/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests del detalle de una oferta de empleo: postularse (voluntario) y revisar candidaturas (entidad).
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import OfertaEmpleoDetalle from '../pages/OfertaEmpleoDetalle.tsx'
import type { CandidaturaRecibida, OfertaEmpleo } from '../empleo.ts'
import { OFERTANTE, VOLUNTARIO, dia, simularApi } from './api.ts'

const OFERTA: OfertaEmpleo = {
  id: 'e1',
  titulo: 'Educador/a social',
  descripcion: 'Apoyo a familias',
  organizacion: 'Asociación',
  categorias: [{ id: 'c1', nombre: 'Educación', slug: 'educacion' }],
  tipoContrato: 'indefinido',
  jornada: 'completa',
  modalidad: 'presencial',
  ubicacion: { isla: 'gran_canaria', municipio: 'Telde' },
  salario: null,
  requisitos: 'Grado en Educación Social',
  vacantes: 1,
  fechaLimite: '2026-12-15T00:00:00.000Z',
  fechaPublicacion: dia(-1),
  abierta: true,
}

const sinSesion = () => {}

function renderDetalle(usuario = VOLUNTARIO) {
  render(<OfertaEmpleoDetalle ofertaId="e1" usuario={usuario} onCerrarSesion={sinSesion} />)
}

describe('OfertaEmpleoDetalle (voluntario)', () => {
  it('muestra la oferta y envia la candidatura con el mensaje', async () => {
    const llamadas = simularApi({
      'GET /api/empleo/e1': { body: OFERTA },
      'GET /api/empleo/candidaturas/mias': { body: [] },
      'POST /api/empleo/e1/candidaturas': { status: 201, body: { id: 'c1', estado: 'pendiente' } },
    })
    renderDetalle()

    expect(await screen.findByRole('heading', { name: 'Educador/a social' })).toBeInTheDocument()
    expect(screen.getByText('Indefinido')).toBeInTheDocument()
    expect(screen.getByText('Telde, Gran Canaria')).toBeInTheDocument()
    expect(screen.getByText('Hasta el 15 de diciembre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Grado en Educación Social')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Mensaje para la entidad (opcional)'), 'Me encanta')
    await userEvent.click(screen.getByRole('button', { name: 'Postularme' }))

    expect(await screen.findByText(/Candidatura enviada/)).toBeInTheDocument()
    expect(screen.getByText('En revisión')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Postularme' })).not.toBeInTheDocument()
    expect(llamadas).toContainEqual({
      metodo: 'POST',
      ruta: '/api/empleo/e1/candidaturas',
      cuerpo: { mensaje: 'Me encanta' },
    })
  })

  it('si ya se postulo muestra el estado en lugar del formulario', async () => {
    simularApi({
      'GET /api/empleo/e1': { body: OFERTA },
      'GET /api/empleo/candidaturas/mias': {
        body: [{ id: 'c1', ofertaId: 'e1', estado: 'preseleccionada', fechaCandidatura: '2026-11-20T10:00:00.000Z' }],
      },
    })
    renderDetalle()

    expect(await screen.findByText('Preseleccionada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Postularme' })).not.toBeInTheDocument()
  })

  it('una candidatura retirada permite volver a postularse', async () => {
    simularApi({
      'GET /api/empleo/e1': { body: OFERTA },
      'GET /api/empleo/candidaturas/mias': {
        body: [{ id: 'c1', ofertaId: 'e1', estado: 'retirada', fechaCandidatura: '2026-11-20T10:00:00.000Z' }],
      },
    })
    renderDetalle()

    expect(await screen.findByRole('button', { name: 'Postularme' })).toBeInTheDocument()
  })

  it('fuera de plazo no deja postularse', async () => {
    simularApi({
      'GET /api/empleo/e1': { body: { ...OFERTA, abierta: false } },
      'GET /api/empleo/candidaturas/mias': { body: [] },
    })
    renderDetalle()

    expect(await screen.findByText('El plazo para presentar candidaturas ha terminado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Postularme' })).not.toBeInTheDocument()
  })

  it('muestra el error del servidor si la oferta no existe', async () => {
    simularApi({
      'GET /api/empleo/e1': { status: 404, body: { message: 'La oferta de empleo no existe o ya no está disponible' } },
      'GET /api/empleo/candidaturas/mias': { body: [] },
    })
    renderDetalle()

    expect(
      await screen.findByText('La oferta de empleo no existe o ya no está disponible'),
    ).toBeInTheDocument()
  })
})

describe('OfertaEmpleoDetalle (entidad)', () => {
  function recibida(datos: Partial<CandidaturaRecibida> = {}): CandidaturaRecibida {
    return {
      id: 'c1',
      estado: 'pendiente',
      mensaje: 'Llevo dos años de voluntaria',
      fechaCandidatura: '2026-11-20T10:00:00.000Z',
      fechaResolucion: null,
      candidato: {
        id: 'v1',
        nombre: 'Laura',
        avatarUrl: null,
        isla: 'tenerife',
        municipio: 'La Laguna',
        biografia: null,
        intereses: [],
        habilidades: ['Primeros auxilios'],
        idiomas: ['Inglés'],
        acreditaciones: [{ nombre: 'Monitor de ocio', fechaObtencion: '2025-01-01T00:00:00.000Z' }],
        estadisticas: { horasTotales: 42, colaboraciones: 9, valoracionMedia: 4.75, numValoraciones: 4 },
        email: null,
        telefono: null,
      },
      ...datos,
    }
  }

  const propia = (candidaturas: CandidaturaRecibida[]) => ({
    'GET /api/empleo/e1/candidaturas': {
      body: { oferta: { ...OFERTA, estado: 'publicada', candidaturas: 1, candidaturasPendientes: 1 }, candidaturas },
    },
  })

  it('muestra cada candidato con su trayectoria de voluntariado y preselecciona', async () => {
    const llamadas = simularApi({
      ...propia([recibida()]),
      'PATCH /api/empleo/candidaturas/c1': { body: { id: 'c1', estado: 'preseleccionada' } },
    })
    renderDetalle(OFERTANTE)

    const tarjeta = (await screen.findByRole('heading', { name: 'Laura' })).closest('li')!
    const trayectoria = within(tarjeta).getByRole('list', { name: 'Trayectoria de voluntariado' })
    expect(trayectoria).toHaveTextContent('42 h de voluntariado')
    expect(trayectoria).toHaveTextContent('9 colaboraciones')
    expect(trayectoria).toHaveTextContent('4,8 / 5 en 4 valoraciones')
    expect(within(tarjeta).getByText('Llevo dos años de voluntaria')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Monitor de ocio')).toBeInTheDocument()
    // Sin preseleccionar no se ve el contacto
    expect(within(tarjeta).queryByText('Email')).not.toBeInTheDocument()

    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Preseleccionar' }))

    expect(llamadas).toContainEqual({
      metodo: 'PATCH',
      ruta: '/api/empleo/candidaturas/c1',
      cuerpo: { estado: 'preseleccionada' },
    })
  })

  it('una preseleccionada muestra el contacto y solo se puede descartar', async () => {
    simularApi(
      propia([
        recibida({
          estado: 'preseleccionada',
          candidato: { ...recibida().candidato, email: 'laura@ejemplo.com', telefono: '600000000' },
        }),
      ]),
    )
    renderDetalle(OFERTANTE)

    const tarjeta = (await screen.findByRole('heading', { name: 'Laura' })).closest('li')!
    expect(within(tarjeta).getByRole('link', { name: 'laura@ejemplo.com' })).toHaveAttribute(
      'href',
      'mailto:laura@ejemplo.com',
    )
    expect(within(tarjeta).getByText('600000000')).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button', { name: 'Preseleccionar' })).not.toBeInTheDocument()
    expect(within(tarjeta).getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
  })

  it('sin candidaturas lo indica', async () => {
    simularApi(propia([]))
    renderDetalle(OFERTANTE)

    expect(await screen.findByText('Todavía no ha llegado ninguna candidatura.')).toBeInTheDocument()
  })

  it('si la oferta es de otra entidad la muestra sin candidaturas', async () => {
    simularApi({
      'GET /api/empleo/e1/candidaturas': { status: 404, body: { message: 'La oferta de empleo no existe o no es tuya' } },
      'GET /api/empleo/e1': { body: OFERTA },
    })
    renderDetalle(OFERTANTE)

    expect(await screen.findByRole('heading', { name: 'Educador/a social' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Candidaturas/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Postularme' })).not.toBeInTheDocument()
  })
})
