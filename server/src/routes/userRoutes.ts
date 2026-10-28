/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de usuarios.
 */

import { Router } from 'express'
import { getUsers } from '../controllers/userController.js'

const router = Router()

router.get('/', getUsers)

export default router
