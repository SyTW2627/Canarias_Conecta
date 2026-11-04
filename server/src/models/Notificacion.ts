/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de los avisos al usuario (coleccion notificaciones).
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

const NOVENTA_DIAS_EN_SEGUNDOS = 90 * 24 * 60 * 60

const notificacionSchema = new Schema(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tipo: { type: String, required: true, trim: true },
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
