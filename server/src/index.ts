/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Conecta con MongoDB y arranca el servidor Express.
 */

import dotenv from 'dotenv'
import app from './app.js'
import { connectDB } from './config/db.js'
import { prepararBaseDeDatos } from './config/catalogo.js'

dotenv.config()

const PORT = Number(process.env.PORT) || 3000

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
