/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Catalogo con todas las ofertas disponibles y el buscador.
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './Oportunidades.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import TarjetaOferta from '../components/TarjetaOferta.tsx'
import { ISLAS, hoyIso } from '../ofertas.ts'
import { useOfertasPublicadas } from '../useOfertasPublicadas.ts'

type OportunidadesProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

type Categoria = { id: string; nombre: string; slug: string }

// Limite de la API para el texto de busqueda
const BUSQUEDA_MAX = 100
const ESPERA_ESCRITURA_MS = 350

// Devuelve el valor cuando el usuario deja de escribir: evita una peticion por tecla
function useValorRetrasado(valor: string): string {
  const [retrasado, setRetrasado] = useState(valor)

  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), ESPERA_ESCRITURA_MS)
    return () => clearTimeout(temporizador)
  }, [valor])

  return retrasado
}

function Oportunidades({ usuario, onCerrarSesion }: OportunidadesProps) {
  // El buscador y el mapa del inicio llegan con ?q= e ?isla= en la URL
  const [busqueda, setBusqueda] = useState(
    () => new URLSearchParams(window.location.search).get('q')?.slice(0, BUSQUEDA_MAX) ?? '',
  )
  const [categoria, setCategoria] = useState('')
  const [isla, setIsla] = useState(() => {
    const deUrl = new URLSearchParams(window.location.search).get('isla') ?? ''
    return deUrl in ISLAS ? deUrl : ''
  })
  const [municipio, setMunicipio] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])

  const { ofertas, error: errorOfertas, cargando } = useOfertasPublicadas({
    q: useValorRetrasado(busqueda),
    categoria,
    isla,
    municipio: useValorRetrasado(municipio),
    fechaDesde,
    fechaHasta,
  })

  useEffect(() => {
    const controlador = new AbortController()

    // Si falla, el filtro de categoria se queda solo con "Todas"
    fetch('/api/categorias', { signal: controlador.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategorias)
      .catch(() => {})

    return () => controlador.abort()
  }, [])

  const hayFiltros = Boolean(
    busqueda || categoria || isla || municipio || fechaDesde || fechaHasta,
  )

  function limpiarFiltros() {
    setBusqueda('')
    setCategoria('')
    setIsla('')
    setMunicipio('')
    setFechaDesde('')
    setFechaHasta('')
  }

  const oportunidades = ofertas ?? []

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
          <Notificaciones />
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

          <div className="search-controls catalogo-filtros">
            <label className="filtro-busqueda">
              <span>Buscar</span>
              <input
                type="search"
                value={busqueda}
                maxLength={BUSQUEDA_MAX}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Ej. costa, mayores..."
              />
            </label>

            <label>
              <span>Categoría</span>
              <select value={categoria} onChange={(event) => setCategoria(event.target.value)}>
                <option value="">Todas</option>
                {categorias.map(({ id, nombre, slug }) => (
                  <option key={id} value={slug}>{nombre}</option>
                ))}
              </select>
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

            <label>
              <span>Municipio</span>
              <input
                type="text"
                value={municipio}
                onChange={(event) => setMunicipio(event.target.value)}
                placeholder="Ej. La Laguna"
              />
            </label>

            <label>
              <span>Desde</span>
              <input
                type="date"
                value={fechaDesde}
                min={hoyIso()}
                onChange={(event) => setFechaDesde(event.target.value)}
              />
            </label>

            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={fechaHasta}
                min={fechaDesde || hoyIso()}
                onChange={(event) => setFechaHasta(event.target.value)}
              />
            </label>

            {hayFiltros && (
              <button type="button" className="btn btn-outline filtro-limpiar" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            )}
          </div>
        </section>

        {/* El id es el destino del enlace "Ver todas" del buscador */}
        <section className="opportunities-section" id="oportunidades-destacadas">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Todas las oportunidades</h2>
            </div>
            {ofertas && (
              <p className="catalogo-total">
                {cargando
                  ? 'Buscando...'
                  : oportunidades.length === 1
                    ? '1 oportunidad'
                    : `${oportunidades.length} oportunidades`}
              </p>
            )}
          </div>

          {errorOfertas && oportunidades.length > 0 && (
            <p className="empty-state">{errorOfertas}</p>
          )}

          {oportunidades.length > 0 ? (
            <div className={`catalogo-grid${cargando ? ' catalogo-cargando' : ''}`}>
              {oportunidades.map((oferta) => (
                <TarjetaOferta key={oferta.id} oferta={oferta} />
              ))}
            </div>
          ) : (
            <p className="empty-state">
              {errorOfertas ??
                (ofertas === null
                  ? 'Cargando oportunidades...'
                  : hayFiltros
                    ? 'No hemos encontrado oportunidades con esos filtros.'
                    : 'Todavía no hay oportunidades publicadas.')}
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
