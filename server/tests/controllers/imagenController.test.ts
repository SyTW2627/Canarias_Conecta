/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del controlador que sirve las imagenes (modelo simulado).
 */

import { describe, expect, it, vi } from 'vitest'
import { getImagen } from '../../src/controllers/imagenController.js'
import { Imagen } from '../../src/models/Imagen.js'
import { PNG, consulta, crearReq, crearRes, errorBd, nuevoId } from '../helpers.js'

describe('getImagen', () => {
  it('envia los bytes con su tipo y cabeceras de cache y seguridad', async () => {
    const id = nuevoId().toString()
    const buscar = vi.spyOn(Imagen, 'findById').mockReturnValue(
      consulta({ contentType: 'image/png', data: PNG }) as never
    )
    const res = crearRes()

    await getImagen(crearReq({ params: { id } }), res)

    expect(buscar).toHaveBeenCalledWith(id)
    expect(res.cabeceras).toEqual({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    })
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0)
  })

  it('responde 404 sin consultar la base de datos si el id no es valido', async () => {
    const buscar = vi.spyOn(Imagen, 'findById')
    const res = crearRes()

    await getImagen(crearReq({ params: { id: 'no-es-un-id' } }), res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La imagen no existe' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 404 si la imagen no existe', async () => {
    vi.spyOn(Imagen, 'findById').mockReturnValue(consulta(null) as never)
    const res = crearRes()

    await getImagen(crearReq({ params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(404)
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Imagen, 'findById').mockReturnValue(consulta(errorBd()) as never)
    const res = crearRes()

    await getImagen(crearReq({ params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al obtener la imagen' })
  })
})
