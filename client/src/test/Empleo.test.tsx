/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de la pantalla de empleo: catalogo y candidaturas del voluntario, y ofertas de la entidad.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Empleo from '../pages/Empleo.tsx'
import {
  paginasVisibles,
  type MiCandidatura,
  type MiOfertaEmpleo,
  type OfertaEmpleo,
  type PaginaEmpleos,
} from '../empleo.ts'
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

// Respuesta paginada de GET /api/empleo
function pagina(ofertas: OfertaEmpleo[], datos: Partial<PaginaEmpleos> = {}) {
  const total = datos.total ?? ofertas.length
  return {
    body: {
      ofertas,
      total,
      pagina: 1,
      porPagina: 12,
      totalPaginas: Math.ceil(total / 12),
      ...datos,
    },
  }
}

// n ofertas distintas, numeradas desde "desde"
const variasOfertas = (n: number, desde = 1) =>
  Array.from({ length: n }, (_, i) => empleo({ id: `e${desde + i}`, titulo: `Puesto ${desde + i}` }))

// Pagina pedida en la URL (sin parametro, la primera)
const paginaDeUrl = (url: string) => Number(new URL(url, 'http://x').searchParams.get('pagina') ?? 1)

const urlsPedidas = () => vi.mocked(fetch).mock.calls.map(([url]) => String(url))

const sinSesion = () => {}

describe('Empleo (voluntario)', () => {
  it('muestra las ofertas de empleo con su contrato, lugar, salario y vacantes', async () => {
    simularApi({ 'GET /api/empleo': pagina([empleo()]) })
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
    simularApi({ 'GET /api/empleo': pagina([]) })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    expect(await screen.findByText('Todavía no hay ofertas de empleo publicadas.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Contrato'), 'practicas')
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'completa')

    expect(await screen.findByText('No hay ofertas de empleo con esos filtros.')).toBeInTheDocument()
    expect(urlsPedidas()).toContain('/api/empleo?tipoContrato=practicas&jornada=completa')
  })

  it('lista sus candidaturas y permite retirar una tras confirmarlo', async () => {
    const llamadas = simularApi({
      'GET /api/empleo': pagina([]),
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
    simularApi({ 'GET /api/empleo': pagina([]), 'GET /api/empleo/candidaturas/mias': { body: [] } })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Mis candidaturas' }))

    expect(
      await screen.findByText('Todavía no te has postulado a ninguna oferta de empleo.'),
    ).toBeInTheDocument()
  })
})

describe('Empleo (voluntario): paginacion del catalogo', () => {
  // 30 ofertas: paginas de 12, 12 y 6
  const responderPorPagina = (_cuerpo: unknown, url: string) => {
    const n = paginaDeUrl(url)
    return pagina(variasOfertas(n === 3 ? 6 : 12, (n - 1) * 12 + 1), { total: 30, pagina: n })
  }

  it('con una sola pagina no muestra la paginacion', async () => {
    simularApi({ 'GET /api/empleo': pagina(variasOfertas(5)) })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    expect(await screen.findByText('5 ofertas de empleo')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Páginas de ofertas de empleo' })).not.toBeInTheDocument()
  })

  it('muestra el total, el rango visible y la pagina actual', async () => {
    simularApi({ 'GET /api/empleo': responderPorPagina })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)

    expect(await screen.findByText('30 ofertas de empleo · Mostrando 1–12')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(12)
    const nav = screen.getByRole('navigation', { name: 'Páginas de ofertas de empleo' })
    expect(within(nav).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Página 3' })).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('button', { name: /Anterior/ })).toBeDisabled()
    expect(within(nav).getByRole('button', { name: /Siguiente/ })).toBeEnabled()
  })

  it('avanza y retrocede de pagina pidiendo cada una a la API', async () => {
    simularApi({ 'GET /api/empleo': responderPorPagina })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)
    await screen.findByText('Puesto 1')

    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(await screen.findByText('Puesto 13')).toBeInTheDocument()
    expect(screen.queryByText('Puesto 1')).not.toBeInTheDocument()
    expect(urlsPedidas()).toContain('/api/empleo?pagina=2')

    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }))
    expect(await screen.findByText('30 ofertas de empleo · Mostrando 25–30')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /Anterior/ }))
    expect(await screen.findByText('Puesto 13')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  it('al cambiar un filtro vuelve a la primera pagina', async () => {
    simularApi({ 'GET /api/empleo': responderPorPagina })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)
    await screen.findByText('Puesto 1')
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }))
    await screen.findByText('Puesto 13')

    await userEvent.selectOptions(screen.getByLabelText('Isla'), 'tenerife')

    expect(await screen.findByText('Puesto 1')).toBeInTheDocument()
    expect(urlsPedidas().at(-1)).toBe('/api/empleo?isla=tenerife')
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
  })

  it('si la pagina pedida se ha quedado vacia, salta a la ultima', async () => {
    // Al llegar a la 3 ya solo quedan 24 ofertas: la 3 viene vacia y se pide la 2
    simularApi({
      'GET /api/empleo': (_cuerpo, url) => {
        const n = paginaDeUrl(url)
        if (n === 1) return pagina(variasOfertas(12), { total: 30 })
        if (n === 3) return pagina([], { total: 24, pagina: 3 })
        return pagina(variasOfertas(12, 13), { total: 24, pagina: n })
      },
    })
    render(<Empleo usuario={VOLUNTARIO} onCerrarSesion={sinSesion} />)
    await screen.findByText('Puesto 1')

    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }))

    expect(await screen.findByText('24 ofertas de empleo · Mostrando 13–24')).toBeInTheDocument()
    expect(urlsPedidas().slice(-2)).toEqual(['/api/empleo?pagina=3', '/api/empleo?pagina=2'])
    expect(screen.queryByRole('button', { name: 'Página 3' })).not.toBeInTheDocument()
  })
})

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
