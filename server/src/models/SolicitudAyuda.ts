/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de las peticiones del boton Necesito ayuda (coleccion solicitudes_ayuda).
 */

import { Schema, model, type InferSchemaType } from 'mongoose'
import { ISLAS } from './constantes.js'

export const URGENCIAS = ['baja', 'media', 'alta'] as const
export const ESTADOS_SOLICITUD = ['nueva', 'en_revision', 'convertida', 'descartada'] as const

const solicitudAyudaSchema = new Schema(
  {
    // Opcional: esta pendiente decidir si hace falta estar registrado
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User' },
    nombreContacto: { type: String, required: true, trim: true },
    emailContacto: { type: String, required: true, lowercase: true, trim: true },
    telefonoContacto: { type: String, trim: true },
    isla: { type: String, enum: ISLAS, required: true },
    municipio: { type: String, trim: true },
    categoriaId: { type: Schema.Types.ObjectId, ref: 'Categoria' },
    descripcion: { type: String, required: true, trim: true },
    urgencia: { type: String, enum: URGENCIAS, default: 'media' },
    estado: { type: String, enum: ESTADOS_SOLICITUD, default: 'nueva' },
    // Oferta en la que se convirtio la solicitud, si la hay
    ofertaId: { type: Schema.Types.ObjectId, ref: 'Oferta' }
  },
  { collection: 'solicitudes_ayuda', timestamps: true }
)

solicitudAyudaSchema.index({ estado: 1, createdAt: -1 })

export type SolicitudAyudaDoc = InferSchemaType<typeof solicitudAyudaSchema>

export const SolicitudAyuda = model('SolicitudAyuda', solicitudAyudaSchema)
