/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona las peticiones relacionadas con las ofertas de voluntariado.
 */

import type { Request, Response } from 'express'
import type { QueryFilter } from 'mongoose'
import { Categoria } from '../models/Categoria.js'
import { ISLAS } from '../models/constantes.js'
import { Oferta, normalizarTexto, type OfertaDoc } from '../models/Oferta.js'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Los parametros repetidos (?isla=a&isla=b) llegan como array y se ignoran
function leerParametro(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
}

function esIslaValida(isla: string): isla is (typeof ISLAS)[number] {
  return (ISLAS as readonly string[]).includes(isla)
}

// Devuelve la fecha a las 00:00 UTC, como se guarda en los turnos, o null si no existe
function leerFecha(texto: string): Date | null {
  const fecha = new Date(`${texto}T00:00:00.000Z`)
  const esValida =
    FECHA_REGEX.test(texto) &&
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().startsWith(texto)

  return esValida ? fecha : null
}

function hoyEnUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
}

// El termino viene del usuario: sin escapar, un "(" romperia la expresion regular
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// GET /api/ofertas -> ofertas publicadas con algun turno en las fechas pedidas
export async function buscarOfertas(req: Request, res: Response): Promise<void> {
  const q = leerParametro(req.query.q)
  const categoria = leerParametro(req.query.categoria)
  const isla = leerParametro(req.query.isla)
  const municipio = leerParametro(req.query.municipio)
  const textoDesde = leerParametro(req.query.fechaDesde)
  const textoHasta = leerParametro(req.query.fechaHasta)

  if (isla !== undefined && !esIslaValida(isla)) {
    res.status(400).json({ message: 'La isla no es válida' })
    return
  }

  const fechaDesde = textoDesde ? leerFecha(textoDesde) : hoyEnUtc()
  const fechaHasta = textoHasta ? leerFecha(textoHasta) : undefined

  if (!fechaDesde || fechaHasta === null) {
    res.status(400).json({ message: 'Las fechas deben tener el formato AAAA-MM-DD' })
    return
  }

  if (fechaHasta && fechaHasta < fechaDesde) {
    res.status(400).json({ message: 'La fecha de fin no puede ser anterior a la de inicio' })
    return
  }

  try {
    // $elemMatch: las dos condiciones de fecha deben cumplirse en el mismo turno
    const filtro: QueryFilter<OfertaDoc> = {
      estado: 'publicada',
      turnos: {
        $elemMatch: { fecha: { $gte: fechaDesde, ...(fechaHasta && { $lte: fechaHasta }) } }
      }
    }

    if (isla) filtro['ubicacion.isla'] = isla
    if (municipio) filtro['ubicacion.municipio'] = municipio

    if (categoria) {
      const encontrada = await Categoria.findOne({ slug: categoria.toLowerCase() })
      if (!encontrada) {
        res.json([])
        return
      }
      filtro.categoriaIds = encontrada._id
    }

    // Cada palabra debe aparecer, en cualquier orden: "costa limpieza"
    if (q) {
      filtro.$and = normalizarTexto(q)
        .split(/\s+/)
        .map((palabra) => ({ textoBusqueda: new RegExp(escaparRegex(palabra)) }))
    }

    const ofertas = await Oferta.find(filtro)
      .sort({ 'turnos.fecha': 1 })
      .populate<{ ofertanteId: { nombre: string } }>('ofertanteId', 'nombre')
      .populate<{ categoriaIds: Array<{ id: string; nombre: string; slug: string }> }>(
        'categoriaIds',
        'nombre slug'
      )

    res.json(
      ofertas.map((oferta) => ({
        id: oferta.id,
        titulo: oferta.titulo,
        descripcion: oferta.descripcion,
        organizacion: oferta.ofertanteId.nombre,
        categorias: oferta.categoriaIds.map(({ id, nombre, slug }) => ({ id, nombre, slug })),
        modalidad: oferta.modalidad,
        tipoDuracion: oferta.tipoDuracion,
        ubicacion: oferta.ubicacion,
        imagenes: oferta.imagenes,
        turnos: oferta.turnos.map((turno) => ({
          id: turno._id,
          fecha: turno.fecha,
          horaInicio: turno.horaInicio,
          horaFin: turno.horaFin,
          plazas: turno.plazas,
          plazasLibres: turno.plazasLibres
        }))
      }))
    )
  } catch (error) {
    console.error('Error al buscar ofertas:', error)
    res.status(500).json({ message: 'Error al buscar las ofertas' })
  }
}
