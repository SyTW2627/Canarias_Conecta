/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de autenticacion.
 */

import { Router } from 'express'
import {
  actualizarPerfil,
  getPerfil,
  login,
  register,
  restablecerPassword,
  solicitarRecuperacion
} from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { recibirImagen } from '../middleware/subidaImagen.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/recuperar-password', solicitarRecuperacion)
router.post('/restablecer-password', restablecerPassword)
router.patch('/me', requireAuth, recibirImagen, actualizarPerfil)
router.get('/me', requireAuth, getPerfil)

export default router
