/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Prepara la base de datos al arrancar: colecciones, indices y categorias necesarias.
 */

import { Categoria } from '../models/Categoria.js'
import { Inscripcion } from '../models/Inscripcion.js'
import { Notificacion } from '../models/Notificacion.js'
import { Oferta } from '../models/Oferta.js'
import { SolicitudAyuda } from '../models/SolicitudAyuda.js'
import { Token } from '../models/Token.js'
import { User } from '../models/User.js'

// Catalogo real, no datos de ejemplo: sin categorias no se puede publicar una oferta
const CATEGORIAS = [
  { nombre: 'Medio ambiente', slug: 'medio-ambiente' },
  { nombre: 'Personas mayores', slug: 'personas-mayores' },
  { nombre: 'Educación', slug: 'educacion' },
  { nombre: 'Comunidad', slug: 'comunidad' },
  { nombre: 'Alimentación', slug: 'alimentacion' },
  { nombre: 'Animales', slug: 'animales' }
]

export async function prepararBaseDeDatos(): Promise<void> {
  // init() crea la coleccion y sus indices aunque el modelo aun no se use en ninguna ruta
  await Promise.all([
    User.init(),
    Categoria.init(),
    Oferta.init(),
    Inscripcion.init(),
    SolicitudAyuda.init(),
    Notificacion.init(),
    Token.init()
  ])

  // upsert por slug: arrancar varias veces no duplica categorias
  for (const categoria of CATEGORIAS) {
    await Categoria.updateOne(
      { slug: categoria.slug },
      { $setOnInsert: categoria },
      { upsert: true }
    )
  }
}
