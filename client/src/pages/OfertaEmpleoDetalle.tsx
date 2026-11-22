/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Detalle de una oferta de empleo. El voluntario se postula; la entidad que la
 *          publico revisa las candidaturas y preselecciona o descarta a cada candidato.
 */
import { useEffect, useState } from 'react'
import './HomePage.css'
import './OfertaDetalle.css'
import './GestionarOfertas.css'
import './Empleo.css'
import type { Usuario } from './Login.tsx'
import MarcoAutenticado from '../components/MarcoAutenticado.tsx'
import { ISLAS, cabecerasConSesion } from '../ofertas.ts'
import {
  ESTADOS_CANDIDATURA,
  JORNADAS,
  TIPOS_CONTRATO,
  formatearDia,
  formatearFechaCorta,
  lugarDeEmpleo,
  type CandidaturaRecibida,
  type MiCandidatura,
  type MiOfertaEmpleo,
  type OfertaEmpleo,
} from '../empleo.ts'

type OfertaEmpleoDetalleProps = {
  ofertaId: string
  usuario: Usuario
  onCerrarSesion: () => void
}

const MENSAJE_MAX = 2000

async function pedir<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...opciones, headers: cabecerasConSesion() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.message ?? 'No se pudo completar la acción'), {
    status: res.status,
  })
  return data as T
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error && !(error instanceof TypeError)
    ? error.message
    : 'No se pudo conectar con el servidor'
}

function DatosOferta({ oferta }: { oferta: OfertaEmpleo }) {
  return (
    <>
      <article className="oferta-cabecera sin-imagen">
        <div className="opportunity-content">
          <p className="opportunity-organization">{oferta.organizacion}</p>
          <h1>{oferta.titulo}</h1>
          {oferta.categorias.length > 0 && (
            <ul className="oferta-categorias">
              {oferta.categorias.map((categoria) => (
                <li key={categoria.id} className="tag">{categoria.nombre}</li>
              ))}
            </ul>
          )}
          <dl>
            <div><dt>Contrato</dt><dd>{TIPOS_CONTRATO[oferta.tipoContrato] ?? oferta.tipoContrato}</dd></div>
            <div><dt>Jornada</dt><dd>{JORNADAS[oferta.jornada] ?? oferta.jornada}</dd></div>
            <div><dt>Lugar</dt><dd>{lugarDeEmpleo(oferta)}</dd></div>
            {oferta.salario && <div><dt>Salario</dt><dd>{oferta.salario}</dd></div>}
            <div><dt>Vacantes</dt><dd>{oferta.vacantes}</dd></div>
            <div>
              <dt>Plazo</dt>
              <dd>
                {oferta.fechaLimite ? `Hasta el ${formatearFechaCorta(oferta.fechaLimite)}` : 'Abierto'}
              </dd>
            </div>
          </dl>
        </div>
      </article>

      <section className="oferta-bloque">
        <h2>Sobre el puesto</h2>
        <p className="empleo-texto">{oferta.descripcion}</p>
        {oferta.requisitos && (
          <>
            <h2>Requisitos</h2>
            <p className="empleo-texto">{oferta.requisitos}</p>
          </>
        )}
      </section>
    </>
  )
}

// Voluntario: ve la oferta y se postula, o el estado de su candidatura si ya lo hizo
function VistaCandidato({ ofertaId }: { ofertaId: string }) {
  const [oferta, setOferta] = useState<OfertaEmpleo | null>(null)
  const [candidatura, setCandidatura] = useState<MiCandidatura | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    Promise.all([
      pedir<OfertaEmpleo>(`/api/empleo/${encodeURIComponent(ofertaId)}`),
      pedir<MiCandidatura[]>('/api/empleo/candidaturas/mias').catch(() => []),
    ])
      .then(([datosOferta, mias]) => {
        if (cancelado) return
        setOferta(datosOferta)
        // Una retirada no cuenta: puede volver a postularse
        setCandidatura(
          mias.find((otra) => otra.ofertaId === ofertaId && otra.estado !== 'retirada') ?? null,
        )
      })
      .catch((errorCarga) => !cancelado && setError(mensajeDeError(errorCarga)))
    return () => {
      cancelado = true
    }
  }, [ofertaId])

  async function postularse() {
    setEnviando(true)
    setAviso(null)
    try {
      const creada = await pedir<{ id: string; estado: MiCandidatura['estado'] }>(
        `/api/empleo/${encodeURIComponent(ofertaId)}/candidaturas`,
        { method: 'POST', body: JSON.stringify({ mensaje: mensaje.trim() || undefined }) },
      )
      setCandidatura({
        id: creada.id,
        estado: creada.estado,
        fechaCandidatura: new Date().toISOString(),
        ofertaId,
        titulo: oferta?.titulo ?? '',
        organizacion: oferta?.organizacion ?? '',
        tipoContrato: oferta?.tipoContrato ?? '',
        jornada: oferta?.jornada ?? '',
        modalidad: oferta?.modalidad ?? '',
        ubicacion: oferta?.ubicacion ?? null,
        ofertaAbierta: true,
      })
      setAviso('Candidatura enviada. La entidad verá tu perfil y tu trayectoria de voluntariado.')
    } catch (errorEnvio) {
      setAviso(mensajeDeError(errorEnvio))
    } finally {
      setEnviando(false)
    }
  }

  if (error) return <p className="empty-state">{error}</p>
  if (!oferta) return <p className="empty-state">Cargando la oferta de empleo...</p>

  return (
    <>
      <DatosOferta oferta={oferta} />

      <section className="oferta-bloque empleo-postulacion">
        <h2>Tu candidatura</h2>
        {candidatura ? (
          <p>
            Te postulaste el {formatearDia(candidatura.fechaCandidatura)}. Estado:{' '}
            <span className={`empleo-estado empleo-estado-${candidatura.estado}`}>
              {ESTADOS_CANDIDATURA[candidatura.estado]}
            </span>
          </p>
        ) : !oferta.abierta ? (
          <p>El plazo para presentar candidaturas ha terminado.</p>
        ) : (
          <>
            <p className="gestion-ayuda">
              La entidad verá tu perfil: horas de voluntariado, colaboraciones, valoraciones y
              acreditaciones. Tu email y teléfono solo se comparten si te preselecciona.
            </p>
            <label className="empleo-campo">
              <span>Mensaje para la entidad (opcional)</span>
              <textarea
                value={mensaje}
                maxLength={MENSAJE_MAX}
                rows={5}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Cuéntales por qué te interesa el puesto..."
              />
            </label>
            <button type="button" className="btn" onClick={postularse} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Postularme'}
            </button>
          </>
        )}
        {aviso && <p className="oferta-inscripcion-mensaje" role="status">{aviso}</p>}
        <p>
          <a className="text-link" href="/empleo">Ver mis candidaturas</a>
        </p>
      </section>
    </>
  )
}

function TarjetaCandidatura({
  candidatura,
  ocupada,
  onDecidir,
}: {
  candidatura: CandidaturaRecibida
  ocupada: boolean
  onDecidir: (estado: 'preseleccionada' | 'descartada') => void
}) {
  const { candidato } = candidatura
  const { estadisticas } = candidato

  return (
    <li className="empleo-candidatura">
      <div className="empleo-candidatura-cabecera">
        <div>
          <h3>{candidato.nombre}</h3>
          <p className="empleo-detalle-linea">
            {[candidato.municipio, candidato.isla && (ISLAS[candidato.isla] ?? candidato.isla)].filter(Boolean).join(', ') || 'Sin ubicación'}
            {' · '}Se postuló el {formatearDia(candidatura.fechaCandidatura)}
          </p>
        </div>
        <span className={`empleo-estado empleo-estado-${candidatura.estado}`}>
          {ESTADOS_CANDIDATURA[candidatura.estado]}
        </span>
      </div>

      <ul className="empleo-estadisticas" aria-label="Trayectoria de voluntariado">
        <li><strong>{estadisticas.horasTotales}</strong> h de voluntariado</li>
        <li><strong>{estadisticas.colaboraciones}</strong> colaboraciones</li>
        <li>
          {estadisticas.numValoraciones > 0 ? (
            <><strong>{estadisticas.valoracionMedia.toFixed(1).replace('.', ',')}</strong> / 5 en {estadisticas.numValoraciones} valoraciones</>
          ) : (
            'Sin valoraciones'
          )}
        </li>
      </ul>

      {candidato.biografia && <p className="empleo-texto">{candidato.biografia}</p>}
      {candidatura.mensaje && (
        <blockquote className="empleo-mensaje">{candidatura.mensaje}</blockquote>
      )}

      <dl className="empleo-perfil">
        {candidato.habilidades.length > 0 && (
          <div><dt>Habilidades</dt><dd>{candidato.habilidades.join(', ')}</dd></div>
        )}
        {candidato.idiomas.length > 0 && (
          <div><dt>Idiomas</dt><dd>{candidato.idiomas.join(', ')}</dd></div>
        )}
        {candidato.intereses.length > 0 && (
          <div><dt>Intereses</dt><dd>{candidato.intereses.map((i) => i.nombre).join(', ')}</dd></div>
        )}
        {candidato.acreditaciones.length > 0 && (
          <div>
            <dt>Acreditaciones</dt>
            <dd>{candidato.acreditaciones.map((a) => a.nombre).join(', ')}</dd>
          </div>
        )}
        {candidato.email && <div><dt>Email</dt><dd><a href={`mailto:${candidato.email}`}>{candidato.email}</a></dd></div>}
        {candidato.telefono && <div><dt>Teléfono</dt><dd>{candidato.telefono}</dd></div>}
      </dl>

      {candidatura.estado !== 'descartada' && (
        <div className="gestion-acciones">
          {candidatura.estado === 'pendiente' && (
            <button
              type="button"
              className="gestion-accion gestion-accion-principal"
              onClick={() => onDecidir('preseleccionada')}
              disabled={ocupada}
            >
              Preseleccionar
            </button>
          )}
          <button
            type="button"
            className="gestion-accion gestion-accion-peligro"
            onClick={() => onDecidir('descartada')}
            disabled={ocupada}
          >
            Descartar
          </button>
        </div>
      )}
    </li>
  )
}

type DatosEntidad = {
  oferta: MiOfertaEmpleo
  candidaturas: CandidaturaRecibida[]
}

// Entidad: si la oferta es suya ve las candidaturas; si no, solo la oferta
function VistaEntidad({ ofertaId }: { ofertaId: string }) {
  const [datos, setDatos] = useState<DatosEntidad | null>(null)
  const [ajena, setAjena] = useState<OfertaEmpleo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [recargas, setRecargas] = useState(0)

  useEffect(() => {
    let cancelado = false
    pedir<DatosEntidad>(`/api/empleo/${encodeURIComponent(ofertaId)}/candidaturas`)
      .then((data) => {
        if (cancelado) return
        setDatos(data)
        setError(null)
      })
      .catch(async (errorPropia) => {
        if (cancelado) return
        if ((errorPropia as { status?: number }).status !== 404) {
          setError(mensajeDeError(errorPropia))
          return
        }
        // No es suya: se muestra como cualquier oferta publicada
        try {
          const publica = await pedir<OfertaEmpleo>(`/api/empleo/${encodeURIComponent(ofertaId)}`)
          if (!cancelado) setAjena(publica)
        } catch (errorPublica) {
          if (!cancelado) setError(mensajeDeError(errorPublica))
        }
      })
    return () => {
      cancelado = true
    }
  }, [ofertaId, recargas])

  async function decidir(candidaturaId: string, estado: 'preseleccionada' | 'descartada') {
    if (estado === 'descartada' && !window.confirm('¿Descartar esta candidatura?')) return
    setErrorAccion(null)
    setEnCurso(candidaturaId)
    try {
      await pedir(`/api/empleo/candidaturas/${encodeURIComponent(candidaturaId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      })
    } catch (errorDecision) {
      setErrorAccion(mensajeDeError(errorDecision))
    } finally {
      setEnCurso(null)
      setRecargas((n) => n + 1)
    }
  }

  if (error) return <p className="empty-state">{error}</p>
  if (ajena) return <DatosOferta oferta={ajena} />
  if (!datos) return <p className="empty-state">Cargando la oferta de empleo...</p>

  const { oferta, candidaturas } = datos

  return (
    <>
      <DatosOferta oferta={oferta} />

      <section className="oferta-bloque">
        <h2>
          Candidaturas{' '}
          <span className="gestion-contador">{candidaturas.length}</span>
        </h2>
        {oferta.estado === 'cerrada' && (
          <p className="gestion-ayuda">Esta oferta está cerrada: ya no admite candidaturas.</p>
        )}
        {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}
        {candidaturas.length === 0 ? (
          <p className="empty-state">Todavía no ha llegado ninguna candidatura.</p>
        ) : (
          <ul className="empleo-candidaturas">
            {candidaturas.map((candidatura) => (
              <TarjetaCandidatura
                key={candidatura.id}
                candidatura={candidatura}
                ocupada={enCurso !== null}
                onDecidir={(estado) => decidir(candidatura.id, estado)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function OfertaEmpleoDetalle({ ofertaId, usuario, onCerrarSesion }: OfertaEmpleoDetalleProps) {
  return (
    <MarcoAutenticado
      usuario={usuario}
      onCerrarSesion={onCerrarSesion}
      activa="empleo"
      claseMain="oferta-detalle empleo"
    >
      <a className="text-link oferta-volver" href="/empleo">
        Volver a empleo
      </a>
      {usuario.rol === 'voluntario' ? (
        <VistaCandidato ofertaId={ofertaId} />
      ) : (
        <VistaEntidad ofertaId={ofertaId} />
      )}
    </MarcoAutenticado>
  )
}

export default OfertaEmpleoDetalle
