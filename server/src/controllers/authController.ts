/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona el registro y el inicio de sesion de los usuarios.
 */

import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, ROLES } from '../models/User.js'

const PASSWORD_MIN = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function esRolValido(rol: string): rol is (typeof ROLES)[number] {
  return (ROLES as readonly string[]).includes(rol)
}

// POST /api/auth/register -> crea el usuario y devuelve { token, user } para entrar directamente
export async function register(req: Request, res: Response): Promise<void> {
  const { nombre, email, password, rol } = req.body ?? {}

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password ||
    typeof rol !== 'string'
  ) {
    res.status(400).json({ message: 'Nombre, email, contraseña y rol son obligatorios' })
    return
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({ message: 'El email no es válido' })
    return
  }

  if (password.length < PASSWORD_MIN) {
    res.status(400).json({ message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` })
    return
  }

  if (!esRolValido(rol)) {
    res.status(400).json({ message: 'El rol no es válido' })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('Falta la variable JWT_SECRET en el archivo .env')
    res.status(500).json({ message: 'Error al registrar el usuario' })
    return
  }

  try {
    const user = await User.create({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      rol
    })

    const token = jwt.sign({ id: user.id, rol: user.rol }, secret, { expiresIn: '1d' })

    res.status(201).json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    })
  } catch (error) {
    // 11000 = indice unico duplicado: ya existe un usuario con ese email
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Ya existe una cuenta con ese email' })
      return
    }
    console.error('Error al registrar el usuario:', error)
    res.status(500).json({ message: 'Error al registrar el usuario' })
  }
}

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
