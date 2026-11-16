/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Reserva y libera las plazas de los turnos y hace avanzar la lista de espera.
 */

import type { Types } from 'mongoose'
import { Inscripcion } from '../models/Inscripcion.js'
import { Oferta } from '../models/Oferta.js'
import { notificar } from './notificaciones.js'

type Id = Types.ObjectId | string

type InscripcionConPlazas = {
  ofertaId: Types.ObjectId
  turnoIds: Types.ObjectId[]
}

// Resta una plaza a cada turno en una sola operacion: o se reservan todos o ninguno
export async function reservarPlazas(ofertaId: Id, turnoIds: Id[]): Promise<boolean> {
  const reservada = await Oferta.findOneAndUpdate(
    {
      _id: ofertaId,
      estado: 'publicada',
      $and: turnoIds.map((turnoId) => ({
        turnos: { $elemMatch: { _id: turnoId, plazasLibres: { $gte: 1 } } },
      })),
    },
    { $inc: { 'turnos.$[turno].plazasLibres': -1 } },
    { arrayFilters: [{ 'turno._id': { $in: turnoIds } }], returnDocument: 'after' },
  )
  return reservada !== null
}

async function devolverPlazas(inscripcion: InscripcionConPlazas): Promise<void> {
  await Oferta.updateOne(
    { _id: inscripcion.ofertaId },
    { $inc: { 'turnos.$[turno].plazasLibres': 1 } },
    { arrayFilters: [{ 'turno._id': { $in: inscripcion.turnoIds } }] },
  )
}

// Recorre la lista de espera por orden de llegada y pasa a pendiente a quien ya tenga plaza
// en todos sus turnos. Quien espera varios turnos puede quedar detras de alguien que pidio menos
export async function promoverListaEspera(ofertaId: Id): Promise<void> {
  const enEspera = await Inscripcion.find({ ofertaId, estado: 'en_espera' }).sort({ createdAt: 1 })

  for (const inscripcion of enEspera) {
    if (!(await reservarPlazas(ofertaId, inscripcion.turnoIds))) continue

    // Si la cancelo justo ahora, la plaza vuelve a la oferta
    const promovida = await Inscripcion.findOneAndUpdate(
      { _id: inscripcion._id, estado: 'en_espera' },
      { estado: 'pendiente' },
      { returnDocument: 'after' },
    )
    if (!promovida) {
      await devolverPlazas(inscripcion)
      continue
    }

    const oferta = await Oferta.findById(ofertaId).select('titulo')
    const titulo = oferta?.titulo ?? 'una oferta'
    await notificar([
      {
        usuarioId: promovida.voluntarioId,
        tipo: 'lista_espera_plaza',
        titulo: 'Se ha liberado una plaza',
        mensaje: `Sales de la lista de espera de "${titulo}". Tu solicitud está pendiente de que la organización la acepte. Si ya no puedes ir, cancélala para que pase al siguiente.`,
        enlace: '/mis_inscripciones',
      },
      {
        usuarioId: promovida.ofertanteId,
        tipo: 'inscripcion_nueva',
        titulo: 'Nueva solicitud desde la lista de espera',
        mensaje: `Una persona de la lista de espera de "${titulo}" ha ocupado una plaza libre.`,
        enlace: `/gestionar-ofertas/${ofertaId}/candidatos`,
      },
    ])
  }
}

// Al rechazar o cancelar una inscripcion con plaza: la devuelve y avisa a la lista de espera
export async function liberarPlazas(inscripcion: InscripcionConPlazas): Promise<void> {
  await devolverPlazas(inscripcion)
  try {
    await promoverListaEspera(inscripcion.ofertaId)
  } catch (error) {
    // La plaza ya esta libre: si falla la cola, la accion principal no debe fallar
    console.error('Error al avanzar la lista de espera:', error)
  }
}
