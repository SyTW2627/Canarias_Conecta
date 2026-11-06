/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Sirve las imagenes guardadas en la base de datos.
 */

import type { Request, Response } from 'express'
import { isObjectIdOrHexString } from 'mongoose'
import { Imagen } from '../models/Imagen.js'

// GET /api/imagenes/:id -> bytes de la imagen
export async function getImagen(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: 'La imagen no existe' })
    return
  }

  try {
    const imagen = await Imagen.findById(id)

    if (!imagen) {
      res.status(404).json({ message: 'La imagen no existe' })
      return
    }

    // Una imagen nunca cambia de contenido: el navegador puede guardarla sin volver a pedirla
    res
      .set({
        'Content-Type': imagen.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      })
      .send(Buffer.from(imagen.data))
  } catch (error) {
    console.error('Error al obtener la imagen:', error)
    res.status(500).json({ message: 'Error al obtener la imagen' })
  }
}
