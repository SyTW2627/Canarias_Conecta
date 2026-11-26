/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla del ofertante con los voluntarios mas compatibles con una de sus ofertas:
 * ve su afinidad y su perfil, y puede invitarles a inscribirse con una notificacion.
 *   GET  /api/ofertas/mias/:id/voluntarios-recomendados
 *   POST /api/ofertas/mias/:id/invitaciones { voluntarioId, mensaje? }
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './GestionarOfertas.css'
import './Candidatos.css'
import './VoluntariosRecomendados.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import PerfilVoluntario, {
  AvatarVoluntario,
  type PerfilPublicoVoluntario,
} from '../components/PerfilVoluntario.tsx'
import { ISLAS, cabecerasConSesion } from '../ofertas.ts'

type Motivo = {
  tipo: 'interes' | 'isla' | 'online' | 'disponibilidad' | 'valoracion'
  texto: string
}

type Recomendado = {
  voluntario: PerfilPublicoVoluntario
  afinidad: number
  motivos: Motivo[]
  invitado: boolean
}

type Respuesta = {
  oferta: { id: string; titulo: string }
  recomendaciones: Recomendado[]
}

type Props = {
  ofertaId: string
  usuario: Usuario
  onCerrarSesion: () => void
}

const ICONOS_MOTIVO: Record<Motivo['tipo'], string> = {
  interes: '🏷️',
  isla: '📍',
  online: '💻',
  disponibilidad: '🕒',
  valoracion: '🌴',
}

const MENSAJE_MAX = 300

function VoluntariosRecomendados({ ofertaId, usuario, onCerrarSesion }: Props) {
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [perfilAbierto, setPerfilAbierto] = useState<string | null>(null)
  const [invitando, setInvitando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enCurso, setEnCurso] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()

    async function cargar() {
      try {
        const res = await fetch(
          `/api/ofertas/mias/${encodeURIComponent(ofertaId)}/voluntarios-recomendados`,
          { headers: cabecerasConSesion(), signal: controlador.signal },
        )
        const data = await res.json()
        if (!res.ok) {
          setError(data.message ?? 'No se pudieron cargar los voluntarios recomendados')
          return
        }
        setError(null)
        setDatos(data)
      } catch {
        if (!controlador.signal.aborted) setError('No se pudo conectar con el servidor')
      }
    }

    cargar()
    return () => controlador.abort()
  }, [ofertaId])

  function marcarInvitado(voluntarioId: string) {
    setDatos((actual) =>
      actual && {
        ...actual,
        recomendaciones: actual.recomendaciones.map((r) =>
          r.voluntario.id === voluntarioId ? { ...r, invitado: true } : r,
        ),
      },
    )
  }

  async function invitar(voluntarioId: string) {
    setErrorAccion(null)
    setEnCurso(voluntarioId)

    try {
      const res = await fetch(`/api/ofertas/mias/${encodeURIComponent(ofertaId)}/invitaciones`, {
        method: 'POST',
        headers: cabecerasConSesion(),
        body: JSON.stringify(mensaje.trim() ? { voluntarioId, mensaje } : { voluntarioId }),
      })

      if (res.ok) {
        marcarInvitado(voluntarioId)
        setInvitando(null)
        setMensaje('')
        return
      }

      const data = await res.json().catch(() => ({}))
      setErrorAccion(data.message ?? 'No se pudo enviar la invitación')
      // Ya invitado desde otra pestaña: se refleja igualmente
      if (res.status === 409 && /invitado/.test(data.message ?? '')) marcarInvitado(voluntarioId)
    } catch {
      setErrorAccion('No se pudo conectar con el servidor')
    } finally {
      setEnCurso(null)
    }
  }

  return (
    <div className="authenticated-home">
      <header className="nav authenticated-nav">
        <div className="brand">
          <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
          <span className="logo">Canarias Conecta</span>
        </div>

        <nav className="authenticated-links" aria-label="Navegación principal">
          <a href="/#inicio">Inicio</a>
          <a href="/empleo">Empleo</a>
          <a href="/perfil">Mi perfil</a>
          <a href="/gestionar-ofertas" aria-current="page">Gestionar ofertas</a>
        </nav>

        <div className="authenticated-user">
          <Notificaciones />
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="authenticated-main gestion">
        <section className="gestion-cabecera">
          <div>
            <a className="gestion-volver" href="/gestionar-ofertas">
              <span aria-hidden="true">←</span> Volver a mis ofertas
            </a>
            <h1 className="section-title gestion-titulo">
              Voluntarios recomendados{datos ? `: ${datos.oferta.titulo}` : ''}
            </h1>
            <p className="gestion-ayuda">
              Personas cuyo perfil encaja con tu oferta por intereses, isla, disponibilidad y
              valoraciones. Invítalas y recibirán un aviso para inscribirse.
            </p>
          </div>
        </section>

        <div className="candidatos">
          {error && <p className="gestion-error" role="alert">{error}</p>}
          {!error && datos === null && <p className="empty-state">Buscando voluntarios compatibles...</p>}
          {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}

          {datos && datos.recomendaciones.length === 0 && (
            <p className="empty-state">
              Ahora mismo no hay voluntarios cuyo perfil encaje con esta oferta.
            </p>
          )}

          {datos && datos.recomendaciones.length > 0 && (
            <ul className="candidatos-lista">
              {datos.recomendaciones.map(({ voluntario, afinidad, motivos, invitado }) => {
                const abierto = perfilAbierto === voluntario.id
                const escribiendo = invitando === voluntario.id

                return (
                  <li key={voluntario.id} className="gestion-bloque candidato">
                    <div className="candidato-cabecera">
                      <AvatarVoluntario voluntario={voluntario} />
                      <div className="candidato-resumen">
                        <h3>{voluntario.nombre}</h3>
                        <p>
                          {[
                            voluntario.edad !== null && `${voluntario.edad} años`,
                            voluntario.municipio,
                            voluntario.isla && ISLAS[voluntario.isla],
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Sin datos de ubicación'}
                        </p>
                      </div>
                      <span
                        className={`recomendado-afinidad${afinidad >= 75 ? ' recomendado-afinidad-alta' : ''}`}
                        aria-label={`${afinidad}% de compatibilidad`}
                      >
                        {afinidad}% compatible
                      </span>
                    </div>

                    <ul className="recomendado-motivos" aria-label="Por qué se recomienda">
                      {motivos.map((motivo) => (
                        <li key={motivo.tipo}>
                          <span aria-hidden="true">{ICONOS_MOTIVO[motivo.tipo]}</span> {motivo.texto}
                        </li>
                      ))}
                    </ul>

                    {abierto && (
                      <PerfilVoluntario id={`perfil-${voluntario.id}`} voluntario={voluntario} />
                    )}

                    {escribiendo && (
                      <div className="candidato-rechazo">
                        <label htmlFor={`mensaje-${voluntario.id}`}>
                          Mensaje para {voluntario.nombre} (opcional)
                        </label>
                        <textarea
                          id={`mensaje-${voluntario.id}`}
                          rows={3}
                          maxLength={MENSAJE_MAX}
                          value={mensaje}
                          onChange={(evento) => setMensaje(evento.target.value)}
                        />
                      </div>
                    )}

                    <div className="gestion-acciones">
                      <button
                        type="button"
                        className="gestion-accion"
                        aria-expanded={abierto}
                        aria-controls={`perfil-${voluntario.id}`}
                        onClick={() => setPerfilAbierto(abierto ? null : voluntario.id)}
                      >
                        {abierto ? 'Ocultar perfil' : 'Ver perfil'}
                      </button>

                      {invitado && <span className="recomendado-invitado">✓ Invitación enviada</span>}

                      {!invitado && !escribiendo && (
                        <button
                          type="button"
                          className="gestion-accion candidato-aceptar"
                          onClick={() => {
                            setInvitando(voluntario.id)
                            setMensaje('')
                            setErrorAccion(null)
                          }}
                          disabled={enCurso !== null}
                        >
                          Invitar
                        </button>
                      )}

                      {!invitado && escribiendo && (
                        <>
                          <button
                            type="button"
                            className="gestion-accion candidato-aceptar"
                            onClick={() => invitar(voluntario.id)}
                            disabled={enCurso !== null}
                          >
                            {enCurso === voluntario.id ? 'Enviando...' : 'Enviar invitación'}
                          </button>
                          <button
                            type="button"
                            className="gestion-accion"
                            onClick={() => setInvitando(null)}
                            disabled={enCurso !== null}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
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

export default VoluntariosRecomendados
