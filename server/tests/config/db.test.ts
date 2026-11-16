/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de la conexion con MongoDB.
 */

import mongoose from 'mongoose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectDB, dbStatus } from '../../src/config/db.js'

describe('dbStatus', () => {
  it.each([
    [0, 'desconectado'],
    [1, 'conectado'],
    [2, 'conectando'],
    [3, 'desconectando'],
    [99, 'desconocido']
  ])('traduce readyState %i como "%s"', (estado, texto) => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(estado as never)
    expect(dbStatus()).toBe(texto)
  })
})

describe('connectDB', () => {
  afterEach(() => {
    delete process.env.MONGODB_URI
  })

  it('lanza un error claro si falta MONGODB_URI', async () => {
    const conectar = vi.spyOn(mongoose, 'connect')

    await expect(connectDB()).rejects.toThrow('Falta la variable MONGODB_URI')
    expect(conectar).not.toHaveBeenCalled()
  })

  it('conecta con la URI configurada', async () => {
    process.env.MONGODB_URI = 'mongodb://servidor/base'
    const conectar = vi.spyOn(mongoose, 'connect').mockResolvedValueOnce(mongoose)

    await connectDB()

    expect(conectar).toHaveBeenCalledWith('mongodb://servidor/base')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('MongoDB conectado'))
  })

  it('propaga el error si la conexion falla', async () => {
    process.env.MONGODB_URI = 'mongodb://servidor/base'
    vi.spyOn(mongoose, 'connect').mockRejectedValueOnce(new Error('sin red'))

    await expect(connectDB()).rejects.toThrow('sin red')
  })
})
