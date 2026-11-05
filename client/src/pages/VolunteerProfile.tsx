/**
 * Perfil de un usuario voluntario.
 */
import { useEffect, useState } from 'react'
import './VolunteerProfile.css'
import type { Usuario } from './Login.tsx'

type VolunteerProfileProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

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

function VolunteerProfile({ usuario, onCerrarSesion }: VolunteerProfileProps) {
  const [historial, setHistorial] = useState<HistorialItem[] | null>(null)
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null)

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

  const colaboracionesCompletadas = historial?.filter(
    (item) => item.estado === 'completada',
  ).length ?? 0
  const horasDedicadas = historial?.reduce((total, item) => total + item.horas, 0) ?? 0
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
                <span className="tag">Medio ambiente</span>
                <span className="tag">Personas mayores</span>
                <span className="tag">Comunidad</span>
              </div>

              <button type="button" className="btn profile-edit-button">
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
