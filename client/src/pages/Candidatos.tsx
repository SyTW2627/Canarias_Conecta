/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla del ofertante para revisar los candidatos de una oferta y aceptarlos o rechazarlos.
 */
import { useEffect, useMemo, useState } from 'react'
import './HomePage.css'
import './GestionarOfertas.css'
import './Candidatos.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import { ISLAS, cabecerasConSesion, formatearFecha, type MiOferta } from '../ofertas.ts'

type EstadoInscripcion =
  | 'pendiente'
  | 'en_espera'
  | 'aceptada'
  | 'rechazada'
  | 'cancelada'
  | 'completada'
  | 'no_presentado'

type Candidato = {
  id: string
  estado: EstadoInscripcion
  terminada: boolean
  horasPrevistas: number
  horasRealizadas: number | null
  cancelacionTardia: boolean
  mensaje: string | null
  motivoRechazo: string | null
  fechaSolicitud: string
  fechaResolucion: string | null
  turnoIds: string[]
  valoracion: { puntuacion: number; comentario: string | null } | null
  voluntario: {
    id: string
    nombre: string
    avatarUrl: string | null
    isla: string | null
    municipio: string | null
    edad: number | null
    biografia: string | null
    intereses: { id: string; nombre: string }[]
    habilidades: string[]
    idiomas: string[]
    estadisticas: {
      horasTotales: number
      colaboraciones: number
      valoracionMedia: number
      numValoraciones: number
    }
    email: string | null
    telefono: string | null
  }
}

type CandidatosProps = {
  ofertaId: string
  usuario: Usuario
  onCerrarSesion: () => void
}

type Filtro = 'pendiente' | 'en_espera' | 'aceptada' | 'completada' | 'rechazada' | 'todas'

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'en_espera', texto: 'En espera' },
  { valor: 'aceptada', texto: 'Aceptados' },
  { valor: 'completada', texto: 'Finalizados' },
  { valor: 'rechazada', texto: 'Rechazados' },
  { valor: 'todas', texto: 'Todos' },
]

const ETIQUETAS_ESTADO: Record<EstadoInscripcion, string> = {
  pendiente: 'Pendiente',
  en_espera: 'En espera',
  aceptada: 'Aceptado',
  rechazada: 'Rechazado',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_presentado: 'No presentado',
}

const FORMATO_SOLICITUD = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// "Finalizados" agrupa a quien participo y a quien no se presento
function filtroDeEstado(estado: EstadoInscripcion): Filtro | null {
  if (estado === 'no_presentado') return 'completada'
  return estado === 'cancelada' ? null : estado
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
}

function Candidatos({ ofertaId, usuario, onCerrarSesion }: CandidatosProps) {
  const [oferta, setOferta] = useState<MiOferta | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [recargas, setRecargas] = useState(0)
  const [filtro, setFiltro] = useState<Filtro>('pendiente')
  const [perfilAbierto, setPerfilAbierto] = useState<string | null>(null)
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [completando, setCompletando] = useState<string | null>(null)
  const [horas, setHoras] = useState('')
  const [valorando, setValorando] = useState<string | null>(null)
  const [puntuacion, setPuntuacion] = useState(0)
  const [comentarioValoracion, setComentarioValoracion] = useState('')

  useEffect(() => {
    const controlador = new AbortController()
    const opciones = { headers: cabecerasConSesion(), signal: controlador.signal }

    async function cargar() {
      try {
        const [resOferta, resCandidatos] = await Promise.all([
          fetch(`/api/ofertas/mias/${encodeURIComponent(ofertaId)}`, opciones),
          fetch(`/api/inscripciones/oferta/${encodeURIComponent(ofertaId)}`, opciones),
        ])
        const [dataOferta, dataCandidatos] = await Promise.all([resOferta.json(), resCandidatos.json()])

        if (!resOferta.ok || !resCandidatos.ok) {
          setError(
            (!resOferta.ok ? dataOferta.message : dataCandidatos.message) ??
              'No se pudieron cargar los candidatos',
          )
          return
        }

        setError(null)
        setOferta(dataOferta)
        setCandidatos(dataCandidatos)
      } catch {
        if (!controlador.signal.aborted) setError('No se pudo conectar con el servidor')
      }
    }

    cargar()
    return () => controlador.abort()
  }, [ofertaId, recargas])

  const turnosPorId = useMemo(
    () => new Map((oferta?.turnos ?? []).map((turno) => [turno.id, turno])),
    [oferta],
  )

  const contadores = useMemo(() => {
    const cuenta: Record<Filtro, number> = {
      pendiente: 0,
      en_espera: 0,
      aceptada: 0,
      completada: 0,
      rechazada: 0,
      todas: 0,
    }
    for (const candidato of candidatos ?? []) {
      cuenta.todas++
      const grupo = filtroDeEstado(candidato.estado)
      if (grupo) cuenta[grupo]++
    }
    return cuenta
  }, [candidatos])

  const visibles = (candidatos ?? []).filter(
    (candidato) => filtro === 'todas' || filtroDeEstado(candidato.estado) === filtro,
  )

  async function resolver(candidato: Candidato, decision: 'aceptar' | 'rechazar') {
    setErrorAccion(null)
    setEnCurso(candidato.id)

    try {
      const res = await fetch(
        `/api/inscripciones/${encodeURIComponent(candidato.id)}/${decision}`,
        {
          method: 'PATCH',
          headers: cabecerasConSesion(),
          body: JSON.stringify(decision === 'rechazar' ? { motivo } : {}),
        },
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorAccion(data.message ?? 'No se pudo actualizar la solicitud')
      } else {
        setRechazando(null)
        setMotivo('')
      }
      // Se recarga siempre: otra pestaña puede haber resuelto la solicitud
      setRecargas((n) => n + 1)
    } catch {
      setErrorAccion('No se pudo conectar con el servidor')
    } finally {
      setEnCurso(null)
    }
  }

  async function completar(candidato: Candidato, asistio: boolean) {
    const horasNumero = Number(horas.replace(',', '.'))
    if (asistio && !(horasNumero > 0)) {
      setErrorAccion('Indica las horas realizadas')
      return
    }

    setErrorAccion(null)
    setEnCurso(candidato.id)

    try {
      const res = await fetch(`/api/inscripciones/${encodeURIComponent(candidato.id)}/completar`, {
        method: 'PATCH',
        headers: cabecerasConSesion(),
        body: JSON.stringify(asistio ? { asistio, horas: horasNumero } : { asistio }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorAccion(data.message ?? 'No se pudo completar la inscripción')
      } else {
        setCompletando(null)
      }

      setRecargas((n) => n + 1)
    } catch {
      setErrorAccion('No se pudo conectar con el servidor')
    } finally {
      setEnCurso(null)
    }
  }

  async function valorar(candidato: Candidato) {
    if (puntuacion < 1) {
      setErrorAccion('Selecciona entre 1 y 5 palmeras')
      return
    }

    setErrorAccion(null)
    setEnCurso(candidato.id)
    try {
      const res = await fetch(`/api/inscripciones/${encodeURIComponent(candidato.id)}/valorar`, {
        method: 'PATCH',
        headers: { ...cabecerasConSesion(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ puntuacion, comentario: comentarioValoracion }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorAccion(data.message ?? 'No se pudo guardar la valoración')
      } else {
        setValorando(null)
        setPuntuacion(0)
        setComentarioValoracion('')
      }
      setRecargas((n) => n + 1)
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
          <img
            src="/fotos/Logo_Canarias_Conecta_Sinfondo.png"
            alt="Logo de Canarias Conecta"
          />
          <span className="logo">Canarias Conecta</span>
        </div>

        <nav className="authenticated-links" aria-label="Navegación principal">
          <a href="/#inicio">Inicio</a>
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
        <section className="welcome-section">
          <p className="eyebrow">Panel del ofertante</p>
          <h1>Candidatos{oferta ? `: ${oferta.titulo}` : ''}</h1>
          <p>
            Revisa el perfil de cada voluntario y acepta o rechaza su solicitud. Al rechazar, sus
            plazas vuelven a quedar libres.{' '}
            <a className="text-link" href="/gestionar-ofertas">Volver a mis ofertas</a>
          </p>
        </section>

        <div className="candidatos">
          {error && <p className="gestion-error" role="alert">{error}</p>}
          {!error && candidatos === null && <p className="empty-state">Cargando candidatos...</p>}

          {candidatos && (
            <>
              <div className="candidatos-filtros" role="tablist" aria-label="Filtrar candidatos">
                {FILTROS.map(({ valor, texto }) => (
                  <button
                    key={valor}
                    type="button"
                    role="tab"
                    aria-selected={filtro === valor}
                    className={filtro === valor ? 'candidatos-filtro activo' : 'candidatos-filtro'}
                    onClick={() => setFiltro(valor)}
                  >
                    {texto} <span>{contadores[valor]}</span>
                  </button>
                ))}
              </div>

              {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}

              {visibles.length === 0 && (
                <p className="empty-state">
                  {candidatos.length === 0
                    ? 'Todavía no se ha inscrito nadie en esta oferta.'
                    : 'No hay candidatos en este estado.'}
                </p>
              )}

              <ul className="candidatos-lista">
                {visibles.map((candidato) => {
                  const { voluntario } = candidato
                  const abierto = perfilAbierto === candidato.id
                  const turnos = candidato.turnoIds
                    .map((turnoId) => turnosPorId.get(turnoId))
                    .filter((turno) => turno !== undefined)
                    .sort((a, b) => a.fecha.localeCompare(b.fecha))

                  return (
                    <li key={candidato.id} className="gestion-bloque candidato">
                      <div className="candidato-cabecera">
                        {voluntario.avatarUrl ? (
                          <img className="candidato-avatar" src={voluntario.avatarUrl} alt="" />
                        ) : (
                          <span className="candidato-avatar" aria-hidden="true">
                            {iniciales(voluntario.nombre)}
                          </span>
                        )}
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
                          <p>
                            Solicitado el {FORMATO_SOLICITUD.format(new Date(candidato.fechaSolicitud))}
                          </p>
                        </div>
                        <span className={`gestion-estado candidato-estado-${candidato.estado}`}>
                          {ETIQUETAS_ESTADO[candidato.estado]}
                        </span>
                      </div>

                      {turnos.length > 0 && (
                        <div className="candidato-turnos">
                          <strong>Turnos solicitados</strong>
                          <ul>
                            {turnos.map((turno) => (
                              <li key={turno.id}>
                                {formatearFecha(turno.fecha)}, de {turno.horaInicio} a {turno.horaFin}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {candidato.mensaje && (
                        <p className="candidato-mensaje">“{candidato.mensaje}”</p>
                      )}

                      {abierto && (
                        <div className="candidato-perfil" id={`perfil-${candidato.id}`}>
                          <dl className="candidato-estadisticas">
                            <div>
                              <dt>Horas de voluntariado</dt>
                              <dd>{voluntario.estadisticas.horasTotales}</dd>
                            </div>
                            <div>
                              <dt>Colaboraciones</dt>
                              <dd>{voluntario.estadisticas.colaboraciones}</dd>
                            </div>
                            <div>
                              <dt>Valoración media</dt>
                              <dd>
                                {voluntario.estadisticas.numValoraciones > 0
                                  ? `${voluntario.estadisticas.valoracionMedia.toFixed(1)} / 5 (${voluntario.estadisticas.numValoraciones})`
                                  : 'Sin valoraciones'}
                              </dd>
                            </div>
                          </dl>

                          <h4>Sobre mí</h4>
                          <p>{voluntario.biografia || 'No ha escrito una presentación.'}</p>

                          <h4>Intereses</h4>
                          {voluntario.intereses.length > 0 ? (
                            <div className="candidato-etiquetas">
                              {voluntario.intereses.map((interes) => (
                                <span key={interes.id} className="tag">{interes.nombre}</span>
                              ))}
                            </div>
                          ) : (
                            <p>Sin intereses indicados.</p>
                          )}

                          <h4>Habilidades</h4>
                          <p>
                            {voluntario.habilidades.length > 0
                              ? voluntario.habilidades.join(', ')
                              : 'Sin habilidades indicadas.'}
                          </p>

                          <h4>Idiomas</h4>
                          <p>
                            {voluntario.idiomas.length > 0
                              ? voluntario.idiomas.join(', ')
                              : 'Sin idiomas indicados.'}
                          </p>

                          <h4>Contacto</h4>
                          {voluntario.email ? (
                            <p>
                              <a className="text-link" href={`mailto:${voluntario.email}`}>
                                {voluntario.email}
                              </a>
                              {voluntario.telefono && <> · {voluntario.telefono}</>}
                            </p>
                          ) : (
                            <p>Los datos de contacto se muestran al aceptar la solicitud.</p>
                          )}
                        </div>
                      )}

                      {candidato.estado === 'rechazada' && candidato.motivoRechazo && (
                        <p className="gestion-ayuda">Motivo del rechazo: {candidato.motivoRechazo}</p>
                      )}

                      {candidato.estado === 'completada' && candidato.horasRealizadas !== null && (
                        <p className="gestion-ayuda">
                          Participó: {candidato.horasRealizadas} h sumadas a su perfil.
                        </p>
                      )}

                      {candidato.estado === 'completada' && candidato.valoracion === null && valorando === candidato.id && (
                        <div className="candidato-valoracion">
                          <p className="candidato-valoracion-titulo">Valora su colaboración</p>
                          <div className="candidato-palmeras" role="radiogroup" aria-label="Valoración de 1 a 5 palmeras">
                            {[1, 2, 3, 4, 5].map((valor) => (
                              <button
                                key={valor}
                                type="button"
                                className={valor <= puntuacion ? 'palmera seleccionada' : 'palmera'}
                                role="radio"
                                aria-checked={valor === puntuacion}
                                aria-label={`${valor} palmera${valor === 1 ? '' : 's'}`}
                                onClick={() => setPuntuacion(valor)}
                              >
                                🌴
                              </button>
                            ))}
                          </div>
                          <textarea
                            rows={3}
                            maxLength={1000}
                            placeholder="Comentario opcional"
                            value={comentarioValoracion}
                            onChange={(evento) => setComentarioValoracion(evento.target.value)}
                          />
                        </div>
                      )}

                      {candidato.estado === 'completada' && candidato.valoracion && (
                        <p className="gestion-ayuda candidato-valoracion-guardada">
                          Valoración enviada: {'🌴'.repeat(candidato.valoracion.puntuacion)}
                        </p>
                      )}

                      {candidato.estado === 'en_espera' && (
                        <p className="gestion-ayuda">
                          En lista de espera: pasará a pendiente en cuanto se libere una plaza en sus turnos.
                        </p>
                      )}

                      {candidato.estado === 'cancelada' && candidato.cancelacionTardia && (
                        <p className="gestion-ayuda">Canceló con menos de 48 h de antelación.</p>
                      )}

                      {candidato.estado === 'aceptada' && !candidato.terminada && (
                        <p className="gestion-ayuda">
                          Podrás confirmar su asistencia cuando terminen sus turnos.
                        </p>
                      )}

                      {completando === candidato.id && (
                        <div className="candidato-rechazo">
                          <label htmlFor={`horas-${candidato.id}`}>
                            Horas realizadas (se suman a su perfil)
                          </label>
                          <input
                            id={`horas-${candidato.id}`}
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={horas}
                            onChange={(evento) => setHoras(evento.target.value)}
                          />
                        </div>
                      )}

                      {candidato.estado === 'completada' && candidato.valoracion === null && (
                        valorando === candidato.id ? (
                          <>
                            <button
                              type="button"
                              className="gestion-accion candidato-aceptar"
                              onClick={() => valorar(candidato)}
                              disabled={enCurso !== null}
                            >
                              {enCurso === candidato.id ? 'Guardando...' : 'Guardar valoración'}
                            </button>
                            <button
                              type="button"
                              className="gestion-accion"
                              onClick={() => setValorando(null)}
                              disabled={enCurso !== null}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="gestion-accion candidato-aceptar"
                            onClick={() => {
                              setValorando(candidato.id)
                              setPuntuacion(0)
                              setComentarioValoracion('')
                            }}
                            disabled={enCurso !== null}
                          >
                            Valorar con palmeras
                          </button>
                        )
                      )}

                      {rechazando === candidato.id && (
                        <div className="candidato-rechazo">
                          <label htmlFor={`motivo-${candidato.id}`}>
                            Motivo del rechazo (opcional, lo verá el voluntario)
                          </label>
                          <textarea
                            id={`motivo-${candidato.id}`}
                            rows={3}
                            maxLength={500}
                            value={motivo}
                            onChange={(evento) => setMotivo(evento.target.value)}
                          />
                        </div>
                      )}

                      <div className="gestion-acciones">
                        <button
                          type="button"
                          className="gestion-accion"
                          aria-expanded={abierto}
                          aria-controls={`perfil-${candidato.id}`}
                          onClick={() => setPerfilAbierto(abierto ? null : candidato.id)}
                        >
                          {abierto ? 'Ocultar perfil' : 'Ver perfil'}
                        </button>

                        {candidato.estado === 'pendiente' && rechazando !== candidato.id && (
                          <>
                            <button
                              type="button"
                              className="gestion-accion candidato-aceptar"
                              onClick={() => resolver(candidato, 'aceptar')}
                              disabled={enCurso !== null}
                            >
                              {enCurso === candidato.id ? 'Aceptando...' : 'Aceptar'}
                            </button>
                            <button
                              type="button"
                              className="gestion-accion gestion-accion-peligro"
                              onClick={() => {
                                setRechazando(candidato.id)
                                setMotivo('')
                              }}
                              disabled={enCurso !== null}
                            >
                              Rechazar
                            </button>
                          </>
                        )}

                        {candidato.estado === 'aceptada' &&
                          candidato.terminada &&
                          completando !== candidato.id && (
                            <>
                              <button
                                type="button"
                                className="gestion-accion candidato-aceptar"
                                onClick={() => {
                                  setCompletando(candidato.id)
                                  setHoras(String(candidato.horasPrevistas))
                                }}
                                disabled={enCurso !== null}
                              >
                                Participó
                              </button>
                              <button
                                type="button"
                                className="gestion-accion gestion-accion-peligro"
                                onClick={() => completar(candidato, false)}
                                disabled={enCurso !== null}
                              >
                                {enCurso === candidato.id ? 'Guardando...' : 'No se presentó'}
                              </button>
                            </>
                          )}

                        {completando === candidato.id && (
                          <>
                            <button
                              type="button"
                              className="gestion-accion candidato-aceptar"
                              onClick={() => completar(candidato, true)}
                              disabled={enCurso !== null}
                            >
                              {enCurso === candidato.id ? 'Guardando...' : 'Confirmar participación'}
                            </button>
                            <button
                              type="button"
                              className="gestion-accion"
                              onClick={() => setCompletando(null)}
                              disabled={enCurso !== null}
                            >
                              Cancelar
                            </button>
                          </>
                        )}

                        {rechazando === candidato.id && (
                          <>
                            <button
                              type="button"
                              className="gestion-accion gestion-accion-peligro"
                              onClick={() => resolver(candidato, 'rechazar')}
                              disabled={enCurso !== null}
                            >
                              {enCurso === candidato.id ? 'Rechazando...' : 'Confirmar rechazo'}
                            </button>
                            <button
                              type="button"
                              className="gestion-accion"
                              onClick={() => setRechazando(null)}
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
            </>
          )}
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

export default Candidatos
