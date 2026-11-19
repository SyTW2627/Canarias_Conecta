/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests unitarios del servicio de envio de correos (nodemailer simulado).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMail = vi.fn()
const createTransport = vi.fn(() => ({ sendMail }))

vi.mock('nodemailer', () => ({ default: { createTransport } }))

const CORREO = { para: 'ana@test.com', asunto: 'Asunto', texto: 'Texto plano', html: '<p>Html</p>' }
const VARIABLES = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'NODE_ENV'] as const
const originales = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]))

// El transporte se guarda en una variable del modulo: cada test lo importa de nuevo
async function cargarServicio() {
  vi.resetModules()
  return import('../../src/services/correo.js')
}

describe('enviarCorreo', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({})
    createTransport.mockClear()
    for (const variable of VARIABLES) delete process.env[variable]
  })

  afterEach(() => {
    for (const variable of VARIABLES) {
      if (originales[variable] === undefined) delete process.env[variable]
      else process.env[variable] = originales[variable]
    }
  })

  it('sin SMTP y fuera de produccion, muestra el correo en la consola', async () => {
    const { enviarCorreo } = await cargarServicio()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await enviarCorreo(CORREO)

    expect(createTransport).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0][0]).toContain('Para: ana@test.com')
    expect(log.mock.calls[0][0]).toContain('Asunto: Asunto')
    expect(log.mock.calls[0][0]).toContain('Texto plano')
  })

  it('sin SMTP en produccion, lanza un error', async () => {
    process.env.NODE_ENV = 'production'
    const { enviarCorreo } = await cargarServicio()

    await expect(enviarCorreo(CORREO)).rejects.toThrow('Falta la variable SMTP_HOST')
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('con SMTP envia el correo con el remitente por defecto y el puerto 587 sin TLS directo', async () => {
    process.env.SMTP_HOST = 'smtp.test'
    const { enviarCorreo } = await cargarServicio()

    await enviarCorreo(CORREO)

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.test',
      port: 587,
      secure: false,
      auth: undefined
    })
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Canarias Conecta <no-responder@canariasconecta.local>',
      to: 'ana@test.com',
      subject: 'Asunto',
      text: 'Texto plano',
      html: '<p>Html</p>'
    })
  })

  it('usa TLS directo en el puerto 465, credenciales y el remitente configurado', async () => {
    Object.assign(process.env, {
      SMTP_HOST: 'smtp.test',
      SMTP_PORT: '465',
      SMTP_USER: 'usuario',
      SMTP_PASS: 'clave',
      MAIL_FROM: 'Equipo <equipo@test.com>'
    })
    const { enviarCorreo } = await cargarServicio()

    await enviarCorreo(CORREO)

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.test',
      port: 465,
      secure: true,
      auth: { user: 'usuario', pass: 'clave' }
    })
    expect(sendMail.mock.calls[0][0].from).toBe('Equipo <equipo@test.com>')
  })

  it('usa 587 si SMTP_PORT no es un numero', async () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.test', SMTP_PORT: 'abc' })
    const { enviarCorreo } = await cargarServicio()

    await enviarCorreo(CORREO)

    expect(createTransport.mock.calls[0]).toEqual([expect.objectContaining({ port: 587 })])
  })

  it('crea el transporte una sola vez y lo reutiliza', async () => {
    process.env.SMTP_HOST = 'smtp.test'
    const { enviarCorreo } = await cargarServicio()

    await enviarCorreo(CORREO)
    await enviarCorreo(CORREO)

    expect(createTransport).toHaveBeenCalledOnce()
    expect(sendMail).toHaveBeenCalledTimes(2)
  })

  it('recuerda que no hay SMTP sin volver a comprobarlo', async () => {
    const { enviarCorreo } = await cargarServicio()
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await enviarCorreo(CORREO)
    // Configurarlo despues no cambia el transporte ya decidido
    process.env.SMTP_HOST = 'smtp.test'
    await enviarCorreo(CORREO)

    expect(createTransport).not.toHaveBeenCalled()
  })

  it('propaga los errores del servidor SMTP', async () => {
    process.env.SMTP_HOST = 'smtp.test'
    sendMail.mockRejectedValueOnce(new Error('SMTP caido'))
    const { enviarCorreo } = await cargarServicio()

    await expect(enviarCorreo(CORREO)).rejects.toThrow('SMTP caido')
  })
})
