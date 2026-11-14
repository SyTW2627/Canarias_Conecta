/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Devuelve a la oferta las plazas que ocupaba una inscripcion.
 */

import type { Types } from 'mongoose'
import { Oferta } from '../models/Oferta.js'

type InscripcionConPlazas = {
  ofertaId: Types.ObjectId
  turnoIds: Types.ObjectId[]
}

// Se llama al rechazar o cancelar una inscripcion que tenia plazas reservadas
export async function devolverPlazas(inscripcion: InscripcionConPlazas): Promise<void> {
  await Oferta.updateOne(
    { _id: inscripcion.ofertaId },
    { $inc: { 'turnos.$[turno].plazasLibres': 1 } },
    { arrayFilters: [{ 'turno._id': { $in: inscripcion.turnoIds } }] },
  )
}
