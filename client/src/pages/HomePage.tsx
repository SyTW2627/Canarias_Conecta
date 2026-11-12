/**
 * Pantalla principal para usuarios autenticados.
 */
import { useState } from 'react'
import './HomePage.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import TarjetaOferta from '../components/TarjetaOferta.tsx'
import { useOfertasPublicadas } from '../useOfertasPublicadas.ts'

type HomePageProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

function HomePage({ usuario, onCerrarSesion }: HomePageProps) {
  const [indiceOportunidades, setIndiceOportunidades] = useState(0)
  const { ofertas, error: errorOfertas } = useOfertasPublicadas()
  const oportunidades = ofertas ?? []

  const oportunidadesVisibles = oportunidades.slice(
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
          <Notificaciones />
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

        <section className="opportunities-section" id="oportunidades-destacadas">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Próximas oportunidades</h2>
            </div>
            <a className="text-link" href="/oportunidades">
              Ver todas
            </a>
          </div>

          {oportunidades.length > 0 ? (
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
              {oportunidadesVisibles.map((oferta) => (
                <TarjetaOferta key={oferta.id} oferta={oferta} />
              ))}
              </div>

              <button
                type="button"
                className="opportunity-arrow opportunity-arrow-next"
                onClick={() =>
                  setIndiceOportunidades((indice) =>
                    Math.min(oportunidades.length - 3, indice + 1),
                  )
                }
                disabled={indiceOportunidades >= oportunidades.length - 3}
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
                  : 'Todavía no hay oportunidades publicadas.')}
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
