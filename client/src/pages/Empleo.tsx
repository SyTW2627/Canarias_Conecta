/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla de empleo. El voluntario busca ofertas y sigue sus candidaturas;
 *          la entidad publica sus ofertas de empleo y accede a sus candidaturas.
 */
import { useEffect, useRef, useState } from 'react'
import './HomePage.css'
import './Oportunidades.css'
import './GestionarOfertas.css'
import './Empleo.css'
import type { Usuario } from './Login.tsx'
import MarcoAutenticado from '../components/MarcoAutenticado.tsx'
import FormularioEmpleo, { type CuerpoEmpleo } from '../components/FormularioEmpleo.tsx'
import { ISLAS, cabecerasConSesion } from '../ofertas.ts'
import {
  ESTADOS_CANDIDATURA,
  JORNADAS,
  TIPOS_CONTRATO,
  formatearDia,
  formatearFechaCorta,
  lugarDeEmpleo,
  paginasVisibles,
  type PaginaEmpleos,
  type MiCandidatura,
  type MiOfertaEmpleo,
  type OfertaEmpleo,
} from '../empleo.ts'

type EmpleoProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

const BUSQUEDA_MAX = 100
const ESPERA_ESCRITURA_MS = 350

function useValorRetrasado(valor: string): string {
  const [retrasado, setRetrasado] = useState(valor)
  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), ESPERA_ESCRITURA_MS)
    return () => clearTimeout(temporizador)
  }, [valor])
  return retrasado
}

// Lee la respuesta de la API; un error lleva siempre { message }
async function pedir<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...opciones, headers: cabecerasConSesion() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? 'No se pudo completar la acción')
  return data as T
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error && !(error instanceof TypeError)
    ? error.message
    : 'No se pudo conectar con el servidor'
}

function TarjetaEmpleo({ oferta }: { oferta: OfertaEmpleo }) {
  return (
    <article className="empleo-tarjeta">
      <p className="opportunity-organization">{oferta.organizacion}</p>
      <h3>{oferta.titulo}</h3>
      <ul className="empleo-etiquetas">
        <li>{TIPOS_CONTRATO[oferta.tipoContrato] ?? oferta.tipoContrato}</li>
        <li>{JORNADAS[oferta.jornada] ?? oferta.jornada}</li>
      </ul>
      <dl>
        <div><dt>Lugar</dt><dd>{lugarDeEmpleo(oferta)}</dd></div>
        {oferta.salario && <div><dt>Salario</dt><dd>{oferta.salario}</dd></div>}
        <div>
          <dt>Plazo</dt>
          <dd>{oferta.fechaLimite ? `Hasta el ${formatearFechaCorta(oferta.fechaLimite)}` : 'Abierto'}</dd>
        </div>
      </dl>
      <div className="opportunity-footer">
        <span>{oferta.vacantes === 1 ? '1 vacante' : `${oferta.vacantes} vacantes`}</span>
        <a className="btn" href={`/empleo/${oferta.id}`}>Ver oferta</a>
      </div>
    </article>
  )
}

type PaginacionProps = {
  actual: number
  total: number
  onCambiar: (pagina: number) => void
}

function Paginacion({ actual, total, onCambiar }: PaginacionProps) {
  return (
    <nav className="paginacion" aria-label="Páginas de ofertas de empleo">
      <button
        type="button"
        className="paginacion-paso"
        onClick={() => onCambiar(actual - 1)}
        disabled={actual === 1}
      >
        <span aria-hidden="true">‹</span> Anterior
      </button>
      <ol>
        {paginasVisibles(actual, total).map((n, i) =>
          n === null ? (
            <li key={`hueco-${i}`} className="paginacion-hueco" aria-hidden="true">…</li>
          ) : (
            <li key={n}>
              <button
                type="button"
                aria-label={`Página ${n}`}
                aria-current={n === actual ? 'page' : undefined}
                onClick={() => n !== actual && onCambiar(n)}
              >
                {n}
              </button>
            </li>
          ),
        )}
      </ol>
      <button
        type="button"
        className="paginacion-paso"
        onClick={() => onCambiar(actual + 1)}
        disabled={actual === total}
      >
        Siguiente <span aria-hidden="true">›</span>
      </button>
    </nav>
  )
}

function BuscadorEmpleo() {
  const [busqueda, setBusqueda] = useState('')
  const [isla, setIsla] = useState('')
  const [tipoContrato, setTipoContrato] = useState('')
  const [jornada, setJornada] = useState('')
  const [resultado, setResultado] = useState<PaginaEmpleos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resultados = useRef<HTMLElement>(null)
  const q = useValorRetrasado(busqueda)

  const parametros = new URLSearchParams()
  for (const [clave, valor] of Object.entries({ q: q.trim(), isla, tipoContrato, jornada })) {
    if (valor) parametros.set(clave, valor)
  }
  const filtros = parametros.toString()

  // La pagina va ligada a los filtros: al cambiarlos se vuelve a la primera
  const [paginaElegida, setPaginaElegida] = useState({ filtros, pagina: 1 })
  const pagina = paginaElegida.filtros === filtros ? paginaElegida.pagina : 1
  if (pagina > 1) parametros.set('pagina', String(pagina))
  const consulta = parametros.toString()

  useEffect(() => {
    const controlador = new AbortController()
    fetch(`/api/empleo${consulta ? `?${consulta}` : ''}`, { signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar las ofertas de empleo')
        const datos = data as PaginaEmpleos
        // Si la pagina se ha quedado vacia (se cerraron ofertas), salta a la ultima que tenga
        if (datos.ofertas.length === 0 && datos.pagina > 1 && datos.totalPaginas > 0) {
          setPaginaElegida({ filtros, pagina: datos.totalPaginas })
          return
        }
        setResultado(datos)
        setError(null)
      })
      .catch((errorCarga) => {
        if (!controlador.signal.aborted) setError(mensajeDeError(errorCarga))
      })
    return () => controlador.abort()
  }, [consulta, filtros])

  function irAPagina(nueva: number) {
    setPaginaElegida({ filtros, pagina: nueva })
    resultados.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const ofertas = resultado?.ofertas ?? null

  const hayFiltros = Boolean(busqueda || isla || tipoContrato || jornada)

  function limpiarFiltros() {
    setBusqueda('')
    setIsla('')
    setTipoContrato('')
    setJornada('')
  }

  return (
    <>
      <section className="search-section">
        <div className="search-controls catalogo-filtros">
          <label className="filtro-busqueda">
            <span>Buscar</span>
            <input
              type="search"
              value={busqueda}
              maxLength={BUSQUEDA_MAX}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. educador, logística..."
            />
          </label>
          <label>
            <span>Isla</span>
            <select value={isla} onChange={(e) => setIsla(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ISLAS).map(([valor, nombre]) => (
                <option key={valor} value={valor}>{nombre}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Contrato</span>
            <select value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS_CONTRATO).map(([valor, nombre]) => (
                <option key={valor} value={valor}>{nombre}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Jornada</span>
            <select value={jornada} onChange={(e) => setJornada(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(JORNADAS).map(([valor, nombre]) => (
                <option key={valor} value={valor}>{nombre}</option>
              ))}
            </select>
          </label>
          {hayFiltros && (
            <button type="button" className="btn btn-outline filtro-limpiar" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      <section className="opportunities-section" ref={resultados}>
        {resultado && ofertas && ofertas.length > 0 ? (
          <>
            <p className="catalogo-total">
              {resultado.total === 1 ? '1 oferta de empleo' : `${resultado.total} ofertas de empleo`}
              {resultado.totalPaginas > 1 &&
                ` · Mostrando ${(resultado.pagina - 1) * resultado.porPagina + 1}–${
                  (resultado.pagina - 1) * resultado.porPagina + ofertas.length
                }`}
            </p>
            <div className="catalogo-grid">
              {ofertas.map((oferta) => <TarjetaEmpleo key={oferta.id} oferta={oferta} />)}
            </div>
            {resultado.totalPaginas > 1 && (
              <Paginacion
                actual={resultado.pagina}
                total={resultado.totalPaginas}
                onCambiar={irAPagina}
              />
            )}
          </>
        ) : (
          <p className="empty-state">
            {error ??
              (ofertas === null
                ? 'Cargando ofertas de empleo...'
                : hayFiltros
                  ? 'No hay ofertas de empleo con esos filtros.'
                  : 'Todavía no hay ofertas de empleo publicadas.')}
          </p>
        )}
      </section>
    </>
  )
}

function MisCandidaturas() {
  const [candidaturas, setCandidaturas] = useState<MiCandidatura[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [recargas, setRecargas] = useState(0)

  useEffect(() => {
    let cancelado = false
    pedir<MiCandidatura[]>('/api/empleo/candidaturas/mias')
      .then((data) => {
        if (cancelado) return
        setCandidaturas(data)
        setError(null)
      })
      .catch((errorCarga) => !cancelado && setError(mensajeDeError(errorCarga)))
    return () => {
      cancelado = true
    }
  }, [recargas])

  async function retirar(candidatura: MiCandidatura) {
    if (!window.confirm(`¿Retirar tu candidatura a "${candidatura.titulo}"?`)) return
    setErrorAccion(null)
    setEnCurso(candidatura.id)
    try {
      await pedir(`/api/empleo/candidaturas/${encodeURIComponent(candidatura.id)}/retirar`, {
        method: 'PATCH',
      })
    } catch (errorRetirar) {
      setErrorAccion(mensajeDeError(errorRetirar))
    } finally {
      setEnCurso(null)
      setRecargas((n) => n + 1)
    }
  }

  if (!candidaturas) {
    return <p className="empty-state">{error ?? 'Cargando tus candidaturas...'}</p>
  }

  if (candidaturas.length === 0) {
    return <p className="empty-state">Todavía no te has postulado a ninguna oferta de empleo.</p>
  }

  return (
    <>
      {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}
      <ul className="empleo-lista">
        {candidaturas.map((candidatura) => (
          <li key={candidatura.id} className="empleo-fila">
            <div>
              <p className="opportunity-organization">{candidatura.organizacion}</p>
              <h3>
                <a href={`/empleo/${candidatura.ofertaId}`}>{candidatura.titulo}</a>
              </h3>
              <p className="empleo-detalle-linea">
                {TIPOS_CONTRATO[candidatura.tipoContrato]} · {JORNADAS[candidatura.jornada]} ·{' '}
                {lugarDeEmpleo({
                  ubicacion: candidatura.ubicacion ?? undefined,
                  modalidad: candidatura.modalidad,
                })}
              </p>
              <p className="empleo-detalle-linea">
                Enviada el {formatearDia(candidatura.fechaCandidatura)}
                {!candidatura.ofertaAbierta && ' · La oferta ya no admite candidaturas'}
              </p>
            </div>
            <div className="empleo-fila-acciones">
              <span className={`empleo-estado empleo-estado-${candidatura.estado}`}>
                {ESTADOS_CANDIDATURA[candidatura.estado]}
              </span>
              {['pendiente', 'preseleccionada'].includes(candidatura.estado) && (
                <button
                  type="button"
                  className="gestion-accion"
                  onClick={() => retirar(candidatura)}
                  disabled={enCurso !== null}
                >
                  {enCurso === candidatura.id ? 'Retirando...' : 'Retirar'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function EmpleoVoluntario() {
  const [pestana, setPestana] = useState<'ofertas' | 'candidaturas'>('ofertas')

  return (
    <>
      <section className="gestion-cabecera">
        <div>
          <p className="eyebrow">Tu experiencia como voluntario también cuenta</p>
          <h1 className="section-title gestion-titulo">Empleo</h1>
        </div>
      </section>

      <div className="empleo-pestanas" role="tablist" aria-label="Secciones de empleo">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'ofertas'}
          onClick={() => setPestana('ofertas')}
        >
          Ofertas de empleo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'candidaturas'}
          onClick={() => setPestana('candidaturas')}
        >
          Mis candidaturas
        </button>
      </div>

      <div role="tabpanel">{pestana === 'ofertas' ? <BuscadorEmpleo /> : <MisCandidaturas />}</div>
    </>
  )
}

function EmpleoEntidad() {
  const [ofertas, setOfertas] = useState<MiOfertaEmpleo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [recargas, setRecargas] = useState(0)

  useEffect(() => {
    let cancelado = false
    pedir<MiOfertaEmpleo[]>('/api/empleo/mias')
      .then((data) => {
        if (cancelado) return
        setOfertas(data)
        setError(null)
      })
      .catch((errorCarga) => !cancelado && setError(mensajeDeError(errorCarga)))
    return () => {
      cancelado = true
    }
  }, [recargas])

  async function publicar(cuerpo: CuerpoEmpleo): Promise<string | null> {
    try {
      await pedir('/api/empleo', { method: 'POST', body: JSON.stringify(cuerpo) })
      setMostrarFormulario(false)
      setMensajeExito('Oferta de empleo publicada. Los voluntarios ya pueden postularse.')
      setRecargas((n) => n + 1)
      return null
    } catch (errorPublicar) {
      return mensajeDeError(errorPublicar)
    }
  }

  async function cerrar(oferta: MiOfertaEmpleo) {
    if (!window.confirm(`¿Cerrar "${oferta.titulo}"? Dejará de admitir candidaturas.`)) return
    setErrorAccion(null)
    setEnCurso(oferta.id)
    try {
      await pedir(`/api/empleo/${encodeURIComponent(oferta.id)}/cerrar`, { method: 'PATCH' })
    } catch (errorCerrar) {
      setErrorAccion(mensajeDeError(errorCerrar))
    } finally {
      setEnCurso(null)
      setRecargas((n) => n + 1)
    }
  }

  return (
    <>
      <section className="gestion-cabecera">
        <h1 className="section-title gestion-titulo">Ofertas de empleo</h1>
        {!mostrarFormulario && (
          <button
            type="button"
            className="btn gestion-publicar"
            onClick={() => {
              setMensajeExito(null)
              setMostrarFormulario(true)
            }}
          >
            <span aria-hidden="true">+</span> Publicar oferta de empleo
          </button>
        )}
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

      {mostrarFormulario && (
        <FormularioEmpleo onEnviar={publicar} onCancelar={() => setMostrarFormulario(false)} />
      )}

      <section className="gestion-listado">
        <div className="gestion-listado-cabecera">
          <h2>Mis ofertas de empleo</h2>
          {ofertas && ofertas.length > 0 && (
            <span className="gestion-contador">
              {ofertas.length} {ofertas.length === 1 ? 'oferta' : 'ofertas'}
            </span>
          )}
        </div>

        {errorAccion && <p className="gestion-error" role="alert">{errorAccion}</p>}
        {error && <p className="empty-state">{error}</p>}
        {!error && ofertas === null && <p className="empty-state">Cargando tus ofertas de empleo...</p>}
        {ofertas?.length === 0 && (
          <p className="empty-state">Todavía no has publicado ninguna oferta de empleo.</p>
        )}

        {ofertas && ofertas.length > 0 && (
          <ul className="empleo-lista">
            {ofertas.map((oferta) => {
              const activa = oferta.estado === 'publicada'
              return (
                <li key={oferta.id} className={`empleo-fila${activa ? '' : ' gestion-tarjeta-inactiva'}`}>
                  <div>
                    <h3>{oferta.titulo}</h3>
                    <p className="empleo-detalle-linea">
                      {TIPOS_CONTRATO[oferta.tipoContrato]} · {JORNADAS[oferta.jornada]} ·{' '}
                      {lugarDeEmpleo(oferta)}
                    </p>
                    <p className="empleo-detalle-linea">
                      {oferta.candidaturas === 1 ? '1 candidatura' : `${oferta.candidaturas} candidaturas`}
                      {oferta.fechaLimite && ` · Plazo hasta el ${formatearFechaCorta(oferta.fechaLimite)}`}
                    </p>
                  </div>
                  <div className="empleo-fila-acciones">
                    <span
                      className={`gestion-estado gestion-estado-${activa && oferta.abierta ? 'publicada' : 'cerrada'}`}
                    >
                      {!activa ? 'Cerrada' : oferta.abierta ? 'Publicada' : 'Plazo terminado'}
                    </span>
                    <a className="gestion-accion gestion-accion-principal" href={`/empleo/${oferta.id}`}>
                      Ver candidaturas
                      {oferta.candidaturasPendientes > 0 && (
                        <span className="gestion-pendientes">
                          {oferta.candidaturasPendientes} sin revisar
                        </span>
                      )}
                    </a>
                    {activa && (
                      <button
                        type="button"
                        className="gestion-accion"
                        onClick={() => cerrar(oferta)}
                        disabled={enCurso !== null}
                      >
                        {enCurso === oferta.id ? 'Cerrando...' : 'Cerrar oferta'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function Empleo({ usuario, onCerrarSesion }: EmpleoProps) {
  return (
    <MarcoAutenticado
      usuario={usuario}
      onCerrarSesion={onCerrarSesion}
      activa="empleo"
      claseMain="gestion empleo"
    >
      {usuario.rol === 'voluntario' ? <EmpleoVoluntario /> : <EmpleoEntidad />}
    </MarcoAutenticado>
  )
}

export default Empleo
