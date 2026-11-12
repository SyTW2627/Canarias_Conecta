/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla de detalle de una oferta de voluntariado.
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './OfertaDetalle.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import {
  DURACIONES,
  ISLAS,
  MODALIDADES,
  esTurnoProximo,
  formatearFecha,
  type Oferta,
} from '../ofertas.ts'

type OfertaDetalleProps = {
  ofertaId: string
  usuario: Usuario
  onCerrarSesion: () => void
}

function textoPlazas(plazasLibres: number): string {
  if (plazasLibres === 0) return 'Sin plazas'
  return plazasLibres === 1 ? '1 plaza disponible' : `${plazasLibres} plazas disponibles`
}

function OfertaDetalle({ ofertaId, usuario, onCerrarSesion }: OfertaDetalleProps) {
  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [turnosSeleccionados, setTurnosSeleccionados] = useState<string[]>([])
  const [estadoInscripcion, setEstadoInscripcion] = useState<string | null>(null)
  const [inscribiendo, setInscribiendo] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()

    async function cargarOferta() {
      try {
        const res = await fetch(`/api/ofertas/${encodeURIComponent(ofertaId)}`, {
          signal: controlador.signal,
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.message ?? 'No se pudo cargar la oferta')
          return
        }

        setOferta(data)
        setTurnosSeleccionados(data.turnos.filter(esTurnoProximo).map((turno: { id: string }) => turno.id))
      } catch {
        if (!controlador.signal.aborted) {
          setError('No se pudo conectar con el servidor')
        }
      }
    }

    cargarOferta()
    return () => controlador.abort()
  }, [ofertaId])

  const turnosProximos = oferta?.turnos.filter(esTurnoProximo) ?? []

  async function inscribirse() {
    if (!oferta || turnosSeleccionados.length === 0) return

    setInscribiendo(true)
    setEstadoInscripcion(null)
    try {
      const res = await fetch('/api/inscripciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
        body: JSON.stringify({ ofertaId: oferta.id, turnoIds: turnosSeleccionados }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'No se pudo completar la inscripción')
      setEstadoInscripcion('Solicitud enviada correctamente')
    } catch (error) {
      setEstadoInscripcion(error instanceof Error ? error.message : 'No se pudo completar la inscripción')
    } finally {
      setInscribiendo(false)
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
          {usuario.rol === 'ofertante' && <a href="/gestionar-ofertas">Gestionar ofertas</a>}
        </nav>

        <div className="authenticated-user">
          <Notificaciones />
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="authenticated-main oferta-detalle">
        <a className="text-link oferta-volver" href="/oportunidades">
          Volver a oportunidades
        </a>

        {error && <p className="empty-state">{error}</p>}
        {!error && !oferta && <p className="empty-state">Cargando la oferta...</p>}

        {oferta && (
          <>
            <article className={oferta.imagenes[0] ? 'oferta-cabecera' : 'oferta-cabecera sin-imagen'}>
              {oferta.imagenes[0] && <img src={oferta.imagenes[0]} alt={oferta.titulo} />}

              <div className="opportunity-content">
                <p className="opportunity-organization">{oferta.organizacion}</p>
                <h1>{oferta.titulo}</h1>

                <ul className="oferta-categorias">
                  {oferta.categorias.map((categoria) => (
                    <li key={categoria.id} className="tag">{categoria.nombre}</li>
                  ))}
                </ul>

                <dl>
                  {oferta.ubicacion && (
                    <div>
                      <dt>Ubicación</dt>
                      <dd>
                        {oferta.ubicacion.municipio}, {ISLAS[oferta.ubicacion.isla]}
                      </dd>
                    </div>
                  )}
                  <div><dt>Modalidad</dt><dd>{MODALIDADES[oferta.modalidad]}</dd></div>
                  <div><dt>Duración</dt><dd>{DURACIONES[oferta.tipoDuracion]}</dd></div>
                  {oferta.edadMinima !== undefined && (
                    <div><dt>Edad mínima</dt><dd>{oferta.edadMinima} años</dd></div>
                  )}
                </dl>
              </div>
            </article>

            <div className="oferta-cuerpo">
              <section className="oferta-bloque">
                <h2>Sobre esta oferta</h2>
                <p>{oferta.descripcion}</p>

                {oferta.requisitos && (
                  <>
                    <h2>Requisitos</h2>
                    <p>{oferta.requisitos}</p>
                  </>
                )}
              </section>

              <section className="oferta-bloque">
                <h2>Próximos turnos</h2>

                {turnosProximos.length > 0 ? (
                  <ul className="oferta-turnos">
                    {turnosProximos.map((turno) => (
                      <li key={turno.id}>
                        <label className="oferta-turno-seleccion">
                          <input
                            type="checkbox"
                            checked={turnosSeleccionados.includes(turno.id)}
                            onChange={() =>
                              setTurnosSeleccionados((seleccionados) =>
                                seleccionados.includes(turno.id)
                                  ? seleccionados.filter((id) => id !== turno.id)
                                  : [...seleccionados, turno.id],
                              )
                            }
                          />
                          <span>Seleccionar</span>
                        </label>
                        <strong>{formatearFecha(turno.fecha)}</strong>
                        <span>{turno.horaInicio} - {turno.horaFin}</span>
                        <span className={turno.plazasLibres === 0 ? 'oferta-sin-plazas' : 'oferta-plazas'}>
                          {textoPlazas(turno.plazasLibres)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Esta oferta no tiene turnos próximos.</p>
                )}
                {usuario.rol === 'voluntario' && turnosProximos.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="btn oferta-inscribirse"
                      onClick={inscribirse}
                      disabled={inscribiendo || turnosSeleccionados.length === 0}
                    >
                      {inscribiendo ? 'Enviando...' : 'Inscribirme'}
                    </button>
                    {estadoInscripcion && (
                      <p className="oferta-inscripcion-mensaje" role="status">
                        {estadoInscripcion}
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
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

export default OfertaDetalle
