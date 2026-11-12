/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el modelo de usuario (voluntario, ofertante o admin) de la coleccion users.
 */

import { Schema, model, type InferSchemaType } from 'mongoose'
import { HORA_REGEX, ISLAS } from './constantes.js'

export const ROLES = ['voluntario', 'ofertante', 'admin'] as const
// Unicos roles que se pueden elegir al registrarse: admin nunca debe estar aqui
export const ROLES_REGISTRO = ['voluntario', 'ofertante'] as const
export const ESTADOS_USUARIO = ['pendiente_verificacion', 'activo', 'suspendido', 'eliminado'] as const
export const TIPOS_ENTIDAD = [
  'ong',
  'asociacion',
  'fundacion',
  'administracion_publica',
  'empresa',
  'particular'
] as const
export const TIPOS_CONSENTIMIENTO = ['terminos', 'privacidad', 'comunicaciones'] as const

const consentimientoSchema = new Schema(
  {
    tipo: { type: String, enum: TIPOS_CONSENTIMIENTO, required: true },
    version: { type: String, required: true },
    aceptado: { type: Boolean, required: true },
    fecha: { type: Date, default: Date.now }
  },
  { _id: false }
)

const franjaDisponibilidadSchema = new Schema(
  {
    // 0 = domingo ... 6 = sabado, igual que Date.getDay()
    diaSemana: { type: Number, required: true, min: 0, max: 6 },
    horaInicio: { type: String, required: true, match: HORA_REGEX },
    horaFin: { type: String, required: true, match: HORA_REGEX }
  },
  { _id: false }
)

const perfilVoluntarioSchema = new Schema(
  {
    fechaNacimiento: { type: Date },
    biografia: { type: String, trim: true },
    interesIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Categoria' }], default: [] },
    habilidades: { type: [String], default: [] },
    idiomas: { type: [String], default: [] },
    islasPreferidas: { type: [{ type: String, enum: ISLAS }], default: [] },
    disponibilidad: { type: [franjaDisponibilidadSchema], default: [] },
    favoritas: { type: [{ type: Schema.Types.ObjectId, ref: 'Oferta' }], default: [] },
    estadisticas: {
      horasTotales: { type: Number, default: 0 },
      colaboraciones: { type: Number, default: 0 },
      valoracionMedia: { type: Number, default: 0 },
      numValoraciones: { type: Number, default: 0 }
    }
  },
  { _id: false }
)

const perfilOfertanteSchema = new Schema(
  {
    tipoEntidad: { type: String, enum: TIPOS_ENTIDAD, required: true },
    cif: { type: String, trim: true },
    descripcion: { type: String, trim: true },
    web: { type: String, trim: true },
    personaContacto: { type: String, trim: true },
    direccion: { type: String, trim: true },
    verificada: { type: Boolean, default: false },
    estadisticas: {
      ofertasPublicadas: { type: Number, default: 0 },
      valoracionMedia: { type: Number, default: 0 },
      numValoraciones: { type: Number, default: 0 }
    }
  },
  { _id: false }
)

const userSchema = new Schema(
  {
    // Nombre de la persona o de la entidad, segun el rol
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Se guarda el hash de bcrypt, nunca la contrasena en claro
    password: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, required: true },
    estado: { type: String, enum: ESTADOS_USUARIO, default: 'activo' },
    emailVerificado: { type: Boolean, default: false },
    avatarUrl: { type: String, trim: true },
    telefono: { type: String, trim: true },
    isla: { type: String, enum: ISLAS },
    municipio: { type: String, trim: true },
    consentimientos: { type: [consentimientoSchema], default: [] },
    ultimoAcceso: { type: Date },
    // Los JWT emitidos antes de esta fecha dejan de valer (p. ej. tras restablecer la contrasena)
    passwordCambiadaEn: { type: Date },
    // Solo rol voluntario
    voluntario: { type: perfilVoluntarioSchema },
    // Solo rol ofertante
    ofertante: { type: perfilOfertanteSchema }
  },
  { timestamps: true }
)

userSchema.index({ rol: 1, estado: 1 })
// sparse ignora a quien no tiene cif, pero no las cadenas vacias: guardar undefined en ese caso
userSchema.index({ 'ofertante.cif': 1 }, { unique: true, sparse: true })

export type UserDoc = InferSchemaType<typeof userSchema>

export const User = model('User', userSchema)
