/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de candidatura de un voluntario a una oferta de empleo (coleccion candidaturas).
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

export const ESTADOS_CANDIDATURA = [
  'pendiente',
  // La entidad quiere contactar con el candidato: desde aqui ve su email y su telefono
  'preseleccionada',
  'descartada',
  // El propio candidato la retira; puede volver a postularse
  'retirada'
] as const

// Estados que impiden volver a postularse a la misma oferta
export const ESTADOS_CANDIDATURA_ACTIVA = ['pendiente', 'preseleccionada', 'descartada']

export const MENSAJE_CANDIDATURA_MAX = 2000

const candidaturaSchema = new Schema(
  {
    ofertaEmpleoId: { type: Schema.Types.ObjectId, ref: 'OfertaEmpleo', required: true },
    candidatoId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Copiado de la oferta para comprobar permisos sin consultarla
    ofertanteId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Carta de presentacion opcional
    mensaje: { type: String, trim: true, maxlength: MENSAJE_CANDIDATURA_MAX },
    estado: { type: String, enum: ESTADOS_CANDIDATURA, default: 'pendiente' },
    fechaResolucion: { type: Date }
  },
  { collection: 'candidaturas', timestamps: true }
)

// Parcial: quien retiro su candidatura puede volver a enviarla
candidaturaSchema.index(
  { candidatoId: 1, ofertaEmpleoId: 1 },
  { unique: true, partialFilterExpression: { estado: { $in: ESTADOS_CANDIDATURA_ACTIVA } } }
)
candidaturaSchema.index({ ofertaEmpleoId: 1, estado: 1, createdAt: 1 })
candidaturaSchema.index({ ofertanteId: 1, estado: 1 })
candidaturaSchema.index({ candidatoId: 1, createdAt: -1 })

export type CandidaturaDoc = InferSchemaType<typeof candidaturaSchema>

export const Candidatura = model('Candidatura', candidaturaSchema)
