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
  editarOferta,
  eliminarOferta,
  getMiOferta,
  getMisOfertas,
  getOferta
} from '../controllers/ofertaController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'
import { recibirImagen } from '../middleware/subidaImagen.js'

const router = Router()

router.get('/', buscarOfertas)
// La imagen se recibe despues de comprobar la sesion, para no leer ficheros de cualquiera
router.post('/', requireAuth, requireRol('ofertante'), recibirImagen, crearOferta)
// Va antes de /:id para que "mias" no se lea como el id de una oferta
router.get('/mias', requireAuth, requireRol('ofertante'), getMisOfertas)
router.get('/mias/:id', requireAuth, requireRol('ofertante'), getMiOferta)
router.get('/:id', getOferta)
router.patch('/:id/cerrar', requireAuth, requireRol('ofertante'), cerrarOferta)
router.put('/:id', requireAuth, requireRol('ofertante'), recibirImagen, editarOferta)
router.delete('/:id', requireAuth, requireRol('ofertante'), eliminarOferta)

export default router
