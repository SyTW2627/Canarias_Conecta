/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del controlador de notificaciones (modelo simulado).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  getNotificaciones,
  marcarLeida,
  marcarTodasLeidas
} from '../../src/controllers/notificacionController.js'
import { Notificacion } from '../../src/models/Notificacion.js'
import { consulta, crearReq, crearRes, errorBd, nuevoId, usuarioVoluntario } from '../helpers.js'

const usuario = usuarioVoluntario()

describe('getNotificaciones', () => {
  it('devuelve las 30 mas recientes del usuario y el total sin leer', async () => {
    const fecha = new Date('2026-01-02T10:00:00Z')
    const q = consulta([
      { id: 'a', tipo: 'inscripcion_aceptada', titulo: 'T', mensaje: 'M', enlace: '/x', leida: false, createdAt: fecha },
      { id: 'b', tipo: 'oferta_cerrada', titulo: 'T2', mensaje: 'M2', leida: true, createdAt: fecha }
    ])
    const buscar = vi.spyOn(Notificacion, 'find').mockReturnValue(q as never)
    const contar = vi.spyOn(Notificacion, 'countDocuments').mockResolvedValue(4 as never)
    const res = crearRes()

    await getNotificaciones(crearReq({ usuario }), res)

    expect(buscar).toHaveBeenCalledWith({ usuarioId: usuario.id })
    expect(q.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(q.limit).toHaveBeenCalledWith(30)
    expect(contar).toHaveBeenCalledWith({ usuarioId: usuario.id, leida: false })
    expect(res.body).toEqual({
      noLeidas: 4,
      notificaciones: [
        { id: 'a', tipo: 'inscripcion_aceptada', titulo: 'T', mensaje: 'M', enlace: '/x', leida: false, fecha },
        { id: 'b', tipo: 'oferta_cerrada', titulo: 'T2', mensaje: 'M2', enlace: null, leida: true, fecha }
      ]
    })
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Notificacion, 'find').mockReturnValue(consulta([]) as never)
    vi.spyOn(Notificacion, 'countDocuments').mockRejectedValue(errorBd())
    const res = crearRes()

    await getNotificaciones(crearReq({ usuario }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudieron cargar las notificaciones' })
  })
})

describe('marcarLeida', () => {
  it('marca la notificacion filtrando tambien por el usuario y responde 204', async () => {
    const id = nuevoId().toString()
    const actualizar = vi.spyOn(Notificacion, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never)
    const res = crearRes()

    await marcarLeida(crearReq({ usuario, params: { id } }), res)

    // Filtrar por usuarioId impide marcar notificaciones de otros
    expect(actualizar).toHaveBeenCalledWith({ _id: id, usuarioId: usuario.id }, { leida: true })
    expect(res.statusCode).toBe(204)
    expect(res.terminada).toBe(true)
  })

  it('responde 404 sin consultar si el id no es valido', async () => {
    const actualizar = vi.spyOn(Notificacion, 'updateOne')
    const res = crearRes()

    await marcarLeida(crearReq({ usuario, params: { id: 'xyz' } }), res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'La notificación no existe' })
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('responde 404 si no existe o es de otro usuario', async () => {
    vi.spyOn(Notificacion, 'updateOne').mockResolvedValue({ matchedCount: 0 } as never)
    const res = crearRes()

    await marcarLeida(crearReq({ usuario, params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(404)
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Notificacion, 'updateOne').mockRejectedValue(errorBd())
    const res = crearRes()

    await marcarLeida(crearReq({ usuario, params: { id: nuevoId().toString() } }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo actualizar la notificación' })
  })
})

describe('marcarTodasLeidas', () => {
  it('marca solo las no leidas del usuario y responde 204', async () => {
    const actualizar = vi.spyOn(Notificacion, 'updateMany').mockResolvedValue({} as never)
    const res = crearRes()

    await marcarTodasLeidas(crearReq({ usuario }), res)

    expect(actualizar).toHaveBeenCalledWith({ usuarioId: usuario.id, leida: false }, { leida: true })
    expect(res.statusCode).toBe(204)
    expect(res.terminada).toBe(true)
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Notificacion, 'updateMany').mockRejectedValue(errorBd())
    const res = crearRes()

    await marcarTodasLeidas(crearReq({ usuario }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudieron actualizar las notificaciones' })
  })
})
