/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona la consulta de notificaciones del usuario autenticado y su marcado como leidas.
 */

import type { Request, Response } from 'express'
import { isObjectIdOrHexString } from 'mongoose'
import { Notificacion } from '../models/Notificacion.js'

const LIMITE = 30

// GET /api/notificaciones -> las mas recientes y el total sin leer
export async function getNotificaciones(req: Request, res: Response): Promise<void> {
  const usuarioId = req.usuario!.id

  try {
    const [notificaciones, noLeidas] = await Promise.all([
      Notificacion.find({ usuarioId }).sort({ createdAt: -1 }).limit(LIMITE),
      Notificacion.countDocuments({ usuarioId, leida: false })
    ])

    res.json({
      noLeidas,
      notificaciones: notificaciones.map((notificacion) => ({
        id: notificacion.id,
        tipo: notificacion.tipo,
        titulo: notificacion.titulo,
        mensaje: notificacion.mensaje,
        enlace: notificacion.enlace ?? null,
        leida: notificacion.leida,
        fecha: notificacion.createdAt
      }))
    })
  } catch (error) {
    console.error('Error al obtener las notificaciones:', error)
    res.status(500).json({ message: 'No se pudieron cargar las notificaciones' })
  }
}

// PATCH /api/notificaciones/:id/leida -> marca una notificacion propia como leida
export async function marcarLeida(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(404).json({ message: 'La notificación no existe' })
    return
  }

  try {
    const { matchedCount } = await Notificacion.updateOne(
      { _id: id, usuarioId: req.usuario!.id },
      { leida: true }
    )

    if (matchedCount === 0) {
      res.status(404).json({ message: 'La notificación no existe' })
      return
    }

    res.status(204).end()
  } catch (error) {
    console.error('Error al marcar la notificación:', error)
    res.status(500).json({ message: 'No se pudo actualizar la notificación' })
  }
}

// PATCH /api/notificaciones/leidas -> marca todas las del usuario como leidas
export async function marcarTodasLeidas(req: Request, res: Response): Promise<void> {
  try {
    await Notificacion.updateMany({ usuarioId: req.usuario!.id, leida: false }, { leida: true })
    res.status(204).end()
  } catch (error) {
    console.error('Error al marcar las notificaciones:', error)
    res.status(500).json({ message: 'No se pudieron actualizar las notificaciones' })
  }
}
