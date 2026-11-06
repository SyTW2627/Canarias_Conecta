/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona el registro y el inicio de sesion de los usuarios.
 */

import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, ROLES_REGISTRO } from '../models/User.js'
import { Categoria } from '../models/Categoria.js'
import { isObjectIdOrHexString } from 'mongoose'

const PASSWORD_MIN = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function esRolValido(rol: string): rol is (typeof ROLES_REGISTRO)[number] {
  return (ROLES_REGISTRO as readonly string[]).includes(rol)
}

// PATCH /api/auth/me -> actualiza los datos editables del usuario autenticado
export async function actualizarPerfil(req: Request, res: Response): Promise<void> {
  if (!req.usuario) {
    res.status(401).json({ message: 'Debes iniciar sesión' })
    return
  }

  const { nombre, email, passwordActual, passwordNueva, interesIds } = req.body ?? {}
  if (
    (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim())) ||
    (email !== undefined && (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()))) ||
    (passwordActual !== undefined && typeof passwordActual !== 'string') ||
    (passwordNueva !== undefined && typeof passwordNueva !== 'string')
    || (interesIds !== undefined &&
      (!Array.isArray(interesIds) ||
        interesIds.some((id) => typeof id !== 'string' || !isObjectIdOrHexString(id))))
  ) {
    res.status(400).json({ message: 'Los datos del perfil no son válidos' })
    return
  }

  if (
    nombre === undefined &&
    email === undefined &&
    passwordNueva === undefined &&
    interesIds === undefined
  ) {
    res.status(400).json({ message: 'No hay cambios que guardar' })
    return
  }

  if (passwordNueva !== undefined && passwordNueva.length < PASSWORD_MIN) {
    res.status(400).json({ message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` })
    return
  }

  try {
    const user = await User.findById(req.usuario.id).select('+password')
    if (!user) {
      res.status(404).json({ message: 'No se encontró el usuario' })
      return
    }

    if (passwordNueva !== undefined) {
      if (!passwordActual || !(await bcrypt.compare(passwordActual, user.password))) {
        res.status(401).json({ message: 'La contraseña actual no es correcta' })
        return
      }
      user.password = await bcrypt.hash(passwordNueva, 10)
    }

    if (nombre !== undefined) user.nombre = nombre.trim()
    if (email !== undefined) user.email = email.trim().toLowerCase()
    if (interesIds !== undefined) {
      const idsUnicos = [...new Set(interesIds)]
      const categorias = await Categoria.find({ _id: { $in: idsUnicos }, activa: true }).select('_id')
      if (categorias.length !== idsUnicos.length) {
        res.status(400).json({ message: 'Algún interés seleccionado no es válido' })
        return
      }
      user.set('voluntario.interesIds', idsUnicos)
    }
    await user.save()

    res.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        interesIds: user.voluntario?.interesIds?.map((id) => id.toString()) ?? [],
      },
    })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Ya existe una cuenta con ese email' })
      return
    }

    console.error('Error al actualizar el perfil:', error)
    res.status(500).json({ message: 'No se pudo actualizar el perfil' })
  }

}

// GET /api/auth/me -> datos editables del usuario autenticado
export async function getPerfil(req: Request, res: Response): Promise<void> {
  if (!req.usuario) {
    res.status(401).json({ message: 'Debes iniciar sesión' })
    return
  }

  try {
    const user = await User.findById(req.usuario.id).populate('voluntario.interesIds', 'nombre')
    if (!user) {
      res.status(404).json({ message: 'No se encontró el usuario' })
      return
    }
    const intereses = (user.voluntario?.interesIds ?? []) as unknown as Array<{
      id: string
      nombre: string
    }>
    res.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        intereses: intereses.map((interes) => ({
          id: interes.id,
          nombre: interes.nombre,
        })),
      },
    })
  } catch (error) {
    console.error('Error al obtener el perfil:', error)
    res.status(500).json({ message: 'No se pudo cargar el perfil' })
  }
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
