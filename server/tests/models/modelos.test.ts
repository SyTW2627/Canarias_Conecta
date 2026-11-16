/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de las validaciones, indices y utilidades de los modelos.
 */

import type { Error as MongooseError } from 'mongoose'
import { describe, expect, it } from 'vitest'
import { Inscripcion } from '../../src/models/Inscripcion.js'
import { Notificacion } from '../../src/models/Notificacion.js'
import { Oferta, construirTextoBusqueda, normalizarTexto } from '../../src/models/Oferta.js'
import { SolicitudAyuda } from '../../src/models/SolicitudAyuda.js'
import { Token } from '../../src/models/Token.js'
import { User } from '../../src/models/User.js'
import { HORA_REGEX } from '../../src/models/constantes.js'
import { nuevoId, turno } from '../helpers.js'

describe('normalizarTexto', () => {
  it('quita tildes y diéresis y pasa a minusculas', async () => {
    expect(normalizarTexto('Reforestación en GÜÍMAR')).toBe('reforestacion en guimar')
  })

  it('conserva la ñ como n sin tilde', async () => {
    expect(normalizarTexto('Niños')).toBe('ninos')
  })
})

describe('construirTextoBusqueda', () => {
  it('une las partes con espacios ignorando las vacias', async () => {
    expect(construirTextoBusqueda(['Título', undefined, '', 'Adeje'])).toBe('titulo adeje')
  })

  it('elimina los espacios sobrantes', () => {
    expect(construirTextoBusqueda(['  Limpieza   de costa ', '\tAdeje\n'])).toBe('limpieza de costa adeje')
  })
})

describe('HORA_REGEX', () => {
  it.each(['00:00', '09:30', '23:59'])('acepta %s', async (hora) => {
    expect(HORA_REGEX.test(hora)).toBe(true)
  })

  it.each(['24:00', '9:30', '12:60', '12-30', ''])('rechaza "%s"', async (hora) => {
    expect(HORA_REGEX.test(hora)).toBe(false)
  })
})

// Devuelve el error de validacion, o undefined si el documento es valido
function validar(documento: { validate(): Promise<void> }) {
  return documento.validate().then(
    () => undefined,
    (error: MongooseError.ValidationError) => error
  )
}

// Oferta minima valida; cada test cambia lo que quiere comprobar
function oferta(datos: Record<string, unknown> = {}) {
  return new Oferta({
    ofertanteId: nuevoId(),
    titulo: 'Oferta',
    descripcion: 'Descripcion',
    categoriaIds: [nuevoId()],
    modalidad: 'presencial',
    tipoDuracion: 'jornada',
    ubicacion: { isla: 'tenerife', municipio: 'Adeje' },
    turnos: [turno(1)],
    textoBusqueda: 'oferta',
    estado: 'publicada',
    ...datos
  })
}

describe('Modelo Oferta', () => {
  it('acepta una oferta publicada completa', async () => {
    expect(await validar(oferta())).toBeUndefined()
  })

  it('por defecto se crea como borrador sin imagenes', async () => {
    const nueva = new Oferta({})
    expect(nueva.estado).toBe('borrador')
    expect(nueva.imagenes).toEqual([])
  })

  it('una publicada necesita al menos una categoria y un turno', async () => {
    const error = await validar(oferta({ categoriaIds: [], turnos: [] }))

    expect(error?.errors.categoriaIds.message).toBe('La oferta necesita al menos una categoría')
    expect(error?.errors.turnos.message).toBe('La oferta necesita al menos un turno')
  })

  it('un borrador puede no tener categorias, turnos ni ubicacion', async () => {
    const borrador = oferta({ estado: 'borrador', categoriaIds: [], turnos: [], ubicacion: undefined })
    expect(await validar(borrador)).toBeUndefined()
  })

  it('una oferta presencial publicada necesita ubicacion', async () => {
    const error = await validar(oferta({ ubicacion: undefined }))
    expect(error?.errors.ubicacion).toBeDefined()
  })

  it('una oferta online no necesita ubicacion', async () => {
    expect(await validar(oferta({ modalidad: 'online', ubicacion: undefined }))).toBeUndefined()
  })

  it('la hora de fin de un turno debe ser posterior a la de inicio', async () => {
    const error = await validar(oferta({ turnos: [turno(1, { horaInicio: '12:00', horaFin: '11:00' })] }))
    expect(error?.errors['turnos.0.horaFin'].message).toBe(
      'La hora de fin debe ser posterior a la de inicio'
    )
  })

  it('las plazas libres no pueden superar a las plazas', async () => {
    const error = await validar(oferta({ turnos: [turno(1, { plazas: 2, plazasLibres: 3 })] }))
    expect(error?.errors['turnos.0.plazasLibres'].message).toBe(
      'Las plazas libres no pueden superar a las plazas'
    )
  })

  it('rechaza horas mal formadas, plazas menores que 1 y libres negativas', async () => {
    const error = await validar(oferta({
      turnos: [turno(1, { horaInicio: '7:00', plazas: 0, plazasLibres: -1 })]
    }))

    expect(Object.keys(error?.errors ?? {})).toEqual(
      expect.arrayContaining(['turnos.0.horaInicio', 'turnos.0.plazas', 'turnos.0.plazasLibres'])
    )
  })

  it('rechaza valores fuera de los enumerados y textos demasiado largos', async () => {
    const error = await validar(oferta({
      modalidad: 'teletransporte',
      tipoDuracion: 'eterna',
      estado: 'archivada',
      titulo: 'x'.repeat(121),
      ubicacion: { isla: 'mallorca', municipio: 'Palma' }
    }))

    expect(Object.keys(error?.errors ?? {})).toEqual(
      expect.arrayContaining(['modalidad', 'tipoDuracion', 'estado', 'titulo', 'ubicacion.isla'])
    )
  })
})

describe('Modelo Inscripcion', () => {
  function inscripcion(datos: Record<string, unknown> = {}) {
    return new Inscripcion({
      voluntarioId: nuevoId(),
      ofertaId: nuevoId(),
      ofertanteId: nuevoId(),
      turnoIds: [nuevoId()],
      ...datos
    })
  }

  it('empieza pendiente', async () => {
    expect(inscripcion().estado).toBe('pendiente')
  })

  it('necesita al menos un turno', async () => {
    const error = await validar(inscripcion({ turnoIds: [] }))
    expect(error?.errors.turnoIds.message).toBe('La inscripcion necesita al menos un turno')
  })

  it('valida la puntuacion de las valoraciones entre 1 y 5', async () => {
    const autorId = nuevoId()
    const error = await validar(inscripcion({
      valoracionAlVoluntario: { autorId, puntuacion: 6 },
      valoracionALaOferta: { autorId, puntuacion: 0 }
    }))

    expect(Object.keys(error?.errors ?? {})).toEqual(
      expect.arrayContaining(['valoracionAlVoluntario.puntuacion', 'valoracionALaOferta.puntuacion'])
    )
  })

  it('define un indice unico parcial: solo una inscripcion activa por voluntario y oferta', () => {
    const indices = Inscripcion.schema.indexes()

    expect(indices).toContainEqual([
      { voluntarioId: 1, ofertaId: 1 },
      {
        unique: true,
        // Quien cancelo o fue rechazado puede volver a inscribirse
        partialFilterExpression: {
          estado: { $in: ['pendiente', 'aceptada', 'completada', 'no_presentado'] }
        }
      }
    ])
  })

  it('define indices para listar por oferta, ofertante y voluntario segun el estado', () => {
    const claves = Inscripcion.schema.indexes().map(([campos]) => campos)

    expect(claves).toEqual(
      expect.arrayContaining([
        { ofertaId: 1, estado: 1 },
        { ofertanteId: 1, estado: 1 },
        { voluntarioId: 1, estado: 1 }
      ])
    )
  })
})

describe('Modelo User', () => {
  it('guarda el email en minusculas y sin espacios', () => {
    const user = new User({ email: '  ANA@Test.COM ' })
    expect(user.email).toBe('ana@test.com')
  })

  it('no devuelve la contraseña en las consultas salvo que se pida', () => {
    expect(User.schema.path('password').options.select).toBe(false)
  })

  it('empieza activo, sin verificar el email y sin consentimientos', () => {
    const user = new User({ rol: 'voluntario' })
    expect(user).toMatchObject({ estado: 'activo', emailVerificado: false })
    expect(user.consentimientos).toEqual([])
  })

  it('el email es unico', () => {
    expect(User.schema.path('email').options.unique).toBe(true)
  })

  it('el CIF es unico pero opcional (indice disperso)', () => {
    expect(User.schema.indexes()).toContainEqual([{ 'ofertante.cif': 1 }, { unique: true, sparse: true }])
  })

  it('rechaza roles, estados, islas y tipos de entidad desconocidos', async () => {
    const error = await validar(new User({
      nombre: 'X',
      email: 'x@test.com',
      password: 'h',
      rol: 'superusuario',
      estado: 'raro',
      isla: 'ibiza',
      ofertante: { tipoEntidad: 'secta' }
    }))

    expect(Object.keys(error?.errors ?? {})).toEqual(
      expect.arrayContaining(['rol', 'estado', 'isla', 'ofertante.tipoEntidad'])
    )
  })

  it('valida las franjas de disponibilidad del voluntario', async () => {
    const error = await validar(new User({
      nombre: 'X',
      email: 'x@test.com',
      password: 'h',
      rol: 'voluntario',
      voluntario: { disponibilidad: [{ diaSemana: 7, horaInicio: '25:00', horaFin: '10:00' }] }
    }))

    expect(Object.keys(error?.errors ?? {})).toEqual(
      expect.arrayContaining([
        'voluntario.disponibilidad.0.diaSemana',
        'voluntario.disponibilidad.0.horaInicio'
      ])
    )
  })

  it('inicializa las estadisticas del voluntario a cero', async () => {
    const user = new User({ rol: 'voluntario', voluntario: {} })
    expect(user.voluntario?.estadisticas).toMatchObject({
      horasTotales: 0,
      colaboraciones: 0,
      valoracionMedia: 0,
      numValoraciones: 0
    })
  })
})

describe('Modelo Notificacion', () => {
  it('solo admite los tipos definidos y empieza sin leer', async () => {
    const valida = new Notificacion({
      usuarioId: nuevoId(),
      tipo: 'oferta_cerrada',
      titulo: 'T',
      mensaje: 'M'
    })
    expect(await validar(valida)).toBeUndefined()
    expect(valida.leida).toBe(false)

    const invalida = new Notificacion({ usuarioId: nuevoId(), tipo: 'x', titulo: 'T', mensaje: 'M' })
    expect((await validar(invalida))?.errors.tipo).toBeDefined()
  })
})

describe('Indices de Oferta y Notificacion', () => {
  it('las notificaciones se borran solas a los 90 dias', () => {
    expect(Notificacion.schema.indexes()).toContainEqual([
      { createdAt: 1 },
      { expireAfterSeconds: 90 * 24 * 60 * 60 }
    ])
  })

  it('las ofertas tienen indices para buscar por estado, isla, categoria, fecha y ofertante', () => {
    const claves = Oferta.schema.indexes().map(([campos]) => campos)
    expect(claves).toEqual(
      expect.arrayContaining([
        { estado: 1, 'ubicacion.isla': 1, categoriaIds: 1 },
        { 'turnos.fecha': 1 },
        { ofertanteId: 1, estado: 1 }
      ])
    )
  })

  it('el texto de busqueda no se devuelve en las consultas', () => {
    expect(Oferta.schema.path('textoBusqueda').options.select).toBe(false)
  })
})

describe('Modelo Token', () => {
  it('solo admite los tipos definidos y empieza sin usar', async () => {
    const token = new Token({
      usuarioId: nuevoId(),
      tipo: 'recuperar_password',
      tokenHash: 'h',
      expiraEn: new Date()
    })
    expect(await validar(token)).toBeUndefined()
    expect(token.usado).toBe(false)

    const invalido = new Token({ usuarioId: nuevoId(), tipo: 'x', tokenHash: 'h', expiraEn: new Date() })
    expect((await validar(invalido))?.errors.tipo).toBeDefined()
  })

  it('el hash del token es unico y el token se borra solo al caducar', () => {
    expect(Token.schema.path('tokenHash').options.unique).toBe(true)
    expect(Token.schema.indexes()).toContainEqual([{ expiraEn: 1 }, { expireAfterSeconds: 0 }])
  })
})

describe('Modelo SolicitudAyuda', () => {
  it('aplica los valores por defecto y valida los obligatorios', async () => {
    const solicitud = new SolicitudAyuda({
      nombreContacto: 'Ana',
      emailContacto: 'ANA@TEST.COM',
      isla: 'la_palma',
      descripcion: 'Necesito ayuda'
    })
    expect(await validar(solicitud)).toBeUndefined()
    expect(solicitud).toMatchObject({ urgencia: 'media', estado: 'nueva', emailContacto: 'ana@test.com' })

    const error = await validar(new SolicitudAyuda({ urgencia: 'maxima' }))
    expect(Object.keys(error?.errors ?? {})).toEqual(
      expect.arrayContaining(['nombreContacto', 'emailContacto', 'isla', 'descripcion', 'urgencia'])
    )
  })
})
