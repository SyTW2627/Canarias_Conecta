/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Sistema de recomendacion basado en contenido: puntua cada oferta segun el perfil
 * del voluntario (intereses, islas e historial) y explica por que se recomienda.
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
