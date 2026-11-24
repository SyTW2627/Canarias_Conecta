/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla del ofertante para editar una de sus ofertas mientras esta activa.
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './GestionarOfertas.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import FormularioOferta, { type EnvioOferta } from '../components/FormularioOferta.tsx'
import { cabecerasConSesion, esTurnoProximo, formatearFecha, type MiOferta } from '../ofertas.ts'

type EditarOfertaProps = {
  ofertaId: string
  usuario: Usuario
  onCerrarSesion: () => void
}

// Vuelve al listado sin recargar: App escucha popstate para cambiar de pantalla
function volverAGestion() {
  window.history.pushState(null, '', '/gestionar-ofertas')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function EditarOferta({ ofertaId, usuario, onCerrarSesion }: EditarOfertaProps) {
  const [oferta, setOferta] = useState<MiOferta | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()

    async function cargarOferta() {
      try {
        const res = await fetch(`/api/ofertas/mias/${encodeURIComponent(ofertaId)}`, {
          headers: cabecerasConSesion(),
          signal: controlador.signal,
        })
        const data = await res.json()

        if (!res.ok) {
          setErrorCarga(data.message ?? 'No se pudo cargar la oferta')
          return
        }

        setOferta(data)
      } catch {
        if (!controlador.signal.aborted) setErrorCarga('No se pudo conectar con el servidor')
      }
    }

    cargarOferta()
    return () => controlador.abort()
  }, [ofertaId])

  async function guardar({ cuerpo, imagen, quitarImagen }: EnvioOferta): Promise<string | null> {
    const formulario = new FormData()
    formulario.append('datos', JSON.stringify({ ...cuerpo, quitarImagen }))
    if (imagen) formulario.append('imagen', imagen)

    try {
      const res = await fetch(`/api/ofertas/${encodeURIComponent(ofertaId)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
        body: formulario,
      })
      const data = await res.json()

      if (!res.ok) return data.message ?? 'No se pudieron guardar los cambios'

      volverAGestion()
      return null
    } catch {
      return 'No se pudo conectar con el servidor'
    }
  }

  const editable = oferta && oferta.estado === 'publicada' && !oferta.terminada
  const turnosPasados = oferta?.turnos.filter((turno) => !esTurnoProximo(turno)) ?? []

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
            <h1 className="section-title gestion-titulo">Editar oferta</h1>
          </div>
        </section>

        <div className="gestion-edicion">
          {errorCarga && <p className="gestion-error" role="alert">{errorCarga}</p>}
          {!errorCarga && !oferta && <p className="empty-state">Cargando la oferta...</p>}
          {oferta && !editable && (
            <p className="gestion-error" role="alert">
              Solo se pueden editar las ofertas publicadas que no han terminado.
            </p>
          )}

          {editable && (
            <>
              {turnosPasados.length > 0 && (
                <section className="gestion-bloque gestion-pasados">
                  <h2>Turnos ya realizados</h2>
                  <p className="gestion-ayuda">Estos turnos ya han pasado y no se pueden modificar.</p>
                  <ul className="gestion-turnos-pasados">
                    {turnosPasados.map((turno) => (
                      <li key={turno.id}>
                        {formatearFecha(turno.fecha)}, de {turno.horaInicio} a {turno.horaFin}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <FormularioOferta
                titulo={oferta.titulo}
                textoBoton="Guardar cambios"
                textoEnviando="Guardando..."
                oferta={oferta}
                onEnviar={guardar}
              />
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

export default EditarOferta
