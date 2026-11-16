/**
 * Datos inventados para simular respuestas del servidor en los tests (NO tiene tests).
 * Con ellos podemos probar pantallas en situaciones concretas (oferta completa,
 * inscripción rechazada, notificaciones sin leer...) sin tocar la base de datos.
 */
import { fechaFutura } from './fixtures';

export function turnoFalso(datos: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'turno-1',
    fecha: `${fechaFutura(20)}T00:00:00.000Z`,
    horaInicio: '10:00',
    horaFin: '13:00',
    plazas: 5,
    plazasLibres: 3,
    ...datos,
  };
}

export function ofertaFalsa(datos: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'oferta-falsa-1',
    titulo: 'Limpieza de la playa de Las Teresitas',
    descripcion: 'Recogemos plásticos y residuos de la playa entre todos.',
    organizacion: 'Mar y Comunidad',
    categorias: [{ id: 'c1', nombre: 'Medio ambiente', slug: 'medio-ambiente' }],
    modalidad: 'presencial',
    tipoDuracion: 'jornada',
    ubicacion: { isla: 'tenerife', municipio: 'Santa Cruz de Tenerife', direccion: 'Playa de Las Teresitas' },
    requisitos: 'Traer agua y protector solar',
    edadMinima: 16,
    imagenes: [],
    turnos: [turnoFalso()],
    ...datos,
  };
}

export function miOfertaFalsa(datos: Partial<Record<string, unknown>> = {}) {
  return {
    ...ofertaFalsa(),
    estado: 'publicada',
    terminada: false,
    creadaEn: new Date().toISOString(),
    candidatosPendientes: 0,
    ...datos,
  };
}

export function inscripcionFalsa(datos: Partial<Record<string, unknown>> = {}) {
  const fecha = `${fechaFutura(20)}T00:00:00.000Z`;
  return {
    id: 'inscripcion-1',
    ofertaId: 'oferta-falsa-1',
    titulo: 'Limpieza de la playa de Las Teresitas',
    organizador: 'Mar y Comunidad',
    fecha,
    horas: 3,
    estado: 'aceptada',
    inicio: `${fechaFutura(20)}T10:00:00.000Z`,
    puedeCancelar: true,
    cancelacionTardia: false,
    posicionEspera: null,
    motivoRechazo: null,
    valoracion: null,
    ...datos,
  };
}

export function candidatoFalso(datos: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'candidato-1',
    estado: 'pendiente',
    terminada: false,
    horasPrevistas: 3,
    horasRealizadas: null,
    cancelacionTardia: false,
    mensaje: 'Me encantaría ayudar',
    motivoRechazo: null,
    fechaSolicitud: new Date().toISOString(),
    fechaResolucion: null,
    turnoIds: ['turno-1'],
    valoracion: null,
    voluntario: {
      id: 'vol-1',
      nombre: 'Ana Rodríguez',
      avatarUrl: null,
      isla: 'tenerife',
      municipio: 'La Laguna',
      edad: 25,
      biografia: 'Me gusta el mar y ayudar a los demás.',
      intereses: [{ id: 'i1', nombre: 'Medio ambiente' }],
      habilidades: ['Primeros auxilios'],
      idiomas: ['Español', 'Inglés'],
      estadisticas: { horasTotales: 12, colaboraciones: 4, valoracionMedia: 4.5, numValoraciones: 2 },
      email: null,
      telefono: null,
    },
    ...datos,
  };
}

export function notificacionFalsa(datos: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'noti-1',
    tipo: 'inscripcion_aceptada',
    titulo: 'Te han aceptado',
    mensaje: 'Tu solicitud para la limpieza de la playa ha sido aceptada.',
    enlace: null,
    leida: false,
    fecha: new Date().toISOString(),
    ...datos,
  };
}
