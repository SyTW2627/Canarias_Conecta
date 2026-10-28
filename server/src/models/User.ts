/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de usuario (voluntario u ofertante) de la coleccion users.
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

export const ROLES = ['voluntario', 'ofertante'] as const

const userSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Se guarda el hash de bcrypt, nunca la contrasena en claro
    password: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, required: true }
  },
  { timestamps: true }
)

export type UserDoc = InferSchemaType<typeof userSchema>

export const User = model('User', userSchema)
