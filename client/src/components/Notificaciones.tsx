/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Campana de la cabecera con las notificaciones del usuario autenticado.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import './Notificaciones.css'
import { cabecerasConSesion } from '../ofertas.ts'

type Notificacion = {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  enlace: string | null
  leida: boolean
  fecha: string
}

// Cada cuanto se consultan avisos nuevos mientras la pagina esta abierta
const INTERVALO_MS = 60_000

const FORMATO_RELATIVO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

function haceCuanto(fecha: string): string {
  const segundos = Math.round((new Date(fecha).getTime() - Date.now()) / 1000)
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unidad, tamano] of unidades) {
    if (Math.abs(segundos) >= tamano) return FORMATO_RELATIVO.format(Math.round(segundos / tamano), unidad)
  }
  return 'ahora mismo'
}

async function obtenerNotificaciones(
  signal?: AbortSignal,
): Promise<{ notificaciones: Notificacion[]; noLeidas: number }> {
  const res = await fetch('/api/notificaciones', { headers: cabecerasConSesion(), signal })
  if (!res.ok) throw new Error('No se pudieron cargar las notificaciones')
  return res.json()
}

function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  const cargar = useCallback((signal?: AbortSignal) => {
    obtenerNotificaciones(signal)
      .then((data) => {
        setNotificaciones(data.notificaciones)
        setNoLeidas(data.noLeidas)
        setError(false)
      })
      .catch(() => {
        if (!signal?.aborted) setError(true)
      })
  }, [])

  // Se consulta al montar, cada minuto y al volver a la pestaña
  useEffect(() => {
    const controlador = new AbortController()
    const actualizar = () => cargar(controlador.signal)
    const primeraCarga = window.setTimeout(actualizar, 0)
    const intervalo = window.setInterval(actualizar, INTERVALO_MS)
    const alVolver = () => {
      if (document.visibilityState === 'visible') actualizar()
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      controlador.abort()
      window.clearTimeout(primeraCarga)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [cargar])

  // Cierra el panel al pulsar fuera o con Escape
  useEffect(() => {
    if (!abierto) return

    function alPulsar(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false)
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', alPulsar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alPulsar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  function alternar() {
    if (!abierto) cargar()
    setAbierto(!abierto)
  }

  // Se marca en pantalla al momento; si la peticion falla, la siguiente carga lo corrige
  function marcarLeida(notificacion: Notificacion) {
    setAbierto(false)
    if (notificacion.leida) return

    setNotificaciones((lista) =>
      lista.map((otra) => (otra.id === notificacion.id ? { ...otra, leida: true } : otra)),
    )
    setNoLeidas((n) => Math.max(0, n - 1))
    fetch(`/api/notificaciones/${encodeURIComponent(notificacion.id)}/leida`, {
      method: 'PATCH',
      headers: cabecerasConSesion(),
    }).catch(() => {})
  }

  async function marcarTodas() {
    setNotificaciones((lista) => lista.map((notificacion) => ({ ...notificacion, leida: true })))
    setNoLeidas(0)
    await fetch('/api/notificaciones/leidas', {
      method: 'PATCH',
      headers: cabecerasConSesion(),
    }).catch(() => {})
  }

  return (
    <div className="notificaciones" ref={contenedor}>
      <button
        type="button"
        className="notificaciones-boton"
        onClick={alternar}
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-label={
          noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'
        }
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"
            fill="currentColor"
          />
        </svg>
        {noLeidas > 0 && (
          <span className="notificaciones-contador">{noLeidas > 9 ? '9+' : noLeidas}</span>
        )}
      </button>

      {abierto && (
        <div className="notificaciones-panel" role="region" aria-label="Notificaciones">
          <div className="notificaciones-cabecera">
            <strong>Notificaciones</strong>
            {noLeidas > 0 && (
              <button type="button" className="notificaciones-todas" onClick={marcarTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {error && notificaciones.length === 0 ? (
            <p className="notificaciones-vacio">No se pudieron cargar las notificaciones.</p>
          ) : notificaciones.length === 0 ? (
            <p className="notificaciones-vacio">No tienes notificaciones.</p>
          ) : (
            <ul className="notificaciones-lista">
              {notificaciones.map((notificacion) => {
                const contenido = (
                  <>
                    <strong>{notificacion.titulo}</strong>
                    <span>{notificacion.mensaje}</span>
                    <time dateTime={notificacion.fecha}>{haceCuanto(notificacion.fecha)}</time>
                  </>
                )
                const clase = notificacion.leida
                  ? 'notificaciones-item'
                  : 'notificaciones-item no-leida'

                return (
                  <li key={notificacion.id}>
                    {notificacion.enlace ? (
                      <a
                        className={clase}
                        href={notificacion.enlace}
                        onClick={() => marcarLeida(notificacion)}
                      >
                        {contenido}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={clase}
                        onClick={() => marcarLeida(notificacion)}
                      >
                        {contenido}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default Notificaciones
