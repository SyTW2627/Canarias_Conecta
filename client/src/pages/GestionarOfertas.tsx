/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla del ofertante con el listado de sus ofertas y el acceso a publicar una nueva.
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './GestionarOfertas.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import {
  ISLAS,
  MODALIDADES,
  cabecerasConSesion,
  esTurnoProximo,
  estaCompleta,
  formatearFecha,
  imagenDeOferta,
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
// Finalizada y completa se calculan a partir de los turnos: no son estados guardados
function estadoVisible(oferta: MiOferta): { clase: string; texto: string } {
  if (oferta.estado === 'publicada' && oferta.terminada) {
    return { clase: 'finalizada', texto: 'Finalizada' }
  }
  if (oferta.estado === 'publicada' && estaCompleta(oferta)) {
    return { clase: 'completa', texto: 'Completa' }
  }
  return { clase: oferta.estado, texto: ESTADOS[oferta.estado] }
}

function GestionarOfertas({ usuario, onCerrarSesion }: GestionarOfertasProps) {
  const [misOfertas, setMisOfertas] = useState<MiOferta[] | null>(null)
  const [errorListado, setErrorListado] = useState<string | null>(null)
  const [recargas, setRecargas] = useState(0)

  // Al volver de publicar, el mensaje llega en el estado del historial
  const [mensajeExito, setMensajeExito] = useState<string | null>(
    () => (window.history.state as { mensajeExito?: string } | null)?.mensajeExito ?? null,
  )
  const [ofertaEnCurso, setOfertaEnCurso] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  // Se quita del historial para que no vuelva a salir al recargar
  useEffect(() => {
    if (mensajeExito) window.history.replaceState(null, '', window.location.href)
  }, [mensajeExito])

  // Se repite tras cerrar o eliminar una oferta
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
          <h1 className="section-title gestion-titulo">Gestionar ofertas</h1>
          <a className="btn gestion-publicar" href="/gestionar-ofertas/nueva">
            <span aria-hidden="true">+</span> Publicar voluntariado
          </a>
        </section>

        {mensajeExito && (
          <p className="gestion-exito gestion-aviso" role="status">
            {mensajeExito}
            <button
              type="button"
              className="gestion-aviso-cerrar"
              aria-label="Cerrar aviso"
              onClick={() => setMensajeExito(null)}
            >
              ×
            </button>
          </p>
        )}

        <section className="gestion-listado">
          <div className="gestion-listado-cabecera">
            <h2>Mis ofertas</h2>
            {misOfertas && misOfertas.length > 0 && (
              <span className="gestion-contador">
                {misOfertas.length} {misOfertas.length === 1 ? 'oferta' : 'ofertas'}
              </span>
            )}
          </div>

          {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}
          {errorListado && <p className="empty-state">{errorListado}</p>}
          {!errorListado && misOfertas === null && <p className="empty-state">Cargando tus ofertas...</p>}
          {misOfertas?.length === 0 && (
            <div className="gestion-vacio">
              <p className="empty-state">Todavía no has publicado ninguna oferta.</p>
              <a className="btn" href="/gestionar-ofertas/nueva">Publicar mi primer voluntariado</a>
            </div>
          )}

          {misOfertas && misOfertas.length > 0 && (
            <ul className="gestion-lista">
              {misOfertas.map((oferta) => {
                const proximos = oferta.turnos
                  .filter(esTurnoProximo)
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                const plazas = oferta.turnos.reduce((total, t) => total + t.plazas, 0)
                const libres = oferta.turnos.reduce((total, t) => total + t.plazasLibres, 0)
                const ocupadas = plazas - libres
                const estado = estadoVisible(oferta)
                const activa = oferta.estado === 'publicada' && !oferta.terminada

                return (
                  <li key={oferta.id} className={activa ? undefined : 'gestion-tarjeta-inactiva'}>
                    <div className="gestion-tarjeta-imagen">
                      <img src={imagenDeOferta(oferta)} alt="" />
                      <span className={`gestion-estado gestion-estado-${estado.clase}`}>
                        {estado.texto}
                      </span>
                    </div>

                    <div className="gestion-tarjeta-cuerpo">
                      <h3>{oferta.titulo}</h3>
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
                      </p>

                      <div className="gestion-plazas">
                        <p>{ocupadas} de {plazas} plazas ocupadas</p>
                        <div className="gestion-plazas-barra" aria-hidden="true">
                          <span style={{ width: `${plazas > 0 ? (ocupadas / plazas) * 100 : 0}%` }} />
                        </div>
                      </div>

                      <div className="gestion-acciones">
                        <a
                          className="gestion-accion gestion-accion-principal"
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
                        {activa && (
                          <>
                            <a
                              className="gestion-accion"
                              href={`/gestionar-ofertas/${oferta.id}/recomendados`}
                            >
                              Voluntarios recomendados
                            </a>
                            <a
                              className="gestion-accion"
                              href={`/gestionar-ofertas/${oferta.id}/editar`}
                            >
                              Editar
                            </a>
                            <a className="text-link" href={`/ofertas/${oferta.id}`}>
                              Ver como voluntario
                            </a>
                          </>
                        )}
                      </div>

                      <div className="gestion-acciones gestion-acciones-secundarias">
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
                        <button
                          type="button"
                          className="gestion-accion gestion-accion-peligro"
                          onClick={() => ejecutarAccion(oferta, 'eliminar')}
                          disabled={ofertaEnCurso !== null}
                        >
                          {ofertaEnCurso === oferta.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
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

export default GestionarOfertas
