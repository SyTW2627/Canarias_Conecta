/**
 * Pantalla principal para usuarios autenticados.
 */
import { useEffect, useMemo, useState } from 'react'
import './HomePage.css'
import type { Usuario } from './Login.tsx'
import {
  ISLAS,
  MODALIDADES,
  esTurnoProximo,
  formatearFecha,
  imagenDeOferta,
  type Oferta,
  type Turno,
} from '../ofertas.ts'

type HomePageProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

function horarioDe(turno: Turno): string {
  return `${turno.horaInicio} - ${turno.horaFin}`
}

function HomePage({ usuario, onCerrarSesion }: HomePageProps) {
  const [busqueda, setBusqueda] = useState('')
  const [isla, setIsla] = useState('')
  const [indiceOportunidades, setIndiceOportunidades] = useState(0)
  const [ofertas, setOfertas] = useState<Oferta[] | null>(null)
  const [errorOfertas, setErrorOfertas] = useState<string | null>(null)

  // La API solo devuelve ofertas publicadas con algun turno desde hoy
  useEffect(() => {
    const controlador = new AbortController()

    fetch('/api/ofertas', { signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar las ofertas')
        setOfertas(data)
      })
      .catch((error: Error) => {
        if (!controlador.signal.aborted) {
          setErrorOfertas(
            error instanceof SyntaxError || error instanceof TypeError
              ? 'No se pudo conectar con el servidor'
              : error.message,
          )
        }
      })

    return () => controlador.abort()
  }, [])

  const oportunidadesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()

    return (ofertas ?? []).filter((oferta) => {
      const coincideBusqueda =
        !termino ||
        `${oferta.titulo} ${oferta.organizacion} ${oferta.ubicacion?.municipio ?? ''}`
          .toLowerCase()
          .includes(termino)
      const coincideIsla = !isla || oferta.ubicacion?.isla === isla

      return coincideBusqueda && coincideIsla
    })
  }, [ofertas, busqueda, isla])

  const oportunidadesVisibles = oportunidadesFiltradas.slice(
    indiceOportunidades,
    indiceOportunidades + 3,
  )

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
          <a href="#inicio">Inicio</a>
          {usuario.rol === 'voluntario' && <a href="/oportunidades">Oportunidades</a>}
          {usuario.rol === 'voluntario' && <a href="/mis_inscripciones">Mis inscripciones</a>}
          <a href="/perfil">Mi perfil</a>
          {usuario.rol === 'ofertante' && <a href="/gestionar-ofertas">Gestionar ofertas</a>}
        </nav>

        <div className="authenticated-user">
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="authenticated-main" id="inicio">
        <section className="welcome-section">
          <p className="eyebrow">Tu próxima oportunidad empieza aquí</p>
          <h1>Hola, {usuario.nombre}</h1>
          <p>Descubre nuevas formas de colaborar y aportar a tu comunidad.</p>
        </section>

        <section className="search-section" id="oportunidades">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Encuentra tu próxima experiencia</p>
              <h2 className="section-title">Busca oportunidades</h2>
            </div>
            <a className="text-link" href="#oportunidades-destacadas">
              Ver todas
            </a>
          </div>

          <div className="search-controls">
            <label>
              <span>Buscar</span>
              <input
                type="search"
                value={busqueda}
                onChange={(event) => {
                  setBusqueda(event.target.value)
                  setIndiceOportunidades(0)
                }}
                placeholder="Ej. costa, mayores..."
              />
            </label>

            <label>
              <span>Isla</span>
              <select value={isla} onChange={(event) => {
                  setIsla(event.target.value)
                  setIndiceOportunidades(0)
                }}>
                <option value="">Todas</option>
                {Object.entries(ISLAS).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="opportunities-section" id="oportunidades-destacadas">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Próximas oportunidades</h2>
            </div>
          </div>

          {oportunidadesFiltradas.length > 0 ? (
            <div className="opportunity-carousel">
              <button
                type="button"
                className="opportunity-arrow opportunity-arrow-prev"
                onClick={() => setIndiceOportunidades((indice) => Math.max(0, indice - 1))}
                disabled={indiceOportunidades === 0}
                aria-label="Oportunidades anteriores"
              >
                ‹
              </button>

              <div className="opportunity-grid">
              {oportunidadesVisibles.map((oferta) => {
                const turno = oferta.turnos
                  .filter(esTurnoProximo)
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
                const plazasLibres = oferta.turnos.reduce((total, t) => total + t.plazasLibres, 0)

                return (
                  <article className="opportunity-card" key={oferta.id}>
                    <img src={imagenDeOferta(oferta)} alt="" />
                    <div className="opportunity-content">
                      <p className="opportunity-organization">{oferta.organizacion}</p>
                      <h3>{oferta.titulo}</h3>
                      <dl>
                        <div>
                          <dt>Ubicación</dt>
                          <dd>
                            {oferta.ubicacion
                              ? `${oferta.ubicacion.municipio}, ${ISLAS[oferta.ubicacion.isla]}`
                              : MODALIDADES[oferta.modalidad]}
                          </dd>
                        </div>
                        {turno && (
                          <>
                            <div><dt>Fecha</dt><dd>{formatearFecha(turno.fecha)}</dd></div>
                            <div><dt>Horario</dt><dd>{horarioDe(turno)}</dd></div>
                          </>
                        )}
                      </dl>
                      <div className="opportunity-footer">
                        <span>
                          {plazasLibres === 1 ? '1 plaza disponible' : `${plazasLibres} plazas disponibles`}
                        </span>
                        <a className="btn" href={`/ofertas/${oferta.id}`}>
                          Ver detalles
                        </a>
                      </div>
                    </div>
                  </article>
                )
              })}
              </div>

              <button
                type="button"
                className="opportunity-arrow opportunity-arrow-next"
                onClick={() =>
                  setIndiceOportunidades((indice) =>
                    Math.min(oportunidadesFiltradas.length - 3, indice + 1),
                  )
                }
                disabled={indiceOportunidades >= oportunidadesFiltradas.length - 3}
                aria-label="Siguientes oportunidades"
              >
                ›
              </button>
            </div>
          ) : (
            <p className="empty-state">
              {errorOfertas ??
                (ofertas === null
                  ? 'Cargando oportunidades...'
                  : ofertas.length === 0
                    ? 'Todavía no hay oportunidades publicadas.'
                    : 'No hemos encontrado oportunidades con esos filtros.')}
            </p>
          )}
        </section>

        <section className="dashboard-grid" id="perfil">
          <article className="upcoming-card">
            <p className="eyebrow">Tu agenda</p>
            <h2>Próximamente</h2>
            <p className="upcoming-title">Acompañamiento a personas mayores</p>
            <p>sábado, 14 de noviembre · 10:00 - 13:00</p>
            <a className="text-link" href="#inscripciones">Ver mis inscripciones</a>
          </article>

          <article className="summary-card" id="inscripciones">
            <p className="eyebrow">Tu actividad</p>
            <h2>Resumen personal</h2>
            <div className="summary-row"><strong>2</strong><span>Inscripciones activas</span></div>
            <div className="summary-row"><strong>1</strong><span>Solicitud pendiente</span></div>
          </article>
        </section>
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

export default HomePage
