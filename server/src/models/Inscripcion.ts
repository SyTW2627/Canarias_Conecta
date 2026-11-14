/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de inscripcion de un voluntario en una oferta (coleccion inscripciones).
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

export const ESTADOS_INSCRIPCION = [
  'pendiente',
  'aceptada',
  'rechazada',
  'cancelada',
  'completada',
  'no_presentado'
] as const

// Estados que impiden volver a inscribirse en la misma oferta
const ESTADOS_QUE_BLOQUEAN = ['pendiente', 'aceptada', 'completada', 'no_presentado']

const valoracionSchema = new Schema(
  {
    autorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    puntuacion: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, trim: true },
    fecha: { type: Date, default: Date.now }
  },
  { _id: false }
)

const inscripcionSchema = new Schema(
  {
    voluntarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ofertaId: { type: Schema.Types.ObjectId, ref: 'Oferta', required: true },
    // Copiado de la oferta para listar las inscripciones de un ofertante sin consultarla
    ofertanteId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // _id de los turnos dentro de oferta.turnos
    turnoIds: {
      type: [Schema.Types.ObjectId],
      validate: {
        validator: (turnoIds: unknown[]) => turnoIds.length > 0,
        message: 'La inscripcion necesita al menos un turno'
      }
    },
    estado: { type: String, enum: ESTADOS_INSCRIPCION, default: 'pendiente' },
    mensaje: { type: String, trim: true },
    motivoRechazo: { type: String, trim: true },
    fechaResolucion: { type: Date },
    fechaCancelacion: { type: Date },
    // Cancelada con menos antelacion de la minima: queda en el historial del voluntario
    cancelacionTardia: { type: Boolean },
    horasRealizadas: { type: Number, min: 0 },
    valoracionAlVoluntario: { type: valoracionSchema },
    valoracionALaOferta: { type: valoracionSchema }
  },
  { collection: 'inscripciones', timestamps: true }
)

// Parcial: quien cancelo o fue rechazado puede volver a inscribirse
inscripcionSchema.index(
  { voluntarioId: 1, ofertaId: 1 },
  { unique: true, partialFilterExpression: { estado: { $in: ESTADOS_QUE_BLOQUEAN } } }
)
inscripcionSchema.index({ ofertaId: 1, estado: 1 })
inscripcionSchema.index({ ofertanteId: 1, estado: 1 })
inscripcionSchema.index({ voluntarioId: 1, estado: 1 })

export type InscripcionDoc = InferSchemaType<typeof inscripcionSchema>

export const Inscripcion = model('Inscripcion', inscripcionSchema)
