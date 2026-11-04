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
import { User } from '../models/User.js'
import { Categoria } from '../models/Categoria.js'
import { Oferta, construirTextoBusqueda } from '../models/Oferta.js'

dotenv.config()

const EJEMPLOS = [
  { nombre: 'Laura Perez', email: 'laura@ejemplo.com', rol: 'voluntario' },
  { nombre: 'Carlos Diaz', email: 'carlos@ejemplo.com', rol: 'voluntario' },
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
    fecha: '2026-11-14',
    horaInicio: '10:00',
    horaFin: '13:00',
    plazas: 8,
    imagen: '/fotos/imagen_personamayor.jpg'
  },
  {
    email: 'marycomunidad@ejemplo.com',
    titulo: 'Limpieza y cuidado de la costa',
    descripcion: 'Recogida de residuos y cuidado del litoral junto a vecinos de la zona.',
    categorias: ['medio-ambiente'],
    isla: 'gran_canaria',
    municipio: 'Las Palmas de Gran Canaria',
    fecha: '2026-11-15',
    horaInicio: '09:00',
    horaFin: '12:00',
    plazas: 15,
    imagen: '/fotos/limpieza_costa.jpg'
  },
  {
    email: 'redparticipa@ejemplo.com',
    titulo: 'Taller de apoyo comunitario',
    descripcion: 'Ayuda a organizar un taller para reforzar las redes de apoyo del barrio.',
    categorias: ['comunidad'],
    isla: 'tenerife',
    municipio: 'La Laguna',
    fecha: '2026-11-18',
    horaInicio: '16:00',
    horaFin: '19:00',
    plazas: 5,
    imagen: '/fotos/voluntariado-2.png'
  },
  {
    email: 'islasverdes@ejemplo.com',
    titulo: 'Reforestación de espacios naturales',
    descripcion: 'Plantación de especies autóctonas para recuperar espacios naturales.',
    categorias: ['medio-ambiente'],
    isla: 'tenerife',
    municipio: 'La Laguna',
    fecha: '2026-11-19',
    horaInicio: '15:30',
    horaFin: '18:30',
    plazas: 12,
    imagen: '/fotos/reforestacion.jpg'
  },
  {
    email: 'crecerjuntos@ejemplo.com',
    titulo: 'Apoyo escolar para jóvenes',
    descripcion: 'Acompaña a jóvenes en sus tareas escolares y técnicas de estudio.',
    categorias: ['educacion'],
    isla: 'tenerife',
    municipio: 'Santa Cruz de Tenerife',
    fecha: '2026-11-20',
    horaInicio: '17:00',
    horaFin: '19:00',
    plazas: 6,
    imagen: '/fotos/apoyo_escolar.jpeg'
  },
  {
    email: 'bancocanario@ejemplo.com',
    titulo: 'Recogida de alimentos solidaria',
    descripcion: 'Colabora en la recogida y clasificación de alimentos para familias.',
    categorias: ['alimentacion', 'comunidad'],
    isla: 'gran_canaria',
    municipio: 'Las Palmas de Gran Canaria',
    fecha: '2026-11-21',
    horaInicio: '09:30',
    horaFin: '13:30',
    plazas: 20,
    imagen: '/fotos/recogida_alimentos.png'
  }
] as const

// Contrasena comun para todos los usuarios de ejemplo (solo desarrollo)
const PASSWORD_EJEMPLO = 'Ejemplo123'

async function seedOfertas(): Promise<void> {
  const categorias = await Categoria.find()

  for (const ejemplo of OFERTAS) {
    const slugs: readonly string[] = ejemplo.categorias
    const ofertante = await User.findOne({ email: ejemplo.email }).orFail()

    // Ejecutar el seed varias veces no duplica ofertas
    if (await Oferta.exists({ ofertanteId: ofertante._id, titulo: ejemplo.titulo })) {
      continue
    }

    await Oferta.create({
      ofertanteId: ofertante._id,
      titulo: ejemplo.titulo,
      descripcion: ejemplo.descripcion,
      categoriaIds: categorias
        .filter((categoria) => slugs.includes(categoria.slug))
        .map((categoria) => categoria._id),
      modalidad: 'presencial',
      tipoDuracion: 'jornada',
      ubicacion: { isla: ejemplo.isla, municipio: ejemplo.municipio },
      imagenes: [ejemplo.imagen],
      turnos: [
        {
          fecha: new Date(`${ejemplo.fecha}T00:00:00.000Z`),
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
        ejemplo.municipio
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

  await seedOfertas()

  console.log(`Usuarios en la coleccion: ${await User.countDocuments()}`)
  console.log(`Categorias en la coleccion: ${await Categoria.countDocuments()}`)
  console.log(`Ofertas en la coleccion: ${await Oferta.countDocuments()}`)
}

seed()
  .catch((error) => {
    console.error('Error en el seed:', error.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
