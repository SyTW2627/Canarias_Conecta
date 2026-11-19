/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Carga en la base de datos las imagenes iniciales de server/db/imagenes.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Types } from 'mongoose'
import { Imagen } from '../models/Imagen.js'

// La ruta es la misma desde src/config y desde dist/config
const CARPETA_IMAGENES = fileURLToPath(new URL('../../db/imagenes/', import.meta.url))

const TIPOS_POR_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
}

// Devuelve el id de la imagen y solo lee el fichero si aun no esta en la base de datos
export async function cargarImagen(nombre: string): Promise<Types.ObjectId> {
  const existente = await Imagen.findOne({ nombre }).select('_id')
  if (existente) return existente._id

  const contentType = TIPOS_POR_EXTENSION[path.extname(nombre).toLowerCase()]
  if (!contentType) throw new Error(`Tipo de imagen no admitido: ${nombre}`)

  const data = await readFile(path.join(CARPETA_IMAGENES, nombre))
  const imagen = await Imagen.create({ nombre, contentType, data })

  return imagen._id
}
