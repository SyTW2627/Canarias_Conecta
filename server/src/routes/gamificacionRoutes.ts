/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la gamificacion: retos y ranking de los voluntarios.
 */

import { Router } from 'express'
import { getMisLogros, getRanking } from '../controllers/gamificacionController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

// Solo voluntarios: los retos son suyos y el ranking muestra a otros voluntarios
router.use(requireAuth, requireRol('voluntario'))
router.get('/logros', getMisLogros)
router.get('/ranking', getRanking)

export default router
