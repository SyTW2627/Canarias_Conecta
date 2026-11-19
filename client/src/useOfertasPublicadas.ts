/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Carga las ofertas que pueden ver los voluntarios.
 */
import { useEffect, useState } from 'react'
import type { Oferta } from './ofertas.ts'

// Mismos parametros que acepta GET /api/ofertas. Los vacios no se envian
export type FiltrosOfertas = {
  q?: string
  categoria?: string
  isla?: string
  municipio?: string
  fechaDesde?: string
  fechaHasta?: string
}

function construirConsulta(filtros: FiltrosOfertas): string {
  const parametros = new URLSearchParams()

  for (const [clave, valor] of Object.entries(filtros)) {
    const limpio = valor?.trim()
    if (limpio) parametros.set(clave, limpio)
  }

  const texto = parametros.toString()
  return texto ? `?${texto}` : ''
}

// Sin filtros, la API solo devuelve ofertas publicadas con algun turno desde hoy.
// ofertas es null hasta la primera carga; en las siguientes se conservan las anteriores
// mientras cargando es true, para que la lista no parpadee al escribir
export function useOfertasPublicadas(filtros: FiltrosOfertas = {}) {
  const [ofertas, setOfertas] = useState<Oferta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Consulta de la ultima respuesta recibida: si no coincide con la actual, se esta cargando
  const [consultaResuelta, setConsultaResuelta] = useState<string | null>(null)
  const consulta = construirConsulta(filtros)
  const cargando = consultaResuelta !== consulta

  useEffect(() => {
    const controlador = new AbortController()

    fetch(`/api/ofertas${consulta}`, { signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar las ofertas')
        setOfertas(data)
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
        if (!controlador.signal.aborted) setConsultaResuelta(consulta)
      })

    return () => controlador.abort()
  }, [consulta])

  return { ofertas, error, cargando }
}
