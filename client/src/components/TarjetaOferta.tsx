/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tarjeta de una oferta, usada en el carrusel del inicio y en el catalogo.
 */
import '../pages/HomePage.css'
import {
  ISLAS,
  MODALIDADES,
  esTurnoProximo,
  estaCompleta,
  formatearFecha,
  imagenDeOferta,
  plazasDisponibles,
  textoPlazas,
  type Oferta,
} from '../ofertas.ts'

function TarjetaOferta({ oferta }: { oferta: Oferta }) {
  const turno = oferta.turnos
    .filter(esTurnoProximo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
  const completa = estaCompleta(oferta)

  return (
    <article className="opportunity-card">
      <img src={imagenDeOferta(oferta)} alt="" />
      <div className="opportunity-content">
        <p className="opportunity-organization">{oferta.organizacion}</p>
        <h3>{oferta.titulo}</h3>
        <dl>
          <div>
            <dt>Ubicación</dt>
            <dd>
              {oferta.ubicacion
                ? `${oferta.ubicacion.municipio}, ${ISLAS[oferta.ubicacion.isla]}`
                : MODALIDADES[oferta.modalidad]}
            </dd>
          </div>
          {turno && (
            <>
              <div><dt>Fecha</dt><dd>{formatearFecha(turno.fecha)}</dd></div>
              <div><dt>Horario</dt><dd>{turno.horaInicio} - {turno.horaFin}</dd></div>
            </>
          )}
        </dl>
        <div className="opportunity-footer">
          {completa ? (
            <span className="opportunity-completa">Completa</span>
          ) : (
            <span>{textoPlazas(plazasDisponibles(oferta))}</span>
          )}
          <a className="btn" href={`/ofertas/${oferta.id}`}>
            Ver detalles
          </a>
        </div>
      </div>
    </article>
  )
}

export default TarjetaOferta
