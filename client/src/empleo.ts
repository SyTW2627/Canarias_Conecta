/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tipos y textos de las ofertas de empleo y las candidaturas, compartidos por sus pantallas.
 */
import { ISLAS, MODALIDADES } from './ofertas.ts'

export type OfertaEmpleo = {
  id: string
  titulo: string
  descripcion: string
  organizacion: string
  categorias: { id: string; nombre: string; slug: string }[]
  tipoContrato: string
  jornada: string
  modalidad: string
  ubicacion?: { isla: string; municipio: string }
  salario: string | null
  requisitos: string | null
  vacantes: number
  fechaLimite: string | null
  fechaPublicacion: string
  // Sigue publicada y no ha pasado su fecha limite
  abierta: boolean
}

// Respuesta de GET /api/empleo: una pagina del catalogo
export type PaginaEmpleos = {
  ofertas: OfertaEmpleo[]
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
}

// Numeros de pagina a mostrar: siempre la primera, la ultima y las vecinas de la actual;
// null marca un hueco ("…")
export function paginasVisibles(actual: number, total: number): (number | null)[] {
  const paginas: (number | null)[] = []
  for (let n = 1; n <= total; n++) {
    if (n === 1 || n === total || Math.abs(n - actual) <= 1 || total <= 7) {
      paginas.push(n)
    } else if (paginas.at(-1) !== null) {
      paginas.push(null)
    }
  }
  return paginas
}

// Como la ve su propia entidad
export type MiOfertaEmpleo = OfertaEmpleo & {
  estado: 'publicada' | 'cerrada'
  candidaturas: number
  candidaturasPendientes: number
}

export type EstadoCandidatura = 'pendiente' | 'preseleccionada' | 'descartada' | 'retirada'

// Una candidatura del voluntario, con los datos basicos de su oferta
export type MiCandidatura = {
  id: string
  estado: EstadoCandidatura
  fechaCandidatura: string
  ofertaId: string
  titulo: string
  organizacion: string
  tipoContrato: string
  jornada: string
  modalidad: string
  ubicacion: { isla: string; municipio: string } | null
  ofertaAbierta: boolean
}

// Una candidatura como la ve la entidad: el perfil de voluntariado hace de curriculum
export type CandidaturaRecibida = {
  id: string
  estado: Exclude<EstadoCandidatura, 'retirada'>
  mensaje: string | null
  fechaCandidatura: string
  fechaResolucion: string | null
  candidato: {
    id: string
    nombre: string
    avatarUrl: string | null
    isla: string | null
    municipio: string | null
    biografia: string | null
    intereses: { id: string; nombre: string }[]
    habilidades: string[]
    idiomas: string[]
    acreditaciones: { nombre: string; fechaObtencion: string }[]
    estadisticas: {
      horasTotales: number
      colaboraciones: number
      valoracionMedia: number
      numValoraciones: number
    }
    // Solo cuando esta preseleccionada
    email: string | null
    telefono: string | null
  }
}

export const TIPOS_CONTRATO: Record<string, string> = {
  indefinido: 'Indefinido',
  temporal: 'Temporal',
  practicas: 'Prácticas',
  formacion: 'Formación',
  autonomo: 'Autónomo / freelance',
}

export const JORNADAS: Record<string, string> = {
  completa: 'Jornada completa',
  parcial: 'Jornada parcial',
}

export const ESTADOS_CANDIDATURA: Record<EstadoCandidatura, string> = {
  pendiente: 'En revisión',
  preseleccionada: 'Preseleccionada',
  descartada: 'Descartada',
  retirada: 'Retirada',
}

export function lugarDeEmpleo(oferta: Pick<OfertaEmpleo, 'ubicacion' | 'modalidad'>): string {
  const lugar = oferta.ubicacion
    ? `${oferta.ubicacion.municipio}, ${ISLAS[oferta.ubicacion.isla] ?? oferta.ubicacion.isla}`
    : null
  if (!lugar) return MODALIDADES[oferta.modalidad] ?? oferta.modalidad
  return oferta.modalidad === 'presencial' ? lugar : `${lugar} · ${MODALIDADES[oferta.modalidad]}`
}

// La fecha limite llega a las 00:00 UTC: se muestra en UTC para no cambiar de dia
const FORMATO_FECHA_CORTA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatearFechaCorta(fecha: string): string {
  return FORMATO_FECHA_CORTA.format(new Date(fecha))
}

// La fecha de una candidatura es un instante: se muestra en la zona horaria del usuario
export function formatearDia(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
