/**
 * Pantalla principal para usuarios autenticados.
 */
import { useEffect, useMemo, useState } from 'react'
import './HomePage.css'
import type { Usuario } from './Login.tsx'

type HomePageProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

type Oportunidad = {
  titulo: string
  organizacion: string
  ubicacion: string
  fecha: string
  horario: string
  plazas: number
  imagen: string
}

const OPORTUNIDADES: Oportunidad[] = [
  {
    titulo: 'Acompañamiento a personas mayores',
    organizacion: 'Asociación Horizonte',
    ubicacion: 'Santa Cruz de Tenerife',
    fecha: 'Sábado, 14 de noviembre',
    horario: '10:00 - 13:00',
    plazas: 8,
    imagen: '/fotos/imagen_personamayor.jpg',
  },
  {
    titulo: 'Limpieza y cuidado de la costa',
    organizacion: 'Mar y Comunidad',
    ubicacion: 'Las Palmas de Gran Canaria',
    fecha: 'Domingo, 15 de noviembre',
    horario: '09:00 - 12:00',
    plazas: 15,
    imagen: '/fotos/limpieza_costa.jpg',
  },
  {
    titulo: 'Taller de apoyo comunitario',
    organizacion: 'Red Canarias Participa',
    ubicacion: 'La Laguna',
    fecha: 'Miércoles, 18 de noviembre',
    horario: '16:00 - 19:00',
    plazas: 5,
    imagen: '/fotos/voluntariado-2.png',
  },
  {
    titulo: 'Reforestación de espacios naturales',
    organizacion: 'Islas Verdes',
    ubicacion: 'La Laguna',
    fecha: 'Jueves, 19 de noviembre',
    horario: '15:30 - 18:30',
    plazas: 12,
    imagen: '/fotos/reforestacion.jpg',
  },
  {
    titulo: 'Apoyo escolar para jóvenes',
    organizacion: 'Crecer Juntos',
    ubicacion: 'Santa Cruz de Tenerife',
    fecha: 'Viernes, 20 de noviembre',
    horario: '17:00 - 19:00',
    plazas: 6,
    imagen: '/fotos/apoyo_escolar.jpeg',
  },
  {
    titulo: 'Recogida de alimentos solidaria',
    organizacion: 'Banco de Alimentos Canario',
    ubicacion: 'Las Palmas de Gran Canaria',
    fecha: 'Sábado, 21 de noviembre',
    horario: '09:30 - 13:30',
    plazas: 20,
    imagen: '/fotos/recogida_alimentos.png',
  },
]

function HomePage({ usuario, onCerrarSesion }: HomePageProps) {
  const [busqueda, setBusqueda] = useState('')
  const [ubicacion, setUbicacion] = useState('Todas')
  const [indiceOportunidades, setIndiceOportunidades] = useState(0)

  const oportunidadesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()

    return OPORTUNIDADES.filter((oportunidad) => {
      const coincideBusqueda =
        !termino ||
        `${oportunidad.titulo} ${oportunidad.organizacion} ${oportunidad.ubicacion}`
          .toLowerCase()
          .includes(termino)
      const coincideUbicacion = ubicacion === 'Todas' || oportunidad.ubicacion === ubicacion

      return coincideBusqueda && coincideUbicacion
    })
  }, [busqueda, ubicacion])

  useEffect(() => {
    setIndiceOportunidades(0)
  }, [busqueda, ubicacion])

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
          <a href="#oportunidades">Oportunidades</a>
          <a href="#inscripciones">Mis inscripciones</a>
          <a href="#perfil">Mi perfil</a>
          {usuario.rol === 'ofertante' && <a href="#ofertas">Gestionar ofertas</a>}
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
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Ej. costa, mayores..."
              />
            </label>

            <label>
              <span>Ubicación</span>
              <select value={ubicacion} onChange={(event) => setUbicacion(event.target.value)}>
                <option>Todas</option>
                <option>Santa Cruz de Tenerife</option>
                <option>Las Palmas de Gran Canaria</option>
                <option>La Laguna</option>
              </select>
            </label>
          </div>
        </section>

        <section className="opportunities-section" id="oportunidades-destacadas">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Oportunidades destacadas de esta semana</h2>
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
              {oportunidadesVisibles.map((oportunidad) => (
                <article className="opportunity-card" key={oportunidad.titulo}>
                  <img src={oportunidad.imagen} alt="" />
                  <div className="opportunity-content">
                    <p className="opportunity-organization">{oportunidad.organizacion}</p>
                    <h3>{oportunidad.titulo}</h3>
                    <dl>
                      <div><dt>Ubicación</dt><dd>{oportunidad.ubicacion}</dd></div>
                      <div><dt>Fecha</dt><dd>{oportunidad.fecha}</dd></div>
                      <div><dt>Horario</dt><dd>{oportunidad.horario}</dd></div>
                    </dl>
                    <div className="opportunity-footer">
                      <span>{oportunidad.plazas} plazas disponibles</span>
                      <a className="btn" href="#oportunidades">Ver detalles</a>
                    </div>
                  </div>
                </article>
              ))}
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
            <p className="empty-state">No hemos encontrado oportunidades con esos filtros.</p>
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
