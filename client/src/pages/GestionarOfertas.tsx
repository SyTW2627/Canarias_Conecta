/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla del ofertante para publicar ofertas y ver las que ya ha publicado.
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './GestionarOfertas.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import FormularioOferta, { type EnvioOferta } from '../components/FormularioOferta.tsx'
import {
  ISLAS,
  MODALIDADES,
  cabecerasConSesion,
  esTurnoProximo,
  formatearFecha,
  type MiOferta,
} from '../ofertas.ts'

type GestionarOfertasProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

const ESTADOS: Record<MiOferta['estado'], string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
}

// Una oferta publicada cuyos turnos ya pasaron se muestra como finalizada
function textoEstado(oferta: MiOferta): string {
  return oferta.estado === 'publicada' && oferta.terminada ? 'Finalizada' : ESTADOS[oferta.estado]
}

function GestionarOfertas({ usuario, onCerrarSesion }: GestionarOfertasProps) {
  const [misOfertas, setMisOfertas] = useState<MiOferta[] | null>(null)
  const [errorListado, setErrorListado] = useState<string | null>(null)
  const [recargas, setRecargas] = useState(0)

  // Cambiar la clave vacia el formulario tras publicar
  const [claveFormulario, setClaveFormulario] = useState(0)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [ofertaEnCurso, setOfertaEnCurso] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  // Se repite tras publicar, para que la nueva oferta aparezca en el listado
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarMisOfertas() {
      try {
        const res = await fetch('/api/ofertas/mias', {
          headers: cabecerasConSesion(),
          signal: controlador.signal,
        })
        const data = await res.json()

        if (!res.ok) {
          setErrorListado(data.message ?? 'No se pudieron cargar tus ofertas')
          return
        }

        setErrorListado(null)
        setMisOfertas(data)
      } catch {
        if (!controlador.signal.aborted) {
          setErrorListado('No se pudo conectar con el servidor')
        }
      }
    }

    cargarMisOfertas()
    return () => controlador.abort()
  }, [recargas])

  // Cerrar y eliminar comparten el mismo flujo: confirmar, llamar a la API y recargar el listado
  async function ejecutarAccion(oferta: MiOferta, accion: 'cerrar' | 'eliminar') {
    const pregunta =
      accion === 'cerrar'
        ? `¿Cerrar "${oferta.titulo}"? Los voluntarios dejarán de verla y no podrás volver a abrirla.`
        : `¿Eliminar "${oferta.titulo}"? Se borrará definitivamente.`
    if (!window.confirm(pregunta)) return

    setErrorAccion(null)
    setOfertaEnCurso(oferta.id)

    try {
      const res = await fetch(
        accion === 'cerrar'
          ? `/api/ofertas/${encodeURIComponent(oferta.id)}/cerrar`
          : `/api/ofertas/${encodeURIComponent(oferta.id)}`,
        { method: accion === 'cerrar' ? 'PATCH' : 'DELETE', headers: cabecerasConSesion() },
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorAccion(
          data.message ?? `No se pudo ${accion === 'cerrar' ? 'cerrar' : 'eliminar'} la oferta`,
        )
      }
      // Incluso si falla se recarga: la oferta puede haber cambiado de estado mientras tanto
      setRecargas((n) => n + 1)
    } catch {
      setErrorAccion('No se pudo conectar con el servidor')
    } finally {
      setOfertaEnCurso(null)
    }
  }

  async function publicar({ cuerpo, imagen }: EnvioOferta): Promise<string | null> {
    setMensajeExito(null)

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

      setClaveFormulario((n) => n + 1)
      setMensajeExito('Oferta publicada. Los voluntarios ya pueden verla.')
      setRecargas((n) => n + 1)
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
        <section className="welcome-section">
          <p className="eyebrow">Panel del ofertante</p>
          <h1>Gestionar ofertas</h1>
          <p>Publica nuevas oportunidades de voluntariado y consulta las que ya has creado.</p>
        </section>

        <div className="gestion-grid">
          <FormularioOferta
            key={claveFormulario}
            titulo="Publicar una oferta"
            textoBoton="Publicar oferta"
            textoEnviando="Publicando..."
            mensajeExito={mensajeExito}
            onEnviar={publicar}
          />

          <section className="gestion-bloque">
            <h2>Mis ofertas</h2>

            {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}
            {errorListado && <p className="empty-state">{errorListado}</p>}
            {!errorListado && misOfertas === null && <p className="empty-state">Cargando tus ofertas...</p>}
            {misOfertas?.length === 0 && (
              <p className="empty-state">Todavía no has publicado ninguna oferta.</p>
            )}

            {misOfertas && misOfertas.length > 0 && (
              <ul className="gestion-lista">
                {misOfertas.map((oferta) => {
                  const proximos = oferta.turnos
                    .filter(esTurnoProximo)
                    .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  const plazas = oferta.turnos.reduce((total, t) => total + t.plazas, 0)
                  const libres = oferta.turnos.reduce((total, t) => total + t.plazasLibres, 0)

                  return (
                    <li key={oferta.id}>
                      <div className="gestion-lista-cabecera">
                        <h3>{oferta.titulo}</h3>
                        <span
                          className={`gestion-estado gestion-estado-${
                            oferta.estado === 'publicada' && oferta.terminada ? 'finalizada' : oferta.estado
                          }`}
                        >
                          {textoEstado(oferta)}
                        </span>
                      </div>
                      <p>
                        {oferta.ubicacion
                          ? `${oferta.ubicacion.municipio}, ${ISLAS[oferta.ubicacion.isla]}`
                          : MODALIDADES[oferta.modalidad]}
                        {' · '}
                        {oferta.categorias.map((c) => c.nombre).join(', ')}
                      </p>
                      <p>
                        {proximos.length > 0
                          ? `Próximo turno: ${formatearFecha(proximos[0].fecha)}`
                          : 'Sin turnos próximos'}
                        {' · '}
                        {plazas - libres} de {plazas} plazas ocupadas
                      </p>
                      <div className="gestion-acciones">
                        <a
                          className="gestion-accion"
                          href={`/gestionar-ofertas/${oferta.id}/candidatos`}
                        >
                          Ver candidatos
                          {oferta.candidatosPendientes > 0 && (
                            <span className="gestion-pendientes">
                              {oferta.candidatosPendientes} pendiente
                              {oferta.candidatosPendientes === 1 ? '' : 's'}
                            </span>
                          )}
                        </a>
                        {oferta.estado === 'publicada' && !oferta.terminada && (
                          <>
                            <a className="text-link" href={`/ofertas/${oferta.id}`}>
                              Ver como voluntario
                            </a>
                            <a
                              className="gestion-accion"
                              href={`/gestionar-ofertas/${oferta.id}/editar`}
                            >
                              Editar
                            </a>
                          </>
                        )}
                        {['borrador', 'publicada'].includes(oferta.estado) && !oferta.terminada && (
                          <button
                            type="button"
                            className="gestion-accion"
                            onClick={() => ejecutarAccion(oferta, 'cerrar')}
                            disabled={ofertaEnCurso !== null}
                          >
                            {ofertaEnCurso === oferta.id ? 'Cerrando...' : 'Cerrar oferta'}
                          </button>
                        )}
                        {oferta.terminada && (
                          <button
                            type="button"
                            className="gestion-accion gestion-accion-peligro"
                            onClick={() => ejecutarAccion(oferta, 'eliminar')}
                            disabled={ofertaEnCurso !== null}
                          >
                            {ofertaEnCurso === oferta.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
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

export default GestionarOfertas
