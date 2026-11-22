/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona los retos del voluntario y el ranking mensual de horas de voluntariado.
 */

import type { Request, Response } from 'express'
import type { PipelineStage, Types } from 'mongoose'
import { Inscripcion } from '../models/Inscripcion.js'
import { User } from '../models/User.js'
import { calcularLogros, leerProgreso } from '../services/logros.js'
import { esIslaValida, leerParametro } from './ofertaController.js'

const MES_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/
export const RANKING_MAX = 10

// GET /api/gamificacion/logros -> retos del voluntario con su progreso
export async function getMisLogros(req: Request, res: Response): Promise<void> {
  try {
    const progreso = await leerProgreso(req.usuario!.id)
    if (!progreso) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    const logros = calcularLogros(progreso.metricas, progreso.guardados)
    res.json({
      metricas: progreso.metricas,
      conseguidos: logros.filter(({ conseguido }) => conseguido).length,
      logros
    })
  } catch (error) {
    console.error('Error al calcular los retos:', error)
    res.status(500).json({ message: 'No se pudieron cargar tus retos' })
  }
}

// "Laura Perez Gil" -> "Laura P.": el ranking lo ven otros voluntarios
export function nombrePublico(nombre: string): string {
  const [nombrePropio, apellido] = nombre.trim().split(/\s+/)
  return apellido ? `${nombrePropio} ${apellido.charAt(0).toUpperCase()}.` : (nombrePropio ?? '')
}

function mesActual(): string {
  return new Date().toISOString().slice(0, 7)
}

type FilaRanking = { _id: Types.ObjectId; horas: number; colaboraciones: number }

// GET /api/gamificacion/ranking?mes=AAAA-MM&isla= -> voluntarios con mas horas completadas en el
// mes (por la fecha de la actividad), en todas las islas o en una. Incluye la posicion de quien pregunta
export async function getRanking(req: Request, res: Response): Promise<void> {
  const mes = leerParametro(req.query.mes) ?? mesActual()
  const isla = leerParametro(req.query.isla)

  const partes = MES_REGEX.exec(mes)
  if (!partes) {
    res.status(400).json({ message: 'El mes debe tener el formato AAAA-MM' })
    return
  }
  if (isla !== undefined && !esIslaValida(isla)) {
    res.status(400).json({ message: 'La isla no es válida' })
    return
  }

  const inicio = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, 1))
  const fin = new Date(Date.UTC(Number(partes[1]), Number(partes[2]), 1))

  const etapas: PipelineStage[] = [
    { $match: { estado: 'completada' } },
    { $lookup: { from: 'ofertas', localField: 'ofertaId', foreignField: '_id', as: 'oferta' } },
    { $unwind: '$oferta' },
    ...(isla ? [{ $match: { 'oferta.ubicacion.isla': isla } }] : []),
    // Fecha de la actividad: el ultimo de los turnos de la inscripcion
    {
      $addFields: {
        fechaActividad: {
          $max: {
            $map: {
              input: {
                $filter: {
                  input: '$oferta.turnos',
                  as: 'turno',
                  cond: { $in: ['$$turno._id', '$turnoIds'] }
                }
              },
              as: 'turno',
              in: '$$turno.fecha'
            }
          }
        }
      }
    },
    { $match: { fechaActividad: { $gte: inicio, $lt: fin } } },
    {
      $group: {
        _id: '$voluntarioId',
        horas: { $sum: { $ifNull: ['$horasRealizadas', 0] } },
        colaboraciones: { $sum: 1 }
      }
    },
    { $sort: { horas: -1, colaboraciones: -1, _id: 1 } }
  ]

  try {
    const filas = await Inscripcion.aggregate<FilaRanking>(etapas)
    const usuarioId = req.usuario!.id

    // Empate en horas = misma posicion: 1 + cuantos tienen mas horas
    const posicionDe = (horas: number) => 1 + filas.filter((otra) => otra.horas > horas).length
    const mias = filas.find((fila) => fila._id.toString() === usuarioId)
    const primeras = filas.slice(0, RANKING_MAX)

    const usuarios = await User.find({
      _id: { $in: primeras.map((fila) => fila._id) }
    }).select('nombre avatarUrl')
    const porId = new Map(usuarios.map((usuario) => [usuario.id as string, usuario]))

    res.json({
      mes,
      isla: isla ?? null,
      participantes: filas.length,
      ranking: primeras.map((fila) => {
        const usuario = porId.get(fila._id.toString())
        return {
          posicion: posicionDe(fila.horas),
          nombre: usuario ? nombrePublico(usuario.nombre) : 'Voluntario',
          avatarUrl: usuario?.avatarUrl ?? null,
          horas: Math.round(fila.horas * 100) / 100,
          colaboraciones: fila.colaboraciones,
          eresTu: fila._id.toString() === usuarioId
        }
      }),
      tuPosicion: mias
        ? {
            posicion: posicionDe(mias.horas),
            horas: Math.round(mias.horas * 100) / 100,
            colaboraciones: mias.colaboraciones
          }
        : null
    })
  } catch (error) {
    console.error('Error al calcular el ranking:', error)
    res.status(500).json({ message: 'No se pudo cargar el ranking' })
  }
}
