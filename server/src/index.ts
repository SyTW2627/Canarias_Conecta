/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Conecta con MongoDB, arranca el servidor Express y expone el endpoint de salud.
 */
// Servidor de prueba

import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB, dbStatus } from './config/db.js'
import { prepararBaseDeDatos } from './config/catalogo.js'
import authRoutes from './routes/authRoutes.js'
import categoriaRoutes from './routes/categoriaRoutes.js'
import ofertaRoutes from './routes/ofertaRoutes.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Canarias Conecta API funcionando',
    database: dbStatus()
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/categorias', categoriaRoutes)
app.use('/api/ofertas', ofertaRoutes)

// Errores que no gestiona ningun controlador, como un JSON mal formado.
// Express necesita los cuatro parametros para reconocerlo como manejador de errores
app.use((error: { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = error.status ?? 500

  if (status >= 500) {
    console.error('Error no controlado:', error)
    res.status(500).json({ message: 'Error del servidor' })
    return
  }

  res.status(status).json({ message: 'La petición no es válida' })
})

// El servidor solo arranca si la conexion con la base de datos es correcta
connectDB()
  .then(prepararBaseDeDatos)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor ejecutándose en http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Error al conectar con MongoDB:', error.message)
    process.exit(1)
  })

