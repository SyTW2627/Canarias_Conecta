/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Seccion "Recomendado para ti" del inicio del voluntario. Muestra las ofertas que
 * recomienda el servidor segun los intereses de su perfil, su isla y su historial, con el
 * porcentaje de afinidad y el motivo de cada una.
 *   GET /api/ofertas/recomendadas -> recomendaciones con afinidad y motivos
 */
import { useEffect, useState } from 'react'
import './Recomendaciones.css'
import type { Usuario } from '../pages/Login.tsx'
import {
  cabecerasConSesion,
  esTurnoProximo,
  formatearFecha,
  imagenDeOferta,
  type Oferta,
} from '../ofertas.ts'

type Motivo = { tipo: 'interes' | 'isla' | 'online' | 'historial'; texto: string }

export type Recomendacion = { oferta: Oferta; afinidad: number; motivos: Motivo[] }

type RespuestaRecomendaciones = {
  intereses: { id: string; nombre: string }[]
  recomendaciones: Recomendacion[]
}

const ICONOS_MOTIVO: Record<Motivo['tipo'], string> = {
  interes: '🏷️',
  isla: '📍',
  online: '💻',
  historial: '🔁',
}

function useRecomendaciones() {
  const [datos, setDatos] = useState<RespuestaRecomendaciones | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()
    fetch('/api/ofertas/recomendadas', { headers: cabecerasConSesion(), signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar las recomendaciones')
        setDatos(data)
        setError(null)
      })
      .catch((error: unknown) => {
        if (controlador.signal.aborted) return
        setError(
          error instanceof SyntaxError || error instanceof TypeError
            ? 'No se pudo conectar con el servidor'
            : error instanceof Error
              ? error.message
              : 'No se pudieron cargar las recomendaciones',
        )
      })
    return () => controlador.abort()
  }, [])

  return { datos, error }
}

function proximaFecha(oferta: Oferta): string | null {
  const turno = oferta.turnos.filter(esTurnoProximo).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
  return turno ? `${formatearFecha(turno.fecha)}, ${turno.horaInicio}` : null
}

function lugar(oferta: Oferta): string {
  return oferta.ubicacion ? oferta.ubicacion.municipio : 'Online'
}

function Recomendaciones({ usuario }: { usuario: Usuario }) {
  const { datos, error } = useRecomendaciones()
  const primerNombre = usuario.nombre.trim().split(/\s+/)[0] || usuario.nombre
  const sinIntereses = datos !== null && datos.intereses.length === 0

  return (
    <section className="reco" aria-labelledby="reco-titulo">
      <h2 id="reco-titulo" className="inicio-titulo">
        Recomendado para ti, {primerNombre}
      </h2>
      <div className="inicio-subrayado" />

      {/* Intereses del perfil que usa el sistema para recomendar */}
      {datos && !sinIntereses && (
        <p className="reco-segun">
          Según tus intereses:{' '}
          {datos.intereses.map((interes) => (
            <span key={interes.id} className="reco-interes">
              {interes.nombre}
            </span>
          ))}
        </p>
      )}

      {error && <p className="empty-state">{error}</p>}
      {!error && datos === null && <p className="empty-state">Buscando voluntariados para ti…</p>}

      {sinIntereses && (
        <div className="inicio-vacio">
          <h4>Aún no sabemos qué te gusta</h4>
          <p>
            Añade tus intereses en <a href="/perfil">tu perfil</a> y te recomendaremos voluntariados a tu medida.
          </p>
        </div>
      )}

      {datos && !sinIntereses && datos.recomendaciones.length === 0 && (
        <div className="inicio-vacio">
          <h4>Ahora mismo no hay voluntariados que encajen contigo</h4>
          <p>
            Prueba a añadir más intereses en <a href="/perfil">tu perfil</a> o mira{' '}
            <a href="/oportunidades">todas las oportunidades</a>.
          </p>
        </div>
      )}

      {datos && !sinIntereses && datos.recomendaciones.length > 0 && (
        <ul className="reco-lista">
          {datos.recomendaciones.map(({ oferta, afinidad, motivos }) => {
            const fecha = proximaFecha(oferta)
            return (
              <li key={oferta.id} className="reco-tarjeta">
                <div className="reco-imagen">
                  <img src={imagenDeOferta(oferta)} alt="" />
                  <span
                    className={`reco-afinidad${afinidad >= 75 ? ' reco-afinidad-alta' : ''}`}
                    title="Cuánto encaja con tu perfil"
                  >
                    {afinidad}% afín
                  </span>
                </div>
                <div className="reco-cuerpo">
                  <p className="reco-org">{oferta.organizacion}</p>
                  <h3>{oferta.titulo}</h3>
                  <p className="reco-dato">
                    {lugar(oferta)}
                    {fecha && ` · ${fecha}`}
                  </p>
                  <div className="reco-barra" aria-hidden="true">
                    <div style={{ width: `${afinidad}%` }} />
                  </div>
                  <p className="reco-porque">¿Por qué te la recomendamos?</p>
                  <ul className="reco-motivos">
                    {motivos.map((motivo) => (
                      <li key={motivo.tipo}>
                        <span aria-hidden="true">{ICONOS_MOTIVO[motivo.tipo]}</span> {motivo.texto}
                      </li>
                    ))}
                  </ul>
                  <a className="inicio-boton reco-ver" href={`/ofertas/${oferta.id}`}>
                    Ver detalles
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default Recomendaciones
