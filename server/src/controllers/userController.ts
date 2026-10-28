/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona las peticiones relacionadas con los usuarios.
 */

import type { Request, Response } from 'express'
import { User } from '../models/User.js'

// GET /api/users -> lista de usuarios sin la contrasena
export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await User.find().sort({ createdAt: 1 })
    res.json(users)
  } catch (error) {
    console.error('Error al obtener usuarios:', error)
    res.status(500).json({ message: 'Error al obtener los usuarios' })
  }
}
