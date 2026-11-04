/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de categorias.
 */

import { Router } from 'express'
import { getCategorias } from '../controllers/categoriaController.js'

const router = Router()

router.get('/', getCategorias)

export default router
