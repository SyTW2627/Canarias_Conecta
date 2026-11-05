/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Catalogo con todas las ofertas disponibles y el buscador.
 */
import { useMemo, useState } from 'react'
import './HomePage.css'
import './Oportunidades.css'
import type { Usuario } from './Login.tsx'
import TarjetaOferta from '../components/TarjetaOferta.tsx'
import { ISLAS } from '../ofertas.ts'
import { useOfertasPublicadas } from '../useOfertasPublicadas.ts'

type OportunidadesProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

function Oportunidades({ usuario, onCerrarSesion }: OportunidadesProps) {
  const [busqueda, setBusqueda] = useState('')
  const [isla, setIsla] = useState('')
  const { ofertas, error: errorOfertas } = useOfertasPublicadas()

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
          {usuario.rol === 'voluntario' && (
            <a href="/oportunidades" aria-current="page">Oportunidades</a>
          )}
          {usuario.rol === 'voluntario' && <a href="/mis_inscripciones">Mis inscripciones</a>}
          <a href="/#perfil">Mi perfil</a>
          {usuario.rol === 'ofertante' && <a href="/gestionar-ofertas">Gestionar ofertas</a>}
        </nav>

        <div className="authenticated-user">
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="authenticated-main catalogo">
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
              <span>Isla</span>
              <select value={isla} onChange={(event) => setIsla(event.target.value)}>
                <option value="">Todas</option>
                {Object.entries(ISLAS).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* El id es el destino del enlace "Ver todas" del buscador */}
        <section className="opportunities-section" id="oportunidades-destacadas">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Todas las oportunidades</h2>
            </div>
            {ofertas && ofertas.length > 0 && (
              <p className="catalogo-total">
                {oportunidadesFiltradas.length === 1
                  ? '1 oportunidad'
                  : `${oportunidadesFiltradas.length} oportunidades`}
              </p>
            )}
          </div>

          {oportunidadesFiltradas.length > 0 ? (
            <div className="catalogo-grid">
              {oportunidadesFiltradas.map((oferta) => (
                <TarjetaOferta key={oferta.id} oferta={oferta} />
              ))}
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

export default Oportunidades
