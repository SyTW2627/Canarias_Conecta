/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del perfil: acreditaciones, datos enviados como formulario y foto de perfil.
 */

import type { Request } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Imagen } from '../../src/models/Imagen.js'
import { User } from '../../src/models/User.js'
import { JPG, PNG, consulta, crearReq, crearRes, nuevoId, usuarioOfertante } from '../helpers.js'

const { actualizarPerfil, getPerfil } = await import('../../src/controllers/authController.js')

// Reloj fijo: una acreditacion no puede tener fecha futura
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function preparar(datos: Record<string, unknown> = {}) {
  const user = User.hydrate({
    _id: nuevoId(),
    nombre: 'Ana',
    email: 'ana@test.com',
    password: 'hash(Clave1234)',
    rol: 'voluntario',
    estado: 'activo',
    ...datos
  })
  vi.spyOn(User, 'findById').mockReturnValue(consulta(user) as never)
  const guardar = vi.spyOn(user, 'save').mockResolvedValue(user)
  const sesion: Request['usuario'] = { id: user.id, nombre: user.nombre, rol: user.rol }
  return { user, guardar, sesion }
}

type Opciones = { file?: Partial<Express.Multer.File>; multipart?: boolean }

async function ejecutar(sesion: Request['usuario'], body: unknown, opciones: Opciones = {}) {
  const res = crearRes()
  await actualizarPerfil(crearReq({ usuario: sesion, body, ...opciones }), res)
  return res
}

const acreditacion = (datos: Record<string, unknown> = {}) => ({
  nombre: 'Socorrismo',
  fechaObtencion: '2024-05-01',
  ...datos
})

describe('actualizarPerfil: acreditaciones', () => {
  it('guarda las acreditaciones del voluntario quitando espacios y las devuelve', async () => {
    const { user, guardar, sesion } = preparar()

    const res = await ejecutar(sesion, {
      acreditaciones: [
        acreditacion({ nombre: '  Socorrismo ', identificador: ' SOS-1 ' }),
        acreditacion({ nombre: 'Primeros auxilios', identificador: '   ', fechaObtencion: '2026-03-10' })
      ]
    })

    expect(guardar).toHaveBeenCalledOnce()
    const guardadas = user.voluntario!.acreditaciones
    expect(guardadas.map((a) => [a.nombre, a.identificador])).toEqual([
      ['Socorrismo', 'SOS-1'],
      // Un identificador en blanco no se guarda
      ['Primeros auxilios', undefined]
    ])
    expect((res.body as { user: { acreditaciones: unknown } }).user.acreditaciones).toEqual([
      { id: guardadas[0]._id.toString(), nombre: 'Socorrismo', identificador: 'SOS-1', fechaObtencion: '2024-05-01' },
      { id: guardadas[1]._id.toString(), nombre: 'Primeros auxilios', identificador: null, fechaObtencion: '2026-03-10' }
    ])
  })

  it('una lista vacia borra las acreditaciones', async () => {
    const { user, sesion } = preparar({
      voluntario: { acreditaciones: [{ nombre: 'Vieja', fechaObtencion: new Date('2020-01-01') }] }
    })

    const res = await ejecutar(sesion, { acreditaciones: [] })

    expect(res.statusCode).toBe(200)
    expect(user.voluntario!.acreditaciones).toHaveLength(0)
  })

  it.each([
    ['no es una lista', 'Socorrismo'],
    ['tiene un elemento nulo', [null]],
    ['tiene un elemento que no es objeto', ['Socorrismo']],
    ['no tiene nombre', [{ fechaObtencion: '2024-05-01' }]],
    ['tiene el nombre vacio', [acreditacion({ nombre: '   ' })]],
    ['tiene un nombre que no es texto', [acreditacion({ nombre: 5 })]],
    ['tiene un nombre de mas de 200 caracteres', [acreditacion({ nombre: 'x'.repeat(201) })]],
    ['no tiene fecha', [{ nombre: 'Socorrismo' }]],
    ['tiene la fecha en otro formato', [acreditacion({ fechaObtencion: '01/05/2024' })]],
    ['tiene una fecha que no existe', [acreditacion({ fechaObtencion: '2024-02-30' })]],
    ['tiene una fecha imposible', [acreditacion({ fechaObtencion: '2024-13-45' })]],
    ['tiene una fecha futura', [acreditacion({ fechaObtencion: '2026-03-11' })]],
    ['tiene un identificador que no es texto', [acreditacion({ identificador: 7 })]],
    ['tiene un identificador de mas de 200 caracteres', [acreditacion({ identificador: 'x'.repeat(201) })]]
  ])('responde 400 sin consultar la base de datos si la lista %s', async (_caso, acreditaciones) => {
    const buscar = vi.spyOn(User, 'findById')

    const res = await ejecutar({ id: nuevoId().toString(), nombre: 'Ana', rol: 'voluntario' }, { acreditaciones })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Los datos del perfil no son válidos' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('acepta nombre e identificador de exactamente 200 caracteres', async () => {
    const { sesion } = preparar()

    const res = await ejecutar(sesion, {
      acreditaciones: [acreditacion({ nombre: 'n'.repeat(200), identificador: 'i'.repeat(200) })]
    })

    expect(res.statusCode).toBe(200)
  })

  it('un ofertante no puede tener acreditaciones', async () => {
    const res = await ejecutar(usuarioOfertante(), { acreditaciones: [acreditacion()] })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Los datos del perfil no son válidos' })
  })
})

describe('actualizarPerfil: formulario multipart y foto de perfil', () => {
  it('lee los datos del campo "datos" cuando llegan como formulario', async () => {
    const { user, sesion } = preparar()

    const res = await ejecutar(sesion, { datos: JSON.stringify({ nombre: 'Desde formulario' }) }, { multipart: true })

    expect(res.statusCode).toBe(200)
    expect(user.nombre).toBe('Desde formulario')
  })

  it.each([
    ['no es JSON', '{roto'],
    ['es una lista', '[1, 2]'],
    ['es null', 'null'],
    ['es un numero', '5']
  ])('responde 400 si el campo "datos" %s', async (_caso, datos) => {
    const buscar = vi.spyOn(User, 'findById')

    const res = await ejecutar(usuarioOfertante(), { datos }, { multipart: true })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Los datos del perfil no son válidos' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it.each([
    ['PNG', PNG, 'image/png', '.png'],
    ['JPG', JPG, 'image/jpeg', '.jpg']
  ])('guarda una foto %s aunque no cambie nada mas y devuelve su url', async (_caso, buffer, contentType, extension) => {
    const { user, guardar, sesion } = preparar()
    const imagenId = nuevoId().toString()
    const crear = vi.spyOn(Imagen, 'create').mockResolvedValue({ id: imagenId } as never)

    // Sin el campo "datos": solo se sube la foto
    const res = await ejecutar(sesion, {}, { multipart: true, file: { buffer } })

    expect(crear).toHaveBeenCalledWith({
      nombre: expect.stringMatching(new RegExp(`^avatar-[0-9a-f-]{36}\\${extension}$`)),
      contentType,
      data: buffer
    })
    expect(guardar).toHaveBeenCalledOnce()
    expect(user.avatarUrl).toBe(`/api/imagenes/${imagenId}`)
    expect(res.body).toMatchObject({ user: { avatarUrl: `/api/imagenes/${imagenId}` } })
  })

  it('responde 400 sin guardar nada si el archivo no es una imagen permitida', async () => {
    const buscar = vi.spyOn(User, 'findById')
    const crear = vi.spyOn(Imagen, 'create')

    const res = await ejecutar(
      usuarioOfertante(),
      { datos: JSON.stringify({ nombre: 'X' }) },
      { multipart: true, file: { buffer: Buffer.from('GIF89a no permitido') } }
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'La imagen debe ser JPG, PNG o WebP' })
    expect(buscar).not.toHaveBeenCalled()
    expect(crear).not.toHaveBeenCalled()
  })
})

describe('getPerfil: acreditaciones', () => {
  it('devuelve las acreditaciones con la fecha en formato AAAA-MM-DD', async () => {
    const sesion = { id: nuevoId().toString(), nombre: 'Ana', rol: 'voluntario' as const }
    const [a, b] = [nuevoId(), nuevoId()]
    vi.spyOn(User, 'findById').mockReturnValue(
      consulta({
        id: sesion.id,
        nombre: 'Ana',
        email: 'ana@test.com',
        rol: 'voluntario',
        voluntario: {
          interesIds: [],
          acreditaciones: [
            { _id: a, nombre: 'Socorrismo', identificador: 'SOS-1', fechaObtencion: new Date('2024-05-01T00:00:00Z') },
            { _id: b, nombre: 'Monitor', fechaObtencion: new Date('2023-09-15T00:00:00Z') }
          ]
        }
      }) as never
    )
    const res = crearRes()

    await getPerfil(crearReq({ usuario: sesion }), res)

    expect((res.body as { user: { acreditaciones: unknown } }).user.acreditaciones).toEqual([
      { id: a.toString(), nombre: 'Socorrismo', identificador: 'SOS-1', fechaObtencion: '2024-05-01' },
      { id: b.toString(), nombre: 'Monitor', identificador: null, fechaObtencion: '2023-09-15' }
    ])
  })
})
