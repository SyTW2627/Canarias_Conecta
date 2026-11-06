/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de imagenes.
 */

import { Router } from 'express'
import { getImagen } from '../controllers/imagenController.js'

const router = Router()

router.get('/:id', getImagen)

export default router
