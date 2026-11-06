/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de autenticacion.
 */

import { Router } from 'express'
import { actualizarPerfil, getPerfil, login, register } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.patch('/me', requireAuth, actualizarPerfil)
router.get('/me', requireAuth, getPerfil)

export default router
