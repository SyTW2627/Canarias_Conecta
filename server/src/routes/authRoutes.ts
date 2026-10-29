/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de autenticacion.
 */

import { Router } from 'express'
import { login } from '../controllers/authController.js'

const router = Router()

router.post('/login', login)

export default router
