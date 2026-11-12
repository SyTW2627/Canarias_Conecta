/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Formulario de los datos de una oferta, compartido al publicarla y al editarla.
 */
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import '../pages/GestionarOfertas.css'
import {
  DURACIONES,
  ISLAS,
  MODALIDADES,
  esTurnoProximo,
  hoyIso,
  type Oferta,
} from '../ofertas.ts'

type Categoria = { id: string; nombre: string; slug: string }

type TurnoFormulario = {
  clave: number
  // Solo los turnos que ya existian en la oferta
  id?: string
  fecha: string
  horaInicio: string
  horaFin: string
  plazas: string
  // Plazas ya reservadas por voluntarios: no se pueden quitar
  ocupadas: number
}

const FORMULARIO_VACIO = {
  titulo: '',
  descripcion: '',
  modalidad: 'presencial',
  tipoDuracion: 'jornada',
  isla: '',
  municipio: '',
  direccion: '',
  requisitos: '',
  edadMinima: '',
}

type DatosFormulario = typeof FORMULARIO_VACIO

// Lo que el formulario entrega al enviarse
export type EnvioOferta = {
  cuerpo: Record<string, unknown>
  imagen: File | null
  quitarImagen: boolean
}

type FormularioOfertaProps = {
  titulo: string
  textoBoton: string
  textoEnviando: string
  // Al editar: la oferta de la que parten los valores
  oferta?: Oferta
  mensajeExito?: string | null
  // Devuelve el mensaje de error, o null si todo ha ido bien
  onEnviar: (envio: EnvioOferta) => Promise<string | null>
}

// Mismos limites que comprueba el servidor
const IMAGEN_MAX_BYTES = 5 * 1024 * 1024
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']

let siguienteClave = 0

function turnoVacio(): TurnoFormulario {
  siguienteClave += 1
  return { clave: siguienteClave, fecha: '', horaInicio: '', horaFin: '', plazas: '', ocupadas: 0 }
}

function datosDeOferta(oferta: Oferta): DatosFormulario {
  return {
    titulo: oferta.titulo,
    descripcion: oferta.descripcion,
    modalidad: oferta.modalidad,
    tipoDuracion: oferta.tipoDuracion,
    isla: oferta.ubicacion?.isla ?? '',
    municipio: oferta.ubicacion?.municipio ?? '',
    direccion: oferta.ubicacion?.direccion ?? '',
    requisitos: oferta.requisitos ?? '',
    edadMinima: oferta.edadMinima !== undefined ? String(oferta.edadMinima) : '',
  }
}

// Los turnos pasados no se pueden editar: el formulario solo muestra los proximos
function turnosDeOferta(oferta: Oferta): TurnoFormulario[] {
  return oferta.turnos
    .filter(esTurnoProximo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((turno) => {
      siguienteClave += 1
      return {
        clave: siguienteClave,
        id: turno.id,
        fecha: turno.fecha.slice(0, 10),
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        plazas: String(turno.plazas),
        ocupadas: turno.plazas - turno.plazasLibres,
      }
    })
}

// Devuelve el mensaje de error del formulario, o null si se puede enviar
function validarFormulario(
  datos: DatosFormulario,
  categoriaIds: string[],
  turnos: TurnoFormulario[],
): string | null {
  if (!datos.titulo.trim() || !datos.descripcion.trim()) {
    return 'El título y la descripción son obligatorios'
  }
  if (categoriaIds.length === 0) return 'Elige al menos una categoría'
  if (datos.modalidad !== 'online' && (!datos.isla || !datos.municipio.trim())) {
    return 'Indica la isla y el municipio de la oferta'
  }
  if (turnos.length === 0) return 'Añade al menos un turno'

  for (const turno of turnos) {
    if (!turno.fecha || !turno.horaInicio || !turno.horaFin || !turno.plazas) {
      return 'Completa todos los datos de cada turno'
    }
    if (turno.fecha < hoyIso()) return 'Los turnos no pueden tener una fecha pasada'
    if (turno.horaFin <= turno.horaInicio) {
      return 'La hora de fin debe ser posterior a la de inicio'
    }
    if (!Number.isInteger(Number(turno.plazas)) || Number(turno.plazas) < 1) {
      return 'Cada turno necesita al menos una plaza'
    }
    if (Number(turno.plazas) < turno.ocupadas) {
      return `Un turno ya tiene ${turno.ocupadas} plazas ocupadas: no puede tener menos plazas`
    }
  }

  return null
}

function FormularioOferta({
  titulo,
  textoBoton,
  textoEnviando,
  oferta,
  mensajeExito,
  onEnviar,
}: FormularioOfertaProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [datos, setDatos] = useState(() => (oferta ? datosDeOferta(oferta) : FORMULARIO_VACIO))
  const [categoriaIds, setCategoriaIds] = useState<string[]>(
    () => oferta?.categorias.map((categoria) => categoria.id) ?? [],
  )
  const [turnos, setTurnos] = useState<TurnoFormulario[]>(() => {
    const existentes = oferta ? turnosDeOferta(oferta) : []
    return existentes.length > 0 ? existentes : [turnoVacio()]
  })
  const [enviando, setEnviando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null)
  const [imagen, setImagen] = useState<{ archivo: File; vistaPrevia: string } | null>(null)
  // Al editar, la foto propia que ya tenia la oferta (sin contar la de la categoria)
  const [imagenActual, setImagenActual] = useState<string | null>(oferta?.imagenes[0] ?? null)
  const inputImagen = useRef<HTMLInputElement>(null)
  const vistaPreviaActual = useRef<string | null>(null)

  // La URL de la vista previa ocupa memoria hasta que se libera, tambien al salir de la pantalla
  useEffect(() => () => {
    if (vistaPreviaActual.current) URL.revokeObjectURL(vistaPreviaActual.current)
  }, [])

  useEffect(() => {
    const controlador = new AbortController()

    fetch('/api/categorias', { signal: controlador.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategorias)
      .catch(() => {
        if (!controlador.signal.aborted) setCategorias([])
      })

    return () => controlador.abort()
  }, [])

  function cambiarImagen(archivo: File | null) {
    if (vistaPreviaActual.current) URL.revokeObjectURL(vistaPreviaActual.current)
    const vistaPrevia = archivo ? URL.createObjectURL(archivo) : null
    vistaPreviaActual.current = vistaPrevia
    setImagen(archivo && vistaPrevia ? { archivo, vistaPrevia } : null)
    if (!archivo && inputImagen.current) inputImagen.current.value = ''
  }

  function elegirImagen(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0] ?? null
    setErrorFormulario(null)

    if (archivo && !TIPOS_IMAGEN.includes(archivo.type)) {
      setErrorFormulario('La imagen debe ser JPG, PNG o WebP')
      cambiarImagen(null)
      return
    }
    if (archivo && archivo.size > IMAGEN_MAX_BYTES) {
      setErrorFormulario('La imagen no puede superar los 5 MB')
      cambiarImagen(null)
      return
    }

    cambiarImagen(archivo)
  }

  function cambiarDato(campo: keyof DatosFormulario, valor: string) {
    setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  function alternarCategoria(id: string) {
    setCategoriaIds((anteriores) =>
      anteriores.includes(id) ? anteriores.filter((otro) => otro !== id) : [...anteriores, id],
    )
  }

  function cambiarTurno(
    clave: number,
    campo: 'fecha' | 'horaInicio' | 'horaFin' | 'plazas',
    valor: string,
  ) {
    setTurnos((anteriores) =>
      anteriores.map((turno) => (turno.clave === clave ? { ...turno, [campo]: valor } : turno)),
    )
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const error = validarFormulario(datos, categoriaIds, turnos)
    if (error) {
      setErrorFormulario(error)
      return
    }

    setErrorFormulario(null)
    setEnviando(true)

    const esOnline = datos.modalidad === 'online'
    const cuerpo = {
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion.trim(),
      categoriaIds,
      modalidad: datos.modalidad,
      tipoDuracion: datos.tipoDuracion,
      ubicacion: esOnline
        ? undefined
        : {
            isla: datos.isla,
            municipio: datos.municipio.trim(),
            direccion: datos.direccion.trim() || undefined,
          },
      requisitos: datos.requisitos.trim() || undefined,
      edadMinima: datos.edadMinima ? Number(datos.edadMinima) : undefined,
      turnos: turnos.map((turno) => ({
        id: turno.id,
        fecha: turno.fecha,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        plazas: Number(turno.plazas),
      })),
    }

    const errorEnvio = await onEnviar({
      cuerpo,
      imagen: imagen?.archivo ?? null,
      quitarImagen: Boolean(oferta?.imagenes[0]) && !imagenActual,
    })
    setEnviando(false)
    if (errorEnvio) setErrorFormulario(errorEnvio)
  }

  return (
    <form className="gestion-bloque gestion-formulario" onSubmit={enviar} noValidate>
      <h2>{titulo}</h2>

      <label>
        <span>Título *</span>
        <input
          value={datos.titulo}
          maxLength={120}
          onChange={(e) => cambiarDato('titulo', e.target.value)}
          placeholder="Ej. Limpieza de la playa de Las Teresitas"
        />
      </label>

      <label>
        <span>Descripción *</span>
        <textarea
          value={datos.descripcion}
          maxLength={5000}
          rows={5}
          onChange={(e) => cambiarDato('descripcion', e.target.value)}
          placeholder="Qué harán los voluntarios, a quién ayuda la actividad..."
        />
      </label>

      <div className="gestion-imagen">
        <label>
          <span>{imagenActual ? 'Cambiar foto de presentación' : 'Foto de presentación'}</span>
          <input
            ref={inputImagen}
            type="file"
            accept={TIPOS_IMAGEN.join(',')}
            onChange={elegirImagen}
          />
        </label>
        <p className="gestion-ayuda">
          Opcional. JPG, PNG o WebP de hasta 5 MB. Si no subes ninguna, se usará la de la
          categoría.
        </p>
        {imagen ? (
          <div className="gestion-imagen-previa">
            <img src={imagen.vistaPrevia} alt="Vista previa de la foto de la oferta" />
            <button type="button" className="gestion-accion" onClick={() => cambiarImagen(null)}>
              {imagenActual ? 'Mantener la foto actual' : 'Quitar foto'}
            </button>
          </div>
        ) : (
          imagenActual && (
            <div className="gestion-imagen-previa">
              <img src={imagenActual} alt="Foto actual de la oferta" />
              <button type="button" className="gestion-accion" onClick={() => setImagenActual(null)}>
                Quitar foto
              </button>
            </div>
          )
        )}
      </div>

      <fieldset>
        <legend>Categorías *</legend>
        {categorias.length === 0 ? (
          <p className="gestion-ayuda">No se pudieron cargar las categorías.</p>
        ) : (
          <div className="gestion-categorias">
            {categorias.map((categoria) => (
              <label key={categoria.id} className="gestion-check">
                <input
                  type="checkbox"
                  checked={categoriaIds.includes(categoria.id)}
                  onChange={() => alternarCategoria(categoria.id)}
                />
                {categoria.nombre}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="gestion-fila">
        <label>
          <span>Modalidad *</span>
          <select value={datos.modalidad} onChange={(e) => cambiarDato('modalidad', e.target.value)}>
            {Object.entries(MODALIDADES).map(([valor, nombre]) => (
              <option key={valor} value={valor}>{nombre}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Duración *</span>
          <select
            value={datos.tipoDuracion}
            onChange={(e) => cambiarDato('tipoDuracion', e.target.value)}
          >
            {Object.entries(DURACIONES).map(([valor, nombre]) => (
              <option key={valor} value={valor}>{nombre}</option>
            ))}
          </select>
        </label>
      </div>

      {datos.modalidad !== 'online' && (
        <>
          <div className="gestion-fila">
            <label>
              <span>Isla *</span>
              <select value={datos.isla} onChange={(e) => cambiarDato('isla', e.target.value)}>
                <option value="">Elige una isla</option>
                {Object.entries(ISLAS).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Municipio *</span>
              <input
                value={datos.municipio}
                onChange={(e) => cambiarDato('municipio', e.target.value)}
                placeholder="Ej. Santa Cruz de Tenerife"
              />
            </label>
          </div>

          <label>
            <span>Dirección</span>
            <input
              value={datos.direccion}
              onChange={(e) => cambiarDato('direccion', e.target.value)}
              placeholder="Opcional. No se muestra en la oferta pública"
            />
          </label>
        </>
      )}

      <div className="gestion-fila">
        <label>
          <span>Requisitos</span>
          <input
            value={datos.requisitos}
            maxLength={2000}
            onChange={(e) => cambiarDato('requisitos', e.target.value)}
            placeholder="Ej. Ropa cómoda y protección solar"
          />
        </label>

        <label>
          <span>Edad mínima</span>
          <input
            type="number"
            min={0}
            value={datos.edadMinima}
            onChange={(e) => cambiarDato('edadMinima', e.target.value)}
          />
        </label>
      </div>

      <fieldset>
        <legend>Turnos *</legend>
        {turnos.map((turno, indice) => (
          <div key={turno.clave}>
            <div className="gestion-turno">
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  min={hoyIso()}
                  value={turno.fecha}
                  onChange={(e) => cambiarTurno(turno.clave, 'fecha', e.target.value)}
                />
              </label>
              <label>
                <span>Inicio</span>
                <input
                  type="time"
                  value={turno.horaInicio}
                  onChange={(e) => cambiarTurno(turno.clave, 'horaInicio', e.target.value)}
                />
              </label>
              <label>
                <span>Fin</span>
                <input
                  type="time"
                  value={turno.horaFin}
                  onChange={(e) => cambiarTurno(turno.clave, 'horaFin', e.target.value)}
                />
              </label>
              <label>
                <span>Plazas</span>
                <input
                  type="number"
                  min={Math.max(1, turno.ocupadas)}
                  value={turno.plazas}
                  onChange={(e) => cambiarTurno(turno.clave, 'plazas', e.target.value)}
                />
              </label>
              <button
                type="button"
                className="gestion-quitar"
                onClick={() => setTurnos((anteriores) => anteriores.filter((t) => t.clave !== turno.clave))}
                disabled={turnos.length === 1 || turno.ocupadas > 0}
                title={turno.ocupadas > 0 ? 'Este turno ya tiene voluntarios inscritos' : undefined}
                aria-label={`Quitar el turno ${indice + 1}`}
              >
                ×
              </button>
            </div>
            {turno.ocupadas > 0 && (
              <p className="gestion-ayuda gestion-turno-aviso">
                {turno.ocupadas} {turno.ocupadas === 1 ? 'plaza ocupada' : 'plazas ocupadas'}: avisa a
                los voluntarios inscritos si cambias la fecha o el horario.
              </p>
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline gestion-anadir"
          onClick={() => setTurnos((anteriores) => [...anteriores, turnoVacio()])}
        >
          Añadir turno
        </button>
      </fieldset>

      {errorFormulario && <p className="gestion-error" role="alert">{errorFormulario}</p>}
      {mensajeExito && <p className="gestion-exito" role="status">{mensajeExito}</p>}

      <button type="submit" className="btn" disabled={enviando}>
        {enviando ? textoEnviando : textoBoton}
      </button>
    </form>
  )
}

export default FormularioOferta
