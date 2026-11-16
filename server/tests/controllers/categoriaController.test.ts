/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del controlador de categorias (modelo simulado).
 */

import { describe, expect, it, vi } from 'vitest'
import { getCategorias } from '../../src/controllers/categoriaController.js'
import { Categoria } from '../../src/models/Categoria.js'
import { consulta, crearReq, crearRes, errorBd } from '../helpers.js'

describe('getCategorias', () => {
  it('pide solo las activas ordenadas por nombre y devuelve sus datos publicos', async () => {
    const q = consulta([
      { id: '1', nombre: 'Animales', slug: 'animales', icono: undefined, activa: true, imagenId: 'x' },
      { id: '2', nombre: 'Medio ambiente', slug: 'medio-ambiente', icono: 'arbol', activa: true }
    ])
    const buscar = vi.spyOn(Categoria, 'find').mockReturnValue(q as never)
    const res = crearRes()

    await getCategorias(crearReq(), res)

    expect(buscar).toHaveBeenCalledWith({ activa: true })
    expect(q.sort).toHaveBeenCalledWith({ nombre: 1 })
    expect(res.body).toEqual([
      { id: '1', nombre: 'Animales', slug: 'animales', icono: undefined },
      { id: '2', nombre: 'Medio ambiente', slug: 'medio-ambiente', icono: 'arbol' }
    ])
  })

  it('devuelve una lista vacia si no hay categorias', async () => {
    vi.spyOn(Categoria, 'find').mockReturnValue(consulta([]) as never)
    const res = crearRes()

    await getCategorias(crearReq(), res)

    expect(res.body).toEqual([])
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Categoria, 'find').mockReturnValue(consulta(errorBd()) as never)
    const res = crearRes()

    await getCategorias(crearReq(), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al obtener las categorías' })
    expect(console.error).toHaveBeenCalledWith('Error al obtener las categorias:', expect.any(Error))
  })
})
