/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de oferta de empleo de la coleccion ofertas_empleo.
 */

import { Schema, model, type InferSchemaType } from 'mongoose'
import { ISLAS } from './constantes.js'
import { MODALIDADES } from './Oferta.js'

export const TIPOS_CONTRATO = ['indefinido', 'temporal', 'practicas', 'formacion', 'autonomo'] as const
export const JORNADAS = ['completa', 'parcial'] as const
// Sin borrador: una oferta de empleo se publica al crearla y se cierra cuando se cubre
export const ESTADOS_OFERTA_EMPLEO = ['publicada', 'cerrada'] as const

export const VACANTES_MAX = 100

const ubicacionSchema = new Schema(
  {
    isla: { type: String, enum: ISLAS, required: true },
    municipio: { type: String, required: true, trim: true }
  },
  { _id: false }
)

// Colección aparte de "ofertas": no tiene turnos ni plazas, y sus candidaturas no reservan nada
const ofertaEmpleoSchema = new Schema(
  {
    ofertanteId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true, trim: true, maxlength: 120 },
    descripcion: { type: String, required: true, trim: true, maxlength: 5000 },
    // Las mismas categorias que el voluntariado: sector del puesto
    categoriaIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Categoria' }], default: [] },
    tipoContrato: { type: String, enum: TIPOS_CONTRATO, required: true },
    jornada: { type: String, enum: JORNADAS, required: true },
    modalidad: { type: String, enum: MODALIDADES, required: true },
    ubicacion: {
      type: ubicacionSchema,
      required(this: { modalidad: string }) {
        return this.modalidad !== 'online'
      }
    },
    // Texto libre ("18.000 € brutos/año", "A convenir"): cada entidad lo expresa a su manera
    salario: { type: String, trim: true, maxlength: 100 },
    requisitos: { type: String, trim: true, maxlength: 2000 },
    vacantes: { type: Number, required: true, min: 1, max: VACANTES_MAX, default: 1 },
    // Ultimo dia (00:00 UTC) en que se admiten candidaturas. Sin fecha, hasta que se cierre
    fechaLimite: { type: Date },
    textoBusqueda: { type: String, required: true, select: false },
    estado: { type: String, enum: ESTADOS_OFERTA_EMPLEO, default: 'publicada' },
    fechaPublicacion: { type: Date, default: Date.now }
  },
  { collection: 'ofertas_empleo', timestamps: true }
)

ofertaEmpleoSchema.index({ estado: 1, 'ubicacion.isla': 1, fechaPublicacion: -1 })
ofertaEmpleoSchema.index({ ofertanteId: 1, estado: 1 })

export type OfertaEmpleoDoc = InferSchemaType<typeof ofertaEmpleoSchema>

export const OfertaEmpleo = model('OfertaEmpleo', ofertaEmpleoSchema)
