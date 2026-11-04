/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de ofertas.
 */

import { Router } from 'express'
import { buscarOfertas, getOferta } from '../controllers/ofertaController.js'

const router = Router()

router.get('/', buscarOfertas)
router.get('/:id', getOferta)

export default router
