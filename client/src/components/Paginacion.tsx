/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Navegacion entre paginas de un catalogo: anterior, numeros y siguiente.
 */
import './Paginacion.css'
import { paginasVisibles } from '../paginacion.ts'

type PaginacionProps = {
  actual: number
  total: number
  // Nombre accesible de la navegacion, p. ej. "Páginas de oportunidades"
  etiqueta: string
  onCambiar: (pagina: number) => void
}

function Paginacion({ actual, total, etiqueta, onCambiar }: PaginacionProps) {
  if (total <= 1) return null

  return (
    <nav className="paginacion" aria-label={etiqueta}>
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

export default Paginacion
