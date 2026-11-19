/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de los tokens de verificacion de email y recuperacion de contrasena.
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

export const TIPOS_TOKEN = ['verificar_email', 'recuperar_password'] as const

const tokenSchema = new Schema(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tipo: { type: String, enum: TIPOS_TOKEN, required: true },
    // Se guarda el hash, nunca el token en claro
    tokenHash: { type: String, required: true, unique: true },
    usado: { type: Boolean, default: false },
    expiraEn: { type: Date, required: true }
  },
  { collection: 'tokens' }
)

// TTL: MongoDB borra el token en cuanto llega a expiraEn
tokenSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 })

export type TokenDoc = InferSchemaType<typeof tokenSchema>

export const Token = model('Token', tokenSchema)
