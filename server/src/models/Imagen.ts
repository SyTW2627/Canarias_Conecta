/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de imagen, que guarda los bytes en la coleccion imagenes.
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

const imagenSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    contentType: { type: String, required: true },
    // Un documento admite 16 MB como maximo, y con ello cada imagen
    data: { type: Buffer, required: true }
  },
  { collection: 'imagenes' }
)

export type ImagenDoc = InferSchemaType<typeof imagenSchema>

export const Imagen = model('Imagen', imagenSchema)
