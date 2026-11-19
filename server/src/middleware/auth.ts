/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Protege rutas comprobando el token JWT y el rol del usuario.
 */

import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { isObjectIdOrHexString } from 'mongoose'
import { User, ROLES } from '../models/User.js'

type UsuarioAutenticado = {
  id: string
  nombre: string
  rol: (typeof ROLES)[number]
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado
    }
  }
}

// Exige la cabecera Authorization: Bearer <token> y deja el usuario en req.usuario
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('Falta la variable JWT_SECRET en el archivo .env')
    res.status(500).json({ message: 'Error al comprobar la sesión' })
    return
  }

  const [tipo, token] = req.headers.authorization?.split(' ') ?? []
  if (tipo !== 'Bearer' || !token) {
    res.status(401).json({ message: 'Debes iniciar sesión' })
    return
  }

  let id: unknown
  let emitidoEn: number | undefined
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    id = typeof payload === 'string' ? undefined : payload.id
    emitidoEn = typeof payload === 'string' ? undefined : payload.iat
  } catch {
    res.status(401).json({ message: 'La sesión no es válida o ha caducado' })
    return
  }

  try {
    // Se consulta el usuario porque el token sigue siendo valido aunque lo suspendan o lo borren
    const user = typeof id === 'string' && isObjectIdOrHexString(id) ? await User.findById(id) : null

    if (!user) {
      res.status(401).json({ message: 'La sesión no es válida o ha caducado' })
      return
    }

    // iat va en segundos: un token emitido en el mismo segundo del cambio sigue valiendo
    const cambio = user.passwordCambiadaEn
    if (cambio && (emitidoEn === undefined || emitidoEn < Math.floor(cambio.getTime() / 1000))) {
      res.status(401).json({ message: 'La sesión no es válida o ha caducado' })
      return
    }

    if (user.estado !== 'activo') {
      res.status(403).json({ message: 'Tu cuenta no puede realizar esta acción' })
      return
    }

    req.usuario = { id: user.id, nombre: user.nombre, rol: user.rol }
    next()
  } catch (error) {
    console.error('Error al comprobar la sesión:', error)
    res.status(500).json({ message: 'Error al comprobar la sesión' })
  }
}

// Se usa siempre despues de requireAuth
export function requireRol(...roles: UsuarioAutenticado['rol'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ message: 'No tienes permiso para realizar esta acción' })
      return
    }

    next()
  }
}
