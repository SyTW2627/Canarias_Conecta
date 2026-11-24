/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla de gamificacion del voluntario: sus retos con su progreso y el ranking
 *          mensual de horas de voluntariado.
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './Oportunidades.css'
import './GestionarOfertas.css'
import './Retos.css'
import type { Usuario } from './Login.tsx'
import MarcoAutenticado from '../components/MarcoAutenticado.tsx'
import { ISLAS, cabecerasConSesion } from '../ofertas.ts'
import {
  formatearHoras,
  mesActual,
  moverMes,
  nombreMes,
  type Logro,
  type RespuestaLogros,
  type RespuestaRanking,
} from '../gamificacion.ts'

type RetosProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

async function pedir<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: cabecerasConSesion(), signal })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar los datos')
  return data as T
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error && !(error instanceof TypeError)
    ? error.message
    : 'No se pudo conectar con el servidor'
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

function TarjetaLogro({ logro }: { logro: Logro }) {
  const porcentaje = Math.round((logro.progreso / logro.objetivo) * 100)

  return (
    <li className={`reto${logro.conseguido ? ' reto-conseguido' : ''}`}>
      <span className="reto-icono" aria-hidden="true">{logro.icono}</span>
      <div className="reto-cuerpo">
        <h3>{logro.nombre}</h3>
        <p>{logro.descripcion}</p>
        {logro.conseguido ? (
          <p className="reto-estado">
            Conseguido{logro.fecha && ` el ${FORMATO_FECHA.format(new Date(logro.fecha))}`}
          </p>
        ) : (
          <>
            <div
              className="reto-barra"
              role="progressbar"
              aria-label={`Progreso de ${logro.nombre}`}
              aria-valuemin={0}
              aria-valuemax={logro.objetivo}
              aria-valuenow={logro.progreso}
            >
              <span style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="reto-estado">
              {logro.progreso} / {logro.objetivo}
              {logro.detalle && ` · ${logro.detalle}`}
            </p>
          </>
        )}
      </div>
    </li>
  )
}

function MisRetos() {
  const [datos, setDatos] = useState<RespuestaLogros | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()
    pedir<RespuestaLogros>('/api/gamificacion/logros', controlador.signal)
      .then(setDatos)
      .catch((errorCarga) => {
        if (!controlador.signal.aborted) setError(mensajeDeError(errorCarga))
      })
    return () => controlador.abort()
  }, [])

  if (!datos) return <p className="empty-state">{error ?? 'Cargando tus retos...'}</p>

  const { metricas, logros, conseguidos } = datos

  return (
    <>
      <ul className="retos-resumen" aria-label="Tu actividad">
        <li><strong>{formatearHoras(metricas.horas)}</strong> de voluntariado</li>
        <li><strong>{metricas.colaboraciones}</strong> colaboraciones</li>
        <li><strong>{metricas.islas}</strong> {metricas.islas === 1 ? 'isla' : 'islas'}</li>
        <li><strong>{conseguidos} / {logros.length}</strong> retos conseguidos</li>
      </ul>
      <ul className="retos-lista">
        {logros.map((logro) => <TarjetaLogro key={logro.id} logro={logro} />)}
      </ul>
    </>
  )
}

function Ranking() {
  const [mes, setMes] = useState(mesActual)
  const [isla, setIsla] = useState('')
  const [datos, setDatos] = useState<RespuestaRanking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const consulta = `mes=${mes}${isla ? `&isla=${isla}` : ''}`

  useEffect(() => {
    const controlador = new AbortController()
    pedir<RespuestaRanking>(`/api/gamificacion/ranking?${consulta}`, controlador.signal)
      .then((respuesta) => {
        setDatos(respuesta)
        setError(null)
      })
      .catch((errorCarga) => {
        if (!controlador.signal.aborted) setError(mensajeDeError(errorCarga))
      })
    return () => controlador.abort()
  }, [consulta])

  // Mientras llega la respuesta del nuevo filtro se mantiene la anterior
  const actual = datos && datos.mes === mes && (datos.isla ?? '') === isla ? datos : null
  const tuFilaVisible = actual?.ranking.some((fila) => fila.eresTu)

  return (
    <>
      <div className="ranking-controles">
        <div className="ranking-mes">
          <button
            type="button"
            className="gestion-accion"
            aria-label="Mes anterior"
            onClick={() => setMes((m) => moverMes(m, -1))}
          >
            ‹
          </button>
          <span aria-live="polite">{nombreMes(mes)}</span>
          <button
            type="button"
            className="gestion-accion"
            aria-label="Mes siguiente"
            onClick={() => setMes((m) => moverMes(m, 1))}
            disabled={mes >= mesActual()}
          >
            ›
          </button>
        </div>
        <label>
          <span>Isla</span>
          <select value={isla} onChange={(e) => setIsla(e.target.value)}>
            <option value="">Todas las islas</option>
            {Object.entries(ISLAS).map(([valor, nombre]) => (
              <option key={valor} value={valor}>{nombre}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="empty-state">{error}</p>}
      {!error && !actual && <p className="empty-state">Cargando el ranking...</p>}
      {actual && actual.ranking.length === 0 && (
        <p className="empty-state">
          Nadie ha completado todavía una colaboración este mes. ¡Puedes ser el primero!
        </p>
      )}

      {actual && actual.ranking.length > 0 && (
        <>
          <ol className="ranking-lista">
            {actual.ranking.map((fila, indice) => (
              <li key={indice} className={fila.eresTu ? 'ranking-tu' : undefined}>
                <span className={`ranking-posicion ranking-posicion-${fila.posicion}`}>{fila.posicion}</span>
                <span className="ranking-nombre">
                  {fila.nombre}
                  {fila.eresTu && <span className="ranking-etiqueta"> (tú)</span>}
                </span>
                <span className="ranking-horas">{formatearHoras(fila.horas)}</span>
                <span className="ranking-colaboraciones">
                  {fila.colaboraciones === 1 ? '1 colaboración' : `${fila.colaboraciones} colaboraciones`}
                </span>
              </li>
            ))}
          </ol>
          <p className="gestion-ayuda">
            {actual.tuPosicion
              ? tuFilaVisible
                ? `Participan ${actual.participantes} voluntarios.`
                : `Vas en el puesto ${actual.tuPosicion.posicion} de ${actual.participantes} con ${formatearHoras(actual.tuPosicion.horas)}.`
              : 'Completa una colaboración este mes para entrar en el ranking.'}
          </p>
        </>
      )}
    </>
  )
}

function Retos({ usuario, onCerrarSesion }: RetosProps) {
  return (
    <MarcoAutenticado usuario={usuario} onCerrarSesion={onCerrarSesion} activa="retos" claseMain="gestion retos">
      <section className="gestion-cabecera">
        <div>
          <p className="eyebrow">Cada colaboración suma</p>
          <h1 className="section-title gestion-titulo">Retos</h1>
        </div>
      </section>

      <section className="gestion-listado" aria-labelledby="retos-titulo">
        <h2 id="retos-titulo">Tus retos</h2>
        <MisRetos />
      </section>

      <section className="gestion-listado" aria-labelledby="ranking-titulo">
        <h2 id="ranking-titulo">Ranking del mes</h2>
        <p className="gestion-ayuda">
          Horas de voluntariado completadas en el mes. Solo se muestra tu nombre y la inicial de tu apellido.
        </p>
        <Ranking />
      </section>
    </MarcoAutenticado>
  )
}

export default Retos
