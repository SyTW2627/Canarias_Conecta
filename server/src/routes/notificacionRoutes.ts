/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de notificaciones.
 */

import { Router } from 'express'
import {
  getNotificaciones,
  marcarLeida,
  marcarTodasLeidas
} from '../controllers/notificacionController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', getNotificaciones)
// Va antes de /:id/leida para que "leidas" no se lea como un id
router.patch('/leidas', marcarTodasLeidas)
router.patch('/:id/leida', marcarLeida)

export default router
