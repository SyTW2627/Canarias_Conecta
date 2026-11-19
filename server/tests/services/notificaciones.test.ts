/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del servicio que crea notificaciones (modelo simulado).
 */

import { describe, expect, it, vi } from 'vitest'
import { Notificacion } from '../../src/models/Notificacion.js'
import { notificar } from '../../src/services/notificaciones.js'
import { nuevoId } from '../helpers.js'

const aviso = () => ({
  usuarioId: nuevoId(),
  tipo: 'inscripcion_aceptada' as const,
  titulo: 'Solicitud aceptada',
  mensaje: 'Te han aceptado',
  enlace: '/mis_inscripciones'
})

describe('notificar', () => {
  it('guarda una notificacion suelta como lista de un elemento', async () => {
    const insertar = vi.spyOn(Notificacion, 'insertMany').mockResolvedValue([] as never)
    const datos = aviso()

    await notificar(datos)

    expect(insertar).toHaveBeenCalledWith([datos])
  })

  it('guarda varias notificaciones en una sola operacion', async () => {
    const insertar = vi.spyOn(Notificacion, 'insertMany').mockResolvedValue([] as never)
    const avisos = [aviso(), aviso(), aviso()]

    await notificar(avisos)

    expect(insertar).toHaveBeenCalledOnce()
    expect(insertar).toHaveBeenCalledWith(avisos)
  })

  it('no hace nada con una lista vacia', async () => {
    const insertar = vi.spyOn(Notificacion, 'insertMany')
    await notificar([])

    expect(insertar).not.toHaveBeenCalled()
  })

  it('no lanza si falla la base de datos: solo lo registra', async () => {
    vi.spyOn(Notificacion, 'insertMany').mockRejectedValue(new Error('caida'))

    await expect(notificar(aviso())).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('Error al crear las notificaciones:', expect.any(Error))
  })
})
