/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de GET /api/ofertas/recomendadas (modelos simulados).
 */

import type { Types } from 'mongoose'
import { describe, expect, it, vi } from 'vitest'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { Oferta } from '../../src/models/Oferta.js'
import { User } from '../../src/models/User.js'
import { consulta, crearReq, crearRes, errorBd, nuevoId, turno, usuarioVoluntario } from '../helpers.js'

vi.mock('../../src/services/notificaciones.js', () => ({ notificar: vi.fn() }))

const { getRecomendaciones } = await import('../../src/controllers/ofertaController.js')

const sesion = usuarioVoluntario()
const COSTA = { id: 'c-costa', nombre: 'Medio ambiente', slug: 'medio-ambiente' }
const MAYORES = { id: 'c-mayores', nombre: 'Personas mayores', slug: 'personas-mayores' }

function ofertaPoblada(titulo: string, categorias: typeof COSTA[], isla = 'tenerife') {
  return {
    id: nuevoId().toString(),
    titulo,
    descripcion: 'Descripción',
    ofertanteId: { nombre: 'ONG' },
    categoriaIds: categorias.map((c) => ({ ...c, imagenId: undefined as Types.ObjectId | undefined })),
    modalidad: 'presencial',
    tipoDuracion: 'jornada',
    ubicacion: { isla, municipio: 'Municipio' },
    imagenes: [] as Types.ObjectId[],
    turnos: [turno(3)]
  }
}

function simularUsuario(voluntario: Record<string, unknown> | undefined, isla?: string) {
  const usuario = voluntario === undefined ? null : { _id: nuevoId(), isla, voluntario }
  return vi.spyOn(User, 'findById').mockReturnValue(consulta(usuario) as never)
}

describe('getRecomendaciones', () => {
  it('devuelve las ofertas ordenadas por afinidad con sus motivos', async () => {
    simularUsuario({ interesIds: [COSTA], islasPreferidas: [], favoritas: [] }, 'tenerife')
    vi.spyOn(Inscripcion, 'find').mockReturnValue(consulta([]) as never)
    const costa = ofertaPoblada('Limpieza de costa', [COSTA])
    const mayores = ofertaPoblada('Acompañar mayores', [MAYORES], 'lanzarote')
    const mayoresTenerife = ofertaPoblada('Mayores en Tenerife', [MAYORES])
    const buscar = vi.spyOn(Oferta, 'find').mockReturnValue(consulta([mayores, mayoresTenerife, costa]) as never)

    const res = crearRes()
    await getRecomendaciones(crearReq({ usuario: sesion }), res)

    expect(res.statusCode).toBe(200)
    const cuerpo = res.body as {
      intereses: unknown[]
      recomendaciones: Array<{ oferta: { titulo: string }; afinidad: number; motivos: unknown[] }>
    }
    expect(cuerpo.intereses).toEqual([{ id: COSTA.id, nombre: COSTA.nombre }])
    expect(cuerpo.recomendaciones.map((r) => [r.oferta.titulo, r.afinidad])).toEqual([
      ['Limpieza de costa', 80],
      ['Mayores en Tenerife', 20]
    ])
    expect(cuerpo.recomendaciones[0].motivos).toEqual([
      { tipo: 'interes', texto: 'Te interesa Medio ambiente' },
      { tipo: 'isla', texto: 'En tu isla: Tenerife' }
    ])
    // Solo publicadas, con plazas en turnos futuros
    expect(buscar.mock.calls[0][0]).toMatchObject({ estado: 'publicada', _id: { $nin: [] } })
  })

  it('excluye las ofertas en las que ya esta inscrito y usa su historial', async () => {
    const inscrita = nuevoId()
    const cancelada = nuevoId()
    simularUsuario({ interesIds: [], islasPreferidas: [], favoritas: [] })
    vi.spyOn(Inscripcion, 'find').mockReturnValue(
      consulta([
        { ofertaId: inscrita, estado: 'aceptada' },
        { ofertaId: cancelada, estado: 'cancelada' }
      ]) as never
    )
    const candidata = ofertaPoblada('Otra de mayores', [MAYORES], 'lanzarote')
    const buscar = vi
      .spyOn(Oferta, 'find')
      .mockReturnValueOnce(consulta([{ titulo: 'Acompañar mayores', categoriaIds: [MAYORES.id] }]) as never)
      .mockReturnValueOnce(consulta([candidata]) as never)

    const res = crearRes()
    await getRecomendaciones(crearReq({ usuario: sesion }), res)

    // El historial solo incluye la inscripcion que no se cancelo
    expect(buscar.mock.calls[0][0]).toEqual({ _id: { $in: [inscrita] } })
    expect(buscar.mock.calls[1][0]).toMatchObject({ _id: { $nin: [inscrita] } })
    const cuerpo = res.body as { recomendaciones: Array<{ afinidad: number; motivos: unknown[] }> }
    expect(cuerpo.recomendaciones).toEqual([
      expect.objectContaining({
        afinidad: 20,
        motivos: [{ tipo: 'historial', texto: 'Parecida a «Acompañar mayores»' }]
      })
    ])
  })

  it('responde 404 si el usuario ya no existe', async () => {
    simularUsuario(undefined)
    const res = crearRes()
    await getRecomendaciones(crearReq({ usuario: sesion }), res)
    expect(res.statusCode).toBe(404)
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(User, 'findById').mockReturnValue(consulta(errorBd()) as never)
    const res = crearRes()
    await getRecomendaciones(crearReq({ usuario: sesion }), res)
    expect(res.statusCode).toBe(500)
  })
})
