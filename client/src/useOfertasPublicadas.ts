/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Carga las ofertas que pueden ver los voluntarios.
 */
import { useEffect, useState } from 'react'
import type { Oferta } from './ofertas.ts'

// La API solo devuelve ofertas publicadas con algun turno desde hoy.
// ofertas es null mientras se cargan
export function useOfertasPublicadas() {
  const [ofertas, setOfertas] = useState<Oferta[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()

    fetch('/api/ofertas', { signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'No se pudieron cargar las ofertas')
        setOfertas(data)
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

    return () => controlador.abort()
  }, [])

  return { ofertas, error }
}
