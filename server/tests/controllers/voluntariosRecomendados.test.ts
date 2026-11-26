/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de los voluntarios recomendados a una entidad y de sus invitaciones.
 */

import { describe, expect, it, vi } from 'vitest'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { Notificacion } from '../../src/models/Notificacion.js'
import { Oferta } from '../../src/models/Oferta.js'
import { User } from '../../src/models/User.js'
import { consulta, crearReq, crearRes, errorBd, nuevoId, turno, usuarioOfertante } from '../helpers.js'

const { getVoluntariosRecomendados, invitarVoluntario } = await import(
  '../../src/controllers/voluntariosRecomendadosController.js'
)

const sesion = usuarioOfertante()
const COSTA_ID = nuevoId()
const COSTA = { _id: COSTA_ID, id: COSTA_ID.toString(), nombre: 'Medio ambiente' }

function ofertaPropia(datos: Record<string, unknown> = {}) {
  return {
    id: nuevoId().toString(),
    titulo: 'Limpieza de costa',
    estado: 'publicada',
    modalidad: 'presencial',
    ubicacion: { isla: 'tenerife', municipio: 'Adeje' },
    categoriaIds: [COSTA],
    turnos: [turno(3)],
    ...datos
  }
}

function voluntario(nombre: string, perfil: Record<string, unknown> = {}, isla?: string) {
  const id = nuevoId().toString()
  return {
    id,
    nombre,
    email: `${nombre}@correo.es`,
    isla,
    voluntario: { interesIds: [], habilidades: [], idiomas: [], ...perfil }
  }
}

function simularOferta(oferta: unknown) {
  return vi.spyOn(Oferta, 'findOne').mockReturnValue(consulta(oferta) as never)
}

describe('getVoluntariosRecomendados', () => {
  it('devuelve los voluntarios compatibles, sin contacto, y marca a los ya invitados', async () => {
    const oferta = ofertaPropia()
    simularOferta(oferta)
    const inscrito = nuevoId()
    vi.spyOn(Inscripcion, 'distinct').mockReturnValue(consulta([inscrito]) as never)
    const ana = voluntario('ana', { interesIds: [COSTA] }, 'tenerife')
    const luis = voluntario('luis', {}, 'tenerife')
    const buscar = vi.spyOn(User, 'find').mockReturnValue(consulta([luis, ana]) as never)
    vi.spyOn(Notificacion, 'distinct').mockReturnValue(consulta([luis.id]) as never)

    const res = crearRes()
    await getVoluntariosRecomendados(crearReq({ usuario: sesion, params: { id: oferta.id } }), res)

    expect(res.statusCode).toBe(200)
    const cuerpo = res.body as {
      oferta: { titulo: string }
      recomendaciones: Array<{
        voluntario: Record<string, unknown>
        afinidad: number
        invitado: boolean
      }>
    }
    expect(cuerpo.oferta.titulo).toBe('Limpieza de costa')
    expect(cuerpo.recomendaciones.map((r) => [r.voluntario.nombre, r.afinidad, r.invitado])).toEqual([
      ['ana', 70, false],
      ['luis', 20, true]
    ])
    expect(cuerpo.recomendaciones[0].voluntario).not.toHaveProperty('email')
    // Solo voluntarios activos que no estan ya inscritos
    expect(buscar.mock.calls[0][0]).toMatchObject({
      rol: 'voluntario',
      estado: 'activo',
      _id: { $nin: [inscrito] }
    })
  })

  it('responde 404 si la oferta no es del ofertante o el id no es valido', async () => {
    simularOferta(null)
    const res = crearRes()
    await getVoluntariosRecomendados(crearReq({ usuario: sesion, params: { id: nuevoId().toString() } }), res)
    expect(res.statusCode).toBe(404)

    const resInvalido = crearRes()
    await getVoluntariosRecomendados(crearReq({ usuario: sesion, params: { id: 'abc' } }), resInvalido)
    expect(resInvalido.statusCode).toBe(404)
  })

  it('responde 409 si la oferta no esta publicada o no le quedan turnos con plazas', async () => {
    for (const oferta of [
      ofertaPropia({ estado: 'cerrada' }),
      ofertaPropia({ turnos: [turno(-2)] }),
      ofertaPropia({ turnos: [turno(3, { plazasLibres: 0 })] })
    ]) {
      simularOferta(oferta)
      const res = crearRes()
      await getVoluntariosRecomendados(crearReq({ usuario: sesion, params: { id: oferta.id } }), res)
      expect(res.statusCode).toBe(409)
    }
  })

  it('responde 500 si falla la base de datos', async () => {
    simularOferta(errorBd())
    const res = crearRes()
    await getVoluntariosRecomendados(crearReq({ usuario: sesion, params: { id: nuevoId().toString() } }), res)
    expect(res.statusCode).toBe(500)
  })
})

describe('invitarVoluntario', () => {
  function preparar({ inscrito = false, invitado = false, existe = true } = {}) {
    const oferta = ofertaPropia()
    simularOferta(oferta)
    vi.spyOn(User, 'findOne').mockReturnValue(consulta(existe ? { _id: nuevoId() } : null) as never)
    vi.spyOn(Inscripcion, 'exists').mockResolvedValue((inscrito ? { _id: nuevoId() } : null) as never)
    vi.spyOn(Notificacion, 'exists').mockResolvedValue((invitado ? { _id: nuevoId() } : null) as never)
    const crear = vi.spyOn(Notificacion, 'create').mockResolvedValue({} as never)
    return { oferta, crear }
  }

  const peticion = (ofertaId: string, body: unknown) =>
    crearReq({ usuario: sesion, params: { id: ofertaId }, body })

  it('crea la notificacion de invitacion con el mensaje de la entidad', async () => {
    const { oferta, crear } = preparar()
    const voluntarioId = nuevoId().toString()

    const res = crearRes()
    await invitarVoluntario(peticion(oferta.id, { voluntarioId, mensaje: '  ¡Te esperamos!  ' }), res)

    expect(res.statusCode).toBe(201)
    expect(crear).toHaveBeenCalledWith({
      usuarioId: voluntarioId,
      tipo: 'invitacion_oferta',
      titulo: 'ONG Mar te invita a colaborar',
      mensaje: '«Limpieza de costa»: ¡Te esperamos!',
      enlace: `/ofertas/${oferta.id}`
    })
  })

  it('usa un mensaje por defecto si la entidad no escribe nada', async () => {
    const { oferta, crear } = preparar()
    const res = crearRes()
    await invitarVoluntario(peticion(oferta.id, { voluntarioId: nuevoId().toString() }), res)

    expect(res.statusCode).toBe(201)
    expect(crear.mock.calls[0][0]).toMatchObject({
      mensaje: expect.stringContaining('Tu perfil encaja con «Limpieza de costa»')
    })
  })

  it('valida el voluntario y la longitud del mensaje', async () => {
    const { oferta, crear } = preparar()
    for (const body of [{}, { voluntarioId: 'abc' }, { voluntarioId: nuevoId().toString(), mensaje: 'x'.repeat(301) }]) {
      const res = crearRes()
      await invitarVoluntario(peticion(oferta.id, body), res)
      expect(res.statusCode).toBe(400)
    }
    expect(crear).not.toHaveBeenCalled()
  })

  it('no invita dos veces ni a quien ya esta inscrito', async () => {
    for (const opciones of [{ invitado: true }, { inscrito: true }]) {
      const { oferta, crear } = preparar(opciones)
      const res = crearRes()
      await invitarVoluntario(peticion(oferta.id, { voluntarioId: nuevoId().toString() }), res)
      expect(res.statusCode).toBe(409)
      expect(crear).not.toHaveBeenCalled()
    }
  })

  it('responde 404 si el voluntario no existe o no esta activo', async () => {
    const { oferta } = preparar({ existe: false })
    const res = crearRes()
    await invitarVoluntario(peticion(oferta.id, { voluntarioId: nuevoId().toString() }), res)
    expect(res.statusCode).toBe(404)
  })

  it('responde 409 si la oferta ya no admite inscripciones', async () => {
    const oferta = ofertaPropia({ estado: 'cerrada' })
    simularOferta(oferta)
    const res = crearRes()
    await invitarVoluntario(peticion(oferta.id, { voluntarioId: nuevoId().toString() }), res)
    expect(res.statusCode).toBe(409)
  })

  it('responde 500 si no se puede guardar la notificacion', async () => {
    const { oferta, crear } = preparar()
    crear.mockRejectedValue(errorBd())
    const res = crearRes()
    await invitarVoluntario(peticion(oferta.id, { voluntarioId: nuevoId().toString() }), res)
    expect(res.statusCode).toBe(500)
  })
})
