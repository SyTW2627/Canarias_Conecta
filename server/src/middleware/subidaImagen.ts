/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Recibe la imagen de portada de una oferta en peticiones multipart/form-data.
 */

import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'

export const IMAGEN_MAX_BYTES = 5 * 1024 * 1024

// La imagen se queda en memoria: despues se guarda como Buffer en la coleccion imagenes
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGEN_MAX_BYTES, files: 1, fields: 5 }
}).single('imagen')

// Solo actua si la peticion es multipart; las peticiones JSON siguen igual
export function recibirImagen(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) {
    next()
    return
  }

  subida(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? `La imagen no puede superar los ${IMAGEN_MAX_BYTES / 1024 / 1024} MB`
          : 'Solo se admite una imagen por oferta'
      res.status(400).json({ message })
      return
    }

    if (error) {
      next(error)
      return
    }

    next()
  })
}

// El tipo que manda el navegador no es fiable: se comprueba la firma del fichero
export function detectarTipoImagen(data: Buffer): { contentType: string; extension: string } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: '.jpg' }
  }

  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType: 'image/png', extension: '.png' }
  }

  if (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: '.webp' }
  }

  return null
}
