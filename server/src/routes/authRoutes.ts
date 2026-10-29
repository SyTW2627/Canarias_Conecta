/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de autenticacion.
 */

import { Router } from 'express'
import { login, register } from '../controllers/authController.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)

export default router
