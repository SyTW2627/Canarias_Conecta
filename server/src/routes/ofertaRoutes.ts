/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de ofertas.
 */

import { Router } from 'express'
import {
  buscarOfertas,
  cerrarOferta,
  crearOferta,
  eliminarOferta,
  getMisOfertas,
  getOferta
} from '../controllers/ofertaController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

router.get('/', buscarOfertas)
router.post('/', requireAuth, requireRol('ofertante'), crearOferta)
// Va antes de /:id para que "mias" no se lea como el id de una oferta
router.get('/mias', requireAuth, requireRol('ofertante'), getMisOfertas)
router.get('/:id', getOferta)
router.patch('/:id/cerrar', requireAuth, requireRol('ofertante'), cerrarOferta)
router.delete('/:id', requireAuth, requireRol('ofertante'), eliminarOferta)

export default router
