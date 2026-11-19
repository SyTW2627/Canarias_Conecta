/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de la carga de imagenes iniciales (disco y modelo simulados).
 */

import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Imagen } from '../../src/models/Imagen.js'
import { PNG, consulta, nuevoId } from '../helpers.js'

const fs = vi.hoisted(() => ({ readFile: vi.fn() }))
vi.mock('node:fs/promises', () => ({ ...fs, default: fs }))

const { cargarImagen } = await import('../../src/config/imagenes.js')

function simularExistente(existente: { _id: ReturnType<typeof nuevoId> } | null) {
  const q = consulta(existente)
  const buscar = vi.spyOn(Imagen, 'findOne').mockReturnValue(q as never)
  return { buscar, q }
}

describe('cargarImagen', () => {
  it('devuelve la imagen ya guardada sin leer el fichero', async () => {
    const existente = { _id: nuevoId() }
    const { buscar, q } = simularExistente(existente)
    const crear = vi.spyOn(Imagen, 'create')

    const id = await cargarImagen('reforestacion.jpg')

    expect(id).toBe(existente._id)
    expect(buscar).toHaveBeenCalledWith({ nombre: 'reforestacion.jpg' })
    expect(q.select).toHaveBeenCalledWith('_id')
    expect(fs.readFile).not.toHaveBeenCalled()
    expect(crear).not.toHaveBeenCalled()
  })

  it.each([
    ['foto.jpg', 'image/jpeg'],
    ['foto.JPEG', 'image/jpeg'],
    ['foto.png', 'image/png']
  ])('lee %s de db/imagenes y la guarda como %s', async (nombre, contentType) => {
    simularExistente(null)
    fs.readFile.mockResolvedValue(PNG)
    const _id = nuevoId()
    const crear = vi.spyOn(Imagen, 'create').mockResolvedValue({ _id } as never)

    const id = await cargarImagen(nombre)

    expect(id).toBe(_id)
    const ruta = fs.readFile.mock.calls[0][0] as string
    expect(ruta.endsWith(path.join('db', 'imagenes', nombre))).toBe(true)
    expect(crear).toHaveBeenCalledWith({ nombre, contentType, data: PNG })
  })

  it('rechaza extensiones no admitidas sin leer el disco', async () => {
    simularExistente(null)

    await expect(cargarImagen('documento.gif')).rejects.toThrow('Tipo de imagen no admitido: documento.gif')
    expect(fs.readFile).not.toHaveBeenCalled()
  })

  it('propaga el error si el fichero no se puede leer', async () => {
    simularExistente(null)
    fs.readFile.mockRejectedValue(new Error('ENOENT'))

    await expect(cargarImagen('no-existe.png')).rejects.toThrow('ENOENT')
  })
})
