/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Conecta con MongoDB, arranca el servidor Express y expone el endpoint de salud.
 */
// Servidor de prueba

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB, dbStatus } from './config/db.js'
import userRoutes from './routes/userRoutes.js'
import authRoutes from './routes/authRoutes.js'

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

app.use('/api/users', userRoutes)
app.use('/api/auth', authRoutes)

// El servidor solo arranca si la conexion con la base de datos es correcta
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor ejecutándose en http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Error al conectar con MongoDB:', error.message)
    process.exit(1)
  })

