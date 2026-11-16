/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios de la recuperacion de contraseña (modelos, bcrypt y correo simulados).
 */

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Token } from '../../src/models/Token.js'
import { User } from '../../src/models/User.js'
import { consulta, crearReq, crearRes, errorBd, nuevoId } from '../helpers.js'

const bcrypt = vi.hoisted(() => ({ hash: vi.fn(), compare: vi.fn() }))
vi.mock('bcrypt', () => ({ default: bcrypt }))

const correo = vi.hoisted(() => ({ enviarCorreo: vi.fn() }))
vi.mock('../../src/services/correo.js', () => correo)

const { restablecerPassword, solicitarRecuperacion } = await import('../../src/controllers/authController.js')

const MENSAJE =
  'Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer la contraseña.'
const HORA = 60 * 60 * 1000
const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex')

beforeEach(() => {
  correo.enviarCorreo.mockResolvedValue(undefined)
  bcrypt.hash.mockImplementation(async (texto: string) => `hash(${texto})`)
})

function usuario(datos: Record<string, unknown> = {}) {
  return User.hydrate({ _id: nuevoId(), nombre: 'Ana', email: 'ana@test.com', rol: 'voluntario', estado: 'activo', ...datos })
}

describe('solicitarRecuperacion', () => {
  // Simula la base de datos: el usuario encontrado y si ya hay un enlace reciente
  function simular({ user = usuario() as ReturnType<typeof usuario> | null, reciente = false } = {}) {
    return {
      buscar: vi.spyOn(User, 'findOne').mockReturnValue(consulta(user) as never),
      existe: vi.spyOn(Token, 'exists').mockResolvedValue((reciente ? { _id: nuevoId() } : null) as never),
      borrar: vi.spyOn(Token, 'deleteMany').mockResolvedValue({} as never),
      crear: vi.spyOn(Token, 'create').mockResolvedValue({} as never),
      user
    }
  }

  async function ejecutar(body: unknown) {
    const res = crearRes()
    await solicitarRecuperacion(crearReq({ body }), res)
    return res
  }

  const tokenDelCorreo = () =>
    (correo.enviarCorreo.mock.lastCall![0].texto as string).match(/token=([0-9a-f]{64})/)![1]

  it.each([undefined, {}, { email: '' }, { email: 'sin-arroba' }, { email: 42 }])(
    'responde 400 si el email no es valido (%o)',
    async (body) => {
      const buscar = vi.spyOn(User, 'findOne')
      const res = await ejecutar(body)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ message: 'El email no es válido' })
      expect(buscar).not.toHaveBeenCalled()
    }
  )

  it('busca solo cuentas activas por el email normalizado', async () => {
    const { buscar } = simular()
    await ejecutar({ email: '  ANA@test.com ' })

    expect(buscar).toHaveBeenCalledWith({ email: 'ana@test.com', estado: 'activo' })
  })

  it('responde el mensaje generico sin enviar nada si la cuenta no existe o no esta activa', async () => {
    const { crear } = simular({ user: null })

    const res = await ejecutar({ email: 'nadie@test.com' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ message: MENSAJE })
    expect(crear).not.toHaveBeenCalled()
    expect(correo.enviarCorreo).not.toHaveBeenCalled()
  })

  it('guarda solo el hash de un token nuevo que caduca en una hora y envia el enlace', async () => {
    const { user, crear, borrar } = simular()
    const antes = Date.now()

    const res = await ejecutar({ email: 'ana@test.com' })

    expect(res.body).toEqual({ message: MENSAJE })
    const token = tokenDelCorreo()
    // Solo vale el ultimo enlace: se borran los anteriores antes de crear el nuevo
    expect(borrar).toHaveBeenCalledWith({ usuarioId: user!._id, tipo: 'recuperar_password' })
    expect(borrar.mock.invocationCallOrder[0]).toBeLessThan(crear.mock.invocationCallOrder[0])

    const guardado = crear.mock.calls[0][0] as unknown as { tokenHash: string; expiraEn: Date; tipo: string }
    expect(guardado.tipo).toBe('recuperar_password')
    expect(guardado.tokenHash).toBe(sha256(token))
    expect(guardado.tokenHash).not.toBe(token)
    expect(guardado.expiraEn.getTime() - antes).toBeGreaterThanOrEqual(HORA - 50)
    expect(guardado.expiraEn.getTime() - antes).toBeLessThanOrEqual(HORA + 1000)

    expect(correo.enviarCorreo).toHaveBeenCalledWith({
      para: 'ana@test.com',
      asunto: 'Restablece tu contraseña de Canarias Conecta',
      texto: expect.stringContaining(`http://cliente.test/restablecer-password?token=${token}`),
      html: expect.stringContaining(`href="http://cliente.test/restablecer-password?token=${token}"`)
    })
    expect(correo.enviarCorreo.mock.lastCall![0].texto).toContain('Hola, Ana:')
  })

  it('genera un token distinto en cada solicitud', async () => {
    simular()
    await ejecutar({ email: 'ana@test.com' })
    const primero = tokenDelCorreo()
    await ejecutar({ email: 'ana@test.com' })

    expect(tokenDelCorreo()).not.toBe(primero)
  })

  it('no envia otro correo si se pidio uno hace menos de un minuto', async () => {
    const { user, existe, crear } = simular({ reciente: true })
    const ahora = Date.now()

    const res = await ejecutar({ email: 'ana@test.com' })

    expect(res.body).toEqual({ message: MENSAJE })
    const filtro = existe.mock.calls[0][0] as unknown as { expiraEn: { $gt: Date } }
    expect(filtro).toMatchObject({ usuarioId: user!._id, tipo: 'recuperar_password', usado: false })
    // "Reciente" = caduca dentro de mas de 59 minutos
    expect(filtro.expiraEn.$gt.getTime() - ahora).toBeGreaterThanOrEqual(HORA - 60 * 1000 - 50)
    expect(filtro.expiraEn.$gt.getTime() - ahora).toBeLessThanOrEqual(HORA - 60 * 1000 + 1000)
    expect(crear).not.toHaveBeenCalled()
    expect(correo.enviarCorreo).not.toHaveBeenCalled()
  })

  it('escapa el nombre del usuario en el HTML del correo', async () => {
    simular({ user: usuario({ nombre: `<b>Eva</b> & "Co" 'x'` }) })

    await ejecutar({ email: 'ana@test.com' })

    const { html, texto } = correo.enviarCorreo.mock.lastCall![0]
    expect(html).toContain('&#60;b&#62;Eva&#60;/b&#62; &#38; &#34;Co&#34; &#39;x&#39;')
    expect(html).not.toContain('<b>Eva</b>')
    // El texto plano no es HTML: va sin escapar
    expect(texto).toContain(`<b>Eva</b> & "Co" 'x'`)
  })

  it('usa localhost:5173 si no hay CLIENT_URL y quita las barras finales', async () => {
    simular()

    process.env.CLIENT_URL = 'https://web.test///'
    await ejecutar({ email: 'ana@test.com' })
    expect(correo.enviarCorreo.mock.lastCall![0].texto).toContain('https://web.test/restablecer-password?token=')

    delete process.env.CLIENT_URL
    await ejecutar({ email: 'ana@test.com' })
    expect(correo.enviarCorreo.mock.lastCall![0].texto).toContain('http://localhost:5173/restablecer-password?token=')

    process.env.CLIENT_URL = 'http://cliente.test'
  })

  it('responde 500 si no se puede enviar el correo', async () => {
    simular()
    correo.enviarCorreo.mockRejectedValue(new Error('SMTP caido'))

    const res = await ejecutar({ email: 'ana@test.com' })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo enviar el correo. Inténtalo más tarde' })
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(User, 'findOne').mockReturnValue(consulta(errorBd()) as never)

    const res = await ejecutar({ email: 'ana@test.com' })

    expect(res.statusCode).toBe(500)
    expect(console.error).toHaveBeenCalledWith('Error al solicitar la recuperación de contraseña:', expect.any(Error))
  })
})

describe('restablecerPassword', () => {
  const TOKEN = 'ab'.repeat(32)

  function simular({
    guardado = { usuarioId: nuevoId() } as { usuarioId: ReturnType<typeof nuevoId> } | null,
    user = usuario() as ReturnType<typeof usuario> | null
  } = {}) {
    return {
      usarToken: vi.spyOn(Token, 'findOneAndUpdate').mockResolvedValue(guardado as never),
      cambiar: vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(user as never),
      borrar: vi.spyOn(Token, 'deleteMany').mockResolvedValue({} as never),
      guardado,
      user
    }
  }

  async function ejecutar(body: unknown) {
    const res = crearRes()
    await restablecerPassword(crearReq({ body }), res)
    return res
  }

  it.each([undefined, 123, 'corto', 'z'.repeat(64), 'AB'.repeat(32), 'ab'.repeat(33)])(
    'responde 400 sin consultar si el token tiene un formato invalido (%s)',
    async (token) => {
      const usarToken = vi.spyOn(Token, 'findOneAndUpdate')
      const res = await ejecutar({ token, password: 'NuevaClave1' })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ message: 'El enlace no es válido o ha caducado' })
      expect(usarToken).not.toHaveBeenCalled()
    }
  )

  it('responde 400 si no hay cuerpo', async () => {
    const res = await ejecutar(undefined)
    expect(res.body).toEqual({ message: 'El enlace no es válido o ha caducado' })
  })

  it.each([undefined, 12345678, '1234567'])(
    'responde 400 sin gastar el enlace si la contraseña nueva no es valida (%s)',
    async (password) => {
      const usarToken = vi.spyOn(Token, 'findOneAndUpdate')
      const res = await ejecutar({ token: TOKEN, password })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ message: 'La contraseña debe tener al menos 8 caracteres' })
      expect(usarToken).not.toHaveBeenCalled()
    }
  )

  it('marca el token como usado en la misma operacion que lo busca', async () => {
    const { usarToken } = simular()
    const antes = Date.now()

    await ejecutar({ token: TOKEN, password: 'NuevaClave1' })

    const [filtro, cambio] = usarToken.mock.calls[0] as unknown as [
      { tokenHash: string; tipo: string; usado: boolean; expiraEn: { $gt: Date } },
      unknown
    ]
    expect(filtro).toMatchObject({ tokenHash: sha256(TOKEN), tipo: 'recuperar_password', usado: false })
    // Solo sirve si no ha caducado
    expect(filtro.expiraEn.$gt.getTime()).toBeGreaterThanOrEqual(antes - 50)
    expect(cambio).toEqual({ usado: true })
  })

  it('responde 400 si el token no existe, ya se uso o ha caducado', async () => {
    const { cambiar } = simular({ guardado: null })

    const res = await ejecutar({ token: TOKEN, password: 'NuevaClave1' })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: 'El enlace no es válido o ha caducado' })
    expect(cambiar).not.toHaveBeenCalled()
  })

  it('cambia la contraseña, invalida las sesiones anteriores y borra los enlaces', async () => {
    const { cambiar, borrar, guardado, user } = simular()
    const antes = Date.now()

    const res = await ejecutar({ token: TOKEN, password: 'NuevaClave1' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ message: 'Contraseña actualizada. Ya puedes iniciar sesión con la nueva.' })
    expect(bcrypt.hash).toHaveBeenCalledWith('NuevaClave1', 10)
    const [filtro, cambio] = cambiar.mock.calls[0] as unknown as [unknown, { password: string; passwordCambiadaEn: Date }]
    // Una cuenta suspendida tras pedir el enlace no puede usarlo
    expect(filtro).toEqual({ _id: guardado!.usuarioId, estado: 'activo' })
    expect(cambio.password).toBe('hash(NuevaClave1)')
    expect(cambio.passwordCambiadaEn.getTime()).toBeGreaterThanOrEqual(antes)
    expect(borrar).toHaveBeenCalledWith({ usuarioId: user!._id, tipo: 'recuperar_password' })
  })

  it('responde 400 si la cuenta ya no esta activa', async () => {
    const { borrar } = simular({ user: null })

    const res = await ejecutar({ token: TOKEN, password: 'NuevaClave1' })

    expect(res.statusCode).toBe(400)
    expect(borrar).not.toHaveBeenCalled()
  })

  it('responde 500 si falla la base de datos', async () => {
    vi.spyOn(Token, 'findOneAndUpdate').mockRejectedValue(errorBd())

    const res = await ejecutar({ token: TOKEN, password: 'NuevaClave1' })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'No se pudo cambiar la contraseña' })
  })
})
