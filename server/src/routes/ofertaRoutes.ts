/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de ofertas.
 */

import { Router } from 'express'
import { buscarOfertas, crearOferta, getOferta } from '../controllers/ofertaController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

router.get('/', buscarOfertas)
router.post('/', requireAuth, requireRol('ofertante'), crearOferta)
router.get('/:id', getOferta)

export default router
