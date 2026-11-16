/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de los middlewares requireAuth y requireRol.
 */

import type { NextFunction, Request } from 'express'
import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireAuth, requireRol } from '../../src/middleware/auth.js'
import { User } from '../../src/models/User.js'
import { consulta, crearReq, crearRes, errorBd, firmarToken, nuevoId } from '../helpers.js'

// Usuario tal y como lo devolveria la base de datos
function usuario(datos: Record<string, unknown> = {}) {
  return User.hydrate({
    _id: nuevoId(),
    nombre: 'Ana',
    email: 'ana@test.com',
    rol: 'voluntario',
    estado: 'activo',
    ...datos
  })
}

function simularUsuario(user: ReturnType<typeof usuario> | null) {
  return vi.spyOn(User, 'findById').mockReturnValue(consulta(user) as never)
}

async function ejecutar(authorization?: string) {
  const req = crearReq({ headers: authorization ? { authorization } : {} })
  const res = crearRes()
  const next = vi.fn() as unknown as NextFunction
  await requireAuth(req, res, next)
  return { req, res, next }
}

describe('requireAuth', () => {
  afterEach(() => {
    process.env.JWT_SECRET = 'secreto-de-test'
  })

  it('responde 500 si falta JWT_SECRET', async () => {
    delete process.env.JWT_SECRET
    const { res, next } = await ejecutar('Bearer x')

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al comprobar la sesión' })
    expect(console.error).toHaveBeenCalledWith('Falta la variable JWT_SECRET en el archivo .env')
    expect(next).not.toHaveBeenCalled()
  })

  it.each([
    ['sin cabecera', undefined],
    ['con otro esquema', 'Basic abc'],
    ['con Bearer sin token', 'Bearer'],
    ['con Bearer y espacio vacio', 'Bearer ']
  ])('responde 401 %s sin consultar la base de datos', async (_caso, cabecera) => {
    const buscar = vi.spyOn(User, 'findById')
    const { res, next } = await ejecutar(cabecera)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ message: 'Debes iniciar sesión' })
    expect(next).not.toHaveBeenCalled()
    expect(buscar).not.toHaveBeenCalled()
  })

  it.each([
    ['no es un JWT', () => 'no-es-un-jwt'],
    ['esta firmado con otro secreto', () => jwt.sign({ id: nuevoId().toString() }, 'otro-secreto')],
    ['ha caducado', () => firmarToken(nuevoId().toString(), { expiresIn: -10 })],
    [
      'usa un algoritmo distinto de HS256',
      () => jwt.sign({ id: nuevoId().toString() }, process.env.JWT_SECRET!, { algorithm: 'HS512' })
    ]
  ])('responde 401 si el token %s', async (_caso, crearToken) => {
    const buscar = vi.spyOn(User, 'findById')
    const { res } = await ejecutar(`Bearer ${crearToken()}`)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ message: 'La sesión no es válida o ha caducado' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it.each([
    ['el payload es un texto', () => jwt.sign('solo-texto', process.env.JWT_SECRET!)],
    ['el id no es un ObjectId', () => firmarToken('no-es-un-id')],
    ['no hay id', () => jwt.sign({ otro: 1 }, process.env.JWT_SECRET!)]
  ])('responde 401 sin consultar la base de datos si %s', async (_caso, crearToken) => {
    const buscar = vi.spyOn(User, 'findById')
    const { res } = await ejecutar(`Bearer ${crearToken()}`)

    expect(res.statusCode).toBe(401)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('responde 401 si el usuario ya no existe', async () => {
    const id = nuevoId().toString()
    const buscar = simularUsuario(null)
    const { res } = await ejecutar(`Bearer ${firmarToken(id)}`)

    expect(buscar).toHaveBeenCalledWith(id)
    expect(res.statusCode).toBe(401)
  })

  it('responde 401 si el token es anterior al ultimo cambio de contraseña', async () => {
    const user = usuario({ passwordCambiadaEn: new Date(Date.now() + 5000) })
    simularUsuario(user)
    const { res, next } = await ejecutar(`Bearer ${firmarToken(user.id)}`)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ message: 'La sesión no es válida o ha caducado' })
    expect(next).not.toHaveBeenCalled()
  })

  it('responde 401 si hubo cambio de contraseña y el token no tiene fecha de emision', async () => {
    const user = usuario({ passwordCambiadaEn: new Date(0) })
    simularUsuario(user)
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { noTimestamp: true })

    const { res } = await ejecutar(`Bearer ${token}`)
    expect(res.statusCode).toBe(401)
  })

  it('acepta un token emitido en el mismo segundo que el cambio de contraseña', async () => {
    const ahora = Math.floor(Date.now() / 1000)
    const user = usuario({ passwordCambiadaEn: new Date(ahora * 1000 + 900) })
    simularUsuario(user)
    const token = jwt.sign({ id: user.id, iat: ahora }, process.env.JWT_SECRET!)

    const { next } = await ejecutar(`Bearer ${token}`)
    expect(next).toHaveBeenCalledOnce()
  })

  it.each(['suspendido', 'eliminado', 'pendiente_verificacion'])(
    'responde 403 si la cuenta esta %s',
    async (estado) => {
      const user = usuario({ estado })
      simularUsuario(user)
      const { res, next } = await ejecutar(`Bearer ${firmarToken(user.id)}`)

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({ message: 'Tu cuenta no puede realizar esta acción' })
      expect(next).not.toHaveBeenCalled()
    }
  )

  it('deja el usuario en req.usuario y continua si todo es correcto', async () => {
    const user = usuario({ rol: 'ofertante', nombre: 'ONG' })
    simularUsuario(user)

    const { req, res, next } = await ejecutar(`Bearer ${firmarToken(user.id)}`)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
    expect(req.usuario).toEqual({ id: user.id, nombre: 'ONG', rol: 'ofertante' })
  })

  it('responde 500 si falla la consulta a la base de datos', async () => {
    vi.spyOn(User, 'findById').mockReturnValue(consulta(errorBd()) as never)
    const { res, next } = await ejecutar(`Bearer ${firmarToken(nuevoId().toString())}`)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al comprobar la sesión' })
    expect(console.error).toHaveBeenCalledWith('Error al comprobar la sesión:', expect.any(Error))
    expect(next).not.toHaveBeenCalled()
  })
})

describe('requireRol', () => {
  function comprobar(usuarioActual: Request['usuario'], ...roles: Parameters<typeof requireRol>) {
    const res = crearRes()
    const next = vi.fn()
    requireRol(...roles)(crearReq({ usuario: usuarioActual }), res, next)
    return { res, next }
  }

  it('responde 403 si no hay usuario autenticado', () => {
    const { res, next } = comprobar(undefined, 'voluntario')

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ message: 'No tienes permiso para realizar esta acción' })
    expect(next).not.toHaveBeenCalled()
  })

  it('responde 403 si el rol no esta permitido', () => {
    const { res, next } = comprobar({ id: '1', nombre: 'A', rol: 'voluntario' }, 'ofertante')

    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('continua si el rol esta entre los permitidos', () => {
    const { res, next } = comprobar({ id: '1', nombre: 'A', rol: 'admin' }, 'ofertante', 'admin')

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })
})
