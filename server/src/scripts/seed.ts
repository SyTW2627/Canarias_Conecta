/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Inserta usuarios de ejemplo en la base de datos local (npm run seed).
 */

import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { User } from '../models/User.js'

dotenv.config()

const EJEMPLOS = [
  { nombre: 'Laura Perez', email: 'laura@ejemplo.com', rol: 'voluntario' },
  { nombre: 'Carlos Diaz', email: 'carlos@ejemplo.com', rol: 'voluntario' },
  { nombre: 'Banco de Alimentos Tenerife', email: 'banco@ejemplo.com', rol: 'ofertante' }
] as const

// Contrasena comun para todos los usuarios de ejemplo (solo desarrollo)
const PASSWORD_EJEMPLO = 'Ejemplo123'

async function seed(): Promise<void> {
  await connectDB()
  const password = await bcrypt.hash(PASSWORD_EJEMPLO, 10)

  // upsert por email: ejecutar el seed varias veces no duplica usuarios
  for (const ejemplo of EJEMPLOS) {
    await User.updateOne(
      { email: ejemplo.email },
      { $setOnInsert: { ...ejemplo, password } },
      { upsert: true }
    )
  }

  console.log(`Usuarios en la coleccion: ${await User.countDocuments()}`)
}

seed()
  .catch((error) => {
    console.error('Error en el seed:', error.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
