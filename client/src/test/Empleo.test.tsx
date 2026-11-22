/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la pantalla de empleo: catalogo y candidaturas del voluntario, y ofertas de la entidad.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Empleo from '../pages/Empleo.tsx'
import type { MiCandidatura, MiOfertaEmpleo, OfertaEmpleo } from '../empleo.ts'
import { OFERTANTE, VOLUNTARIO, dia, simularApi } from './api.ts'

function empleo(datos: Partial<OfertaEmpleo> = {}): OfertaEmpleo {
  return {
    id: 'e1',
    titulo: 'Educador/a social',
    descripcion: 'Apoyo a familias',
    organizacion: 'Asociación',
    categorias: [],
    tipoContrato: 'temporal',
    jornada: 'parcial',
    modalidad: 'presencial',
    ubicacion: { isla: 'tenerife', municipio: 'La Laguna' },
    salario: '1.200 €/mes',
    requisitos: null,
    vacantes: 2,
    fechaLimite: null,
    fechaPublicacion: dia(-1),
    abierta: true,
    ...datos,
  }
}

function candidatura(datos: Partial<MiCandidatura> = {}): MiCandidatura {
  return {
    id: 'c1',
    estado: 'pendiente',
    fechaCandidatura: '2026-11-20T10:00:00.000Z',
    ofertaId: 'e1',
    titulo: 'Educador/a social',
    organizacion: 'Asociación',
    tipoContrato: 'temporal',
    jornada: 'parcial',
    modalidad: 'online',
    ubicacion: null,
    ofertaAbierta: true,
    ...datos,
  }
}

const sinSesion = () => {}

describe('Empleo (voluntario)', () => {
  it('muestra las ofertas de empleo con su contrato, lugar, salario y vacantes', async () => {
    simularApi({ 'GET /api/empleo': { body: [empleo()] } })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    const tarjeta = (await screen.findByText('Educador/a social')).closest('article')!
    expect(within(tarjeta).getByText('Temporal')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Jornada parcial')).toBeInTheDocument()
    expect(within(tarjeta).getByText('La Laguna, Tenerife')).toBeInTheDocument()
    expect(within(tarjeta).getByText('1.200 €/mes')).toBeInTheDocument()
    expect(within(tarjeta).getByText('2 vacantes')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Abierto')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('link', { name: 'Ver oferta' })).toHaveAttribute('href', '/empleo/e1')
    expect(screen.getByRole('link', { name: 'Empleo' })).toHaveAttribute('aria-current', 'page')
  })

  it('envia los filtros elegidos a la API', async () => {
    simularApi({ 'GET /api/empleo': { body: [] } })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    expect(await screen.findByText('Todavía no hay ofertas de empleo publicadas.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Contrato'), 'practicas')
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'completa')

    expect(await screen.findByText('No hay ofertas de empleo con esos filtros.')).toBeInTheDocument()
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    expect(urls).toContain('/api/empleo?tipoContrato=practicas&jornada=completa')
  })

  it('lista sus candidaturas y permite retirar una tras confirmarlo', async () => {
    const llamadas = simularApi({
      'GET /api/empleo': { body: [] },
      'GET /api/empleo/candidaturas/mias': {
        body: [candidatura(), candidatura({ id: 'c2', titulo: 'Monitor/a', estado: 'descartada' })],
      },
      'PATCH /api/empleo/candidaturas/c1/retirar': { body: { id: 'c1', estado: 'retirada' } },
    })
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Mis candidaturas' }))

    const pendiente = (await screen.findByRole('link', { name: 'Educador/a social' })).closest('li')!
    expect(within(pendiente).getByText('En revisión')).toBeInTheDocument()
    const descartada = screen.getByRole('link', { name: 'Monitor/a' }).closest('li')!
    expect(within(descartada).getByText('Descartada')).toBeInTheDocument()
    // Una descartada ya no se puede retirar
    expect(within(descartada).queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument()

    await userEvent.click(within(pendiente).getByRole('button', { name: 'Retirar' }))

    expect(confirmar).toHaveBeenCalledWith('¿Retirar tu candidatura a "Educador/a social"?')
    expect(llamadas).toContainEqual({
      metodo: 'PATCH',
      ruta: '/api/empleo/candidaturas/c1/retirar',
      cuerpo: undefined,
    })
  })

  it('sin candidaturas lo indica', async () => {
    simularApi({ 'GET /api/empleo': { body: [] }, 'GET /api/empleo/candidaturas/mias': { body: [] } })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Mis candidaturas' }))

    expect(
      await screen.findByText('Todavía no te has postulado a ninguna oferta de empleo.'),
    ).toBeInTheDocument()
  })
})

describe('Empleo (entidad)', () => {
  const mia = (datos: Partial<MiOfertaEmpleo> = {}): MiOfertaEmpleo => ({
    ...empleo(),
    estado: 'publicada',
    candidaturas: 3,
    candidaturasPendientes: 2,
    ...datos,
  })

  it('lista sus ofertas con sus candidaturas y el acceso a revisarlas', async () => {
    simularApi({
      'GET /api/empleo/mias': {
        body: [mia(), mia({ id: 'e2', titulo: 'Cerrada', estado: 'cerrada', abierta: false, candidaturas: 1 })],
      },
    })
    render(<Empleo usuario={OFERTANTE} onCerrarSesion={sinSesion} />)

    const activa = (await screen.findByRole('heading', { name: 'Educador/a social' })).closest('li')!
    expect(within(activa).getByText('Publicada')).toBeInTheDocument()
    expect(within(activa).getByText(/3 candidaturas/)).toBeInTheDocument()
    expect(within(activa).getByRole('link', { name: /Ver candidaturas/ })).toHaveAttribute('href', '/empleo/e1')
    expect(within(activa).getByText('2 sin revisar')).toBeInTheDocument()

    const cerrada = screen.getByRole('heading', { name: 'Cerrada' }).closest('li')!
    expect(within(cerrada).getByText('Cerrada', { selector: 'span' })).toBeInTheDocument()
    expect(within(cerrada).queryByRole('button', { name: 'Cerrar oferta' })).not.toBeInTheDocument()
  })

  it('publica una oferta de empleo con los datos del formulario', async () => {
    const llamadas = simularApi({
      'GET /api/empleo/mias': { body: [] },
      'GET /api/categorias': { body: [{ id: 'c1', nombre: 'Educación' }] },
      'POST /api/empleo': { status: 201, body: { id: 'nueva', estado: 'publicada' } },
    })
    render(<Empleo usuario={OFERTANTE} onCerrarSesion={sinSesion} />)

    await userEvent.click(await screen.findByRole('button', { name: /Publicar oferta de empleo/ }))
    await userEvent.type(screen.getByLabelText('Título del puesto *'), 'Monitor/a')
    await userEvent.type(screen.getByLabelText('Descripción *'), 'Campamentos')
    await userEvent.click(await screen.findByLabelText('Educación'))
    await userEvent.selectOptions(screen.getByLabelText('Contrato *'), 'practicas')
    await userEvent.selectOptions(screen.getByLabelText('Isla *'), 'la_palma')
    await userEvent.type(screen.getByLabelText('Municipio *'), 'Los Llanos')
    await userEvent.clear(screen.getByLabelText('Vacantes *'))
    await userEvent.type(screen.getByLabelText('Vacantes *'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar oferta de empleo' }))

    expect(await screen.findByText(/Oferta de empleo publicada/)).toBeInTheDocument()
    expect(llamadas.find((llamada) => llamada.metodo === 'POST')?.cuerpo).toEqual({
      titulo: 'Monitor/a',
      descripcion: 'Campamentos',
      categoriaIds: ['c1'],
      tipoContrato: 'practicas',
      jornada: 'completa',
      modalidad: 'presencial',
      ubicacion: { isla: 'la_palma', municipio: 'Los Llanos' },
      vacantes: 3,
    })
  })

  it('no envia el formulario si falta la ubicacion de un puesto presencial', async () => {
    const llamadas = simularApi({
      'GET /api/empleo/mias': { body: [] },
      'GET /api/categorias': { body: [] },
    })
    render(<Empleo usuario={OFERTANTE} onCerrarSesion={sinSesion} />)

    await userEvent.click(await screen.findByRole('button', { name: /Publicar oferta de empleo/ }))
    await userEvent.type(screen.getByLabelText('Título del puesto *'), 'Monitor/a')
    await userEvent.type(screen.getByLabelText('Descripción *'), 'Campamentos')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar oferta de empleo' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Indica la isla y el municipio del puesto')
    expect(llamadas.some((llamada) => llamada.metodo === 'POST')).toBe(false)
  })

  it('cierra una oferta tras confirmarlo', async () => {
    const llamadas = simularApi({
      'GET /api/empleo/mias': { body: [mia()] },
      'PATCH /api/empleo/e1/cerrar': { body: { id: 'e1', estado: 'cerrada' } },
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Empleo usuario={OFERTANTE} onCerrarSesion={sinSesion} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar oferta' }))

    expect(llamadas).toContainEqual({ metodo: 'PATCH', ruta: '/api/empleo/e1/cerrar', cuerpo: undefined })
  })
})
