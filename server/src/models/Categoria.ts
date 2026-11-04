/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de categoria (interes) de la coleccion categorias.
 */

import { Schema, model, type InferSchemaType } from 'mongoose'

const categoriaSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    icono: { type: String, trim: true },
    activa: { type: Boolean, default: true }
  },
  { collection: 'categorias' }
)

export type CategoriaDoc = InferSchemaType<typeof categoriaSchema>

export const Categoria = model('Categoria', categoriaSchema)
