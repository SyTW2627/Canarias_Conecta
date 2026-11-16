/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del registro, inicio de sesion y perfil (modelos y bcrypt simulados).
 */

import type { Request } from 'express'
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Categoria } from '../../src/models/Categoria.js'
import { User } from '../../src/models/User.js'
import {
  consulta,
  crearReq,
  crearRes,
  errorBd,
  nuevoId,
  usuarioOfertante,
  usuarioVoluntario
} from '../helpers.js'

// bcrypt simulado: "hash(x)" es el hash de x y compare lo comprueba
const bcrypt = vi.hoisted(() => ({
  hash: vi.fn(async (texto: string) => `hash(${texto})`),
  compare: vi.fn(async (texto: string, hash: string) => hash === `hash(${texto})`)
}))
vi.mock('bcrypt', () => ({ default: bcrypt }))

const { actualizarPerfil, getPerfil, login, register } = await import(
  '../../src/controllers/authController.js'
)

beforeEach(() => {
  bcrypt.hash.mockImplementation(async (texto: string) => `hash(${texto})`)
  bcrypt.compare.mockImplementation(async (texto: string, hash: string) => hash === `hash(${texto})`)
})

afterEach(() => {
  process.env.JWT_SECRET = 'secreto-de-test'
})

// Usuario tal y como lo devolveria la base de datos
function usuario(datos: Record<string, unknown> = {}) {
  return User.hydrate({
    _id: nuevoId(),
    nombre: 'Ana',
    email: 'ana@test.com',
    password: 'hash(Clave1234)',
    rol: 'voluntario',
    estado: 'activo',
    ...datos
  })
}

const REGISTRO = { nombre: ' Ana Pérez ', email: ' ANA@Test.com ', password: 'Segura123', rol: 'voluntario' }

describe('register', () => {
  function simularCreacion() {
    return vi.spyOn(User, 'create').mockImplementation((async (datos: Record<string, unknown>) =>
      usuario(datos)) as never)
  }

  it('crea el usuario con los datos limpios y la contraseña cifrada, y devuelve un token', async () => {
    const crear = simularCreacion()
    const res = crearRes()

    await register(crearReq({ body: REGISTRO }), res)

    expect(bcrypt.hash).toHaveBeenCalledWith('Segura123', 10)
    expect(crear).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      email: 'ana@test.com',
      password: 'hash(Segura123)',
      rol: 'voluntario'
    })
    expect(res.statusCode).toBe(201)
    const { token, user } = res.body as { token: string; user: Record<string, string> }
    expect(user).toEqual({ id: expect.any(String), nombre: 'Ana Pérez', email: 'ana@test.com', rol: 'voluntario' })
    expect(jwt.verify(token, 'secreto-de-test')).toMatchObject({ id: user.id, rol: 'voluntario' })
    // El token caduca en un dia
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number }
    expect(exp - iat).toBe(24 * 60 * 60)
  })

  it('permite registrarse como ofertante', async () => {
    simularCreacion()
    const res = crearRes()

    await register(crearReq({ body: { ...REGISTRO, rol: 'ofertante' } }), res)

    expect(res.statusCode).toBe(201)
  })

  it.each([
    ['falta el nombre', { nombre: undefined }],
    ['el nombre esta vacio', { nombre: '   ' }],
    ['falta el email', { email: undefined }],
    ['el email esta vacio', { email: ' ' }],
    ['falta la contraseña', { password: '' }],
    ['falta el rol', { rol: undefined }],
    ['el nombre no es texto', { nombre: 42 }]
  ])('responde 400 si %s', async (_caso, cambios) => {
    const crear = vi.spyOn(User, 'create')
    const res = crearRes()

    await register(crearReq({ body: { ...REGISTRO, ...cambios } }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Nombre, email, contraseña y rol son obligatorios' })
    expect(crear).not.toHaveBeenCalled()
  })

  it('responde 400 si no hay cuerpo', async () => {
    const res = crearRes()
    await register(crearReq({ body: undefined }), res)
    expect(res.statusCode).toBe(400)
  })

  it('responde 400 si el email no es valido', async () => {
    const res = crearRes()
    await register(crearReq({ body: { ...REGISTRO, email: 'sin-arroba' } }), res)
    expect(res.body).toEqual({ message: 'El email no es válido' })
  })

  it('responde 400 si la contraseña tiene menos de 8 caracteres', async () => {
    const res = crearRes()
    await register(crearReq({ body: { ...REGISTRO, password: '1234567' } }), res)
    expect(res.body).toEqual({ message: 'La contraseña debe tener al menos 8 caracteres' })
  })

  it.each(['admin', 'superusuario'])('no permite registrarse con el rol %s', async (rol) => {
    const crear = vi.spyOn(User, 'create')
    const res = crearRes()

    await register(crearReq({ body: { ...REGISTRO, rol } }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'El rol no es válido' })
    expect(crear).not.toHaveBeenCalled()
  })

  it('responde 409 si el email ya esta registrado', async () => {
    vi.spyOn(User, 'create').mockRejectedValue({ code: 11000 })
    const res = crearRes()

    await register(crearReq({ body: REGISTRO }), res)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Ya existe una cuenta con ese email' })
  })

  it('responde 500 si falta JWT_SECRET, sin crear el usuario', async () => {
    delete process.env.JWT_SECRET
    const crear = vi.spyOn(User, 'create')
    const res = crearRes()

    await register(crearReq({ body: REGISTRO }), res)

    expect(res.statusCode).toBe(500)
    expect(crear).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(User, 'create').mockRejectedValue(errorBd())
    const res = crearRes()

    await register(crearReq({ body: REGISTRO }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al registrar el usuario' })
  })
})

describe('login', () => {
  function simularBusqueda(user: ReturnType<typeof usuario> | null | Error) {
    const q = consulta(user)
    const buscar = vi.spyOn(User, 'findOne').mockReturnValue(q as never)
    return { buscar, q }
  }

  it('devuelve un token y los datos del usuario con credenciales correctas', async () => {
    const user = usuario({ rol: 'ofertante', nombre: 'ONG' })
    const { buscar, q } = simularBusqueda(user)
    const res = crearRes()

    await login(crearReq({ body: { email: ' ANA@test.com ', password: 'Clave1234' } }), res)

    expect(buscar).toHaveBeenCalledWith({ email: 'ana@test.com' })
    // La contraseña no se devuelve por defecto: hay que pedirla
    expect(q.select).toHaveBeenCalledWith('+password')
    const { token, user: datos } = res.body as { token: string; user: Record<string, string> }
    expect(datos).toEqual({ id: user.id, nombre: 'ONG', email: 'ana@test.com', rol: 'ofertante' })
    expect(jwt.verify(token, 'secreto-de-test')).toMatchObject({ id: user.id, rol: 'ofertante' })
  })

  it.each([
    ['sin cuerpo', undefined],
    ['sin email', { password: 'x' }],
    ['sin contraseña', { email: 'a@test.com' }],
    ['con email vacio', { email: '', password: 'x' }],
    ['con tipos incorrectos', { email: ['a'], password: 1 }]
  ])('responde 400 %s', async (_caso, body) => {
    const res = crearRes()

    await login(crearReq({ body }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'El email y la contraseña son obligatorios' })
  })

  it('responde 401 con el mismo mensaje si el email no existe o la contraseña falla', async () => {
    simularBusqueda(null)
    const noExiste = crearRes()
    await login(crearReq({ body: { email: 'otro@test.com', password: 'Clave1234' } }), noExiste)

    simularBusqueda(usuario())
    const malPassword = crearRes()
    await login(crearReq({ body: { email: 'ana@test.com', password: 'mala' } }), malPassword)

    expect(noExiste.statusCode).toBe(401)
    expect(malPassword.statusCode).toBe(401)
    expect(noExiste.body).toEqual({ message: 'Email o contraseña incorrectos' })
    expect(malPassword.body).toEqual(noExiste.body)
  })

  it('responde 500 si falta JWT_SECRET', async () => {
    delete process.env.JWT_SECRET
    const res = crearRes()

    await login(crearReq({ body: { email: 'a@test.com', password: 'x' } }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al iniciar sesión' })
  })

  it('responde 500 si falla la base de datos', async () => {
    simularBusqueda(errorBd())
    const res = crearRes()

    await login(crearReq({ body: { email: 'a@test.com', password: 'x' } }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Error al iniciar sesión' })
  })
})

describe('getPerfil', () => {
  it('responde 401 si no hay usuario autenticado', async () => {
    const res = crearRes()
    await getPerfil(crearReq(), res)
    expect(res.statusCode).toBe(401)
  })

  it('devuelve los datos del voluntario con sus intereses', async () => {
    const sesion = usuarioVoluntario()
    const q = consulta({
      id: sesion.id,
      nombre: 'Ana',
      email: 'ana@test.com',
      rol: 'voluntario',
      telefono: '600',
      isla: 'gran_canaria',
      municipio: 'Telde',
      voluntario: { interesIds: [{ id: 'c1', nombre: 'Animales', slug: 'animales' }] }
    })
    const buscar = vi.spyOn(User, 'findById').mockReturnValue(q as never)
    const res = crearRes()

    await getPerfil(crearReq({ usuario: sesion }), res)

    expect(buscar).toHaveBeenCalledWith(sesion.id)
    expect(q.populate).toHaveBeenCalledWith('voluntario.interesIds', 'nombre')
    expect(res.body).toEqual({
      user: {
        id: sesion.id,
        nombre: 'Ana',
        email: 'ana@test.com',
        rol: 'voluntario',
        intereses: [{ id: 'c1', nombre: 'Animales' }],
        telefono: '600',
        isla: 'gran_canaria',
        municipio: 'Telde',
        ofertante: undefined
      }
    })
  })

  it('devuelve los datos de la entidad de un ofertante', async () => {
    const sesion = usuarioOfertante()
    const estadisticas = { ofertasPublicadas: 2, valoracionMedia: 4, numValoraciones: 1 }
    vi.spyOn(User, 'findById').mockReturnValue(
      consulta({
        id: sesion.id,
        nombre: 'ONG',
        email: 'ong@test.com',
        rol: 'ofertante',
        ofertante: {
          tipoEntidad: 'fundacion',
          descripcion: 'd',
          web: 'w',
          personaContacto: 'p',
          cif: 'G1',
          direccion: 'x',
          verificada: true,
          estadisticas,
          campoInterno: 'no se devuelve'
        }
      }) as never
    )
    const res = crearRes()

    await getPerfil(crearReq({ usuario: sesion }), res)

    const { user } = res.body as { user: Record<string, unknown> }
    expect(user.intereses).toEqual([])
    expect(user.ofertante).toEqual({
      tipoEntidad: 'fundacion',
      descripcion: 'd',
      web: 'w',
      personaContacto: 'p',
      cif: 'G1',
      direccion: 'x',
      verificada: true,
      estadisticas
    })
  })

  it('responde 404 si el usuario ya no existe', async () => {
    vi.spyOn(User, 'findById').mockReturnValue(consulta(null) as never)
    const res = crearRes()

    await getPerfil(crearReq({ usuario: usuarioVoluntario() }), res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'No se encontró el usuario' })
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(User, 'findById').mockReturnValue(consulta(errorBd()) as never)
    const res = crearRes()

    await getPerfil(crearReq({ usuario: usuarioVoluntario() }), res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo cargar el perfil' })
  })
})

describe('actualizarPerfil', () => {
  // Prepara el usuario que devolvera la base de datos y simula su guardado
  function preparar(datos: Record<string, unknown> = {}) {
    const user = usuario(datos)
    const q = consulta(user)
    vi.spyOn(User, 'findById').mockReturnValue(q as never)
    const guardar = vi.spyOn(user, 'save').mockResolvedValue(user)
    const sesion: Request['usuario'] = { id: user.id, nombre: user.nombre, rol: user.rol }
    return { user, q, guardar, sesion }
  }

  async function ejecutar(sesion: Request['usuario'], body: unknown) {
    const res = crearRes()
    await actualizarPerfil(crearReq({ usuario: sesion, body }), res)
    return res
  }

  it('responde 401 si no hay usuario autenticado', async () => {
    const res = await ejecutar(undefined, { nombre: 'X' })
    expect(res.statusCode).toBe(401)
  })

  it.each([
    ['nombre vacio', { nombre: '  ' }],
    ['nombre que no es texto', { nombre: 1 }],
    ['email invalido', { email: 'malo' }],
    ['email que no es texto', { email: 3 }],
    ['passwordActual que no es texto', { passwordActual: 1, nombre: 'X' }],
    ['passwordNueva que no es texto', { passwordNueva: 12345678 }],
    ['interesIds que no es lista', { interesIds: 'abc' }],
    ['interesIds con ids no validos', { interesIds: ['no-es-id'] }],
    ['interesIds con valores que no son texto', { interesIds: [1] }],
    ['telefono que no es texto', { telefono: 600 }],
    ['isla desconocida', { isla: 'ibiza' }],
    ['isla vacia', { isla: '' }],
    ['isla que no es texto', { isla: 1 }],
    ['municipio vacio', { municipio: ' ' }],
    ['municipio que no es texto', { municipio: 1 }],
    ['tipoEntidad desconocido', { tipoEntidad: 'secta' }],
    ['tipoEntidad que no es texto', { tipoEntidad: 1 }],
    ['descripcion que no es texto', { descripcion: 1 }],
    ['web que no es texto', { web: 1 }],
    ['personaContacto que no es texto', { personaContacto: 1 }],
    ['cif que no es texto', { cif: 1 }],
    ['direccion que no es texto', { direccion: 1 }]
  ])('responde 400 con %s sin consultar la base de datos', async (_caso, body) => {
    const buscar = vi.spyOn(User, 'findById')
    const res = await ejecutar(usuarioOfertante(), body)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Los datos del perfil no son válidos' })
    expect(buscar).not.toHaveBeenCalled()
  })

  it.each([
    ['sin cuerpo', undefined],
    ['solo con la contraseña actual', { passwordActual: 'algo' }],
    ['con un objeto vacio', {}]
  ])('responde 400 si no hay cambios (%s)', async (_caso, body) => {
    const res = await ejecutar(usuarioVoluntario(), body)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'No hay cambios que guardar' })
  })

  it('responde 400 si la contraseña nueva es corta', async () => {
    const res = await ejecutar(usuarioVoluntario(), { passwordActual: 'Clave1234', passwordNueva: 'corta' })
    expect(res.body).toEqual({ message: 'La contraseña debe tener al menos 8 caracteres' })
  })

  it.each([
    ['sin la contraseña actual', {}],
    ['con la contraseña actual vacia', { passwordActual: '' }],
    ['con la contraseña actual incorrecta', { passwordActual: 'incorrecta' }]
  ])('responde 401 al cambiar la contraseña %s', async (_caso, extra) => {
    const { sesion, guardar } = preparar()

    const res = await ejecutar(sesion, { passwordNueva: 'NuevaClave1', ...extra })

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ message: 'La contraseña actual no es correcta' })
    expect(guardar).not.toHaveBeenCalled()
  })

  it('cambia la contraseña si la actual es correcta', async () => {
    const { user, q, sesion, guardar } = preparar()

    const res = await ejecutar(sesion, { passwordActual: 'Clave1234', passwordNueva: 'NuevaClave1' })

    expect(q.select).toHaveBeenCalledWith('+password')
    expect(bcrypt.compare).toHaveBeenCalledWith('Clave1234', 'hash(Clave1234)')
    expect(user.password).toBe('hash(NuevaClave1)')
    expect(guardar).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('hash(')
  })

  it('actualiza nombre, email e intereses quitando duplicados', async () => {
    const [a, b] = [nuevoId().toString(), nuevoId().toString()]
    const { sesion, guardar } = preparar()
    const q = consulta([{ _id: a }, { _id: b }])
    const buscarCategorias = vi.spyOn(Categoria, 'find').mockReturnValue(q as never)

    const res = await ejecutar(sesion, { nombre: '  Nuevo Nombre ', email: ' NUEVO@test.com', interesIds: [a, b, a] })

    expect(buscarCategorias).toHaveBeenCalledWith({ _id: { $in: [a, b] }, activa: true })
    expect(q.select).toHaveBeenCalledWith('_id')
    expect(guardar).toHaveBeenCalledOnce()
    expect(res.body).toEqual({
      user: {
        id: sesion.id,
        nombre: 'Nuevo Nombre',
        email: 'nuevo@test.com',
        rol: 'voluntario',
        interesIds: [a, b],
        telefono: undefined,
        isla: undefined,
        municipio: undefined,
        ofertante: undefined
      }
    })
  })

  it('devuelve una lista de intereses vacia si el usuario no tiene perfil de voluntario', async () => {
    const { sesion } = preparar({ rol: 'ofertante', ofertante: { tipoEntidad: 'ong' } })
    const res = await ejecutar(sesion, { nombre: 'Otro' })

    expect((res.body as { user: { interesIds: string[] } }).user.interesIds).toEqual([])
  })

  it('responde 400 si algun interes no existe o no esta activo', async () => {
    const { sesion, guardar } = preparar()
    vi.spyOn(Categoria, 'find').mockReturnValue(consulta([]) as never)

    const res = await ejecutar(sesion, { interesIds: [nuevoId().toString()] })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'Algún interés seleccionado no es válido' })
    expect(guardar).not.toHaveBeenCalled()
  })

  it('un voluntario no puede cambiar los datos de entidad ni de contacto', async () => {
    const { user, sesion } = preparar()

    const res = await ejecutar(sesion, { telefono: '600', isla: 'tenerife', municipio: 'Adeje', cif: 'X1', nombre: 'Vol' })

    expect(res.statusCode).toBe(200)
    expect(user.telefono).toBeUndefined()
    expect(user.isla).toBeUndefined()
    expect(user.municipio).toBeUndefined()
    expect(user.ofertante).toBeUndefined()
  })

  it('actualiza los datos de la entidad de un ofertante quitando espacios', async () => {
    const { sesion } = preparar({ rol: 'ofertante', ofertante: { tipoEntidad: 'ong' } })

    const res = await ejecutar(sesion, {
      telefono: ' 922000000 ',
      isla: 'lanzarote',
      municipio: ' Arrecife ',
      tipoEntidad: 'asociacion',
      descripcion: ' Ayudamos ',
      web: ' https://a.test ',
      personaContacto: ' Luis ',
      cif: ' G99 ',
      direccion: ' Calle 1 '
    })

    expect(res.body).toMatchObject({
      user: {
        telefono: '922000000',
        isla: 'lanzarote',
        municipio: 'Arrecife',
        ofertante: {
          tipoEntidad: 'asociacion',
          descripcion: 'Ayudamos',
          web: 'https://a.test',
          personaContacto: 'Luis',
          cif: 'G99',
          direccion: 'Calle 1',
          verificada: false
        }
      }
    })
  })

  it('borra los campos opcionales de la entidad si llegan vacios', async () => {
    const { user, sesion } = preparar({
      rol: 'ofertante',
      telefono: '922',
      ofertante: { tipoEntidad: 'ong', descripcion: 'd', web: 'w', personaContacto: 'p', cif: 'c', direccion: 'x' }
    })

    await ejecutar(sesion, { telefono: ' ', descripcion: '', web: ' ', personaContacto: '', cif: '', direccion: '' })

    expect(user.telefono).toBeUndefined()
    expect(user.ofertante?.tipoEntidad).toBe('ong')
    expect(user.ofertante?.descripcion).toBeUndefined()
    expect(user.ofertante?.web).toBeUndefined()
    expect(user.ofertante?.personaContacto).toBeUndefined()
    expect(user.ofertante?.cif).toBeUndefined()
    expect(user.ofertante?.direccion).toBeUndefined()
  })

  it('un ofertante puede cambiar solo el nombre sin tocar los datos de la entidad', async () => {
    const entidad = { tipoEntidad: 'ong', descripcion: 'd', web: 'w', personaContacto: 'p', cif: 'c', direccion: 'x' }
    const { user, sesion } = preparar({ rol: 'ofertante', telefono: '922', isla: 'tenerife', municipio: 'Adeje', ofertante: entidad })

    await ejecutar(sesion, { nombre: 'Nuevo nombre' })

    expect(user).toMatchObject({ nombre: 'Nuevo nombre', telefono: '922', isla: 'tenerife', municipio: 'Adeje', ofertante: entidad })
  })

  it('responde 404 si el usuario ya no existe', async () => {
    vi.spyOn(User, 'findById').mockReturnValue(consulta(null) as never)
    const res = await ejecutar(usuarioVoluntario(), { nombre: 'Y' })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ message: 'No se encontró el usuario' })
  })

  it('responde 409 si el nuevo email ya pertenece a otra cuenta', async () => {
    const { sesion, guardar } = preparar()
    guardar.mockRejectedValue({ code: 11000 })

    const res = await ejecutar(sesion, { email: 'ocupado@test.com' })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Ya existe una cuenta con ese email' })
  })

  it('responde 500 si falla al guardar', async () => {
    const { sesion, guardar } = preparar()
    guardar.mockRejectedValue(errorBd())

    const res = await ejecutar(sesion, { nombre: 'Otro' })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo actualizar el perfil' })
  })
})
