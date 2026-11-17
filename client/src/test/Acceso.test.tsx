/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests del inicio de sesion y del registro: validaciones, errores y sesion guardada.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Login from '../pages/Login.tsx'
import Register from '../pages/Register.tsx'
import { OFERTANTE, VOLUNTARIO, simularApi } from './api.ts'

describe('Login', () => {
  function abrir() {
    const props = { onLogin: vi.fn(), onVolver: vi.fn(), onRecuperarPassword: vi.fn(), onRegistro: vi.fn() }
    render(<Login {...props} />)
    return props
  }

  async function entrar(email = 'laura@ejemplo.com', password = 'Clave1234') {
    await userEvent.type(screen.getByLabelText('Email'), email)
    await userEvent.type(screen.getByLabelText('Contraseña'), password)
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  }

  it('no deja enviar hasta rellenar email y contraseña', async () => {
    abrir()
    const boton = screen.getByRole('button', { name: 'Iniciar sesión' })

    expect(boton).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.es')
    expect(boton).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x')
    expect(boton).toBeEnabled()
  })

  it('guarda el token y el usuario y avisa a la aplicación', async () => {
    const llamadas = simularApi({ 'POST /api/auth/login': { body: { token: 'tok', user: VOLUNTARIO } } })
    const { onLogin } = abrir()

    await entrar()

    expect(llamadas[0].cuerpo).toEqual({ email: 'laura@ejemplo.com', password: 'Clave1234' })
    expect(localStorage.getItem('token')).toBe('tok')
    expect(JSON.parse(localStorage.getItem('usuario')!)).toEqual(VOLUNTARIO)
    expect(onLogin).toHaveBeenCalledWith(VOLUNTARIO)
  })

  it('muestra el error del servidor sin guardar la sesión', async () => {
    simularApi({ 'POST /api/auth/login': { status: 401, body: { message: 'Credenciales incorrectas' } } })
    const { onLogin } = abrir()

    await entrar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas')
    expect(localStorage.getItem('token')).toBeNull()
    expect(onLogin).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })

  it('usa un mensaje genérico si el servidor no lo da', async () => {
    simularApi({ 'POST /api/auth/login': { status: 500, body: {} } })
    abrir()

    await entrar()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar sesión')
  })

  it('avisa si no hay conexión con el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    abrir()

    await entrar()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })

  it('muestra y oculta la contraseña', async () => {
    abrir()
    const campo = screen.getByLabelText('Contraseña')

    expect(campo).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('lleva a recuperar la contraseña, al registro y al inicio', async () => {
    const { onRecuperarPassword, onRegistro, onVolver } = abrir()

    await userEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
    await userEvent.click(screen.getByRole('button', { name: 'Crear una cuenta' }))
    await userEvent.click(screen.getByRole('button', { name: /Canarias Conecta/ }))

    expect(onRecuperarPassword).toHaveBeenCalledOnce()
    expect(onRegistro).toHaveBeenCalledOnce()
    expect(onVolver).toHaveBeenCalledOnce()
  })
})

describe('Register', () => {
  function abrir() {
    const props = { onRegistro: vi.fn(), onVolver: vi.fn(), onIrALogin: vi.fn() }
    render(<Register {...props} />)
    return props
  }

  async function rellenar({ password = 'Segura123', repetir = password }: { password?: string; repetir?: string } = {}) {
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Laura')
    await userEvent.type(screen.getByLabelText('Email'), 'laura@ejemplo.com')
    await userEvent.type(screen.getByLabelText(/^Contraseña/), password)
    await userEvent.type(screen.getByLabelText('Repetir contraseña'), repetir)
  }

  const crear = () => userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

  it('crea una cuenta de voluntario por defecto y deja la sesión iniciada', async () => {
    const llamadas = simularApi({ 'POST /api/auth/register': { status: 201, body: { token: 'tok', user: VOLUNTARIO } } })
    const { onRegistro } = abrir()

    expect(screen.getByRole('radio', { name: /Voluntario/ })).toBeChecked()
    await rellenar()
    await crear()

    expect(llamadas[0].cuerpo).toEqual({
      nombre: 'Laura',
      email: 'laura@ejemplo.com',
      password: 'Segura123',
      rol: 'voluntario',
    })
    expect(localStorage.getItem('token')).toBe('tok')
    expect(onRegistro).toHaveBeenCalledWith(VOLUNTARIO)
  })

  it('una entidad se registra como ofertante y se le pide el nombre de la entidad', async () => {
    const llamadas = simularApi({ 'POST /api/auth/register': { status: 201, body: { token: 'tok', user: OFERTANTE } } })
    abrir()

    await userEvent.click(screen.getByRole('radio', { name: /Ofertante/ }))
    expect(screen.getByLabelText('Nombre de la entidad')).toBeInTheDocument()
    await rellenar()
    await crear()

    expect(llamadas[0].cuerpo).toMatchObject({ rol: 'ofertante' })
  })

  it.each([
    ['la contraseña tiene menos de 8 caracteres', { password: 'Corta1' }, 'La contraseña debe tener al menos 8 caracteres'],
    ['las contraseñas no coinciden', { password: 'Segura123', repetir: 'Segura124' }, 'Las contraseñas no coinciden'],
  ])('no llama al servidor si %s', async (_caso, datos, mensaje) => {
    const llamadas = simularApi({})
    abrir()

    await rellenar(datos)
    await crear()

    expect(screen.getByRole('alert')).toHaveTextContent(mensaje)
    expect(llamadas).toHaveLength(0)
  })

  it('muestra el error del servidor, por ejemplo un email repetido', async () => {
    simularApi({ 'POST /api/auth/register': { status: 409, body: { message: 'Ya existe una cuenta con ese email' } } })
    const { onRegistro } = abrir()

    await rellenar()
    await crear()

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese email')
    expect(onRegistro).not.toHaveBeenCalled()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('avisa si no hay conexión con el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    abrir()

    await rellenar()
    await crear()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })

  it('no deja enviar con campos vacíos y enlaza con el inicio de sesión', async () => {
    const { onIrALogin } = abrir()

    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '¿Ya tienes cuenta? Inicia sesión' }))

    expect(onIrALogin).toHaveBeenCalledOnce()
  })
})
