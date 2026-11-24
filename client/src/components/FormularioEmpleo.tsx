/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Formulario con el que una entidad publica una oferta de empleo.
 */
import { useEffect, useState, type FormEvent } from 'react'
import '../pages/GestionarOfertas.css'
import { ISLAS, MODALIDADES, hoyIso } from '../ofertas.ts'
import { JORNADAS, TIPOS_CONTRATO } from '../empleo.ts'

// Lo que se envia a POST /api/empleo
export type CuerpoEmpleo = {
  titulo: string
  descripcion: string
  categoriaIds: string[]
  tipoContrato: string
  jornada: string
  modalidad: string
  ubicacion?: { isla: string; municipio: string }
  salario?: string
  requisitos?: string
  vacantes: number
  fechaLimite?: string
}

type FormularioEmpleoProps = {
  // Devuelve el mensaje de error, o null si se ha publicado
  onEnviar: (cuerpo: CuerpoEmpleo) => Promise<string | null>
  onCancelar: () => void
}

type Categoria = { id: string; nombre: string }

const VACANTES_MAX = 100

const VACIO = {
  titulo: '',
  descripcion: '',
  tipoContrato: 'indefinido',
  jornada: 'completa',
  modalidad: 'presencial',
  isla: '',
  municipio: '',
  salario: '',
  requisitos: '',
  vacantes: '1',
  fechaLimite: '',
}

type Datos = typeof VACIO

// Mismas reglas que el servidor, para avisar sin esperar a la respuesta
function validarEmpleo(datos: Datos): string | null {
  if (!datos.titulo.trim() || !datos.descripcion.trim()) {
    return 'El título y la descripción son obligatorios'
  }
  if (datos.modalidad !== 'online' && (!datos.isla || !datos.municipio.trim())) {
    return 'Indica la isla y el municipio del puesto'
  }
  const vacantes = Number(datos.vacantes)
  if (!Number.isInteger(vacantes) || vacantes < 1 || vacantes > VACANTES_MAX) {
    return `Las vacantes deben ser un número entre 1 y ${VACANTES_MAX}`
  }
  if (datos.fechaLimite && datos.fechaLimite < hoyIso()) {
    return 'La fecha límite no puede ser pasada'
  }
  return null
}

function FormularioEmpleo({ onEnviar, onCancelar }: FormularioEmpleoProps) {
  const [datos, setDatos] = useState<Datos>(VACIO)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaIds, setCategoriaIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()
    // Las categorias son opcionales: si fallan, se publica sin ellas
    fetch('/api/categorias', { signal: controlador.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategorias)
      .catch(() => {})
    return () => controlador.abort()
  }, [])

  function cambiar(campo: keyof Datos, valor: string) {
    setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  function alternarCategoria(id: string) {
    setCategoriaIds((anteriores) =>
      anteriores.includes(id) ? anteriores.filter((otro) => otro !== id) : [...anteriores, id],
    )
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const errorValidacion = validarEmpleo(datos)
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }

    setError(null)
    setEnviando(true)
    const errorEnvio = await onEnviar({
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion.trim(),
      categoriaIds,
      tipoContrato: datos.tipoContrato,
      jornada: datos.jornada,
      modalidad: datos.modalidad,
      ubicacion:
        datos.modalidad === 'online'
          ? undefined
          : { isla: datos.isla, municipio: datos.municipio.trim() },
      salario: datos.salario.trim() || undefined,
      requisitos: datos.requisitos.trim() || undefined,
      vacantes: Number(datos.vacantes),
      fechaLimite: datos.fechaLimite || undefined,
    })
    setEnviando(false)

    if (errorEnvio) {
      setError(errorEnvio)
      return
    }
    setDatos(VACIO)
    setCategoriaIds([])
  }

  return (
    <form className="gestion-bloque gestion-formulario" onSubmit={enviar} noValidate>
      <div className="formulario-cabecera">
        <h2>Nueva oferta de empleo</h2>
        <p className="gestion-ayuda">Los campos marcados con * son obligatorios.</p>
      </div>

      <section className="formulario-seccion">
        <div className="formulario-seccion-info">
          <span className="formulario-paso" aria-hidden="true">1</span>
          <div>
            <h3>El puesto</h3>
            <p>Qué hará la persona contratada y qué necesita saber.</p>
          </div>
        </div>

        <div className="formulario-campos">
          <label>
            <span>Título del puesto *</span>
            <input
              value={datos.titulo}
              maxLength={120}
              onChange={(e) => cambiar('titulo', e.target.value)}
              placeholder="Ej. Técnico/a de proyectos sociales"
            />
          </label>

          <label>
            <span>Descripción *</span>
            <textarea
              value={datos.descripcion}
              maxLength={5000}
              rows={6}
              onChange={(e) => cambiar('descripcion', e.target.value)}
              placeholder="Funciones, equipo, horario..."
            />
          </label>

          <label>
            <span>Requisitos</span>
            <textarea
              value={datos.requisitos}
              maxLength={2000}
              rows={3}
              onChange={(e) => cambiar('requisitos', e.target.value)}
              placeholder="Formación, experiencia, idiomas..."
            />
          </label>

          {categorias.length > 0 && (
            <fieldset>
              <legend>Sector</legend>
              <div className="gestion-categorias">
                {categorias.map((categoria) => (
                  <label key={categoria.id} className="gestion-check">
                    <input
                      type="checkbox"
                      checked={categoriaIds.includes(categoria.id)}
                      onChange={() => alternarCategoria(categoria.id)}
                    />
                    {categoria.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </section>

      <section className="formulario-seccion">
        <div className="formulario-seccion-info">
          <span className="formulario-paso" aria-hidden="true">2</span>
          <div>
            <h3>Condiciones</h3>
            <p>Contrato, jornada, lugar y plazo para presentar candidaturas.</p>
          </div>
        </div>

        <div className="formulario-campos">
          <div className="gestion-fila gestion-fila-4">
            <label>
              <span>Contrato *</span>
              <select value={datos.tipoContrato} onChange={(e) => cambiar('tipoContrato', e.target.value)}>
                {Object.entries(TIPOS_CONTRATO).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Jornada *</span>
              <select value={datos.jornada} onChange={(e) => cambiar('jornada', e.target.value)}>
                {Object.entries(JORNADAS).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Modalidad *</span>
              <select value={datos.modalidad} onChange={(e) => cambiar('modalidad', e.target.value)}>
                {Object.entries(MODALIDADES).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Vacantes *</span>
              <input
                type="number"
                min={1}
                max={VACANTES_MAX}
                value={datos.vacantes}
                onChange={(e) => cambiar('vacantes', e.target.value)}
              />
            </label>
          </div>

          <div className="gestion-fila gestion-fila-4">
            {datos.modalidad !== 'online' && (
              <>
                <label>
                  <span>Isla *</span>
                  <select value={datos.isla} onChange={(e) => cambiar('isla', e.target.value)}>
                    <option value="">Elige una isla</option>
                    {Object.entries(ISLAS).map(([valor, nombre]) => (
                      <option key={valor} value={valor}>{nombre}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Municipio *</span>
                  <input
                    value={datos.municipio}
                    onChange={(e) => cambiar('municipio', e.target.value)}
                    placeholder="Ej. La Laguna"
                  />
                </label>
              </>
            )}

            <label>
              <span>Salario</span>
              <input
                value={datos.salario}
                maxLength={100}
                onChange={(e) => cambiar('salario', e.target.value)}
                placeholder="Ej. 18.000 € brutos/año"
              />
            </label>

            <label>
              <span>Fecha límite</span>
              <input
                type="date"
                value={datos.fechaLimite}
                min={hoyIso()}
                onChange={(e) => cambiar('fechaLimite', e.target.value)}
              />
            </label>
          </div>
          <p className="gestion-ayuda">
            Sin fecha límite, la oferta admite candidaturas hasta que la cierres.
          </p>
        </div>
      </section>

      <div className="formulario-pie">
        {error && <p className="gestion-error" role="alert">{error}</p>}
        <div className="formulario-botones">
          <button type="button" className="btn btn-outline" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={enviando}>
            {enviando ? 'Publicando...' : 'Publicar oferta de empleo'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default FormularioEmpleo
