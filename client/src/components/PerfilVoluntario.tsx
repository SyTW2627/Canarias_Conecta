/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Perfil de un voluntario tal y como lo ve una entidad (candidatos y recomendados).
 */
import type { ReactNode } from 'react'
import '../pages/Candidatos.css'

export type PerfilPublicoVoluntario = {
  id: string
  nombre: string
  avatarUrl: string | null
  isla: string | null
  municipio: string | null
  edad: number | null
  biografia: string | null
  intereses: { id: string; nombre: string }[]
  habilidades: string[]
  idiomas: string[]
  estadisticas: {
    horasTotales: number
    colaboraciones: number
    valoracionMedia: number
    numValoraciones: number
  }
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
}

export function AvatarVoluntario({ voluntario }: { voluntario: PerfilPublicoVoluntario }) {
  return voluntario.avatarUrl ? (
    <img className="candidato-avatar" src={voluntario.avatarUrl} alt="" />
  ) : (
    <span className="candidato-avatar" aria-hidden="true">
      {iniciales(voluntario.nombre)}
    </span>
  )
}

type Props = {
  id: string
  voluntario: PerfilPublicoVoluntario
  // Secciones extra al final, p. ej. el contacto de un candidato aceptado
  children?: ReactNode
}

function PerfilVoluntario({ id, voluntario, children }: Props) {
  return (
    <div className="candidato-perfil" id={id}>
      <dl className="candidato-estadisticas">
        <div>
          <dt>Horas de voluntariado</dt>
          <dd>{voluntario.estadisticas.horasTotales}</dd>
        </div>
        <div>
          <dt>Colaboraciones</dt>
          <dd>{voluntario.estadisticas.colaboraciones}</dd>
        </div>
        <div>
          <dt>Valoración media</dt>
          <dd>
            {voluntario.estadisticas.numValoraciones > 0
              ? `${voluntario.estadisticas.valoracionMedia.toFixed(1)} / 5 (${voluntario.estadisticas.numValoraciones})`
              : 'Sin valoraciones'}
          </dd>
        </div>
      </dl>

      <h4>Sobre mí</h4>
      <p>{voluntario.biografia || 'No ha escrito una presentación.'}</p>

      <h4>Intereses</h4>
      {voluntario.intereses.length > 0 ? (
        <div className="candidato-etiquetas">
          {voluntario.intereses.map((interes) => (
            <span key={interes.id} className="tag">{interes.nombre}</span>
          ))}
        </div>
      ) : (
        <p>Sin intereses indicados.</p>
      )}

      <h4>Habilidades</h4>
      <p>
        {voluntario.habilidades.length > 0
          ? voluntario.habilidades.join(', ')
          : 'Sin habilidades indicadas.'}
      </p>

      <h4>Idiomas</h4>
      <p>
        {voluntario.idiomas.length > 0 ? voluntario.idiomas.join(', ') : 'Sin idiomas indicados.'}
      </p>

      {children}
    </div>
  )
}

export default PerfilVoluntario
