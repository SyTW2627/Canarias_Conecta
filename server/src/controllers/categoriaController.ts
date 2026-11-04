/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona las peticiones relacionadas con las categorias.
 */

import type { Request, Response } from 'express'
import { Categoria } from '../models/Categoria.js'

// GET /api/categorias -> categorias activas, para rellenar filtros y formularios
export async function getCategorias(_req: Request, res: Response): Promise<void> {
  try {
    const categorias = await Categoria.find({ activa: true }).sort({ nombre: 1 })

    res.json(
      categorias.map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        slug: categoria.slug,
        icono: categoria.icono
      }))
    )
  } catch (error) {
    console.error('Error al obtener las categorias:', error)
    res.status(500).json({ message: 'Error al obtener las categorías' })
  }
}
