/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Crea los avisos que reciben los usuarios cuando ocurre algo que les afecta.
 */

import type { Types } from 'mongoose'
import { Notificacion, type TIPOS_NOTIFICACION } from '../models/Notificacion.js'

export type DatosNotificacion = {
  usuarioId: Types.ObjectId | string
  tipo: (typeof TIPOS_NOTIFICACION)[number]
  titulo: string
  mensaje: string
  enlace?: string
}

// El aviso es secundario: si falla se registra, pero la accion que lo provoca ya se ha hecho
// y no debe responder con error por ello
export async function notificar(avisos: DatosNotificacion | DatosNotificacion[]): Promise<void> {
  const lista = Array.isArray(avisos) ? avisos : [avisos]
  if (lista.length === 0) return

  try {
    await Notificacion.insertMany(lista)
  } catch (error) {
    console.error('Error al crear las notificaciones:', error)
  }
}
