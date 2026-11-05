/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla del ofertante para publicar ofertas y ver las que ya ha publicado.
 */
import { useEffect, useState, type FormEvent } from 'react'
import './HomePage.css'
import './GestionarOfertas.css'
import type { Usuario } from './Login.tsx'
import {
  DURACIONES,
  ISLAS,
  MODALIDADES,
  esTurnoProximo,
  formatearFecha,
  hoyIso,
  type Oferta,
} from '../ofertas.ts'

type GestionarOfertasProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

type Categoria = { id: string; nombre: string; slug: string }

type MiOferta = Oferta & {
  estado: 'borrador' | 'publicada' | 'cerrada' | 'cancelada'
  terminada: boolean
  fechaPublicacion?: string
  creadaEn: string
}

type TurnoFormulario = {
  clave: number
  fecha: string
  horaInicio: string
  horaFin: string
  plazas: string
}

const ESTADOS: Record<MiOferta['estado'], string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
}

// Una oferta publicada cuyos turnos ya pasaron se muestra como finalizada
function textoEstado(oferta: MiOferta): string {
  return oferta.estado === 'publicada' && oferta.terminada ? 'Finalizada' : ESTADOS[oferta.estado]
}

let siguienteClave = 0

function turnoVacio(): TurnoFormulario {
  siguienteClave += 1
  return { clave: siguienteClave, fecha: '', horaInicio: '', horaFin: '', plazas: '' }
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

function cabecerasConSesion(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  }
}

// Devuelve el mensaje de error del formulario, o null si se puede enviar
function validarFormulario(
  datos: typeof FORMULARIO_VACIO,
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
  }

  return null
}

function GestionarOfertas({ usuario, onCerrarSesion }: GestionarOfertasProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [misOfertas, setMisOfertas] = useState<MiOferta[] | null>(null)
  const [errorListado, setErrorListado] = useState<string | null>(null)
  const [recargas, setRecargas] = useState(0)

  const [datos, setDatos] = useState(FORMULARIO_VACIO)
  const [categoriaIds, setCategoriaIds] = useState<string[]>([])
  const [turnos, setTurnos] = useState<TurnoFormulario[]>(() => [turnoVacio()])
  const [enviando, setEnviando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [ofertaEnCurso, setOfertaEnCurso] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

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

  // Se repite tras publicar, para que la nueva oferta aparezca en el listado
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarMisOfertas() {
      try {
        const res = await fetch('/api/ofertas/mias', {
          headers: cabecerasConSesion(),
          signal: controlador.signal,
        })
        const data = await res.json()

        if (!res.ok) {
          setErrorListado(data.message ?? 'No se pudieron cargar tus ofertas')
          return
        }

        setErrorListado(null)
        setMisOfertas(data)
      } catch {
        if (!controlador.signal.aborted) {
          setErrorListado('No se pudo conectar con el servidor')
        }
      }
    }

    cargarMisOfertas()
    return () => controlador.abort()
  }, [recargas])

  function cambiarDato(campo: keyof typeof FORMULARIO_VACIO, valor: string) {
    setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  function alternarCategoria(id: string) {
    setCategoriaIds((anteriores) =>
      anteriores.includes(id) ? anteriores.filter((otro) => otro !== id) : [...anteriores, id],
    )
  }

  function cambiarTurno(clave: number, campo: keyof Omit<TurnoFormulario, 'clave'>, valor: string) {
    setTurnos((anteriores) =>
      anteriores.map((turno) => (turno.clave === clave ? { ...turno, [campo]: valor } : turno)),
    )
  }

  // Cerrar y eliminar comparten el mismo flujo: confirmar, llamar a la API y recargar el listado
  async function ejecutarAccion(oferta: MiOferta, accion: 'cerrar' | 'eliminar') {
    const pregunta =
      accion === 'cerrar'
        ? `¿Cerrar "${oferta.titulo}"? Los voluntarios dejarán de verla y no podrás volver a abrirla.`
        : `¿Eliminar "${oferta.titulo}"? Se borrará definitivamente.`
    if (!window.confirm(pregunta)) return

    setErrorAccion(null)
    setOfertaEnCurso(oferta.id)

    try {
      const res = await fetch(
        accion === 'cerrar'
          ? `/api/ofertas/${encodeURIComponent(oferta.id)}/cerrar`
          : `/api/ofertas/${encodeURIComponent(oferta.id)}`,
        { method: accion === 'cerrar' ? 'PATCH' : 'DELETE', headers: cabecerasConSesion() },
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorAccion(
          data.message ?? `No se pudo ${accion === 'cerrar' ? 'cerrar' : 'eliminar'} la oferta`,
        )
      }
      // Incluso si falla se recarga: la oferta puede haber cambiado de estado mientras tanto
      setRecargas((n) => n + 1)
    } catch {
      setErrorAccion('No se pudo conectar con el servidor')
    } finally {
      setOfertaEnCurso(null)
    }
  }

  async function publicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setMensajeExito(null)

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
        fecha: turno.fecha,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        plazas: Number(turno.plazas),
      })),
      estado: 'publicada',
    }

    try {
      const res = await fetch('/api/ofertas', {
        method: 'POST',
        headers: cabecerasConSesion(),
        body: JSON.stringify(cuerpo),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorFormulario(data.message ?? 'No se pudo publicar la oferta')
        return
      }

      setDatos(FORMULARIO_VACIO)
      setCategoriaIds([])
      setTurnos([turnoVacio()])
      setMensajeExito('Oferta publicada. Los voluntarios ya pueden verla.')
      setRecargas((n) => n + 1)
    } catch {
      setErrorFormulario('No se pudo conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="authenticated-home">
      <header className="nav authenticated-nav">
        <div className="brand">
          <img
            src="/fotos/Logo_Canarias_Conecta_Sinfondo.png"
            alt="Logo de Canarias Conecta"
          />
          <span className="logo">Canarias Conecta</span>
        </div>

        <nav className="authenticated-links" aria-label="Navegación principal">
          <a href="/#inicio">Inicio</a>
          <a href="/oportunidades">Oportunidades</a>
          <a href="/#inscripciones">Mis inscripciones</a>
          <a href="/#perfil">Mi perfil</a>
          <a href="/gestionar-ofertas" aria-current="page">Gestionar ofertas</a>
        </nav>

        <div className="authenticated-user">
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="authenticated-main gestion">
        <section className="welcome-section">
          <p className="eyebrow">Panel del ofertante</p>
          <h1>Gestionar ofertas</h1>
          <p>Publica nuevas oportunidades de voluntariado y consulta las que ya has creado.</p>
        </section>

        <div className="gestion-grid">
          <form className="gestion-bloque gestion-formulario" onSubmit={publicar} noValidate>
            <h2>Publicar una oferta</h2>

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
                <div className="gestion-turno" key={turno.clave}>
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
                      min={1}
                      value={turno.plazas}
                      onChange={(e) => cambiarTurno(turno.clave, 'plazas', e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="gestion-quitar"
                    onClick={() => setTurnos((anteriores) => anteriores.filter((t) => t.clave !== turno.clave))}
                    disabled={turnos.length === 1}
                    aria-label={`Quitar el turno ${indice + 1}`}
                  >
                    ×
                  </button>
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
              {enviando ? 'Publicando...' : 'Publicar oferta'}
            </button>
          </form>

          <section className="gestion-bloque">
            <h2>Mis ofertas</h2>

            {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}
            {errorListado && <p className="empty-state">{errorListado}</p>}
            {!errorListado && misOfertas === null && <p className="empty-state">Cargando tus ofertas...</p>}
            {misOfertas?.length === 0 && (
              <p className="empty-state">Todavía no has publicado ninguna oferta.</p>
            )}

            {misOfertas && misOfertas.length > 0 && (
              <ul className="gestion-lista">
                {misOfertas.map((oferta) => {
                  const proximos = oferta.turnos
                    .filter(esTurnoProximo)
                    .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  const plazas = oferta.turnos.reduce((total, t) => total + t.plazas, 0)
                  const libres = oferta.turnos.reduce((total, t) => total + t.plazasLibres, 0)

                  return (
                    <li key={oferta.id}>
                      <div className="gestion-lista-cabecera">
                        <h3>{oferta.titulo}</h3>
                        <span
                          className={`gestion-estado gestion-estado-${
                            oferta.estado === 'publicada' && oferta.terminada ? 'finalizada' : oferta.estado
                          }`}
                        >
                          {textoEstado(oferta)}
                        </span>
                      </div>
                      <p>
                        {oferta.ubicacion
                          ? `${oferta.ubicacion.municipio}, ${ISLAS[oferta.ubicacion.isla]}`
                          : MODALIDADES[oferta.modalidad]}
                        {' · '}
                        {oferta.categorias.map((c) => c.nombre).join(', ')}
                      </p>
                      <p>
                        {proximos.length > 0
                          ? `Próximo turno: ${formatearFecha(proximos[0].fecha)}`
                          : 'Sin turnos próximos'}
                        {' · '}
                        {plazas - libres} de {plazas} plazas ocupadas
                      </p>
                      <div className="gestion-acciones">
                        {oferta.estado === 'publicada' && !oferta.terminada && (
                          <a className="text-link" href={`/ofertas/${oferta.id}`}>
                            Ver como voluntario
                          </a>
                        )}
                        {['borrador', 'publicada'].includes(oferta.estado) && !oferta.terminada && (
                          <button
                            type="button"
                            className="gestion-accion"
                            onClick={() => ejecutarAccion(oferta, 'cerrar')}
                            disabled={ofertaEnCurso !== null}
                          >
                            {ofertaEnCurso === oferta.id ? 'Cerrando...' : 'Cerrar oferta'}
                          </button>
                        )}
                        {oferta.terminada && (
                          <button
                            type="button"
                            className="gestion-accion gestion-accion-peligro"
                            onClick={() => ejecutarAccion(oferta, 'eliminar')}
                            disabled={ofertaEnCurso !== null}
                          >
                            {ofertaEnCurso === oferta.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <img
            src="/fotos/Logo_Canarias_Conecta_Sinfondo.png"
            alt="Logo de Canarias Conecta"
          />
          <p>Conectando personas con oportunidades para ayudar.</p>
        </div>

        <div className="footer-links">
          <div>
            <h3>Información</h3>
            <a href="/politica-privacidad">Política de privacidad</a>
            <a href="/terminos-condiciones">Términos y condiciones</a>
            <a href="/contacto">Contacto</a>
          </div>

          <div>
            <h3>Síguenos</h3>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
              Facebook
            </a>
            <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default GestionarOfertas
