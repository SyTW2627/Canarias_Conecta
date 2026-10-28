/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Conecta el servidor con la base de datos MongoDB mediante Mongoose.
 */

import mongoose from 'mongoose'

// Traduce los valores de mongoose.connection.readyState
const ESTADOS: Record<number, string> = {
  0: 'desconectado',
  1: 'conectado',
  2: 'conectando',
  3: 'desconectando'
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error('Falta la variable MONGODB_URI en el archivo .env')
  }

  await mongoose.connect(uri)
  console.log(`MongoDB conectado: ${mongoose.connection.name}`)
}

export function dbStatus(): string {
  return ESTADOS[mongoose.connection.readyState] ?? 'desconocido'
}
