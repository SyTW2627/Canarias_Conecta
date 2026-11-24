/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla del ofertante para publicar una nueva oferta de voluntariado.
 */
import './HomePage.css'
import './GestionarOfertas.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import FormularioOferta, { type EnvioOferta } from '../components/FormularioOferta.tsx'

type PublicarOfertaProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

const MENSAJE_PUBLICADA = 'Oferta publicada. Los voluntarios ya pueden verla.'

// Vuelve al listado sin recargar; el mensaje viaja en el estado del historial
function volverAGestion(mensajeExito?: string) {
  window.history.pushState(mensajeExito ? { mensajeExito } : null, '', '/gestionar-ofertas')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function PublicarOferta({ usuario, onCerrarSesion }: PublicarOfertaProps) {
  async function publicar({ cuerpo, imagen }: EnvioOferta): Promise<string | null> {
    // Con imagen se envia como multipart; el navegador pone el Content-Type con su boundary
    const formulario = new FormData()
    formulario.append('datos', JSON.stringify({ ...cuerpo, estado: 'publicada' }))
    if (imagen) formulario.append('imagen', imagen)

    try {
      const res = await fetch('/api/ofertas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
        body: formulario,
      })
      const data = await res.json()

      if (!res.ok) return data.message ?? 'No se pudo publicar la oferta'

      volverAGestion(MENSAJE_PUBLICADA)
      return null
    } catch {
      return 'No se pudo conectar con el servidor'
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
          <a href="/empleo">Empleo</a>
          <a href="/#perfil">Mi perfil</a>
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
            <a className="gestion-volver" href="/gestionar-ofertas"><span aria-hidden="true">←</span> Volver a mis ofertas</a>
            <h1 className="section-title gestion-titulo">Publicar voluntariado</h1>
          </div>
        </section>

        <FormularioOferta
          titulo="Nueva oferta"
          textoBoton="Publicar oferta"
          textoEnviando="Publicando..."
          urlCancelar="/gestionar-ofertas"
          onEnviar={publicar}
        />
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

export default PublicarOferta
