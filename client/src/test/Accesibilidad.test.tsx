/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Tests de accesibilidad de los componentes con axe-core (WCAG 2.2 A/AA) y del uso solo con teclado.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FormularioOferta from '../components/FormularioOferta.tsx'
import Notificaciones from '../components/Notificaciones.tsx'
import TarjetaOferta from '../components/TarjetaOferta.tsx'
import Login from '../pages/Login.tsx'
import RecuperarPassword from '../pages/RecuperarPassword.tsx'
import Register from '../pages/Register.tsx'
import { oferta, simularApi, turno } from './api.ts'
import { infraccionesAccesibilidad } from './axe.ts'

function abrirLogin() {
  render(<Login onLogin={vi.fn()} onVolver={vi.fn()} onRecuperarPassword={vi.fn()} onRegistro={vi.fn()} />)
}

function abrirRegistro() {
  render(<Register onRegistro={vi.fn()} onVolver={vi.fn()} onIrALogin={vi.fn()} />)
}

describe('Accesibilidad automática (axe-core)', () => {
  it('el inicio de sesión no tiene infracciones', async () => {
    abrirLogin()
    expect(await infraccionesAccesibilidad()).toEqual([])
  })

  it('el inicio de sesión sigue siendo accesible al mostrar un error', async () => {
    simularApi({ 'POST /api/auth/login': { status: 401, body: { message: 'Credenciales incorrectas' } } })
    abrirLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'laura@ejemplo.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByRole('alert')

    expect(await infraccionesAccesibilidad()).toEqual([])
  })

  it('el registro no tiene infracciones, tampoco con el formulario de entidad', async () => {
    abrirRegistro()
    expect(await infraccionesAccesibilidad()).toEqual([])

    await userEvent.click(screen.getByRole('radio', { name: /Ofertante/ }))
    expect(await infraccionesAccesibilidad()).toEqual([])
  })

  it('recuperar la contraseña no tiene infracciones', async () => {
    render(<RecuperarPassword onVolver={vi.fn()} onIrALogin={vi.fn()} />)
    expect(await infraccionesAccesibilidad()).toEqual([])
  })

  it('la tarjeta de oferta no tiene infracciones, con plazas y completa', async () => {
    const { unmount } = render(<TarjetaOferta oferta={oferta([turno('a', 3, 2)])} />)
    expect(await infraccionesAccesibilidad()).toEqual([])
    unmount()

    render(<TarjetaOferta oferta={oferta([turno('a', 3, 0)])} />)
    expect(await infraccionesAccesibilidad()).toEqual([])
  })

  it('el formulario de publicar oferta no tiene infracciones', async () => {
    simularApi({ 'GET /api/categorias': { body: [{ id: 'c1', nombre: 'Medio ambiente', slug: 'medio-ambiente' }] } })
    render(
      <FormularioOferta titulo="Publicar una oferta" textoBoton="Publicar oferta" textoEnviando="Publicando..." onEnviar={vi.fn()} />,
    )
    await screen.findByRole('checkbox', { name: 'Medio ambiente' })

    expect(await infraccionesAccesibilidad()).toEqual([])
  })

  it('la campana y el panel de notificaciones no tienen infracciones', async () => {
    simularApi({
      'GET /api/notificaciones': {
        body: {
          notificaciones: [
            { id: 'a', tipo: 'inscripcion_aceptada', titulo: 'Aceptada', mensaje: 'Te han aceptado', enlace: '/mis_inscripciones', leida: false, fecha: new Date().toISOString() },
          ],
          noLeidas: 1,
        },
      },
    })
    render(<Notificaciones />)
    const campana = await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' })
    expect(await infraccionesAccesibilidad()).toEqual([])

    await userEvent.click(campana)
    expect(campana).toHaveAttribute('aria-expanded', 'true')
    expect(await infraccionesAccesibilidad()).toEqual([])
  })
})

describe('Formularios comprensibles', () => {
  it('cada campo del login tiene una etiqueta visible asociada', () => {
    abrirLogin()
    for (const campo of screen.getAllByRole('textbox')) {
      expect(campo).toHaveAccessibleName()
    }
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('los campos de email y contraseña ayudan al autocompletado del navegador', () => {
    abrirLogin()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete')
  })

  it('el error del servidor se anuncia a los lectores de pantalla', async () => {
    simularApi({ 'POST /api/auth/login': { status: 401, body: { message: 'Credenciales incorrectas' } } })
    abrirLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'laura@ejemplo.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    // role="alert" hace que el lector lo lea en cuanto aparece, sin mover el foco
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas')
  })

  it('el botón de mostrar contraseña dice qué hace y en qué estado está', async () => {
    abrirLogin()
    const boton = screen.getByRole('button', { name: /Mostrar contraseña/ })
    await userEvent.click(boton)

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /Ocultar contraseña/ })).toBeInTheDocument()
  })
})

describe('Uso solo con teclado', () => {
  it('se inicia sesión con Tab y Enter, sin ratón', async () => {
    const llamadas = simularApi({
      'POST /api/auth/login': { body: { token: 'tok', user: { id: 'v1', nombre: 'Laura', email: 'l@e.es', rol: 'voluntario' } } },
    })
    abrirLogin()

    screen.getByLabelText('Email').focus()
    await userEvent.keyboard('laura@ejemplo.com')
    await userEvent.tab()
    expect(screen.getByLabelText('Contraseña')).toHaveFocus()
    await userEvent.keyboard('Clave1234{Enter}')

    expect(llamadas.find((l) => l.ruta === '/api/auth/login')?.cuerpo).toEqual({
      email: 'laura@ejemplo.com',
      password: 'Clave1234',
    })
  })

  it('el rol del registro se elige con las flechas, como un grupo de radios', async () => {
    abrirRegistro()
    const voluntario = screen.getByRole('radio', { name: /Voluntario/ })
    voluntario.focus()

    await userEvent.keyboard('{ArrowDown}')

    expect(screen.getByRole('radio', { name: /Ofertante/ })).toBeChecked()
    expect(screen.getByLabelText('Nombre de la entidad')).toBeInTheDocument()
  })

  it('el panel de notificaciones se abre con Enter y se cierra con Escape', async () => {
    simularApi({ 'GET /api/notificaciones': { body: { notificaciones: [], noLeidas: 0 } } })
    render(<Notificaciones />)
    const campana = await screen.findByRole('button', { name: 'Notificaciones' })

    campana.focus()
    await userEvent.keyboard('{Enter}')
    expect(campana).toHaveAttribute('aria-expanded', 'true')

    await userEvent.keyboard('{Escape}')
    expect(campana).toHaveAttribute('aria-expanded', 'false')
  })

  it('el enlace de la tarjeta se alcanza con Tab', async () => {
    render(<TarjetaOferta oferta={oferta([turno('a', 3, 1)], { id: 'abc' })} />)
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Ver detalles' })).toHaveFocus()
  })
})
