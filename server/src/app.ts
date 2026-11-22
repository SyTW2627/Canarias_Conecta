/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Crea la aplicacion Express con sus rutas. Separada del arranque para poder probarla.
 */

import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { dbStatus } from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import categoriaRoutes from './routes/categoriaRoutes.js'
import ofertaRoutes from './routes/ofertaRoutes.js'
import inscripcionRoutes from './routes/inscripcionRoutes.js'
import imagenRoutes from './routes/imagenRoutes.js'
import notificacionRoutes from './routes/notificacionRoutes.js'
import empleoRoutes from './routes/empleoRoutes.js'
import gamificacionRoutes from './routes/gamificacionRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())

// GET /api/health -> indica si la API y la base de datos estan funcionando
export function estadoApi(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    message: 'Canarias Conecta API funcionando',
    database: dbStatus()
  })
}

app.get('/api/health', estadoApi)

app.use('/api/auth', authRoutes)
app.use('/api/categorias', categoriaRoutes)
app.use('/api/ofertas', ofertaRoutes)
app.use('/api/inscripciones', inscripcionRoutes)
app.use('/api/imagenes', imagenRoutes)
app.use('/api/notificaciones', notificacionRoutes)
app.use('/api/empleo', empleoRoutes)
app.use('/api/gamificacion', gamificacionRoutes)

// Errores que no gestiona ningun controlador, como un JSON mal formado.
// Express necesita los cuatro parametros para reconocerlo como manejador de errores
export function manejarErrores(
  error: { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = error.status ?? 500

  if (status >= 500) {
    console.error('Error no controlado:', error)
    res.status(500).json({ message: 'Error del servidor' })
    return
  }

  res.status(status).json({ message: 'La petición no es válida' })
}

app.use(manejarErrores)

export default app
