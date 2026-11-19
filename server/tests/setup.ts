/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Prepara cada fichero de tests unitarios: variables de entorno y aislamiento de la base de datos.
 */

import mongoose from 'mongoose'
import { beforeEach, vi } from 'vitest'

process.env.JWT_SECRET = 'secreto-de-test'
process.env.CLIENT_URL = 'http://cliente.test'
process.env.NODE_ENV = 'test'
delete process.env.SMTP_HOST
delete process.env.MONGODB_URI

// Los tests son unitarios: nunca hay conexion. Si un test olvida simular una consulta,
// Mongoose falla al momento en vez de quedarse esperando a que se conecte
mongoose.set('bufferCommands', false)

// Los controladores registran los errores en consola: en los tests solo ensucian la salida.
// Se crea en cada test porque restoreMocks deshace los espias entre tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
