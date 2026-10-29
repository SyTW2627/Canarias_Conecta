/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona el inicio de sesion de los usuarios.
 */

import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

// POST /api/auth/login -> { token, user } si las credenciales son correctas
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ message: 'El email y la contraseña son obligatorios' })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('Falta la variable JWT_SECRET en el archivo .env')
    res.status(500).json({ message: 'Error al iniciar sesión' })
    return
  }

  try {
    // password tiene select: false en el modelo, hay que pedirlo explicitamente
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')

    // Mismo mensaje si no existe el usuario o falla la contrasena, para no revelar emails
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: 'Email o contraseña incorrectos' })
      return
    }

    const token = jwt.sign({ id: user.id, rol: user.rol }, secret, { expiresIn: '1d' })

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    })
  } catch (error) {
    console.error('Error al iniciar sesión:', error)
    res.status(500).json({ message: 'Error al iniciar sesión' })
  }
}
