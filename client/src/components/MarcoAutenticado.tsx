/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Cabecera con la navegacion y pie comunes a las pantallas con sesion iniciada.
 */
import type { ReactNode } from 'react'
import '../pages/HomePage.css'
import type { Usuario } from '../pages/Login.tsx'
import Notificaciones from './Notificaciones.tsx'

type Seccion = 'inicio' | 'oportunidades' | 'inscripciones' | 'empleo' | 'perfil' | 'gestion'

type MarcoAutenticadoProps = {
  usuario: Usuario
  onCerrarSesion: () => void
  activa: Seccion
  claseMain?: string
  children: ReactNode
}

function MarcoAutenticado({ usuario, onCerrarSesion, activa, claseMain, children }: MarcoAutenticadoProps) {
  const esVoluntario = usuario.rol === 'voluntario'
  const actual = (seccion: Seccion) => (seccion === activa ? 'page' : undefined)

  return (
    <div className="authenticated-home">
      <header className="nav authenticated-nav">
        <div className="brand">
          <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
          <span className="logo">Canarias Conecta</span>
        </div>

        <nav className="authenticated-links" aria-label="Navegación principal">
          <a href="/" aria-current={actual('inicio')}>Inicio</a>
          {esVoluntario && (
            <a href="/oportunidades" aria-current={actual('oportunidades')}>Oportunidades</a>
          )}
          {esVoluntario && (
            <a href="/mis_inscripciones" aria-current={actual('inscripciones')}>Mis inscripciones</a>
          )}
          <a href="/empleo" aria-current={actual('empleo')}>Empleo</a>
          <a href="/perfil" aria-current={actual('perfil')}>Mi perfil</a>
          {!esVoluntario && (
            <a href="/gestionar-ofertas" aria-current={actual('gestion')}>Gestionar ofertas</a>
          )}
        </nav>

        <div className="authenticated-user">
          <Notificaciones />
          <span>Hola, {usuario.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className={`authenticated-main${claseMain ? ` ${claseMain}` : ''}`}>{children}</main>

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
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default MarcoAutenticado
