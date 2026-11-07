/**
 * Perfil de un usuario voluntario.
 */
import { useEffect, useState, type FormEvent } from 'react'
import './VolunteerProfile.css'
import type { Usuario } from './Login.tsx'

type VolunteerProfileProps = {
  usuario: Usuario
  onCerrarSesion: () => void
  onUsuarioActualizado: (usuario: Usuario) => void
}

type Categoria = { id: string; nombre: string }

type HistorialItem = {
  id: string
  titulo: string
  organizador: string
  fecha: string | null
  horas: number
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada' | 'completada' | 'no_presentado'
  valoracion: { puntuacion: number; comentario: string | null } | null
}

function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)
  if (palabras.length >= 2) {
    return `${palabras[0][0]}${palabras[1][0]}`.toUpperCase()
  }
  return nombre.slice(0, 2).toUpperCase()
}

function VolunteerProfile({ usuario, onCerrarSesion, onUsuarioActualizado }: VolunteerProfileProps) {
  const [historial, setHistorial] = useState<HistorialItem[] | null>(null)
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null)
  const [mostrarEditor, setMostrarEditor] = useState(false)
  const [nombre, setNombre] = useState(usuario.nombre)
  const [email, setEmail] = useState(usuario.email)
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [errorEditor, setErrorEditor] = useState<string | null>(null)
  const [guardandoEditor, setGuardandoEditor] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [interesIds, setInteresIds] = useState<string[]>(usuario.interesIds ?? [])
  const [nombresIntereses, setNombresIntereses] = useState<Categoria[]>([])

  useEffect(() => {
    const controlador = new AbortController()
    const token = localStorage.getItem('token')

    fetch('/api/inscripciones/mias', {
      signal: controlador.signal,
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudo cargar el historial')
        setHistorial(data)
      })
      .catch((error: Error) => {
        if (!controlador.signal.aborted) {
          setErrorHistorial(error.message)
        }
      })

    return () => controlador.abort()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token') ?? ''
    Promise.all([
      fetch('/api/categorias').then((res) => res.json()),
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
    ])
      .then(([categoriasData, perfilData]) => {
        const categoriasDisponibles = Array.isArray(categoriasData) ? categoriasData : []
        setCategorias(categoriasDisponibles)
        const intereses = perfilData.user?.intereses ?? []
        setNombresIntereses(intereses)
        setInteresIds(intereses.map((interes: Categoria) => interes.id))
      })
      .catch(() => {
        setCategorias([])
      })
  }, [])

  const colaboracionesCompletadas = historial?.filter(
    (item) => item.estado === 'completada',
  ).length ?? 0
  const horasDedicadas = historial
    ?.filter((item) => item.estado === 'completada')
    .reduce((total, item) => total + item.horas, 0) ?? 0
  const valoraciones = (historial ?? []).filter((item) => item.valoracion)
  const valoracionMedia = valoraciones.length
    ? valoraciones.reduce((total, item) => total + (item.valoracion?.puntuacion ?? 0), 0) /
      valoraciones.length
    : null

  function formatearFecha(fecha: string | null): string {
    return fecha
      ? new Intl.DateTimeFormat('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(fecha))
      : 'Fecha pendiente'
  }

  function etiquetaEstado(estado: HistorialItem['estado']): string {
    return {
      pendiente: 'Pendiente',
      aceptada: 'Aceptada',
      rechazada: 'Rechazada',
      cancelada: 'Cancelada',
      completada: 'Completada',
      no_presentado: 'No presentado',
    }[estado]
  }

  async function guardarPerfil(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorEditor(null)
    setGuardandoEditor(true)

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
        body: JSON.stringify({
          nombre,
          email,
          interesIds,
          ...(passwordNueva && { passwordActual, passwordNueva }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'No se pudo actualizar el perfil')

      onUsuarioActualizado(data.user)
      setNombresIntereses(categorias.filter((categoria) => interesIds.includes(categoria.id)))
      setPasswordActual('')
      setPasswordNueva('')
      setMostrarEditor(false)
    } catch (error) {
      setErrorEditor(error instanceof Error ? error.message : 'No se pudo actualizar el perfil')
    } finally {
      setGuardandoEditor(false)
    }
  }

  return (
    <div className="authenticated-home volunteer-profile">
      <header className="nav authenticated-nav">
        <a className="brand" href="/">
          <img
            src="/fotos/Logo_Canarias_Conecta_Sinfondo.png"
            alt="Logo de Canarias Conecta"
          />
          <span className="logo">Canarias Conecta</span>
        </a>

        <nav className="authenticated-links" aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/oportunidades">Oportunidades</a>
          <a href="/mis_inscripciones">Mis inscripciones</a>
          <a href="/perfil" aria-current="page">Mi perfil</a>
        </nav>

        <div className="authenticated-user">
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="volunteer-profile-main">
        <h1 className="section-title profile-page-title">Mi perfil</h1>

        <div className="volunteer-profile-layout">
          <div className="volunteer-profile-sidebar">
            <section className="profile-card">
              <div className="profile-avatar" aria-hidden="true">
                {inicialesDe(usuario.nombre)}
              </div>
              <h2>{usuario.nombre}</h2>
              <p className="profile-member-since">Voluntaria desde noviembre de 2026</p>

              <div className="profile-interests">
                {nombresIntereses.length > 0 ? nombresIntereses.map((interes) => (
                  <span className="tag" key={interes.id}>{interes.nombre}</span>
                )) : <span className="profile-no-interests">Aún no has añadido intereses</span>}
              </div>

              <button
                type="button"
                className="btn profile-edit-button"
                onClick={() => {
                  setErrorEditor(null)
                  setMostrarEditor(true)
                }}
              >
                Editar perfil
              </button>
            </section>

            <section className="profile-card accreditation-card">
              <h2>Mis acreditaciones</h2>
              <p>Aquí aparecerán las acreditaciones que obtengas.</p>
            </section>
          </div>

          <div className="volunteer-profile-main-column">
            <section className="profile-statistics" aria-label="Estadísticas de colaboración">
              <article>
                <strong>{colaboracionesCompletadas}</strong>
                <span>Colaboraciones</span>
              </article>
              <article>
                <strong>{horasDedicadas}</strong>
                <span>Horas dedicadas</span>
              </article>
              <article>
                <strong>{valoracionMedia === null ? '—' : valoracionMedia.toFixed(1)}</strong>
                <span>Valoración media</span>
              </article>
            </section>

            <section className="history-section">
              <h2 className="section-title">Historial de voluntariados</h2>
              <div className="history-card">
            {errorHistorial && <p className="history-message history-error">{errorHistorial}</p>}
            {!errorHistorial && historial === null && (
              <p className="history-message">Cargando historial...</p>
            )}
            {!errorHistorial && historial?.length === 0 && (
              <p className="history-message">Todavía no tienes voluntariados en tu historial.</p>
            )}
            {!errorHistorial && historial && historial.length > 0 && (
              <div className="history-timeline">
                {historial.map((item) => (
                  <article className="history-item" key={item.id}>
                    <time dateTime={item.fecha ?? undefined}>{formatearFecha(item.fecha)}</time>
                    <div className="history-dot" aria-hidden="true" />
                    <div className="history-content">
                      <div className="history-heading">
                        <div>
                          <h3>{item.titulo}</h3>
                          <p>{item.organizador} · {item.horas} horas trabajadas</p>
                        </div>
                        <span className={`history-status history-status-${item.estado}`}>
                          {etiquetaEstado(item.estado)}
                        </span>
                      </div>
                      {item.valoracion && (
                        <div className="history-review">
                          <span aria-label={`${item.valoracion.puntuacion} de 5 estrellas`}>
                            {'★'.repeat(item.valoracion.puntuacion)}
                            <span className="history-empty-stars">
                              {'★'.repeat(5 - item.valoracion.puntuacion)}
                            </span>
                          </span>
                          {item.valoracion.comentario && <p>“{item.valoracion.comentario}”</p>}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {mostrarEditor && (
        <div className="profile-modal-backdrop" role="presentation">
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <div className="profile-modal-header">
              <h2 id="profile-modal-title">Editar perfil</h2>
              <button type="button" className="profile-modal-close" onClick={() => setMostrarEditor(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <form onSubmit={guardarPerfil}>
              <label className="profile-field">
                <span>Nombre</span>
                <input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
              </label>
              <label className="profile-field">
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <fieldset className="profile-interests-field">
                <legend>Intereses</legend>
                <div className="profile-interest-options">
                  {categorias.map((categoria) => (
                    <label className="profile-interest-option" key={categoria.id}>
                      <input
                        type="checkbox"
                        checked={interesIds.includes(categoria.id)}
                        onChange={() => setInteresIds((actuales) =>
                          actuales.includes(categoria.id)
                            ? actuales.filter((id) => id !== categoria.id)
                            : [...actuales, categoria.id],
                        )}
                      />
                      <span>{categoria.nombre}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="profile-modal-help">Deja las contraseñas vacías si no quieres cambiarla.</p>
              <label className="profile-field">
                <span>Contraseña actual</span>
                <input type="password" value={passwordActual} onChange={(event) => setPasswordActual(event.target.value)} />
              </label>
              <label className="profile-field">
                <span>Nueva contraseña</span>
                <input type="password" minLength={8} value={passwordNueva} onChange={(event) => setPasswordNueva(event.target.value)} />
              </label>
              {errorEditor && <p className="profile-modal-error" role="alert">{errorEditor}</p>}
              <div className="profile-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setMostrarEditor(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={guardandoEditor}>
                  {guardandoEditor ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

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
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default VolunteerProfile
