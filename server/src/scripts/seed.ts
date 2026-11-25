/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Inserta usuarios y ofertas de ejemplo en la base de datos local (npm run seed).
 */

import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { prepararBaseDeDatos } from '../config/catalogo.js'
import { cargarImagen } from '../config/imagenes.js'
import { User } from '../models/User.js'
import { Categoria } from '../models/Categoria.js'
import { Imagen } from '../models/Imagen.js'
import { Oferta, construirTextoBusqueda } from '../models/Oferta.js'
import { OfertaEmpleo } from '../models/OfertaEmpleo.js'

dotenv.config()

const EJEMPLOS = [
  { nombre: 'Laura Perez', email: 'laura@ejemplo.com', rol: 'voluntario' },
  { nombre: 'Carlos Diaz', email: 'carlos@ejemplo.com', rol: 'voluntario' },
  // Sin intereses: sirve para ver el inicio antes de que el sistema conozca sus gustos
  { nombre: 'Marta Ruiz', email: 'marta@ejemplo.com', rol: 'voluntario' },
  { nombre: 'Banco de Alimentos Tenerife', email: 'banco@ejemplo.com', rol: 'ofertante' },
  { nombre: 'Asociación Horizonte', email: 'horizonte@ejemplo.com', rol: 'ofertante' },
  { nombre: 'Mar y Comunidad', email: 'marycomunidad@ejemplo.com', rol: 'ofertante' },
  { nombre: 'Red Canarias Participa', email: 'redparticipa@ejemplo.com', rol: 'ofertante' },
  { nombre: 'Islas Verdes', email: 'islasverdes@ejemplo.com', rol: 'ofertante' },
  { nombre: 'Crecer Juntos', email: 'crecerjuntos@ejemplo.com', rol: 'ofertante' },
  { nombre: 'Banco de Alimentos Canario', email: 'bancocanario@ejemplo.com', rol: 'ofertante' }
] as const

// Las mismas oportunidades que muestra HomePage.tsx mientras no lea de la API
const OFERTAS = [
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Acompañamiento a personas mayores',
    descripcion: 'Pasa una mañana haciendo compañía a personas mayores que viven solas.',
    categorias: ['personas-mayores', 'comunidad'],
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    dias: 2,
    horaInicio: '10:00',
    horaFin: '13:00',
    plazas: 8,
    imagen: 'imagen_personamayor.jpg'
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Limpieza y cuidado de la costa',
    descripcion: 'Recogida de residuos y cuidado del litoral junto a vecinos de la zona.',
    categorias: ['medio-ambiente'],
    isla: 'gran_canaria',
    municipio: 'Las Palmas de Gran Canaria',
    dias: 3,
    horaInicio: '09:00',
    horaFin: '12:00',
    plazas: 15,
    imagen: 'limpieza_costa.jpg'
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Taller de apoyo comunitario',
    descripcion: 'Ayuda a organizar un taller para reforzar las redes de apoyo del barrio.',
    categorias: ['comunidad'],
    isla: 'tenerife',
    municipio: 'La Laguna',
    dias: 4,
    horaInicio: '16:00',
    horaFin: '19:00',
    plazas: 5,
    imagen: 'voluntariado-2.png'
  },
  {
    email: 'islasverdes@ejemplo.com',
    titulo: 'Reforestación de espacios naturales',
    descripcion: 'Plantación de especies autóctonas para recuperar espacios naturales.',
    categorias: ['medio-ambiente'],
    isla: 'tenerife',
    municipio: 'La Laguna',
    dias: 5,
    horaInicio: '15:30',
    horaFin: '18:30',
    plazas: 12,
    imagen: 'reforestacion.jpg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Apoyo escolar para jóvenes',
    descripcion: 'Acompaña a jóvenes en sus tareas escolares y técnicas de estudio.',
    categorias: ['educacion'],
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    dias: 6,
    horaInicio: '17:00',
    horaFin: '19:00',
    plazas: 6,
    imagen: 'apoyo_escolar.jpeg'
  },
  {
    email: 'bancocanario@ejemplo.com',
    titulo: 'Recogida de alimentos solidaria',
    descripcion: 'Colabora en la recogida y clasificación de alimentos para familias.',
    categorias: ['alimentacion', 'comunidad'],
    isla: 'gran_canaria',
    municipio: 'Las Palmas de Gran Canaria',
    dias: 8,
    horaInicio: '09:30',
    horaFin: '13:30',
    plazas: 20,
    imagen: 'recogida_alimentos.png'
  },
  {
    email: 'islasverdes@ejemplo.com',
    titulo: 'Cuidado de senderos en Anaga',
    descripcion: 'Limpieza y señalización de senderos del Parque Rural de Anaga.',
    categorias: ['medio-ambiente'],
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    dias: 7,
    horaInicio: '09:00',
    horaFin: '13:00',
    plazas: 10,
    imagen: 'reforestacion.jpg'
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Censo de aves marinas',
    descripcion: 'Ayuda a contar y registrar aves marinas en la costa de Teno.',
    categorias: ['medio-ambiente', 'animales'],
    isla: 'tenerife',
    municipio: 'Buenavista del Norte',
    dias: 9,
    horaInicio: '08:00',
    horaFin: '11:00',
    plazas: 6,
    imagen: 'limpieza_costa.jpg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Paseo de perros del refugio',
    descripcion: 'Saca a pasear a los perros del refugio y ayuda a socializarlos.',
    categorias: ['animales'],
    isla: 'tenerife',
    municipio: 'La Laguna',
    dias: 3,
    horaInicio: '17:00',
    horaFin: '19:00',
    plazas: 8,
    imagen: 'voluntariado-3.png'
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Rescate de tortugas en la playa',
    descripcion: 'Apoyo al equipo que atiende a tortugas marinas varadas.',
    categorias: ['animales', 'medio-ambiente'],
    isla: 'fuerteventura',
    municipio: 'Puerto del Rosario',
    dias: 10,
    horaInicio: '10:00',
    horaFin: '14:00',
    plazas: 4,
    imagen: 'voluntariado-3.png'
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Tarde de juegos en la residencia',
    descripcion: 'Organiza juegos de mesa y charlas con los residentes.',
    categorias: ['personas-mayores'],
    isla: 'gran_canaria',
    municipio: 'Telde',
    dias: 4,
    horaInicio: '16:00',
    horaFin: '18:00',
    plazas: 6,
    imagen: 'imagen_personamayor.jpg'
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Llamadas de compañía a mayores',
    descripcion: 'Llama por teléfono a personas mayores que viven solas para charlar un rato.',
    categorias: ['personas-mayores', 'comunidad'],
    modalidad: 'online',
    dias: 5,
    horaInicio: '11:00',
    horaFin: '12:30',
    plazas: 10,
    imagen: 'imagen_personamayor.jpg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Clases de alfabetización digital',
    descripcion: 'Enseña a usar el móvil y el ordenador a personas mayores.',
    categorias: ['educacion', 'personas-mayores'],
    isla: 'gran_canaria',
    municipio: 'Las Palmas de Gran Canaria',
    dias: 6,
    horaInicio: '10:00',
    horaFin: '12:00',
    plazas: 5,
    imagen: 'apoyo_escolar.jpeg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Refuerzo de matemáticas online',
    descripcion: 'Ayuda por videollamada a estudiantes de secundaria con matemáticas.',
    categorias: ['educacion'],
    modalidad: 'online',
    dias: 2,
    horaInicio: '18:00',
    horaFin: '19:30',
    plazas: 8,
    imagen: 'apoyo_escolar.jpeg'
  },
  {
    email: 'bancocanario@ejemplo.com',
    titulo: 'Reparto de comidas en Arrecife',
    descripcion: 'Prepara y reparte lotes de comida a familias del barrio.',
    categorias: ['alimentacion'],
    isla: 'lanzarote',
    municipio: 'Arrecife',
    dias: 5,
    horaInicio: '09:00',
    horaFin: '12:00',
    plazas: 10,
    imagen: 'recogida_alimentos.png'
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Fiesta vecinal de La Palma',
    descripcion: 'Echa una mano montando y animando la fiesta del barrio.',
    categorias: ['comunidad'],
    isla: 'la_palma',
    municipio: 'Santa Cruz de La Palma',
    dias: 11,
    horaInicio: '17:00',
    horaFin: '21:00',
    plazas: 12,
    imagen: 'voluntariado-2.png'
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Limpieza de la playa de Sotavento',
    descripcion: 'Recogida de plásticos y redes en la playa de Sotavento.',
    categorias: ['medio-ambiente'],
    isla: 'fuerteventura',
    municipio: 'Pájara',
    dias: 4,
    horaInicio: '09:00',
    horaFin: '12:00',
    plazas: 15,
    imagen: 'limpieza_costa.jpg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Apoyo escolar en Corralejo',
    descripcion: 'Refuerzo de lectura y deberes para niños de primaria.',
    categorias: ['educacion'],
    isla: 'fuerteventura',
    municipio: 'La Oliva',
    dias: 8,
    horaInicio: '16:30',
    horaFin: '18:30',
    plazas: 6,
    imagen: 'apoyo_escolar.jpeg'
  },
  {
    email: 'islasverdes@ejemplo.com',
    titulo: 'Retirada de especies invasoras en Timanfaya',
    descripcion: 'Ayuda a retirar plantas invasoras en el entorno del parque.',
    categorias: ['medio-ambiente'],
    isla: 'lanzarote',
    municipio: 'Yaiza',
    dias: 6,
    horaInicio: '08:30',
    horaFin: '12:30',
    plazas: 10,
    imagen: 'reforestacion.jpg'
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Acompañamiento en el centro de día de Teguise',
    descripcion: 'Comparte una mañana de charla y paseo con personas mayores.',
    categorias: ['personas-mayores'],
    isla: 'lanzarote',
    municipio: 'Teguise',
    dias: 9,
    horaInicio: '10:00',
    horaFin: '13:00',
    plazas: 5,
    imagen: 'imagen_personamayor.jpg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Voluntariado en la protectora de Los Llanos',
    descripcion: 'Limpieza de instalaciones y paseo de perros y gatos.',
    categorias: ['animales'],
    isla: 'la_palma',
    municipio: 'Los Llanos de Aridane',
    dias: 3,
    horaInicio: '10:00',
    horaFin: '13:00',
    plazas: 8,
    imagen: 'voluntariado-3.png'
  },
  {
    email: 'bancocanario@ejemplo.com',
    titulo: 'Recogida de alimentos en Santa Cruz de La Palma',
    descripcion: 'Clasificación de alimentos donados en el almacén solidario.',
    categorias: ['alimentacion'],
    isla: 'la_palma',
    municipio: 'Santa Cruz de La Palma',
    dias: 7,
    horaInicio: '09:00',
    horaFin: '13:00',
    plazas: 12,
    imagen: 'recogida_alimentos.png'
  },
  {
    email: 'islasverdes@ejemplo.com',
    titulo: 'Repoblación del monte de Garajonay',
    descripcion: 'Plantación de laurisilva en zonas afectadas por incendios.',
    categorias: ['medio-ambiente'],
    isla: 'la_gomera',
    municipio: 'Vallehermoso',
    dias: 5,
    horaInicio: '09:00',
    horaFin: '13:00',
    plazas: 12,
    imagen: 'reforestacion.jpg'
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Visitas a mayores en San Sebastián de La Gomera',
    descripcion: 'Acompaña a personas mayores que viven solas en el municipio.',
    categorias: ['personas-mayores', 'comunidad'],
    isla: 'la_gomera',
    municipio: 'San Sebastián de La Gomera',
    dias: 2,
    horaInicio: '11:00',
    horaFin: '13:00',
    plazas: 6,
    imagen: 'imagen_personamayor.jpg'
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Taller de silbo gomero para niños',
    descripcion: 'Ayuda a organizar un taller de silbo para escolares.',
    categorias: ['educacion', 'comunidad'],
    isla: 'la_gomera',
    municipio: 'Hermigua',
    dias: 10,
    horaInicio: '17:00',
    horaFin: '19:00',
    plazas: 4,
    imagen: 'apoyo_escolar.jpeg'
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Limpieza de fondos en La Restinga',
    descripcion: 'Apoyo en tierra a buceadores que retiran residuos del fondo marino.',
    categorias: ['medio-ambiente'],
    isla: 'el_hierro',
    municipio: 'El Pinar',
    dias: 6,
    horaInicio: '09:00',
    horaFin: '13:00',
    plazas: 8,
    imagen: 'limpieza_costa.jpg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Cuidado de la granja escuela de Valverde',
    descripcion: 'Alimenta y cuida a los animales de la granja escuela.',
    categorias: ['animales', 'educacion'],
    isla: 'el_hierro',
    municipio: 'Valverde',
    dias: 4,
    horaInicio: '10:00',
    horaFin: '12:30',
    plazas: 5,
    imagen: 'voluntariado-3.png'
  },
  {
    email: 'bancocanario@ejemplo.com',
    titulo: 'Reparto de alimentos en Frontera',
    descripcion: 'Entrega de lotes de comida a familias del municipio.',
    categorias: ['alimentacion', 'comunidad'],
    isla: 'el_hierro',
    municipio: 'Frontera',
    dias: 12,
    horaInicio: '09:30',
    horaFin: '12:30',
    plazas: 6,
    imagen: 'recogida_alimentos.png'
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Limpieza de la playa de Las Conchas',
    descripcion: 'Recogida de residuos en una de las playas más visitadas de La Graciosa.',
    categorias: ['medio-ambiente'],
    isla: 'la_graciosa',
    municipio: 'Caleta de Sebo',
    dias: 7,
    horaInicio: '09:00',
    horaFin: '12:00',
    plazas: 10,
    imagen: 'limpieza_costa.jpg'
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Jornada vecinal en Caleta de Sebo',
    descripcion: 'Prepara y anima una jornada de convivencia con los vecinos.',
    categorias: ['comunidad'],
    isla: 'la_graciosa',
    municipio: 'Caleta de Sebo',
    dias: 13,
    horaInicio: '16:00',
    horaFin: '20:00',
    plazas: 8,
    imagen: 'voluntariado-2.png'
  }
] as const

// Ofertas de empleo de las mismas entidades. "dias": fecha limite desde hoy; sin ella, no hay plazo
const EMPLEOS = [
  {
    email: 'banco@ejemplo.com',
    titulo: 'Técnico/a de logística en almacén solidario',
    descripcion:
      'Coordinación de la recepción, clasificación y reparto de alimentos donados. Trato con voluntariado y entidades receptoras.',
    categorias: ['alimentacion'],
    tipoContrato: 'indefinido',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    salario: '19.000 € brutos/año',
    requisitos: 'Carné de conducir B. Valorable experiencia en almacén.',
    vacantes: 1,
    dias: 30
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Auxiliar de acompañamiento a personas mayores',
    descripcion:
      'Acompañamiento a domicilio y en actividades de centro de día. Trabajo en equipo con trabajo social.',
    categorias: ['personas-mayores'],
    tipoContrato: 'temporal',
    jornada: 'parcial',
    modalidad: 'presencial',
    isla: 'gran_canaria',
    municipio: 'Las Palmas de Gran Canaria',
    salario: '9,50 €/hora',
    requisitos: 'Certificado de profesionalidad de atención sociosanitaria o similar.',
    vacantes: 3,
    dias: 15
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Prácticas en educación ambiental',
    descripcion:
      'Apoyo en talleres de sensibilización sobre el litoral para centros escolares y preparación de materiales.',
    categorias: ['medio-ambiente', 'educacion'],
    tipoContrato: 'practicas',
    jornada: 'parcial',
    modalidad: 'mixta',
    isla: 'gran_canaria',
    municipio: 'Telde',
    vacantes: 2
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Community manager para proyectos sociales',
    descripcion:
      'Gestión de redes sociales y comunicación de las campañas de la red. Trabajo en remoto con reuniones semanales.',
    categorias: ['comunidad'],
    tipoContrato: 'autonomo',
    jornada: 'parcial',
    modalidad: 'online',
    salario: 'A convenir',
    vacantes: 1,
    dias: 45
  },
  {
    email: 'islasverdes@ejemplo.com',
    titulo: 'Técnico/a de restauración ambiental',
    descripcion:
      'Planificación y seguimiento de plantaciones de especies autóctonas en espacios naturales. Coordinación de las jornadas con voluntariado.',
    categorias: ['medio-ambiente'],
    tipoContrato: 'temporal',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'tenerife',
    municipio: 'La Laguna',
    salario: '1.650 € brutos/mes',
    requisitos: 'Grado en Ciencias Ambientales, Biología o similar. Carné de conducir B.',
    vacantes: 2,
    dias: 20
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Educador/a de refuerzo escolar',
    descripcion:
      'Clases de apoyo en grupos reducidos para alumnado de primaria y secundaria por las tardes. Seguimiento con las familias.',
    categorias: ['educacion'],
    tipoContrato: 'indefinido',
    jornada: 'parcial',
    modalidad: 'presencial',
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    salario: '1.000 € brutos/mes (20 h semanales)',
    requisitos: 'Grado en Magisterio, Pedagogía o Educación Social.',
    vacantes: 2,
    dias: 25
  },
  {
    email: 'bancocanario@ejemplo.com',
    titulo: 'Conductor/a de reparto de alimentos',
    descripcion:
      'Recogida de donaciones en supermercados y reparto a las entidades receptoras de la isla con la furgoneta de la organización.',
    categorias: ['alimentacion'],
    tipoContrato: 'temporal',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'gran_canaria',
    municipio: 'Las Palmas de Gran Canaria',
    salario: '1.400 € brutos/mes',
    requisitos: 'Carné de conducir B con al menos dos años de antigüedad.',
    vacantes: 1,
    dias: 10
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Trabajador/a social',
    descripcion:
      'Valoración de casos, planes de atención y coordinación con los servicios sociales municipales para personas mayores en situación de soledad.',
    categorias: ['personas-mayores', 'comunidad'],
    tipoContrato: 'indefinido',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    salario: '24.000 € brutos/año',
    requisitos: 'Grado en Trabajo Social y colegiación.',
    vacantes: 1,
    dias: 30
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Dinamizador/a comunitario/a',
    descripcion:
      'Organización de actividades vecinales y apoyo a las asociaciones de barrio para impulsar la participación en el municipio.',
    categorias: ['comunidad'],
    tipoContrato: 'temporal',
    jornada: 'parcial',
    modalidad: 'presencial',
    isla: 'la_palma',
    municipio: 'Santa Cruz de La Palma',
    salario: '10 €/hora',
    requisitos: 'Experiencia en dinamización sociocultural. Valorable título de animación sociocultural.',
    vacantes: 1,
    dias: 21
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Monitor/a de actividades en el litoral',
    descripcion:
      'Salidas de interpretación del litoral y limpiezas de playa con grupos escolares y familias durante los fines de semana.',
    categorias: ['medio-ambiente', 'educacion'],
    tipoContrato: 'temporal',
    jornada: 'parcial',
    modalidad: 'presencial',
    isla: 'fuerteventura',
    municipio: 'Pájara',
    salario: '9 €/hora',
    requisitos: 'Título de monitor/a de ocio y tiempo libre. Valorable socorrismo acuático.',
    vacantes: 3,
    dias: 18
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Auxiliar en protectora de animales',
    descripcion:
      'Cuidado diario de los animales del refugio, limpieza de las instalaciones y apoyo en las adopciones y en la organización del voluntariado.',
    categorias: ['animales'],
    tipoContrato: 'temporal',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'la_palma',
    municipio: 'Los Llanos de Aridane',
    salario: '1.250 € brutos/mes',
    vacantes: 1,
    dias: 14
  },
  {
    email: 'islasverdes@ejemplo.com',
    titulo: 'Prácticas en gestión de espacios naturales',
    descripcion:
      'Apoyo al equipo técnico en el seguimiento de especies invasoras y en la elaboración de informes de campo.',
    categorias: ['medio-ambiente'],
    tipoContrato: 'practicas',
    jornada: 'parcial',
    modalidad: 'mixta',
    isla: 'lanzarote',
    municipio: 'Yaiza',
    salario: 'Beca de 500 €/mes',
    requisitos: 'Último curso o recién titulado/a en Ciencias Ambientales o Biología.',
    vacantes: 2
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Animador/a sociocultural en centro de día',
    descripcion:
      'Talleres de memoria, música y actividad física adaptada para las personas usuarias del centro de día.',
    categorias: ['personas-mayores'],
    tipoContrato: 'indefinido',
    jornada: 'parcial',
    modalidad: 'presencial',
    isla: 'lanzarote',
    municipio: 'Teguise',
    salario: '950 € brutos/mes',
    requisitos: 'Técnico/a superior en Animación Sociocultural y Turística.',
    vacantes: 1,
    dias: 28
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Técnico/a de proyectos y subvenciones',
    descripcion:
      'Redacción y justificación de proyectos para convocatorias públicas y privadas de las entidades de la red. Teletrabajo con reuniones en línea.',
    categorias: ['comunidad'],
    tipoContrato: 'indefinido',
    jornada: 'completa',
    modalidad: 'online',
    salario: '22.000 € brutos/año',
    requisitos: 'Experiencia mínima de un año en gestión de subvenciones.',
    vacantes: 1,
    dias: 35
  },
  {
    email: 'banco@ejemplo.com',
    titulo: 'Coordinador/a de voluntariado',
    descripcion:
      'Captación, formación y organización de los turnos de voluntariado en el almacén y en las campañas de recogida.',
    categorias: ['alimentacion', 'comunidad'],
    tipoContrato: 'temporal',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    salario: '1.500 € brutos/mes',
    requisitos: 'Experiencia en gestión de equipos de voluntariado.',
    vacantes: 1,
    dias: 12
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Contrato de formación en educación infantil',
    descripcion:
      'Formación en alternancia con el trabajo en el aula matinal y en las actividades extraescolares de la asociación.',
    categorias: ['educacion'],
    tipoContrato: 'formacion',
    jornada: 'parcial',
    modalidad: 'presencial',
    isla: 'fuerteventura',
    municipio: 'La Oliva',
    salario: 'Según convenio',
    requisitos: 'Estar cursando el ciclo de Técnico/a superior en Educación Infantil.',
    vacantes: 2
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Técnico/a de buceo científico',
    descripcion:
      'Muestreos submarinos para el seguimiento de la reserva marina y coordinación de las limpiezas de fondos con voluntariado.',
    categorias: ['medio-ambiente'],
    tipoContrato: 'temporal',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'el_hierro',
    municipio: 'El Pinar',
    salario: '1.800 € brutos/mes',
    requisitos: 'Titulación de buceo profesional o científico. Grado en Ciencias del Mar o similar.',
    vacantes: 1,
    dias: 40
  },
  {
    email: 'bancocanario@ejemplo.com',
    titulo: 'Administrativo/a',
    descripcion:
      'Gestión de la documentación de donaciones y entidades receptoras, atención telefónica y apoyo a la contabilidad.',
    categorias: ['alimentacion'],
    tipoContrato: 'indefinido',
    jornada: 'parcial',
    modalidad: 'presencial',
    isla: 'la_palma',
    municipio: 'Santa Cruz de La Palma',
    salario: '900 € brutos/mes',
    requisitos: 'Técnico/a en Gestión Administrativa. Manejo de hojas de cálculo.',
    vacantes: 1,
    dias: 22
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Diseñador/a gráfico/a para campañas',
    descripcion:
      'Diseño de carteles, piezas para redes sociales y materiales de las campañas de sensibilización de la red, por proyecto.',
    categorias: ['comunidad'],
    tipoContrato: 'autonomo',
    jornada: 'parcial',
    modalidad: 'online',
    salario: 'Por proyecto',
    requisitos: 'Portafolio con trabajos anteriores.',
    vacantes: 1
  },
  {
    email: 'horizonte@ejemplo.com',
    titulo: 'Gerocultor/a en atención a domicilio',
    descripcion:
      'Apoyo en las actividades básicas de la vida diaria a personas mayores en su domicilio y acompañamiento en sus salidas.',
    categorias: ['personas-mayores'],
    tipoContrato: 'temporal',
    jornada: 'completa',
    modalidad: 'presencial',
    isla: 'la_gomera',
    municipio: 'San Sebastián de La Gomera',
    salario: '1.350 € brutos/mes',
    requisitos: 'Certificado de profesionalidad de atención sociosanitaria.',
    vacantes: 2,
    dias: 16
  }
] as const

// Perfiles distintos para comparar las recomendaciones de cada voluntario
const PERFILES_VOLUNTARIOS = [
  { email: 'laura@ejemplo.com', isla: 'tenerife', intereses: ['medio-ambiente', 'animales'] },
  { email: 'carlos@ejemplo.com', isla: 'gran_canaria', intereses: ['personas-mayores', 'educacion'] }
]

// Turno a "dias" de hoy a las 00:00 UTC: los datos de ejemplo no caducan
function fechaDesdeHoy(dias: number): Date {
  const fecha = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha
}

// Contrasena comun para todos los usuarios de ejemplo (solo desarrollo)
const PASSWORD_EJEMPLO = 'Ejemplo123'

async function seedOfertas(): Promise<void> {
  const categorias = await Categoria.find()

  for (const ejemplo of OFERTAS) {
    const slugs: readonly string[] = ejemplo.categorias
    const ofertante = await User.findOne({ email: ejemplo.email }).orFail()

    const imagenId = await cargarImagen(ejemplo.imagen)

    // Ejecutar el seed varias veces no duplica ofertas. Las que ya existen se actualizan
    // porque las de seeds anteriores guardan una ruta a /fotos en lugar de la imagen
    // Tambien se mueve su turno a una fecha futura para que siga apareciendo
    const { matchedCount } = await Oferta.updateOne(
      { ofertanteId: ofertante._id, titulo: ejemplo.titulo },
      { imagenes: [imagenId], 'turnos.0.fecha': fechaDesdeHoy(ejemplo.dias) }
    )
    if (matchedCount > 0) continue

    await Oferta.create({
      ofertanteId: ofertante._id,
      titulo: ejemplo.titulo,
      descripcion: ejemplo.descripcion,
      categoriaIds: categorias
        .filter((categoria) => slugs.includes(categoria.slug))
        .map((categoria) => categoria._id),
      modalidad: 'modalidad' in ejemplo ? ejemplo.modalidad : 'presencial',
      tipoDuracion: 'jornada',
      ...('isla' in ejemplo && { ubicacion: { isla: ejemplo.isla, municipio: ejemplo.municipio } }),
      imagenes: [imagenId],
      turnos: [
        {
          fecha: fechaDesdeHoy(ejemplo.dias),
          horaInicio: ejemplo.horaInicio,
          horaFin: ejemplo.horaFin,
          plazas: ejemplo.plazas,
          plazasLibres: ejemplo.plazas
        }
      ],
      textoBusqueda: construirTextoBusqueda([
        ejemplo.titulo,
        ejemplo.descripcion,
        ofertante.nombre,
        'municipio' in ejemplo ? ejemplo.municipio : undefined
      ]),
      estado: 'publicada',
      fechaPublicacion: new Date()
    })
  }
}

// No duplica: si la entidad ya tiene una oferta de empleo con ese titulo, solo renueva su plazo
async function seedEmpleos(): Promise<void> {
  const categorias = await Categoria.find()

  for (const ejemplo of EMPLEOS) {
    const slugs: readonly string[] = ejemplo.categorias
    const ofertante = await User.findOne({ email: ejemplo.email }).orFail()
    const fechaLimite = 'dias' in ejemplo ? fechaDesdeHoy(ejemplo.dias) : undefined

    const existente = { ofertanteId: ofertante._id, titulo: ejemplo.titulo }
    if (await OfertaEmpleo.exists(existente)) {
      if (fechaLimite) await OfertaEmpleo.updateOne(existente, { fechaLimite })
      continue
    }

    await OfertaEmpleo.create({
      ofertanteId: ofertante._id,
      titulo: ejemplo.titulo,
      descripcion: ejemplo.descripcion,
      categoriaIds: categorias
        .filter((categoria) => slugs.includes(categoria.slug))
        .map((categoria) => categoria._id),
      tipoContrato: ejemplo.tipoContrato,
      jornada: ejemplo.jornada,
      modalidad: ejemplo.modalidad,
      ...('isla' in ejemplo && { ubicacion: { isla: ejemplo.isla, municipio: ejemplo.municipio } }),
      salario: 'salario' in ejemplo ? ejemplo.salario : undefined,
      requisitos: 'requisitos' in ejemplo ? ejemplo.requisitos : undefined,
      vacantes: ejemplo.vacantes,
      fechaLimite,
      textoBusqueda: construirTextoBusqueda([
        ejemplo.titulo,
        ejemplo.descripcion,
        ofertante.nombre,
        'municipio' in ejemplo ? ejemplo.municipio : undefined
      ]),
      estado: 'publicada',
      fechaPublicacion: new Date()
    })
  }
}

async function seed(): Promise<void> {
  await connectDB()
  await prepararBaseDeDatos()
  const password = await bcrypt.hash(PASSWORD_EJEMPLO, 10)

  // upsert por email: ejecutar el seed varias veces no duplica usuarios
  for (const ejemplo of EJEMPLOS) {
    await User.updateOne(
      { email: ejemplo.email },
      { $setOnInsert: { ...ejemplo, password } },
      { upsert: true }
    )
  }

  // Solo a quien aun no tiene intereses: no pisa los que se hayan cambiado desde el perfil
  const categorias = await Categoria.find()
  for (const { email, isla, intereses } of PERFILES_VOLUNTARIOS) {
    await User.updateOne(
      {
        email,
        $or: [{ 'voluntario.interesIds': { $exists: false } }, { 'voluntario.interesIds': { $size: 0 } }]
      },
      {
        isla,
        'voluntario.interesIds': categorias
          .filter((categoria) => intereses.includes(categoria.slug))
          .map((categoria) => categoria._id)
      }
    )
  }

  await seedOfertas()
  await seedEmpleos()

  console.log(`Usuarios en la coleccion: ${await User.countDocuments()}`)
  console.log(`Categorias en la coleccion: ${await Categoria.countDocuments()}`)
  console.log(`Ofertas en la coleccion: ${await Oferta.countDocuments()}`)
  console.log(`Imagenes en la coleccion: ${await Imagen.countDocuments()}`)
  console.log(`Ofertas de empleo en la coleccion: ${await OfertaEmpleo.countDocuments()}`)
}

seed()
  .catch((error) => {
    console.error('Error en el seed:', error.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
