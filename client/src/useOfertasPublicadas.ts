/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Carga las ofertas que pueden ver los voluntarios, completas o por paginas.
 */
import { useEffect, useState } from 'react'
import type { Oferta } from './ofertas.ts'
import type { Pagina } from './paginacion.ts'

// Mismos parametros que acepta GET /api/ofertas. Los vacios no se envian
export type FiltrosOfertas = {
  q?: string
  categoria?: string
  isla?: string
  municipio?: string
  fechaDesde?: string
  fechaHasta?: string
}

// "q=playa&isla=tenerife", sin "?": identifica los filtros aplicados
export function construirFiltros(filtros: FiltrosOfertas): string {
  const parametros = new URLSearchParams()

  for (const [clave, valor] of Object.entries(filtros)) {
    const limpio = valor?.trim()
    if (limpio) parametros.set(clave, limpio)
  }

  return parametros.toString()
}

// datos es null hasta la primera carga; en las siguientes se conservan los anteriores
// mientras cargando es true, para que la lista no parpadee al escribir
function useCargarOfertas<T>(url: string) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  // URL de la ultima respuesta recibida: si no coincide con la actual, se esta cargando
  const [urlResuelta, setUrlResuelta] = useState<string | null>(null)
  const cargando = urlResuelta !== url

  useEffect(() => {
    const controlador = new AbortController()

    fetch(url, { signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar las ofertas')
        setDatos(data)
        setError(null)
      })
      .catch((error: Error) => {
        if (!controlador.signal.aborted) {
          setError(
            error instanceof SyntaxError || error instanceof TypeError
              ? 'No se pudo conectar con el servidor'
              : error.message,
          )
        }
      })
      .finally(() => {
        if (!controlador.signal.aborted) setUrlResuelta(url)
      })

    return () => controlador.abort()
  }, [url])

  return { datos, error, cargando }
}

// Sin filtros, la API solo devuelve ofertas publicadas con algun turno desde hoy
export function useOfertasPublicadas(filtros: FiltrosOfertas = {}) {
  const consulta = construirFiltros(filtros)
  const { datos, error, cargando } = useCargarOfertas<Oferta[]>(
    `/api/ofertas${consulta ? `?${consulta}` : ''}`,
  )
  return { ofertas: datos, error, cargando }
}

// Una pagina del catalogo: { ofertas, total, pagina, porPagina, totalPaginas }
export function useOfertasPaginadas(filtros: FiltrosOfertas, pagina: number) {
  const consulta = construirFiltros(filtros)
  const { datos, error, cargando } = useCargarOfertas<Pagina<Oferta>>(
    `/api/ofertas?${consulta ? `${consulta}&` : ''}pagina=${pagina}`,
  )
  return { resultado: datos, error, cargando }
}
