/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Sistema de recomendacion basado en contenido: puntua cada oferta segun el perfil
 * del voluntario (intereses, islas e historial) y explica por que se recomienda. Tambien hace
 * el camino inverso: puntua a los voluntarios mas compatibles con una oferta de una entidad.
 */

// Pesos de cada criterio. Suman 1, asi la puntuacion final va de 0 a 1
export const PESOS = {
  intereses: 0.6,
  isla: 0.2,
  historial: 0.2
} as const

export const MAX_RECOMENDACIONES = 3

export type PerfilRecomendacion = {
  // Categorias que el voluntario marco como intereses en su perfil
  interesIds: string[]
  // Islas en las que le viene bien colaborar (perfil + isla en la que vive)
  islas: string[]
  // Categorias de las ofertas en las que se inscribio o que guardo como favoritas
  historial: Array<{ titulo: string; categoriaIds: string[] }>
}

export type OfertaCandidata = {
  id: string
  categorias: Array<{ id: string; nombre: string }>
  modalidad: string
  isla?: string
}

export type Motivo = {
  tipo: 'interes' | 'isla' | 'online' | 'historial'
  texto: string
}

export type Puntuacion = {
  // 0..100, para mostrar como "% de afinidad"
  afinidad: number
  motivos: Motivo[]
}

const NOMBRES_ISLAS: Record<string, string> = {
  tenerife: 'Tenerife',
  gran_canaria: 'Gran Canaria',
  lanzarote: 'Lanzarote',
  fuerteventura: 'Fuerteventura',
  la_palma: 'La Palma',
  la_gomera: 'La Gomera',
  el_hierro: 'El Hierro',
  la_graciosa: 'La Graciosa'
}

// Puntua una oferta para un perfil. Cada criterio aporta entre 0 y su peso
export function puntuarOferta(oferta: OfertaCandidata, perfil: PerfilRecomendacion): Puntuacion {
  const motivos: Motivo[] = []
  let total = 0

  // 1. Intereses: proporcion de las categorias de la oferta que le interesan
  const intereses = new Set(perfil.interesIds)
  const enComun = oferta.categorias.filter((categoria) => intereses.has(categoria.id))
  if (oferta.categorias.length > 0 && enComun.length > 0) {
    total += PESOS.intereses * (enComun.length / oferta.categorias.length)
    motivos.push({
      tipo: 'interes',
      texto: `Te interesa ${enComun.map((categoria) => categoria.nombre).join(' y ')}`
    })
  }

  // 2. Ubicacion: en una de sus islas, o online (se puede hacer desde cualquiera)
  if (oferta.modalidad === 'online') {
    total += PESOS.isla
    motivos.push({ tipo: 'online', texto: 'Online, desde cualquier isla' })
  } else if (oferta.isla && perfil.islas.includes(oferta.isla)) {
    total += PESOS.isla
    motivos.push({ tipo: 'isla', texto: `En tu isla: ${NOMBRES_ISLAS[oferta.isla] ?? oferta.isla}` })
  }

  // 3. Historial: comparte categoria con algo en lo que ya participo o que guardo
  const categoriasOferta = new Set(oferta.categorias.map((categoria) => categoria.id))
  const parecida = perfil.historial.find((anterior) =>
    anterior.categoriaIds.some((id) => categoriasOferta.has(id))
  )
  if (parecida) {
    total += PESOS.historial
    motivos.push({ tipo: 'historial', texto: `Parecida a «${parecida.titulo}»` })
  }

  return { afinidad: Math.round(total * 100), motivos }
}

// Ordena de mas a menos afin y se queda con las mejores. Descarta las que no encajan en nada
export function recomendar<T extends OfertaCandidata>(
  ofertas: T[],
  perfil: PerfilRecomendacion,
  maximo = MAX_RECOMENDACIONES
): Array<{ oferta: T } & Puntuacion> {
  return ofertas
    .map((oferta) => ({ oferta, ...puntuarOferta(oferta, perfil) }))
    .filter(({ afinidad }) => afinidad > 0)
    // sort es estable: a igual afinidad se mantiene el orden recibido (turno mas cercano)
    .sort((a, b) => b.afinidad - a.afinidad)
    .slice(0, maximo)
}

// ---------------------------------------------------------------------------
// Recomendacion inversa: voluntarios mas compatibles con una oferta (para el ofertante)
// ---------------------------------------------------------------------------

// Suman 1, asi la compatibilidad final va de 0 a 1
export const PESOS_VOLUNTARIO = {
  intereses: 0.5,
  isla: 0.2,
  disponibilidad: 0.2,
  valoracion: 0.1
} as const

export const MAX_VOLUNTARIOS_RECOMENDADOS = 10

export type FranjaDisponibilidad = { diaSemana: number; horaInicio: string; horaFin: string }

export type OfertaParaVoluntarios = {
  categorias: Array<{ id: string; nombre: string }>
  modalidad: string
  isla?: string
  edadMinima?: number
  // Solo los turnos a los que todavia se puede apuntar (futuros y con plazas)
  turnos: Array<{ fecha: Date; horaInicio: string; horaFin: string }>
}

export type VoluntarioCandidato = {
  id: string
  interesIds: string[]
  // Islas preferidas + isla en la que vive
  islas: string[]
  disponibilidad: FranjaDisponibilidad[]
  edad: number | null
  valoracionMedia: number
  numValoraciones: number
}

export type MotivoVoluntario = {
  tipo: 'interes' | 'isla' | 'online' | 'disponibilidad' | 'valoracion'
  texto: string
}

// Las fechas de los turnos se guardan a las 00:00 UTC: getUTCDay da su dia de la semana
function franjaCubreTurno(franja: FranjaDisponibilidad, turno: OfertaParaVoluntarios['turnos'][number]) {
  return (
    franja.diaSemana === turno.fecha.getUTCDay() &&
    franja.horaInicio <= turno.horaInicio &&
    franja.horaFin >= turno.horaFin
  )
}

// Puntua a un voluntario para una oferta. Devuelve null si no cumple la edad minima
export function puntuarVoluntario(
  voluntario: VoluntarioCandidato,
  oferta: OfertaParaVoluntarios
): { afinidad: number; motivos: MotivoVoluntario[] } | null {
  // Sin fecha de nacimiento no se descarta: la entidad lo comprobara al aceptarle
  if (oferta.edadMinima && voluntario.edad !== null && voluntario.edad < oferta.edadMinima) {
    return null
  }

  const motivos: MotivoVoluntario[] = []
  let total = 0

  // 1. Intereses: proporcion de las categorias de la oferta que le interesan
  const intereses = new Set(voluntario.interesIds)
  const enComun = oferta.categorias.filter((categoria) => intereses.has(categoria.id))
  if (oferta.categorias.length > 0 && enComun.length > 0) {
    total += PESOS_VOLUNTARIO.intereses * (enComun.length / oferta.categorias.length)
    motivos.push({
      tipo: 'interes',
      texto: `Le interesa ${enComun.map((categoria) => categoria.nombre).join(' y ')}`
    })
  }

  // 2. Ubicacion: colabora en la isla de la oferta, o la oferta es online
  if (oferta.modalidad === 'online') {
    total += PESOS_VOLUNTARIO.isla
    motivos.push({ tipo: 'online', texto: 'Oferta online: puede colaborar desde su isla' })
  } else if (oferta.isla && voluntario.islas.includes(oferta.isla)) {
    total += PESOS_VOLUNTARIO.isla
    motivos.push({
      tipo: 'isla',
      texto: `Colabora en ${NOMBRES_ISLAS[oferta.isla] ?? oferta.isla}`
    })
  }

  // 3. Disponibilidad: proporcion de turnos que caben en alguna de sus franjas semanales
  const cubiertos = oferta.turnos.filter((turno) =>
    voluntario.disponibilidad.some((franja) => franjaCubreTurno(franja, turno))
  ).length
  if (oferta.turnos.length > 0 && cubiertos > 0) {
    total += PESOS_VOLUNTARIO.disponibilidad * (cubiertos / oferta.turnos.length)
    motivos.push({
      tipo: 'disponibilidad',
      texto:
        cubiertos === oferta.turnos.length
          ? oferta.turnos.length === 1
            ? 'Disponible en el horario del turno'
            : 'Disponible en todos los turnos'
          : `Disponible en ${cubiertos} de ${oferta.turnos.length} turnos`
    })
  }

  // 4. Valoraciones de otras entidades: premia a quien ya ha colaborado bien
  if (voluntario.numValoraciones > 0) {
    total += PESOS_VOLUNTARIO.valoracion * (voluntario.valoracionMedia / 5)
    motivos.push({
      tipo: 'valoracion',
      texto: `Valoración media ${voluntario.valoracionMedia.toFixed(1)} / 5`
    })
  }

  return { afinidad: Math.round(total * 100), motivos }
}

// Ser online o tener buenas valoraciones lo cumplen muchos: por si solos no bastan para recomendar
const MOTIVOS_DECISIVOS = new Set<MotivoVoluntario['tipo']>(['interes', 'isla', 'disponibilidad'])

// Ordena de mas a menos compatible y se queda con los mejores
export function recomendarVoluntarios<T extends VoluntarioCandidato>(
  voluntarios: T[],
  oferta: OfertaParaVoluntarios,
  maximo = MAX_VOLUNTARIOS_RECOMENDADOS
): Array<{ voluntario: T; afinidad: number; motivos: MotivoVoluntario[] }> {
  return voluntarios
    .map((voluntario) => ({ voluntario, puntuacion: puntuarVoluntario(voluntario, oferta) }))
    .filter(
      (resultado): resultado is { voluntario: T; puntuacion: NonNullable<typeof resultado.puntuacion> } =>
        resultado.puntuacion !== null &&
        resultado.puntuacion.motivos.some((motivo) => MOTIVOS_DECISIVOS.has(motivo.tipo))
    )
    .map(({ voluntario, puntuacion }) => ({ voluntario, ...puntuacion }))
    .sort((a, b) => b.afinidad - a.afinidad)
    .slice(0, maximo)
}
