/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Dobles de prueba compartidos por los tests unitarios: peticiones, respuestas y consultas.
 */

import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Types } from 'mongoose'
import { vi } from 'vitest'

export const nuevoId = () => new Types.ObjectId()

// --- Express ---------------------------------------------------------------

type OpcionesPeticion = {
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, unknown>
  headers?: Record<string, string>
  usuario?: Request['usuario']
  file?: Partial<Express.Multer.File>
  // true simula una peticion multipart/form-data
  multipart?: boolean
}

export function crearReq(opciones: OpcionesPeticion = {}): Request {
  const { multipart = false, ...resto } = opciones
  return {
    params: {},
    query: {},
    headers: {},
    ...resto,
    is: vi.fn((tipo: string) => (multipart && tipo === 'multipart/form-data' ? tipo : false))
  } as unknown as Request
}

export type ResSimulada = Response & {
  statusCode: number
  body: unknown
  cabeceras: Record<string, string>
  terminada: boolean
}

// Respuesta que recuerda el codigo, el cuerpo y las cabeceras enviadas
export function crearRes(): ResSimulada {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    cabeceras: {} as Record<string, string>,
    terminada: false
  } as ResSimulada
  res.status = vi.fn((codigo: number) => {
    res.statusCode = codigo
    return res
  }) as never
  res.json = vi.fn((cuerpo: unknown) => {
    res.body = cuerpo
    res.terminada = true
    return res
  }) as never
  res.send = vi.fn((cuerpo: unknown) => {
    res.body = cuerpo
    res.terminada = true
    return res
  }) as never
  res.set = vi.fn((cabeceras: Record<string, string>) => {
    Object.assign(res.cabeceras, cabeceras)
    return res
  }) as never
  res.end = vi.fn(() => {
    res.terminada = true
    return res
  }) as never
  return res
}

export const usuarioOfertante = (datos: Partial<NonNullable<Request['usuario']>> = {}) => ({
  id: nuevoId().toString(),
  nombre: 'ONG Mar',
  rol: 'ofertante' as const,
  ...datos
})

export const usuarioVoluntario = (datos: Partial<NonNullable<Request['usuario']>> = {}) => ({
  id: nuevoId().toString(),
  nombre: 'Ana',
  rol: 'voluntario' as const,
  ...datos
})

// --- Mongoose ----------------------------------------------------------------

// Consulta simulada: admite encadenar sort, select, populate... y se resuelve con "resultado".
// Si "resultado" es un Error, la consulta falla al esperarla
export function consulta<T>(resultado: T | Error) {
  const q: Record<string, unknown> = {}
  for (const metodo of ['sort', 'select', 'populate', 'skip', 'limit', 'maxTimeMS', 'lean']) {
    q[metodo] = vi.fn(() => q)
  }
  q.then = (ok: (v: T) => unknown, fallo: (e: unknown) => unknown) =>
    (resultado instanceof Error ? Promise.reject(resultado) : Promise.resolve(resultado)).then(ok, fallo)
  return q as unknown as { [k: string]: ReturnType<typeof vi.fn> } & PromiseLike<T>
}

export const errorBd = () => new Error('base de datos caida')

// --- Fechas --------------------------------------------------------------------

// Fecha AAAA-MM-DD a "dias" de hoy (negativo = pasado), como la envia el cliente
export function fecha(dias: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function fechaUtc(dias: number): Date {
  return new Date(`${fecha(dias)}T00:00:00.000Z`)
}

export type TurnoDatos = {
  _id: Types.ObjectId
  fecha: Date
  horaInicio: string
  horaFin: string
  plazas: number
  plazasLibres: number
}

export function turno(dias: number, datos: Partial<TurnoDatos> = {}): TurnoDatos {
  return {
    _id: nuevoId(),
    fecha: fechaUtc(dias),
    horaInicio: '10:00',
    horaFin: '12:00',
    plazas: 3,
    plazasLibres: 3,
    ...datos
  }
}

// --- Varios --------------------------------------------------------------------

export function firmarToken(id: string, opciones: jwt.SignOptions = {}): string {
  return jwt.sign({ id, rol: 'x' }, process.env.JWT_SECRET!, { expiresIn: '1h', ...opciones })
}

// Firmas minimas que reconoce detectarTipoImagen
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
export const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
export const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])
