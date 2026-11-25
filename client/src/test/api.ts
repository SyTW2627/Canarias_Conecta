/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Simula la API del servidor en los tests sustituyendo fetch.
 */
import { vi } from 'vitest'
import type { Oferta, Turno } from '../ofertas.ts'
import type { Usuario } from '../pages/Login.tsx'

type Respuesta = { status?: number; body: unknown }
// Clave "METODO /ruta" (sin query); el valor puede depender del cuerpo enviado
type Rutas = Record<string, Respuesta | ((cuerpo: unknown, url: string) => Respuesta)>

export type Llamada = { metodo: string; ruta: string; cuerpo: unknown }

// Devuelve las llamadas hechas, para comprobar que se envio lo esperado
export function simularApi(rutas: Rutas): Llamada[] {
  const llamadas: Llamada[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones: RequestInit = {}) => {
      const metodo = opciones.method ?? 'GET'
      const ruta = url.split('?')[0]
      const cuerpo = typeof opciones.body === 'string' ? JSON.parse(opciones.body) : undefined
      llamadas.push({ metodo, ruta, cuerpo })

      // Las notificaciones de la barra superior no son lo que se prueba
      const definida = rutas[`${metodo} ${ruta}`] ?? (ruta.startsWith('/api/notificaciones') ? { body: [] } : undefined)
      if (!definida) throw new Error(`Ruta no simulada: ${metodo} ${ruta}`)
      const { status = 200, body } = typeof definida === 'function' ? definida(cuerpo, url) : definida
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    }),
  )
  return llamadas
}

export const VOLUNTARIO: Usuario = { id: 'v1', nombre: 'Laura', email: 'laura@ejemplo.com', rol: 'voluntario' }
export const OFERTANTE: Usuario = { id: 'o1', nombre: 'Asociación', email: 'asoc@ejemplo.com', rol: 'ofertante' }

// Fecha ISO del dia a n dias de hoy, como la guarda el servidor (00:00 UTC)
export function dia(n: number): string {
  return `${new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)}T00:00:00.000Z`
}

export function turno(id: string, diasDesdeHoy: number, plazasLibres: number, plazas = 3): Turno {
  return { id, fecha: dia(diasDesdeHoy), horaInicio: '10:00', horaFin: '13:00', plazas, plazasLibres }
}

export function oferta(turnos: Turno[], datos: Partial<Oferta> = {}): Oferta {
  return {
    id: 'of1',
    titulo: 'Limpieza de playa',
    descripcion: 'Recogida de residuos en la costa',
    organizacion: 'Asociación',
    categorias: [{ id: 'c1', nombre: 'Medio ambiente', slug: 'medio-ambiente' }],
    modalidad: 'presencial',
    tipoDuracion: 'jornada',
    ubicacion: { isla: 'tenerife', municipio: 'La Laguna' },
    imagenes: [],
    turnos,
    ...datos,
  }
}
