/**
 * Pantalla principal para usuarios autenticados (diseño "Inicio final A + B").
 * Hay dos inicios con la misma estetica, segun el rol:
 *  - Voluntario: mapa y buscador, su proxima actividad, su semana y los planes
 *    a los que les faltan voluntarios.
 *      GET /api/ofertas            -> ofertas publicadas con turnos desde hoy
 *      GET /api/inscripciones/mias -> sus inscripciones
 *  - Asociacion (ofertante): resumen, solicitudes por revisar, sus turnos de la
 *    semana, turnos con pocas plazas cubiertas y actividades por cerrar.
 *      GET /api/ofertas/mias             -> sus ofertas
 *      GET /api/inscripciones/oferta/:id -> candidatos de sus actividades pasadas
 */
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import './HomePage.css'
import type { Usuario } from './Login.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import Recomendaciones from '../components/Recomendaciones.tsx'
import { useOfertasPublicadas } from '../useOfertasPublicadas.ts'
import {
  ISLAS,
  MODALIDADES,
  cabecerasConSesion,
  hoyIso,
  imagenDeOferta,
  type MiOferta,
  type Oferta,
  type Turno,
} from '../ofertas.ts'

type HomePageProps = {
  usuario: Usuario
  onCerrarSesion: () => void
}

// ---------------------------------------------------------------------------
// Datos de la API
// ---------------------------------------------------------------------------

type TurnoInscrito = {
  id: string
  fecha: string
  horaInicio: string
  horaFin: string
}

// Lo que devuelve GET /api/inscripciones/mias (solo los campos que usa el inicio)
type MiInscripcion = {
  id: string
  ofertaId: string
  titulo: string
  organizador: string
  fecha: string | null
  estado: string
  inicio: string | null
  posicionEspera: number | null
  // Servidores sin este campo: se deducen los turnos a partir de "inicio" y "fecha"
  turnos?: TurnoInscrito[]
}

// Inscripciones que siguen en marcha y ocupan un hueco en la agenda
const ESTADOS_ACTIVOS = ['pendiente', 'aceptada', 'en_espera']
// Con estos estados la API no deja volver a inscribirse en la misma oferta
const ESTADOS_QUE_BLOQUEAN = ['pendiente', 'en_espera', 'aceptada', 'completada', 'no_presentado']

const BUSQUEDA_MAX = 100
const DIAS_AGENDA = 7
const MAX_FALTAN_MANOS = 3

function useMisInscripciones(activo: boolean) {
  const [inscripciones, setInscripciones] = useState<MiInscripcion[] | null>(activo ? null : [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activo) return
    const controlador = new AbortController()

    fetch('/api/inscripciones/mias', {
      headers: cabecerasConSesion(),
      signal: controlador.signal,
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar tus inscripciones')
        setInscripciones(data)
        setError(null)
      })
      .catch((error: Error) => {
        if (controlador.signal.aborted) return
        setInscripciones([])
        setError(
          error instanceof SyntaxError || error instanceof TypeError
            ? 'No se pudo conectar con el servidor'
            : error.message,
        )
      })

    return () => controlador.abort()
  }, [activo])

  return { inscripciones, error }
}

// ---------------------------------------------------------------------------
// Fechas: los turnos llegan como el dia a las 00:00 UTC y la hora va aparte
// ---------------------------------------------------------------------------

const diaDe = (fecha: string) => fecha.slice(0, 10)

function sumarDias(diaIso: string, dias: number): string {
  const fecha = new Date(`${diaIso}T00:00:00.000Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
  )
}

function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number)
  return horas * 60 + minutos
}

function horaActual(): string {
  const ahora = new Date()
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
}

const FORMATO_DIA_CORTO = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' })
const FORMATO_DIA_LARGO = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' })

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)
const numeroDia = (diaIso: string) => Number(diaIso.slice(8, 10))
const diaCorto = (diaIso: string) =>
  capitalizar(FORMATO_DIA_CORTO.format(new Date(`${diaIso}T00:00:00Z`)).replace('.', ''))
const diaLargo = (diaIso: string) => FORMATO_DIA_LARGO.format(new Date(`${diaIso}T00:00:00Z`))

function seSolapan(a: { horaInicio: string; horaFin: string }, b: { horaInicio: string; horaFin: string }) {
  return aMinutos(a.horaInicio) < aMinutos(b.horaFin) && aMinutos(b.horaInicio) < aMinutos(a.horaFin)
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

function lugarDe(oferta: Oferta | undefined): string {
  if (!oferta) return ''
  if (oferta.ubicacion) return oferta.ubicacion.municipio
  return MODALIDADES[oferta.modalidad] ?? ''
}

function textoPlazasLibres(plazasLibres: number): string {
  if (plazasLibres <= 0) return 'Completa'
  return plazasLibres === 1 ? '1 plaza libre' : `${plazasLibres} plazas libres`
}

function textoEstado(inscripcion: MiInscripcion): { texto: string; clase: string } {
  if (inscripcion.estado === 'aceptada') return { texto: 'Confirmada', clase: 'inicio-chip-ok' }
  if (inscripcion.estado === 'en_espera') {
    return {
      texto: inscripcion.posicionEspera
        ? `En lista de espera (puesto ${inscripcion.posicionEspera})`
        : 'En lista de espera',
      clase: 'inicio-chip-aviso',
    }
  }
  return { texto: 'Pendiente de respuesta', clase: 'inicio-chip-aviso' }
}

function textoFaltan(dias: number): string {
  if (dias <= 0) return 'Es hoy.'
  if (dias === 1) return 'Es mañana.'
  return `Faltan ${dias} días.`
}

// ---------------------------------------------------------------------------
// Turnos de cada inscripcion
// ---------------------------------------------------------------------------

// Con un servidor que no envie "turnos", se reconocen el primero (por su inicio)
// y el ultimo (por su fecha, si ese dia solo hay uno)
function turnosDeInscripcion(inscripcion: MiInscripcion, oferta: Oferta | undefined): TurnoInscrito[] {
  if (inscripcion.turnos) return inscripcion.turnos
  if (!oferta || !inscripcion.inicio) return []

  const diaInicio = diaDe(inscripcion.inicio)
  const horaInicio = inscripcion.inicio.slice(11, 16)
  const encontrados = oferta.turnos.filter(
    (turno) => diaDe(turno.fecha) === diaInicio && turno.horaInicio === horaInicio,
  )

  if (inscripcion.fecha && diaDe(inscripcion.fecha) !== diaInicio) {
    const delUltimoDia = oferta.turnos.filter((turno) => diaDe(turno.fecha) === diaDe(inscripcion.fecha!))
    if (delUltimoDia.length === 1) encontrados.push(delUltimoDia[0])
  }

  return encontrados.map(({ id, fecha, horaInicio, horaFin }) => ({ id, fecha, horaInicio, horaFin }))
}

type MiPlan = {
  inscripcion: MiInscripcion
  oferta: Oferta | undefined
  turno: TurnoInscrito
}

type PlanDisponible = {
  oferta: Oferta
  turno: Turno
}

// ---------------------------------------------------------------------------
// Mapa de las islas (siluetas simplificadas: longitud, latitud)
// ---------------------------------------------------------------------------

const SILUETAS: { slug: string; puntos: [number, number][] }[] = [
  { slug: 'el_hierro', puntos: [[-18.16, 27.76], [-18.06, 27.78], [-17.99, 27.84], [-17.92, 27.82], [-17.88, 27.77], [-17.93, 27.72], [-17.99, 27.64], [-18.03, 27.7], [-18.1, 27.7]] },
  { slug: 'la_palma', puntos: [[-17.92, 28.86], [-17.8, 28.85], [-17.73, 28.78], [-17.72, 28.66], [-17.77, 28.55], [-17.83, 28.45], [-17.88, 28.53], [-17.94, 28.63], [-18.0, 28.73], [-17.98, 28.81]] },
  { slug: 'la_gomera', puntos: [[-17.25, 28.21], [-17.16, 28.2], [-17.1, 28.15], [-17.1, 28.07], [-17.17, 28.02], [-17.27, 28.02], [-17.34, 28.08], [-17.33, 28.16]] },
  { slug: 'tenerife', puntos: [[-16.92, 28.37], [-16.82, 28.39], [-16.68, 28.4], [-16.52, 28.44], [-16.4, 28.51], [-16.28, 28.57], [-16.13, 28.58], [-16.17, 28.52], [-16.3, 28.46], [-16.37, 28.37], [-16.42, 28.25], [-16.48, 28.14], [-16.53, 28.05], [-16.65, 28.0], [-16.73, 28.03], [-16.8, 28.13], [-16.84, 28.24], [-16.9, 28.31]] },
  { slug: 'gran_canaria', puntos: [[-15.82, 28.16], [-15.7, 28.17], [-15.55, 28.15], [-15.42, 28.18], [-15.42, 28.08], [-15.37, 27.98], [-15.4, 27.86], [-15.48, 27.79], [-15.6, 27.74], [-15.72, 27.78], [-15.81, 27.85], [-15.84, 27.97], [-15.85, 28.07]] },
  { slug: 'fuerteventura', puntos: [[-13.87, 28.75], [-13.83, 28.68], [-13.83, 28.55], [-13.85, 28.42], [-13.9, 28.3], [-13.98, 28.22], [-14.1, 28.18], [-14.22, 28.14], [-14.35, 28.08], [-14.5, 28.07], [-14.48, 28.11], [-14.33, 28.15], [-14.22, 28.24], [-14.1, 28.35], [-14.03, 28.5], [-14.0, 28.62], [-13.96, 28.73]] },
  { slug: 'la_graciosa', puntos: [[-13.59, 29.38], [-13.53, 29.37], [-13.52, 29.33], [-13.55, 29.3], [-13.6, 29.31], [-13.62, 29.35]] },
  { slug: 'lanzarote', puntos: [[-13.47, 29.23], [-13.42, 29.15], [-13.45, 29.05], [-13.52, 28.97], [-13.63, 28.92], [-13.75, 28.85], [-13.86, 28.86], [-13.87, 28.93], [-13.8, 28.99], [-13.72, 29.05], [-13.62, 29.1], [-13.55, 29.2]] },
]

// Donde va el nombre de cada isla. Por defecto, debajo
type PosicionEtiqueta = 'abajo' | 'arriba' | 'izquierda' | 'derecha'
const POSICION_ETIQUETA: Record<string, PosicionEtiqueta> = {
  la_graciosa: 'izquierda',
  // A la derecha para no pisar Fuerteventura
  lanzarote: 'derecha',
  // Encima para que no quede pegado a La Gomera
  tenerife: 'arriba',
}

// Ancho del mapa: deja sitio a la derecha para el nombre de Lanzarote
const ANCHO_MAPA = 680
const VIEWBOX_MAPA = `0 0 ${ANCHO_MAPA} 300`

const ISLAS_MAPA = SILUETAS.map(({ slug, puntos }) => {
  const pts = puntos.map(([lon, lat]) => [(lon + 18.3) * 112 + 20, (29.35 - lat) * 127 + 20])
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const centroX = Math.round((minX + maxX) / 2)
  const centroY = Math.round((minY + maxY) / 2)
  const posicion = POSICION_ETIQUETA[slug] ?? 'abajo'

  const etiqueta = {
    abajo: { tx: centroX, ty: maxY + 20, anchor: 'middle' },
    arriba: { tx: centroX, ty: minY - 10, anchor: 'middle' },
    izquierda: { tx: minX - 12, ty: minY + 12, anchor: 'end' },
    derecha: { tx: maxX + 12, ty: centroY + 5, anchor: 'start' },
  }[posicion] as { tx: number; ty: number; anchor: 'start' | 'middle' | 'end' }

  return {
    slug,
    nombre: ISLAS[slug] ?? slug,
    d: `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z`,
    ...etiqueta,
  }
})

// Cambia de pantalla sin recargar: App escucha popstate y vuelve a leer la URL
function irA(url: string) {
  window.history.pushState(null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// Un turno ya no cuenta como proximo cuando su dia ha pasado o ha terminado hoy
function sigueEnPie(turno: { fecha: string; horaFin: string }, hoy: string, ahora: string) {
  return diaDe(turno.fecha) > hoy || (diaDe(turno.fecha) === hoy && turno.horaFin > ahora)
}

function plural(total: number, singular: string, varios: string) {
  return `${total} ${total === 1 ? singular : varios}`
}

// ---------------------------------------------------------------------------
// Piezas comunes a los dos inicios
// ---------------------------------------------------------------------------

function Cabecera({ usuario, onCerrarSesion }: HomePageProps) {
  const esVoluntario = usuario.rol === 'voluntario'
  return (
    <header className="nav authenticated-nav">
      <div className="brand">
        <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
        <span className="logo">Canarias Conecta</span>
      </div>

      <nav className="authenticated-links" aria-label="Navegación principal">
        <a href="#inicio" aria-current="page">Inicio</a>
        {esVoluntario && <a href="/oportunidades">Oportunidades</a>}
        {esVoluntario && <a href="/mis_inscripciones">Mis inscripciones</a>}
        <a href="/perfil">Mi perfil</a>
        {!esVoluntario && <a href="/gestionar-ofertas">Gestionar ofertas</a>}
      </nav>

      <div className="authenticated-user">
        <Notificaciones />
        <span>Hola, {usuario.nombre}</span>
        <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}

function Pie() {
  return (
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
  )
}

type ResumenDia = {
  texto: string
  aria: string
  // Dia marcado en ambar: tiene un plan propio o solicitudes por revisar
  destacado: boolean
  libre: boolean
}

function TiraDias({
  dias,
  diaElegido,
  onElegir,
  resumen,
}: {
  dias: string[]
  diaElegido: string
  onElegir: (dia: string) => void
  resumen: (dia: string) => ResumenDia
}) {
  return (
    <section className="inicio-dias" aria-label="Días de la semana">
      {dias.map((dia, indice) => {
        const { texto, aria, destacado, libre } = resumen(dia)
        const elegido = dia === diaElegido
        const clases = [
          'inicio-dia',
          elegido && 'inicio-dia-elegido',
          destacado && 'inicio-dia-mio',
          libre && 'inicio-dia-libre',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={dia}
            type="button"
            className={clases}
            aria-pressed={elegido}
            aria-label={`${diaLargo(dia)} ${numeroDia(dia)}, ${aria}`}
            onClick={() => onElegir(dia)}
          >
            <span className="inicio-dia-nombre">{indice === 0 ? 'Hoy' : diaCorto(dia)}</span>
            <span className="inicio-dia-numero">{numeroDia(dia)}</span>
            <span className="inicio-dia-resumen">{texto}</span>
          </button>
        )
      })}
    </section>
  )
}

function tituloDelDia(hoy: string, dia: string) {
  const distancia = diasEntre(hoy, dia)
  return (
    `${capitalizar(diaLargo(dia))} ${numeroDia(dia)}` +
    (distancia === 0 ? ', hoy' : distancia === 1 ? ', mañana' : '')
  )
}

// ---------------------------------------------------------------------------
// Pantalla: elige el inicio segun el rol
// ---------------------------------------------------------------------------

function HomePage({ usuario, onCerrarSesion }: HomePageProps) {
  return (
    <div className="authenticated-home inicio">
      <Cabecera usuario={usuario} onCerrarSesion={onCerrarSesion} />
      {usuario.rol === 'ofertante' ? (
        <InicioAsociacion usuario={usuario} />
      ) : (
        <InicioVoluntario usuario={usuario} />
      )}
      <Pie />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inicio del voluntario
// ---------------------------------------------------------------------------

function InicioVoluntario({ usuario }: { usuario: Usuario }) {
  const { ofertas, error: errorOfertas } = useOfertasPublicadas()
  const { inscripciones, error: errorInscripciones } = useMisInscripciones(true)

  const hoy = hoyIso()
  const ahora = horaActual()
  const dias = Array.from({ length: DIAS_AGENDA }, (_, i) => sumarDias(hoy, i))
  const [diaElegido, setDiaElegido] = useState(hoy)
  const [busqueda, setBusqueda] = useState('')

  const listaOfertas = ofertas ?? []
  const ofertaPorId = new Map(listaOfertas.map((oferta) => [oferta.id, oferta]))
  const misInscripciones = inscripciones ?? []

  // Mis planes: un elemento por cada turno de una inscripcion activa
  const misPlanes: MiPlan[] = misInscripciones
    .filter((inscripcion) => ESTADOS_ACTIVOS.includes(inscripcion.estado))
    .flatMap((inscripcion) => {
      const oferta = ofertaPorId.get(inscripcion.ofertaId)
      return turnosDeInscripcion(inscripcion, oferta).map((turno) => ({ inscripcion, oferta, turno }))
    })
    .sort((a, b) =>
      a.turno.fecha === b.turno.fecha
        ? a.turno.horaInicio.localeCompare(b.turno.horaInicio)
        : a.turno.fecha.localeCompare(b.turno.fecha),
    )

  // Ofertas en las que ya no puede volver a inscribirse
  const ofertasBloqueadas = new Set(
    misInscripciones
      .filter((inscripcion) => ESTADOS_QUE_BLOQUEAN.includes(inscripcion.estado))
      .map((inscripcion) => inscripcion.ofertaId),
  )

  // Planes publicados de la semana a los que todavia se puede apuntar
  const disponibles: PlanDisponible[] = listaOfertas
    .filter((oferta) => !ofertasBloqueadas.has(oferta.id))
    .flatMap((oferta) =>
      oferta.turnos
        .filter((turno) => dias.includes(diaDe(turno.fecha)) && sigueEnPie(turno, hoy, ahora))
        .map((turno) => ({ oferta, turno })),
    )
    .sort((a, b) => a.turno.horaInicio.localeCompare(b.turno.horaInicio))

  const misPlanesDe = (dia: string) => misPlanes.filter((plan) => diaDe(plan.turno.fecha) === dia)
  const disponiblesDe = (dia: string) => disponibles.filter((plan) => diaDe(plan.turno.fecha) === dia)

  const proximaActividad = misPlanes.find((plan) => sigueEnPie(plan.turno, hoy, ahora))

  // Les faltan manos: turnos de la semana con plazas libres, los menos cubiertos primero
  const faltanManos = disponibles
    .filter(({ turno }) => turno.plazas > 0 && turno.plazasLibres > 0)
    .map((plan) => ({
      ...plan,
      cubiertas: plan.turno.plazas - plan.turno.plazasLibres,
      porcentaje: Math.round(((plan.turno.plazas - plan.turno.plazasLibres) / plan.turno.plazas) * 100),
    }))
    .sort((a, b) => a.porcentaje - b.porcentaje || a.turno.fecha.localeCompare(b.turno.fecha))
    .slice(0, MAX_FALTAN_MANOS)

  // Cuantas ofertas hay en cada isla, para el mapa
  const ofertasPorIsla = new Map<string, number>()
  for (const oferta of listaOfertas) {
    const isla = oferta.ubicacion?.isla
    if (isla) ofertasPorIsla.set(isla, (ofertasPorIsla.get(isla) ?? 0) + 1)
  }

  const primerNombre = usuario.nombre.trim().split(/\s+/)[0] || usuario.nombre
  const misPlanesDelDia = misPlanesDe(diaElegido)
  const disponiblesDelDia = disponiblesDe(diaElegido).map((plan) => ({
    ...plan,
    coincide: misPlanesDelDia.find((mio) => seSolapan(mio.turno, plan.turno)),
  }))
  const cargandoPlanes = ofertas === null || inscripciones === null

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const texto = busqueda.trim().slice(0, BUSQUEDA_MAX)
    irA(texto ? `/oportunidades?q=${encodeURIComponent(texto)}` : '/oportunidades')
  }

  function abrirIsla(evento: MouseEvent<Element>, slug: string) {
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return
    evento.preventDefault()
    irA(`/oportunidades?isla=${slug}`)
  }

  function resumenDia(dia: string): ResumenDia {
    const tengoPlan = misPlanesDe(dia).length > 0
    const total = disponiblesDe(dia).length
    return {
      texto: cargandoPlanes
        ? '…'
        : tengoPlan
          ? 'Tienes plan'
          : total
            ? plural(total, 'plan', 'planes')
            : 'Libre',
      aria: `${tengoPlan ? 'tienes un plan y ' : ''}${plural(total, 'plan disponible', 'planes disponibles')}`,
      destacado: tengoPlan,
      libre: !total,
    }
  }

  return (
    <>
      {/* Cabecera: saludo, buscador y mapa */}
      <section className="inicio-hero">
        <div className="inicio-hero-contenido">
          <div className="inicio-hero-texto">
            <h1>
              Hola, {primerNombre}.<br />
              Ocho islas, mil formas de ayudar.
            </h1>
            <p>Descubre nuevas formas de colaborar y aportar a tu comunidad.</p>
            <form role="search" className="inicio-buscador" onSubmit={buscar}>
              <label htmlFor="inicio-busqueda" className="inicio-oculto">
                Buscar oportunidades
              </label>
              <input
                id="inicio-busqueda"
                type="search"
                placeholder="Ej. costa, mayores…"
                maxLength={BUSQUEDA_MAX}
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
              />
              <button type="submit">Buscar</button>
            </form>
          </div>

          <div className="inicio-hero-mapa">
            <svg viewBox={VIEWBOX_MAPA} role="img" aria-label="Mapa de las ocho islas Canarias">
              {ISLAS_MAPA.map((isla) => {
                const total = ofertasPorIsla.get(isla.slug) ?? 0
                const descripcion = `${isla.nombre}: ${plural(total, 'oportunidad', 'oportunidades')}`
                return (
                  <a
                    key={isla.slug}
                    href={`/oportunidades?isla=${isla.slug}`}
                    aria-label={descripcion}
                    className="inicio-isla"
                    onClick={(evento) => abrirIsla(evento, isla.slug)}
                  >
                    <title>{descripcion}</title>
                    <path d={isla.d} />
                    <text x={isla.tx} y={isla.ty} textAnchor={isla.anchor}>
                      {isla.nombre}
                    </text>
                  </a>
                )
              })}
            </svg>
          </div>
        </div>
      </section>

      <main className="inicio-main" id="inicio">
        {/* Proxima actividad */}
        <article className="inicio-proxima">
          {proximaActividad ? (
            <>
              <div className="inicio-proxima-fecha" aria-hidden="true">
                <span>{diaCorto(diaDe(proximaActividad.turno.fecha))}</span>
                <strong>{numeroDia(diaDe(proximaActividad.turno.fecha))}</strong>
              </div>
              <div className="inicio-proxima-texto">
                <p className="inicio-etiqueta">Tu próxima actividad</p>
                <p className="inicio-proxima-titulo">{proximaActividad.inscripcion.titulo}</p>
                <p>
                  {capitalizar(diaLargo(diaDe(proximaActividad.turno.fecha)))}{' '}
                  {numeroDia(diaDe(proximaActividad.turno.fecha))}, de {proximaActividad.turno.horaInicio} a{' '}
                  {proximaActividad.turno.horaFin}
                  {lugarDe(proximaActividad.oferta) && `, en ${lugarDe(proximaActividad.oferta)}`}.{' '}
                  {textoFaltan(diasEntre(hoy, diaDe(proximaActividad.turno.fecha)))}
                </p>
              </div>
            </>
          ) : (
            <div className="inicio-proxima-texto">
              <p className="inicio-etiqueta">Tu próxima actividad</p>
              <p className="inicio-proxima-titulo">
                {inscripciones === null
                  ? 'Cargando tus inscripciones…'
                  : errorInscripciones ?? 'Todavía no tienes actividades próximas'}
              </p>
              {inscripciones !== null && !errorInscripciones && (
                <p>Elige un día de tu semana y apúntate a algún plan.</p>
              )}
            </div>
          )}
          <a className="inicio-enlace" href="/mis_inscripciones">
            Ver mis inscripciones
          </a>
        </article>

        {/* Tu semana */}
        <div className="inicio-cabecera-seccion">
          <div>
            <h2 className="inicio-titulo">Tu semana</h2>
            <div className="inicio-subrayado" />
          </div>
          <a className="inicio-enlace" href="/oportunidades">
            Ver todas las oportunidades
          </a>
        </div>

        <TiraDias dias={dias} diaElegido={diaElegido} onElegir={setDiaElegido} resumen={resumenDia} />

        <h3 className="inicio-titulo-dia">{tituloDelDia(hoy, diaElegido)}</h3>

        {errorOfertas && <p className="empty-state">{errorOfertas}</p>}
        {!errorOfertas && cargandoPlanes && <p className="empty-state">Cargando planes…</p>}

        {!cargandoPlanes && misPlanesDelDia.length > 0 && (
          <>
            <p className="inicio-etiqueta inicio-etiqueta-mia">Ya te has apuntado</p>
            <div className="inicio-planes">
              {misPlanesDelDia.map(({ inscripcion, oferta, turno }) => {
                const estado = textoEstado(inscripcion)
                return (
                  <article key={`${inscripcion.id}-${turno.id}`} className="inicio-plan inicio-plan-mio">
                    <div className="inicio-plan-hora">
                      <strong>{turno.horaInicio}</strong>
                      <span>a {turno.horaFin}</span>
                    </div>
                    <div className="inicio-plan-cuerpo">
                      <img src={oferta ? imagenDeOferta(oferta) : '/fotos/voluntariado-1.png'} alt="" />
                      <div className="inicio-plan-texto">
                        <p className="inicio-plan-org">{inscripcion.organizador}</p>
                        <h4>{inscripcion.titulo}</h4>
                        {lugarDe(oferta) && <p className="inicio-plan-lugar">{lugarDe(oferta)}</p>}
                      </div>
                      <span className={`inicio-chip ${estado.clase}`}>{estado.texto}</span>
                      <a className="inicio-boton inicio-boton-claro" href="/mis_inscripciones">
                        Ver inscripción
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {!cargandoPlanes && !errorOfertas && disponiblesDelDia.length > 0 && (
          <>
            <p className="inicio-etiqueta">Puedes apuntarte</p>
            <div className="inicio-planes">
              {disponiblesDelDia.map(({ oferta, turno, coincide }) => (
                <article key={`${oferta.id}-${turno.id}`} className="inicio-plan">
                  <div className="inicio-plan-hora">
                    <strong>{turno.horaInicio}</strong>
                    <span>a {turno.horaFin}</span>
                  </div>
                  <div className="inicio-plan-cuerpo">
                    <img src={imagenDeOferta(oferta)} alt="" />
                    <div className="inicio-plan-texto">
                      <p className="inicio-plan-org">{oferta.organizacion}</p>
                      <h4>{oferta.titulo}</h4>
                      {lugarDe(oferta) && <p className="inicio-plan-lugar">{lugarDe(oferta)}</p>}
                      {coincide && (
                        <p className="inicio-plan-choque">
                          Coincide con {coincide.inscripcion.titulo} ({coincide.turno.horaInicio} -{' '}
                          {coincide.turno.horaFin})
                        </p>
                      )}
                    </div>
                    <span className={`inicio-chip ${turno.plazasLibres > 0 ? 'inicio-chip-ok' : 'inicio-chip-lleno'}`}>
                      {textoPlazasLibres(turno.plazasLibres)}
                    </span>
                    <a className="inicio-boton" href={`/ofertas/${oferta.id}`}>
                      Ver detalles
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!cargandoPlanes && !errorOfertas && disponiblesDelDia.length === 0 && (
          <div className="inicio-vacio">
            <h4>
              {misPlanesDelDia.length > 0
                ? 'No hay más planes publicados para este día'
                : 'No hay planes publicados para este día'}
            </h4>
            <p>
              Elige otro día o mira <a href="/oportunidades">todas las oportunidades</a>.
            </p>
          </div>
        )}

        {/* Sistema de recomendacion: ofertas segun los intereses de su perfil, su isla e historial */}
        <Recomendaciones usuario={usuario} />

        {/* Les faltan manos */}
        {faltanManos.length > 0 && (
          <section className="inicio-faltan">
            <div className="inicio-faltan-intro">
              <h2 className="inicio-titulo">Les faltan manos</h2>
              <p>Actividades de los próximos días que todavía no han cubierto sus plazas.</p>
            </div>
            <div className="inicio-faltan-lista">
              {faltanManos.map(({ oferta, turno, cubiertas, porcentaje }) => {
                const dia = diaDe(turno.fecha)
                return (
                  <div key={`${oferta.id}-${turno.id}`} className="inicio-faltan-fila">
                    <div className="inicio-faltan-texto">
                      <p className="inicio-faltan-titulo">{oferta.titulo}</p>
                      <p className="inicio-faltan-sub">
                        {oferta.organizacion}, {diaLargo(dia)} {numeroDia(dia)}
                        {oferta.ubicacion ? ` en ${oferta.ubicacion.municipio}` : ` (${lugarDe(oferta)})`}
                      </p>
                    </div>
                    <BarraPlazas titulo={oferta.titulo} cubiertas={cubiertas} plazas={turno.plazas} porcentaje={porcentaje} />
                    <a className="inicio-boton" href={`/ofertas/${oferta.id}`}>
                      Apuntarme
                    </a>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </>
  )
}

function BarraPlazas({
  titulo,
  cubiertas,
  plazas,
  porcentaje,
}: {
  titulo: string
  cubiertas: number
  plazas: number
  porcentaje: number
}) {
  return (
    <div className="inicio-faltan-progreso">
      <div
        className="inicio-barra"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={plazas}
        aria-valuenow={cubiertas}
        aria-label={`Plazas cubiertas de ${titulo}`}
      >
        <div style={{ width: `${porcentaje}%` }} />
      </div>
      <p>
        Cubiertas {cubiertas} de {plazas} plazas
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inicio de la asociacion (rol ofertante)
//   GET /api/ofertas/mias                 -> sus ofertas, turnos y candidatos pendientes
//   GET /api/inscripciones/oferta/:id     -> candidatos de las actividades ya pasadas
// ---------------------------------------------------------------------------

// Lo que usa el inicio de GET /api/inscripciones/oferta/:id
type Candidato = {
  id: string
  estado: string
  terminada: boolean
  valoracion: { puntuacion: number } | null
}

type PorCerrar = {
  oferta: MiOferta
  porConfirmar: number
  porValorar: number
}

// Estados en los que la actividad sigue en marcha para la asociacion
const ESTADOS_EN_MARCHA = ['publicada', 'cerrada']
// Actividades pasadas que se revisan para "Pendiente de cerrar"
const MAX_OFERTAS_REVISADAS = 10
// Por debajo de este porcentaje de plazas cubiertas se avisa de que faltan voluntarios
const UMBRAL_FALTAN = 50
const DIAS_FALTAN = 14

function useMisOfertas() {
  const [ofertas, setOfertas] = useState<MiOferta[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()

    fetch('/api/ofertas/mias', { headers: cabecerasConSesion(), signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar tus ofertas')
        setOfertas(data)
        setError(null)
      })
      .catch((error: Error) => {
        if (controlador.signal.aborted) return
        setOfertas([])
        setError(
          error instanceof SyntaxError || error instanceof TypeError
            ? 'No se pudo conectar con el servidor'
            : error.message,
        )
      })

    return () => controlador.abort()
  }, [])

  return { ofertas, error }
}

// Asistencias por confirmar y voluntarios por valorar en las actividades ya pasadas
function usePendientesDeCerrar(ofertas: MiOferta[] | null) {
  const [porCerrar, setPorCerrar] = useState<PorCerrar[]>([])
  const hoy = hoyIso()

  const conTurnosPasados = (ofertas ?? [])
    .filter(
      (oferta) =>
        ESTADOS_EN_MARCHA.includes(oferta.estado) &&
        oferta.turnos.some((turno) => diaDe(turno.fecha) <= hoy),
    )
    .slice(0, MAX_OFERTAS_REVISADAS)
  const clave = conTurnosPasados.map((oferta) => oferta.id).join(',')

  useEffect(() => {
    if (!clave) return
    const controlador = new AbortController()
    const revisar = conTurnosPasados

    Promise.all(
      revisar.map((oferta) =>
        fetch(`/api/inscripciones/oferta/${encodeURIComponent(oferta.id)}`, {
          headers: cabecerasConSesion(),
          signal: controlador.signal,
        })
          .then((res) => (res.ok ? (res.json() as Promise<Candidato[]>) : []))
          .then((candidatos) => ({
            oferta,
            porConfirmar: candidatos.filter((c) => c.estado === 'aceptada' && c.terminada).length,
            porValorar: candidatos.filter((c) => c.estado === 'completada' && !c.valoracion).length,
          }))
          // Si falla una oferta, simplemente no aparece en la lista
          .catch(() => ({ oferta, porConfirmar: 0, porValorar: 0 })),
      ),
    ).then((resultado) => {
      if (!controlador.signal.aborted) {
        setPorCerrar(resultado.filter((r) => r.porConfirmar > 0 || r.porValorar > 0))
      }
    })

    return () => controlador.abort()
    // La lista se vuelve a pedir solo si cambian las ofertas a revisar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return clave ? porCerrar : []
}

type TurnoPropio = {
  oferta: MiOferta
  turno: Turno
  cubiertas: number
  porcentaje: number
}

function InicioAsociacion({ usuario }: { usuario: Usuario }) {
  const { ofertas, error } = useMisOfertas()
  const porCerrar = usePendientesDeCerrar(ofertas)
  const [diaElegido, setDiaElegido] = useState(hoyIso())
  const [copiada, setCopiada] = useState<string | null>(null)

  const hoy = hoyIso()
  const ahora = horaActual()
  const dias = Array.from({ length: DIAS_AGENDA }, (_, i) => sumarDias(hoy, i))
  const listaOfertas = ofertas ?? []
  const cargando = ofertas === null

  const enMarcha = listaOfertas.filter((oferta) => ESTADOS_EN_MARCHA.includes(oferta.estado))

  // Todos sus turnos que aun no han terminado, por orden
  const proximosTurnos: TurnoPropio[] = enMarcha
    .flatMap((oferta) =>
      oferta.turnos
        .filter((turno) => sigueEnPie(turno, hoy, ahora))
        .map((turno) => {
          const cubiertas = turno.plazas - turno.plazasLibres
          return {
            oferta,
            turno,
            cubiertas,
            porcentaje: turno.plazas > 0 ? Math.round((cubiertas / turno.plazas) * 100) : 100,
          }
        }),
    )
    .sort((a, b) =>
      a.turno.fecha === b.turno.fecha
        ? a.turno.horaInicio.localeCompare(b.turno.horaInicio)
        : a.turno.fecha.localeCompare(b.turno.fecha),
    )

  const turnosDe = (dia: string) => proximosTurnos.filter((t) => diaDe(t.turno.fecha) === dia)
  const turnosDelDia = turnosDe(diaElegido)

  // Solicitudes por revisar, las ofertas con mas primero
  const conPendientes = listaOfertas
    .filter((oferta) => oferta.candidatosPendientes > 0)
    .sort((a, b) => b.candidatosPendientes - a.candidatosPendientes)
  const totalPendientes = conPendientes.reduce((total, oferta) => total + oferta.candidatosPendientes, 0)
  const proximoTurno = proximosTurnos[0]

  // Turnos publicados de las proximas dos semanas que van flojos de voluntarios
  const limiteFaltan = sumarDias(hoy, DIAS_FALTAN - 1)
  const necesitanVoluntarios = proximosTurnos
    .filter(
      (t) =>
        t.oferta.estado === 'publicada' &&
        diaDe(t.turno.fecha) <= limiteFaltan &&
        t.turno.plazasLibres > 0 &&
        t.porcentaje < UMBRAL_FALTAN,
    )
    .sort((a, b) => a.porcentaje - b.porcentaje || a.turno.fecha.localeCompare(b.turno.fecha))
    .slice(0, MAX_FALTAN_MANOS)

  // Resumen de la cabecera
  const publicadas = listaOfertas.filter((oferta) => oferta.estado === 'publicada' && !oferta.terminada).length
  const voluntariosSemana = dias.reduce(
    (total, dia) => total + turnosDe(dia).reduce((suma, t) => suma + t.cubiertas, 0),
    0,
  )

  // Islas donde tiene actividades en marcha
  const ofertasPorIsla = new Map<string, number>()
  for (const oferta of enMarcha) {
    const isla = oferta.ubicacion?.isla
    if (isla) ofertasPorIsla.set(isla, (ofertasPorIsla.get(isla) ?? 0) + 1)
  }
  const islasConOfertas = ISLAS_MAPA.filter((isla) => ofertasPorIsla.has(isla.slug))
    .map((isla) => `${isla.nombre} (${ofertasPorIsla.get(isla.slug)})`)
    .join(', ')

  function resumenDia(dia: string): ResumenDia {
    const turnos = turnosDe(dia)
    const pendientes = turnos.some((t) => t.oferta.candidatosPendientes > 0)
    return {
      texto: cargando ? '…' : turnos.length ? plural(turnos.length, 'turno', 'turnos') : 'Libre',
      aria: `${plural(turnos.length, 'turno', 'turnos')}${pendientes ? ', con solicitudes por revisar' : ''}`,
      destacado: pendientes,
      libre: !turnos.length,
    }
  }

  async function copiarEnlace(ofertaId: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/ofertas/${ofertaId}`)
      setCopiada(ofertaId)
      setTimeout(() => setCopiada((actual) => (actual === ofertaId ? null : actual)), 2500)
    } catch {
      // Sin permiso para el portapapeles: se abre la oferta para copiar la URL a mano
      irA(`/ofertas/${ofertaId}`)
    }
  }

  return (
    <>
      {/* Cabecera: saludo, resumen, boton de publicar y mapa */}
      <section className="inicio-hero">
        <div className="inicio-hero-contenido">
          <div className="inicio-hero-texto">
            <h1>
              Hola, {usuario.nombre}.<br />
              Esto es lo que pasa esta semana.
            </h1>
            <p>Revisa las solicitudes, sigue tus turnos y publica nuevas actividades.</p>

            <dl className="inicio-resumen">
              <div>
                <dt>Ofertas publicadas</dt>
                <dd>{cargando ? '…' : publicadas}</dd>
              </div>
              <div>
                <dt>Voluntarios esta semana</dt>
                <dd>{cargando ? '…' : voluntariosSemana}</dd>
              </div>
            </dl>

            <a className="inicio-boton-hero" href="/gestionar-ofertas">
              Publicar nueva oferta
            </a>
          </div>

          <div className="inicio-hero-mapa">
            <svg
              viewBox={VIEWBOX_MAPA}
              role="img"
              aria-label={
                islasConOfertas
                  ? `Islas donde tienes actividades: ${islasConOfertas}`
                  : 'Mapa de las ocho islas Canarias'
              }
            >
              {ISLAS_MAPA.map((isla) => {
                const total = ofertasPorIsla.get(isla.slug) ?? 0
                return (
                  <g key={isla.slug} className={total ? 'inicio-isla inicio-isla-activa' : 'inicio-isla inicio-isla-apagada'}>
                    <path d={isla.d} />
                    <text x={isla.tx} y={isla.ty} textAnchor={isla.anchor}>
                      {total ? `${isla.nombre} · ${total}` : isla.nombre}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </section>

      <main className="inicio-main" id="inicio">
        {/* Lo urgente: solicitudes por revisar, o si no la proxima actividad */}
        <article className="inicio-proxima">
          {totalPendientes > 0 ? (
            <>
              <div className="inicio-proxima-fecha inicio-proxima-aviso" aria-hidden="true">
                <strong>{totalPendientes}</strong>
                <span>nuevas</span>
              </div>
              <div className="inicio-proxima-texto">
                <p className="inicio-etiqueta">Por revisar</p>
                <p className="inicio-proxima-titulo">
                  Tienes {plural(totalPendientes, 'solicitud', 'solicitudes')} por revisar
                </p>
                <p>
                  {conPendientes
                    .slice(0, 3)
                    .map((oferta) => `${oferta.candidatosPendientes} en ${oferta.titulo}`)
                    .join(' · ')}
                  {conPendientes.length > 3 && ' · y más'}
                </p>
              </div>
              <a className="inicio-boton" href={`/gestionar-ofertas/${conPendientes[0].id}/candidatos`}>
                Revisar candidatos
              </a>
            </>
          ) : proximoTurno ? (
            <>
              <div className="inicio-proxima-fecha" aria-hidden="true">
                <span>{diaCorto(diaDe(proximoTurno.turno.fecha))}</span>
                <strong>{numeroDia(diaDe(proximoTurno.turno.fecha))}</strong>
              </div>
              <div className="inicio-proxima-texto">
                <p className="inicio-etiqueta">Tu próxima actividad</p>
                <p className="inicio-proxima-titulo">{proximoTurno.oferta.titulo}</p>
                <p>
                  De {proximoTurno.turno.horaInicio} a {proximoTurno.turno.horaFin}
                  {lugarDe(proximoTurno.oferta) && `, en ${lugarDe(proximoTurno.oferta)}`}. Cubiertas{' '}
                  {proximoTurno.cubiertas} de {proximoTurno.turno.plazas} plazas.{' '}
                  {textoFaltan(diasEntre(hoy, diaDe(proximoTurno.turno.fecha)))}
                </p>
              </div>
              <a className="inicio-enlace" href={`/gestionar-ofertas/${proximoTurno.oferta.id}/candidatos`}>
                Ver voluntarios
              </a>
            </>
          ) : (
            <>
              <div className="inicio-proxima-texto">
                <p className="inicio-etiqueta">Tu próxima actividad</p>
                <p className="inicio-proxima-titulo">
                  {cargando ? 'Cargando tus ofertas…' : error ?? 'No tienes actividades próximas'}
                </p>
                {!cargando && !error && <p>Publica una oferta para empezar a recibir voluntarios.</p>}
              </div>
              <a className="inicio-enlace" href="/gestionar-ofertas">
                Gestionar ofertas
              </a>
            </>
          )}
        </article>

        {/* Tu semana: los turnos propios */}
        <div className="inicio-cabecera-seccion">
          <div>
            <h2 className="inicio-titulo">Tu semana</h2>
            <div className="inicio-subrayado" />
          </div>
          <a className="inicio-enlace" href="/gestionar-ofertas">
            Ver todas mis ofertas
          </a>
        </div>

        <TiraDias dias={dias} diaElegido={diaElegido} onElegir={setDiaElegido} resumen={resumenDia} />

        <h3 className="inicio-titulo-dia">{tituloDelDia(hoy, diaElegido)}</h3>

        {error && <p className="empty-state">{error}</p>}
        {!error && cargando && <p className="empty-state">Cargando tus turnos…</p>}

        {!cargando && !error && turnosDelDia.length > 0 && (
          <>
            <p className="inicio-etiqueta">Tus turnos</p>
            <div className="inicio-planes">
              {turnosDelDia.map(({ oferta, turno, cubiertas, porcentaje }) => (
                <article key={`${oferta.id}-${turno.id}`} className="inicio-plan">
                  <div className="inicio-plan-hora">
                    <strong>{turno.horaInicio}</strong>
                    <span>a {turno.horaFin}</span>
                  </div>
                  <div className="inicio-plan-cuerpo">
                    <img src={imagenDeOferta(oferta)} alt="" />
                    <div className="inicio-plan-texto">
                      <p className="inicio-plan-org">
                        {oferta.estado === 'cerrada' ? 'Inscripciones cerradas' : 'Publicada'}
                      </p>
                      <h4>{oferta.titulo}</h4>
                      {lugarDe(oferta) && <p className="inicio-plan-lugar">{lugarDe(oferta)}</p>}
                    </div>
                    <BarraPlazas titulo={oferta.titulo} cubiertas={cubiertas} plazas={turno.plazas} porcentaje={porcentaje} />
                    {oferta.candidatosPendientes > 0 ? (
                      <span className="inicio-chip inicio-chip-aviso">
                        {plural(oferta.candidatosPendientes, 'solicitud', 'solicitudes')} por revisar
                      </span>
                    ) : (
                      <span className={`inicio-chip ${turno.plazasLibres > 0 ? 'inicio-chip-ok' : 'inicio-chip-lleno'}`}>
                        {turno.plazasLibres > 0 ? textoPlazasLibres(turno.plazasLibres) : 'Completo'}
                      </span>
                    )}
                    <a className="inicio-boton" href={`/gestionar-ofertas/${oferta.id}/candidatos`}>
                      Ver candidatos
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!cargando && !error && turnosDelDia.length === 0 && (
          <div className="inicio-vacio">
            <h4>No tienes turnos este día</h4>
            <p>
              Elige otro día o <a href="/gestionar-ofertas">publica una nueva oferta</a>.
            </p>
          </div>
        )}

        {/* Turnos propios con pocas plazas cubiertas */}
        {necesitanVoluntarios.length > 0 && (
          <section className="inicio-faltan">
            <div className="inicio-faltan-intro">
              <h2 className="inicio-titulo">Turnos que necesitan voluntarios</h2>
              <p>
                Tus actividades de las próximas dos semanas con menos de la mitad de las plazas cubiertas.
                Compártelas para llegar a más gente.
              </p>
            </div>
            <div className="inicio-faltan-lista">
              {necesitanVoluntarios.map(({ oferta, turno, cubiertas, porcentaje }) => {
                const dia = diaDe(turno.fecha)
                return (
                  <div key={`${oferta.id}-${turno.id}`} className="inicio-faltan-fila">
                    <div className="inicio-faltan-texto">
                      <p className="inicio-faltan-titulo">{oferta.titulo}</p>
                      <p className="inicio-faltan-sub">
                        {capitalizar(diaLargo(dia))} {numeroDia(dia)}, de {turno.horaInicio} a {turno.horaFin}
                      </p>
                    </div>
                    <BarraPlazas titulo={oferta.titulo} cubiertas={cubiertas} plazas={turno.plazas} porcentaje={porcentaje} />
                    <div className="inicio-acciones">
                      <button
                        type="button"
                        className="inicio-boton inicio-boton-secundario"
                        onClick={() => copiarEnlace(oferta.id)}
                      >
                        {copiada === oferta.id ? 'Enlace copiado' : 'Copiar enlace'}
                      </button>
                      <a className="inicio-boton" href={`/gestionar-ofertas/${oferta.id}/editar`}>
                        Editar
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Actividades pasadas con tareas pendientes */}
        {porCerrar.length > 0 && (
          <section className="inicio-faltan">
            <div className="inicio-faltan-intro">
              <h2 className="inicio-titulo">Pendiente de cerrar</h2>
              <p>Actividades que ya han pasado: confirma quién asistió y valora a los voluntarios.</p>
            </div>
            <div className="inicio-faltan-lista">
              {porCerrar.map(({ oferta, porConfirmar, porValorar }) => (
                <div key={oferta.id} className="inicio-faltan-fila">
                  <div className="inicio-faltan-texto">
                    <p className="inicio-faltan-titulo">{oferta.titulo}</p>
                    <p className="inicio-faltan-sub">
                      {[
                        porConfirmar > 0 && plural(porConfirmar, 'asistencia por confirmar', 'asistencias por confirmar'),
                        porValorar > 0 && plural(porValorar, 'valoración pendiente', 'valoraciones pendientes'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <a className="inicio-boton inicio-boton-claro" href={`/gestionar-ofertas/${oferta.id}/candidatos`}>
                    Revisar
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}

export default HomePage
