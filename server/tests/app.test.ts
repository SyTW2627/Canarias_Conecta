/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de la aplicacion Express: endpoint de salud, manejador de errores y montaje de rutas.
 */

import type { NextFunction } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { crearReq, crearRes } from './helpers.js'

const db = vi.hoisted(() => ({ dbStatus: vi.fn() }))
vi.mock('../src/config/db.js', () => db)

const { default: app, estadoApi, manejarErrores } = await import('../src/app.js')
const { default: authRoutes } = await import('../src/routes/authRoutes.js')
const { default: categoriaRoutes } = await import('../src/routes/categoriaRoutes.js')
const { default: ofertaRoutes } = await import('../src/routes/ofertaRoutes.js')
const { default: inscripcionRoutes } = await import('../src/routes/inscripcionRoutes.js')
const { default: imagenRoutes } = await import('../src/routes/imagenRoutes.js')
const { default: notificacionRoutes } = await import('../src/routes/notificacionRoutes.js')
const { default: empleoRoutes } = await import('../src/routes/empleoRoutes.js')

type Capa = { name: string; handle: unknown; route?: { path: string }; match(ruta: string): boolean }
const capas = (app as unknown as { router: { stack: Capa[] } }).router.stack

describe('estadoApi', () => {
  it.each(['conectado', 'desconectado'])('informa de que la API funciona y la base de datos esta %s', (estado) => {
    db.dbStatus.mockReturnValue(estado)
    const res = crearRes()

    estadoApi(crearReq(), res)

    expect(res.body).toEqual({ status: 'ok', message: 'Canarias Conecta API funcionando', database: estado })
  })
})

describe('manejarErrores', () => {
  const next = vi.fn() as unknown as NextFunction

  it.each([400, 413, 415])('responde %i con un mensaje generico a los errores del cliente', (status) => {
    const res = crearRes()

    manejarErrores({ status }, crearReq(), res, next)

    expect(res.statusCode).toBe(status)
    expect(res.body).toEqual({ message: 'La petición no es válida' })
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([
    ['sin codigo', {}],
    ['con codigo 500', { status: 500 }],
    ['con codigo 503', { status: 503 }]
  ])('responde 500 sin detalles internos ante un error %s y lo registra', (_caso, error) => {
    const res = crearRes()

    manejarErrores(error, crearReq(), res, next)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error del servidor' })
    expect(console.error).toHaveBeenCalledWith('Error no controlado:', error)
  })
})

describe('app', () => {
  it('aplica CORS y el lector de JSON antes que las rutas', () => {
    expect(capas.slice(0, 2).map((capa) => capa.name)).toEqual(['corsMiddleware', 'jsonParser'])
  })

  it('expone el endpoint de salud', () => {
    const salud = capas.find((capa) => capa.route?.path === '/api/health')
    expect(salud).toBeDefined()
    expect(salud?.match('/api/health')).toBe(true)
  })

  it.each([
    ['/api/auth', authRoutes],
    ['/api/categorias', categoriaRoutes],
    ['/api/ofertas', ofertaRoutes],
    ['/api/inscripciones', inscripcionRoutes],
    ['/api/imagenes', imagenRoutes],
    ['/api/notificaciones', notificacionRoutes],
    ['/api/empleo', empleoRoutes]
  ])('monta las rutas de %s', (prefijo, router) => {
    const capa = capas.find((c) => c.handle === router)

    expect(capa).toBeDefined()
    expect(capa?.match(`${prefijo}/cualquier-cosa`)).toBe(true)
    expect(capa?.match('/otra/ruta')).toBe(false)
  })

  it('registra el manejador de errores en ultimo lugar', () => {
    expect(capas.at(-1)?.handle).toBe(manejarErrores)
  })
})
