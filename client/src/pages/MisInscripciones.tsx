/**
 * Inscripciones del voluntario autenticado.
 */
import { useEffect, useMemo, useState } from 'react'
import './MisInscripciones.css'
import type { Usuario } from './Login.tsx'

type EstadoInscripcion =
  | 'pendiente'
  | 'aceptada'
  | 'rechazada'
  | 'cancelada'
  | 'completada'
  | 'no_presentado'

type Inscripcion = {
  id: string
  ofertaId: string
  titulo: string
  organizador: string
  fecha: string | null
  horas: number
  estado: EstadoInscripcion
  valoracion: { puntuacion: number; comentario: string | null } | null
}

type MisInscripcionesProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

const ETIQUETAS_ESTADO: Record<EstadoInscripcion, string> = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_presentado: 'No presentado',
}

function formatearFecha(fecha: string | null): string {
  return fecha
    ? new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(fecha))
    : 'Fecha pendiente'
}

function partesFecha(fecha: string | null): { dia: string; mes: string } {
  if (!fecha) return { dia: '—', mes: 'sin fecha' }
  const valor = new Date(fecha)
  return {
    dia: new Intl.DateTimeFormat('es-ES', { day: 'numeric' }).format(valor),
    mes: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(valor).replace('.', ''),
  }
}

function claveMes(fecha: string | null): string {
  if (!fecha) return 'sin-fecha'
  const valor = new Date(fecha)
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}`
}

function nombreMes(clave: string): string {
  if (clave === 'sin-fecha') return 'Fecha pendiente'
  const [anio, mes] = clave.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
    .format(new Date(anio, mes - 1, 1))
    .replace(/^./, (letra) => letra.toUpperCase())
}

function MisInscripciones({ usuario, onCerrarSesion }: MisInscripcionesProps) {
  const [inscripciones, setInscripciones] = useState<Inscripcion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()
    fetch('/api/inscripciones/mias', {
      signal: controlador.signal,
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar las inscripciones')
        setInscripciones(data)
      })
      .catch((reason) => {
        if (!controlador.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las inscripciones')
        }
      })
    return () => controlador.abort()
  }, [])

  const grupos = useMemo(() => {
    const agrupadas = new Map<string, Inscripcion[]>()
    for (const inscripcion of inscripciones ?? []) {
      const clave = claveMes(inscripcion.fecha)
      const grupo = agrupadas.get(clave) ?? []
      grupo.push(inscripcion)
      agrupadas.set(clave, grupo)
    }
    return [...agrupadas.entries()].sort(([claveA], [claveB]) => {
      if (claveA === 'sin-fecha') return 1
      if (claveB === 'sin-fecha') return -1
      return claveB.localeCompare(claveA)
    })
  }, [inscripciones])

  return (
    <div className="authenticated-home inscriptions-page">
      <header className="nav authenticated-nav">
        <a className="brand" href="/">
          <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
          <span className="logo">Canarias Conecta</span>
        </a>
        <nav className="authenticated-links" aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/oportunidades">Oportunidades</a>
          <a href="/mis_inscripciones" aria-current="page">Mis inscripciones</a>
          <a href="/perfil">Mi perfil</a>
        </nav>
        <div className="authenticated-user">
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>Cerrar sesión</button>
        </div>
      </header>

      <main className="inscriptions-main">
        <h1 className="section-title inscriptions-title">Mis inscripciones</h1>
        <p className="inscriptions-intro">Consulta el estado de todas tus solicitudes de voluntariado.</p>
        {error && <p className="inscriptions-message inscriptions-error" role="alert">{error}</p>}
        {!error && inscripciones === null && <p className="inscriptions-message">Cargando inscripciones...</p>}
        {!error && inscripciones?.length === 0 && (
          <section className="inscriptions-empty">
            <h2>Aún no tienes inscripciones</h2>
            <p>Encuentra una oportunidad y apúntate para verla aquí.</p>
            <a className="btn" href="/oportunidades">Ver oportunidades</a>
          </section>
        )}
        {!error && grupos.length > 0 && (
          <div className="inscriptions-groups">
            {grupos.map(([mes, items]) => (
              <section className="inscriptions-group" key={mes}>
                <h2>{nombreMes(mes)}</h2>
                <div className="inscriptions-list">
                  {items.map((inscripcion) => (
                    <article className="inscription-card" key={inscripcion.id}>
                      <div className="inscription-date-badge" aria-label={formatearFecha(inscripcion.fecha)}>
                        <strong>{partesFecha(inscripcion.fecha).dia}</strong>
                        <span>{partesFecha(inscripcion.fecha).mes}</span>
                      </div>
                      <div className="inscription-card-content">
                        <h3>
                          <a className="inscription-title-link" href={`/ofertas/${inscripcion.ofertaId}`}>
                            {inscripcion.titulo}
                          </a>
                        </h3>
                        <p className="inscription-organizer">Organiza: {inscripcion.organizador}</p>
                        <p className="inscription-hours">{inscripcion.horas} horas previstas</p>
                      </div>
                      <div className="inscription-card-status">
                        <span className={`inscription-status status-${inscripcion.estado}`}>
                          {ETIQUETAS_ESTADO[inscripcion.estado]}
                        </span>
                        {inscripcion.valoracion && (
                          <div className="inscription-rating">
                            <span aria-label={`${inscripcion.valoracion.puntuacion} de 5 estrellas`}>
                              {'★'.repeat(inscripcion.valoracion.puntuacion)}
                              <span className="inscription-empty-stars">
                                {'★'.repeat(5 - inscripcion.valoracion.puntuacion)}
                              </span>
                            </span>
                            {inscripcion.valoracion.comentario && <p>“{inscripcion.valoracion.comentario}”</p>}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <footer className="footer">
        <div className="footer-brand">
          <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
          <p>Conectando personas con oportunidades para ayudar.</p>
        </div>
      </footer>
    </div>
  )
}

export default MisInscripciones
