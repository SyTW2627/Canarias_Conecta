/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del middleware de subida de imagenes (multer simulado) y de la deteccion de su tipo.
 */

import type { NextFunction } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { JPG, PNG, WEBP, crearReq, crearRes } from '../helpers.js'

// multer se sustituye por un doble: el test decide que error devuelve la subida
const multerDoble = vi.hoisted(() => {
  class MulterError extends Error {
    constructor(public code: string) {
      super(code)
    }
  }
  const subida = vi.fn()
  const single = vi.fn(() => subida)
  const multer = Object.assign(
    vi.fn(() => ({ single })),
    { memoryStorage: vi.fn(() => 'almacen-en-memoria'), MulterError }
  )
  return { multer, single, subida, MulterError }
})

vi.mock('multer', () => ({ default: multerDoble.multer }))

const { IMAGEN_MAX_BYTES, detectarTipoImagen, recibirImagen } = await import(
  '../../src/middleware/subidaImagen.js'
)
// multer se configura al cargar el modulo: se guardan esas llamadas antes de que clearMocks las borre
const configuracion = multerDoble.multer.mock.calls[0]
const campo = multerDoble.single.mock.calls[0]

describe('configuracion de multer', () => {
  it('guarda en memoria una unica imagen de hasta 5 MB del campo "imagen"', () => {
    expect(IMAGEN_MAX_BYTES).toBe(5 * 1024 * 1024)
    expect(configuracion).toEqual([
      { storage: 'almacen-en-memoria', limits: { fileSize: IMAGEN_MAX_BYTES, files: 1, fields: 5 } }
    ])
    expect(campo).toEqual(['imagen'])
  })
})

describe('recibirImagen', () => {
  // La subida simulada llama al callback con el error indicado
  function ejecutar({ multipart = true, error }: { multipart?: boolean; error?: unknown } = {}) {
    multerDoble.subida.mockImplementation((_req, _res, callback: (e?: unknown) => void) => callback(error))
    const req = crearReq({ multipart })
    const res = crearRes()
    const next = vi.fn() as unknown as NextFunction
    recibirImagen(req, res, next)
    return { req, res, next }
  }

  it('deja pasar las peticiones que no son multipart sin llamar a multer', () => {
    const { req, next } = ejecutar({ multipart: false })

    expect(req.is).toHaveBeenCalledWith('multipart/form-data')
    expect(multerDoble.subida).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('procesa las peticiones multipart y continua si no hay error', () => {
    const { req, res, next } = ejecutar()

    expect(multerDoble.subida).toHaveBeenCalledWith(req, res, expect.any(Function))
    expect(next).toHaveBeenCalledWith()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('responde 400 si la imagen supera el tamaño maximo', () => {
    const { res, next } = ejecutar({ error: new multerDoble.MulterError('LIMIT_FILE_SIZE') })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La imagen no puede superar los 5 MB' })
    expect(next).not.toHaveBeenCalled()
  })

  it.each(['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_FIELD_COUNT'])(
    'responde 400 con el error de multer %s',
    (codigo) => {
      const { res, next } = ejecutar({ error: new multerDoble.MulterError(codigo) })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ message: 'Solo se admite una imagen por oferta' })
      expect(next).not.toHaveBeenCalled()
    }
  )

  it('pasa al manejador de errores cualquier otro error', () => {
    const error = new Error('Unexpected end of form')
    const { res, next } = ejecutar({ error })

    expect(next).toHaveBeenCalledWith(error)
    expect(res.status).not.toHaveBeenCalled()
  })
})

describe('detectarTipoImagen', () => {
  it('reconoce un JPEG por su firma', () => {
    expect(detectarTipoImagen(JPG)).toEqual({ contentType: 'image/jpeg', extension: '.jpg' })
  })

  it('reconoce un PNG por su firma', () => {
    expect(detectarTipoImagen(PNG)).toEqual({ contentType: 'image/png', extension: '.png' })
  })

  it('reconoce un WebP por las cabeceras RIFF y WEBP', () => {
    expect(detectarTipoImagen(WEBP)).toEqual({ contentType: 'image/webp', extension: '.webp' })
  })

  it('rechaza un RIFF que no es WebP (por ejemplo, un WAV)', () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')])
    expect(detectarTipoImagen(wav)).toBeNull()
  })

  it('rechaza ficheros sin firma de imagen', () => {
    expect(detectarTipoImagen(Buffer.from('<svg></svg>'))).toBeNull()
    expect(detectarTipoImagen(Buffer.from('GIF89a'))).toBeNull()
  })

  it('rechaza ficheros demasiado cortos para tener firma', () => {
    expect(detectarTipoImagen(Buffer.alloc(0))).toBeNull()
    expect(detectarTipoImagen(Buffer.from([0xff, 0xd8]))).toBeNull()
    expect(detectarTipoImagen(PNG.subarray(0, 7))).toBeNull()
    expect(detectarTipoImagen(WEBP.subarray(0, 11))).toBeNull()
  })
})
