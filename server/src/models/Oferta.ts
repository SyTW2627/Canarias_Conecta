/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de oferta de voluntariado de la coleccion ofertas.
 */

import { Schema, model, type InferSchemaType } from 'mongoose'
import { HORA_REGEX, ISLAS } from './constantes.js'

export const MODALIDADES = ['presencial', 'online', 'mixta'] as const
export const TIPOS_DURACION = ['jornada', 'periodo_corto'] as const
export const ESTADOS_OFERTA = ['borrador', 'publicada', 'cerrada', 'cancelada'] as const

const ubicacionSchema = new Schema(
  {
    isla: { type: String, enum: ISLAS, required: true },
    municipio: { type: String, required: true, trim: true },
    direccion: { type: String, trim: true }
  },
  { _id: false }
)

const turnoSchema = new Schema({
  // Dia del turno a las 00:00 UTC. La hora va aparte en horaInicio y horaFin
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true, match: HORA_REGEX },
  horaFin: {
    type: String,
    required: true,
    match: HORA_REGEX,
    validate: {
      validator(this: { horaInicio: string }, horaFin: string) {
        return horaFin > this.horaInicio
      },
      message: 'La hora de fin debe ser posterior a la de inicio'
    }
  },
  plazas: { type: Number, required: true, min: 1 },
  // Se guardan las libres, no las ocupadas: permite reservar en una sola operacion atomica
  plazasLibres: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator(this: { plazas: number }, plazasLibres: number) {
        return plazasLibres <= this.plazas
      },
      message: 'Las plazas libres no pueden superar a las plazas'
    }
  }
})

// Un borrador puede estar incompleto. Los demas estados ya son visibles para los voluntarios
function noVacioSiCompleta(this: { estado: string }, lista: unknown[]): boolean {
  return this.estado === 'borrador' || lista.length > 0
}

const ofertaSchema = new Schema(
  {
    ofertanteId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true, trim: true, maxlength: 120 },
    descripcion: { type: String, required: true, trim: true, maxlength: 5000 },
    categoriaIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Categoria' }],
      validate: {
        validator: noVacioSiCompleta,
        message: 'La oferta necesita al menos una categoría'
      }
    },
    modalidad: { type: String, enum: MODALIDADES, required: true },
    tipoDuracion: { type: String, enum: TIPOS_DURACION, required: true },
    ubicacion: {
      type: ubicacionSchema,
      required(this: { estado: string; modalidad: string }) {
        return this.estado !== 'borrador' && this.modalidad !== 'online'
      }
    },
    requisitos: { type: String, trim: true, maxlength: 2000 },
    edadMinima: { type: Number, min: 0 },
    imagenes: { type: [{ type: Schema.Types.ObjectId, ref: 'Imagen' }], default: [] },
    turnos: {
      type: [turnoSchema],
      validate: {
        validator: noVacioSiCompleta,
        message: 'La oferta necesita al menos un turno'
      }
    },
    // Copia normalizada para buscar sin distinguir tildes ni mayusculas
    textoBusqueda: { type: String, required: true, select: false },
    estado: { type: String, enum: ESTADOS_OFERTA, default: 'borrador' },
    fechaPublicacion: { type: Date }
  },
  { collection: 'ofertas', timestamps: true }
)

ofertaSchema.index({ estado: 1, 'ubicacion.isla': 1, categoriaIds: 1 })
ofertaSchema.index({ 'turnos.fecha': 1 })
ofertaSchema.index({ ofertanteId: 1, estado: 1 })

// Pasa a minusculas y quita las tildes: "Reforestación" -> "reforestacion"
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

// Une las partes con un solo espacio: el texto recibido puede traer espacios sobrantes
export function construirTextoBusqueda(partes: Array<string | undefined>): string {
  return normalizarTexto(partes.filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim()
}

export type OfertaDoc = InferSchemaType<typeof ofertaSchema>

export const Oferta = model('Oferta', ofertaSchema)
