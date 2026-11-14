/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de los avisos al usuario (coleccion notificaciones).
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

const NOVENTA_DIAS_EN_SEGUNDOS = 90 * 24 * 60 * 60

export const TIPOS_NOTIFICACION = [
  // Para el ofertante: un voluntario se ha postulado a una de sus ofertas
  'inscripcion_nueva',
  // Para el ofertante: un voluntario ha cancelado su inscripcion
  'inscripcion_cancelada',
  // Para el voluntario: el ofertante ha resuelto su solicitud
  'inscripcion_aceptada',
  'inscripcion_rechazada',
  // Para el voluntario: el ofertante ha confirmado que participo en la actividad
  'inscripcion_completada',
  // Para el voluntario: la oferta en la que estaba inscrito se ha cerrado
  'oferta_cerrada'
] as const

const notificacionSchema = new Schema(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tipo: { type: String, enum: TIPOS_NOTIFICACION, required: true },
    titulo: { type: String, required: true, trim: true },
    mensaje: { type: String, required: true, trim: true },
    enlace: { type: String, trim: true },
    leida: { type: Boolean, default: false }
  },
  { collection: 'notificaciones', timestamps: { createdAt: true, updatedAt: false } }
)

notificacionSchema.index({ usuarioId: 1, leida: 1, createdAt: -1 })
// TTL: MongoDB borra solas las notificaciones con mas de 90 dias
notificacionSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOVENTA_DIAS_EN_SEGUNDOS })

export type NotificacionDoc = InferSchemaType<typeof notificacionSchema>

export const Notificacion = model('Notificacion', notificacionSchema)
