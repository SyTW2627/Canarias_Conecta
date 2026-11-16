/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de las tablas de rutas: metodo, ruta, protecciones y controlador de cada endpoint.
 */

import type { Router } from 'express'
import { describe, expect, it, vi } from 'vitest'

// Dobles con nombre reconocible: requireRol("x") devuelve una funcion que recuerda sus roles
vi.mock('../../src/middleware/auth.js', () => ({
  requireAuth: function requireAuth() {},
  requireRol: (...roles: string[]) => Object.assign(function requireRol() {}, { roles })
}))

const rutas = {
  auth: (await import('../../src/routes/authRoutes.js')).default,
  categorias: (await import('../../src/routes/categoriaRoutes.js')).default,
  imagenes: (await import('../../src/routes/imagenRoutes.js')).default,
  ofertas: (await import('../../src/routes/ofertaRoutes.js')).default,
  inscripciones: (await import('../../src/routes/inscripcionRoutes.js')).default,
  notificaciones: (await import('../../src/routes/notificacionRoutes.js')).default
}

type Manejador = { name: string; roles?: string[] }
type Capa = {
  name: string
  handle: Manejador
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Manejador }> }
}

// Describe cada manejador con texto legible: "requireRol(ofertante)", "crearOferta"...
function describir(manejador: Manejador): string {
  return manejador.roles ? `requireRol(${manejador.roles.join(',')})` : manejador.name
}

// Lista "METODO /ruta: manejador > manejador..." en el orden en que se registraron
function tabla(router: Router): string[] {
  return (router as unknown as { stack: Capa[] }).stack.map((capa) => {
    if (!capa.route) return `USE: ${describir(capa.handle)}`
    const metodo = Object.keys(capa.route.methods)[0].toUpperCase()
    const cadena = capa.route.stack.map((paso) => describir(paso.handle)).join(' > ')
    return `${metodo} ${capa.route.path}: ${cadena}`
  })
}

describe('Rutas de autenticacion (/api/auth)', () => {
  it('registro, login y recuperacion son publicos; el perfil exige sesion', () => {
    expect(tabla(rutas.auth)).toEqual([
      'POST /register: register',
      'POST /login: login',
      'POST /recuperar-password: solicitarRecuperacion',
      'POST /restablecer-password: restablecerPassword',
      'PATCH /me: requireAuth > actualizarPerfil',
      'GET /me: requireAuth > getPerfil'
    ])
  })
})

describe('Rutas de categorias e imagenes', () => {
  it('son publicas', () => {
    expect(tabla(rutas.categorias)).toEqual(['GET /: getCategorias'])
    expect(tabla(rutas.imagenes)).toEqual(['GET /:id: getImagen'])
  })
})

describe('Rutas de ofertas (/api/ofertas)', () => {
  it('la busqueda y el detalle son publicos; la gestion exige ser ofertante', () => {
    expect(tabla(rutas.ofertas)).toEqual([
      'GET /: buscarOfertas',
      // La imagen se lee despues de comprobar la sesion
      'POST /: requireAuth > requireRol(ofertante) > recibirImagen > crearOferta',
      'GET /mias: requireAuth > requireRol(ofertante) > getMisOfertas',
      'GET /mias/:id: requireAuth > requireRol(ofertante) > getMiOferta',
      'GET /:id: getOferta',
      'PATCH /:id/cerrar: requireAuth > requireRol(ofertante) > cerrarOferta',
      'PUT /:id: requireAuth > requireRol(ofertante) > recibirImagen > editarOferta',
      'DELETE /:id: requireAuth > requireRol(ofertante) > eliminarOferta'
    ])
  })

  it('declara /mias antes que /:id para que "mias" no se tome como un id', () => {
    const lista = tabla(rutas.ofertas)
    expect(lista.findIndex((r) => r.startsWith('GET /mias:'))).toBeLessThan(
      lista.findIndex((r) => r.startsWith('GET /:id:'))
    )
  })
})

describe('Rutas de inscripciones (/api/inscripciones)', () => {
  it('inscribirse y el historial son de voluntarios; los candidatos y las decisiones, de ofertantes', () => {
    expect(tabla(rutas.inscripciones)).toEqual([
      'POST /: requireAuth > requireRol(voluntario) > crearInscripcion',
      'GET /mias: requireAuth > requireRol(voluntario) > getMisInscripciones',
      'GET /oferta/:ofertaId: requireAuth > requireRol(ofertante) > getCandidatosOferta',
      'PATCH /:id/aceptar: requireAuth > requireRol(ofertante) > aceptarInscripcion',
      'PATCH /:id/rechazar: requireAuth > requireRol(ofertante) > rechazarInscripcion'
    ])
  })
})

describe('Rutas de notificaciones (/api/notificaciones)', () => {
  it('todas exigen sesion y /leidas va antes que /:id/leida', () => {
    expect(tabla(rutas.notificaciones)).toEqual([
      'USE: requireAuth',
      'GET /: getNotificaciones',
      'PATCH /leidas: marcarTodasLeidas',
      'PATCH /:id/leida: marcarLeida'
    ])
  })
})
