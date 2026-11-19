/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests del formulario de ofertas: validaciones, datos enviados, foto y edicion.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FormularioOferta, { type EnvioOferta } from '../components/FormularioOferta.tsx'
import { oferta, simularApi, turno } from './api.ts'

const CATEGORIAS = [
  { id: 'c1', nombre: 'Medio ambiente', slug: 'medio-ambiente' },
  { id: 'c2', nombre: 'Animales', slug: 'animales' },
]

// Fecha AAAA-MM-DD a n dias de hoy, como la escribe el usuario en el campo
function fecha(n: number): string {
  return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
}

type Envio = (envio: EnvioOferta) => Promise<string | null>

function abrir(props: { onEnviar?: Envio; oferta?: Parameters<typeof FormularioOferta>[0]['oferta'] } = {}) {
  const onEnviar = vi.fn<Envio>(props.onEnviar ?? (async () => null))
  render(
    <FormularioOferta
      titulo="Publicar una oferta"
      textoBoton="Publicar oferta"
      textoEnviando="Publicando..."
      oferta={props.oferta}
      onEnviar={onEnviar}
    />,
  )
  return onEnviar
}

// Las fechas y horas se escriben de golpe: el campo solo acepta valores completos
function escribirTurno(indice: number, datos: { fecha?: string; inicio?: string; fin?: string; plazas?: string }) {
  if (datos.fecha !== undefined) fireEvent.change(screen.getAllByLabelText('Fecha')[indice], { target: { value: datos.fecha } })
  if (datos.inicio !== undefined) fireEvent.change(screen.getAllByLabelText('Inicio')[indice], { target: { value: datos.inicio } })
  if (datos.fin !== undefined) fireEvent.change(screen.getAllByLabelText('Fin')[indice], { target: { value: datos.fin } })
  if (datos.plazas !== undefined) fireEvent.change(screen.getAllByLabelText('Plazas')[indice], { target: { value: datos.plazas } })
}

// Rellena una oferta presencial valida con un turno
async function rellenar() {
  await userEvent.type(screen.getByLabelText('Título *'), '  Limpieza de playa ')
  await userEvent.type(screen.getByLabelText('Descripción *'), 'Recogida de residuos')
  await userEvent.click(await screen.findByLabelText('Medio ambiente'))
  await userEvent.selectOptions(screen.getByLabelText('Isla *'), 'tenerife')
  await userEvent.type(screen.getByLabelText('Municipio *'), ' La Laguna ')
  escribirTurno(0, { fecha: fecha(3), inicio: '10:00', fin: '13:00', plazas: '4' })
}

const enviar = () => userEvent.click(screen.getByRole('button', { name: 'Publicar oferta' }))

beforeEach(() => {
  simularApi({ 'GET /api/categorias': { body: CATEGORIAS } })
})

describe('FormularioOferta', () => {
  it('carga las categorías y avisa si no se pudieron cargar', async () => {
    abrir()
    expect(await screen.findByLabelText('Animales')).toBeInTheDocument()

    cleanup()
    simularApi({ 'GET /api/categorias': { status: 500, body: { message: 'x' } } })
    abrir()
    expect(await screen.findByText('No se pudieron cargar las categorías.')).toBeInTheDocument()
  })

  it('envía los datos limpios de una oferta presencial', async () => {
    const onEnviar = abrir()
    await rellenar()
    await userEvent.type(screen.getByLabelText('Dirección'), '   ')
    await userEvent.type(screen.getByLabelText('Edad mínima'), '16')

    await enviar()

    expect(onEnviar).toHaveBeenCalledWith({
      cuerpo: {
        titulo: 'Limpieza de playa',
        descripcion: 'Recogida de residuos',
        categoriaIds: ['c1'],
        modalidad: 'presencial',
        tipoDuracion: 'jornada',
        // Una dirección en blanco no se envía
        ubicacion: { isla: 'tenerife', municipio: 'La Laguna', direccion: undefined },
        requisitos: undefined,
        edadMinima: 16,
        turnos: [{ id: undefined, fecha: fecha(3), horaInicio: '10:00', horaFin: '13:00', plazas: 4 }],
      },
      imagen: null,
      quitarImagen: false,
    })
  })

  it('una oferta online no pide ni envía la ubicación', async () => {
    const onEnviar = abrir()
    await userEvent.type(screen.getByLabelText('Título *'), 'Clases online')
    await userEvent.type(screen.getByLabelText('Descripción *'), 'Apoyo escolar')
    await userEvent.click(await screen.findByLabelText('Animales'))
    await userEvent.selectOptions(screen.getByLabelText('Modalidad *'), 'online')
    escribirTurno(0, { fecha: fecha(1), inicio: '17:00', fin: '18:00', plazas: '2' })

    expect(screen.queryByLabelText('Isla *')).not.toBeInTheDocument()
    await enviar()

    expect(onEnviar.mock.lastCall![0].cuerpo).toMatchObject({ modalidad: 'online', ubicacion: undefined })
  })

  it('envía varios turnos y deja quitar los que sobran', async () => {
    const onEnviar = abrir()
    await rellenar()
    // Con un solo turno no se puede quitar
    expect(screen.getByRole('button', { name: 'Quitar el turno 1' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Añadir turno' }))
    await userEvent.click(screen.getByRole('button', { name: 'Añadir turno' }))
    escribirTurno(1, { fecha: fecha(5), inicio: '09:00', fin: '11:00', plazas: '2' })
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el turno 3' }))
    await enviar()

    expect(onEnviar.mock.lastCall![0].cuerpo.turnos).toEqual([
      expect.objectContaining({ fecha: fecha(3), plazas: 4 }),
      expect.objectContaining({ fecha: fecha(5), plazas: 2 }),
    ])
  })

  it.each([
    ['sin título', () => userEvent.clear(screen.getByLabelText('Título *')), 'El título y la descripción son obligatorios'],
    ['sin categoría', () => userEvent.click(screen.getByLabelText('Medio ambiente')), 'Elige al menos una categoría'],
    ['sin municipio', () => userEvent.clear(screen.getByLabelText('Municipio *')), 'Indica la isla y el municipio de la oferta'],
    ['sin isla', () => userEvent.selectOptions(screen.getByLabelText('Isla *'), ''), 'Indica la isla y el municipio de la oferta'],
    ['con un turno incompleto', async () => escribirTurno(0, { plazas: '' }), 'Completa todos los datos de cada turno'],
    ['con un turno en el pasado', async () => escribirTurno(0, { fecha: fecha(-1) }), 'Los turnos no pueden tener una fecha pasada'],
    ['con la hora de fin antes del inicio', async () => escribirTurno(0, { fin: '09:00' }), 'La hora de fin debe ser posterior a la de inicio'],
    ['con la hora de fin igual al inicio', async () => escribirTurno(0, { fin: '10:00' }), 'La hora de fin debe ser posterior a la de inicio'],
    ['con 0 plazas', async () => escribirTurno(0, { plazas: '0' }), 'Cada turno necesita al menos una plaza'],
    ['con plazas decimales', async () => escribirTurno(0, { plazas: '1.5' }), 'Cada turno necesita al menos una plaza'],
  ])('no envía una oferta %s y explica el motivo', async (_caso, estropear, mensaje) => {
    const onEnviar = abrir()
    await rellenar()
    await estropear()

    await enviar()

    expect(screen.getByRole('alert')).toHaveTextContent(mensaje)
    expect(onEnviar).not.toHaveBeenCalled()
  })

  it('siempre queda al menos un turno: el último no se puede quitar', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Añadir turno' }))

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el turno 2' }))

    expect(screen.getAllByLabelText('Fecha')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Quitar el turno 1' })).toBeDisabled()
  })

  it('muestra el error que devuelve el servidor y vuelve a activar el botón', async () => {
    abrir({ onEnviar: async () => 'La oferta ya existe' })
    await rellenar()

    await enviar()

    expect(await screen.findByRole('alert')).toHaveTextContent('La oferta ya existe')
    expect(screen.getByRole('button', { name: 'Publicar oferta' })).toBeEnabled()
  })

  it('muestra "Publicando..." mientras se envía', async () => {
    let terminar: (valor: string | null) => void = () => {}
    abrir({ onEnviar: () => new Promise((resolver) => { terminar = resolver }) })
    await rellenar()

    await enviar()

    expect(screen.getByRole('button', { name: 'Publicando...' })).toBeDisabled()
    terminar(null)
    expect(await screen.findByRole('button', { name: 'Publicar oferta' })).toBeEnabled()
  })
})

describe('FormularioOferta: foto de presentación', () => {
  // El filtro "accept" del navegador se desactiva para poder probar la validación propia
  const usuario = () => userEvent.setup({ applyAccept: false })

  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:vista'), revokeObjectURL: vi.fn() }))
  })

  it('muestra la vista previa y la envía con la oferta', async () => {
    const onEnviar = abrir()
    await rellenar()
    const foto = new File(['png'], 'playa.png', { type: 'image/png' })

    await usuario().upload(screen.getByLabelText('Foto de presentación'), foto)

    expect(screen.getByAltText('Vista previa de la foto de la oferta')).toHaveAttribute('src', 'blob:vista')
    await enviar()
    expect(onEnviar.mock.lastCall![0].imagen).toBe(foto)
  })

  it('al quitar la foto elegida no se envía ninguna', async () => {
    const onEnviar = abrir()
    await rellenar()
    await usuario().upload(screen.getByLabelText('Foto de presentación'), new File(['png'], 'a.png', { type: 'image/png' }))

    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto' }))

    expect(screen.queryByAltText('Vista previa de la foto de la oferta')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista')
    await enviar()
    expect(onEnviar.mock.lastCall![0].imagen).toBeNull()
  })

  it.each([
    ['un GIF', new File(['gif'], 'a.gif', { type: 'image/gif' }), 'La imagen debe ser JPG, PNG o WebP'],
    ['una foto de más de 5 MB', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' }), 'La imagen no puede superar los 5 MB'],
  ])('rechaza %s', async (_caso, archivo, mensaje) => {
    abrir()

    await usuario().upload(screen.getByLabelText('Foto de presentación'), archivo)

    expect(screen.getByRole('alert')).toHaveTextContent(mensaje)
    expect(screen.queryByAltText('Vista previa de la foto de la oferta')).not.toBeInTheDocument()
  })
})

describe('FormularioOferta: editar una oferta', () => {
  const existente = () =>
    oferta(
      [
        turno('pasado', -2, 0),
        // 3 plazas, 1 libre: 2 ocupadas
        turno('ocupado', 4, 1),
        turno('libre', 2, 3),
      ],
      { requisitos: 'Ropa cómoda', edadMinima: 18, imagenes: ['/api/imagenes/foto1'] },
    )

  it('parte de los datos de la oferta y solo muestra los turnos próximos, ordenados', async () => {
    abrir({ oferta: existente() })

    expect(screen.getByLabelText('Título *')).toHaveValue('Limpieza de playa')
    expect(screen.getByLabelText('Municipio *')).toHaveValue('La Laguna')
    expect(screen.getByLabelText('Requisitos')).toHaveValue('Ropa cómoda')
    expect(screen.getByLabelText('Edad mínima')).toHaveValue(18)
    expect(await screen.findByLabelText('Medio ambiente')).toBeChecked()
    expect(screen.getAllByLabelText('Fecha').map((campo) => (campo as HTMLInputElement).value)).toEqual([fecha(2), fecha(4)])
    expect(screen.getByAltText('Foto actual de la oferta')).toHaveAttribute('src', '/api/imagenes/foto1')
  })

  it('no deja quitar un turno con voluntarios ni bajar de sus plazas ocupadas', async () => {
    const onEnviar = abrir({ oferta: existente() })

    expect(screen.getByText(/2 plazas ocupadas: avisa a los voluntarios/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar el turno 2' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Quitar el turno 1' })).toBeEnabled()

    escribirTurno(1, { plazas: '1' })
    await enviar()

    expect(screen.getByRole('alert')).toHaveTextContent('Un turno ya tiene 2 plazas ocupadas: no puede tener menos plazas')
    expect(onEnviar).not.toHaveBeenCalled()
  })

  it('envía los ids de los turnos existentes y pide quitar la foto actual si se borra', async () => {
    const onEnviar = abrir({ oferta: existente() })
    await screen.findByLabelText('Medio ambiente')

    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto' }))
    await enviar()

    const envio = onEnviar.mock.lastCall![0]
    expect(envio.quitarImagen).toBe(true)
    expect(envio.cuerpo.turnos).toEqual([
      expect.objectContaining({ id: 'libre', plazas: 3 }),
      expect.objectContaining({ id: 'ocupado', plazas: 3 }),
    ])
  })

  it('si se cambia la foto se puede volver a la actual', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:nueva'), revokeObjectURL: vi.fn() }))
    const onEnviar = abrir({ oferta: existente() })
    await screen.findByLabelText('Medio ambiente')

    await userEvent.upload(screen.getByLabelText('Cambiar foto de presentación'), new File(['x'], 'b.png', { type: 'image/png' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mantener la foto actual' }))
    await enviar()

    expect(screen.getByAltText('Foto actual de la oferta')).toBeInTheDocument()
    expect(onEnviar.mock.lastCall![0]).toMatchObject({ imagen: null, quitarImagen: false })
  })
})
