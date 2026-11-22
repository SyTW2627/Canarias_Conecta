/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de la preparacion de la base de datos al arrancar (modelos simulados).
 */

import mongoose from 'mongoose'
import { describe, expect, it, vi } from 'vitest'
import { nuevoId } from '../helpers.js'

const imagenes = vi.hoisted(() => ({ cargarImagen: vi.fn() }))
vi.mock('../../src/config/imagenes.js', () => imagenes)

const { prepararBaseDeDatos } = await import('../../src/config/catalogo.js')
const { Categoria } = await import('../../src/models/Categoria.js')

const MODELOS = [
  'User', 'Categoria', 'Imagen', 'Oferta', 'SolicitudAyuda', 'Notificacion', 'Token', 'OfertaEmpleo', 'Candidatura'
]

function simularTodo() {
  const inits = MODELOS.map((nombre) => vi.spyOn(mongoose.model(nombre), 'init').mockResolvedValue(undefined as never))
  // Inscripcion usa syncIndexes para sustituir el indice unico si cambian los estados que bloquean
  inits.push(vi.spyOn(mongoose.model('Inscripcion'), 'syncIndexes').mockResolvedValue([] as never))
  const upsert = vi.spyOn(Categoria, 'updateOne').mockResolvedValue({} as never)
  const ids = new Map<string, ReturnType<typeof nuevoId>>()
  imagenes.cargarImagen.mockImplementation(async (nombre: string) => {
    if (!ids.has(nombre)) ids.set(nombre, nuevoId())
    return ids.get(nombre)
  })
  return { inits, upsert, ids }
}

describe('prepararBaseDeDatos', () => {
  it('crea las colecciones e indices de todos los modelos', async () => {
    const { inits } = simularTodo()

    await prepararBaseDeDatos()

    for (const init of inits) expect(init).toHaveBeenCalledOnce()
  })

  it('inserta o actualiza las seis categorias del catalogo por su slug', async () => {
    const { upsert, ids } = simularTodo()

    await prepararBaseDeDatos()

    expect(upsert).toHaveBeenCalledTimes(6)
    expect(upsert.mock.calls.map(([filtro]) => (filtro as unknown as { slug: string }).slug)).toEqual([
      'medio-ambiente',
      'personas-mayores',
      'educacion',
      'comunidad',
      'alimentacion',
      'animales'
    ])
    expect(upsert).toHaveBeenCalledWith(
      { slug: 'medio-ambiente' },
      {
        // El nombre solo se escribe al crearla: no pisa uno cambiado a mano
        $setOnInsert: { nombre: 'Medio ambiente', slug: 'medio-ambiente' },
        $set: { imagenId: ids.get('reforestacion.jpg') }
      },
      { upsert: true }
    )
  })

  it('carga la imagen de cada categoria', async () => {
    simularTodo()

    await prepararBaseDeDatos()

    expect(imagenes.cargarImagen.mock.calls.map(([nombre]) => nombre)).toEqual([
      'reforestacion.jpg',
      'imagen_personamayor.jpg',
      'apoyo_escolar.jpeg',
      'voluntariado-2.png',
      'recogida_alimentos.png',
      'voluntariado-3.png'
    ])
  })

  it('propaga el error si no se puede preparar la base de datos', async () => {
    simularTodo()
    imagenes.cargarImagen.mockRejectedValueOnce(new Error('sin imagen'))

    await expect(prepararBaseDeDatos()).rejects.toThrow('sin imagen')
  })
})
