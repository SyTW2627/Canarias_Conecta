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
  getOferta,
  getRecomendaciones
} from '../controllers/ofertaController.js'
import {
  getVoluntariosRecomendados,
  invitarVoluntario
} from '../controllers/voluntariosRecomendadosController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'
import { recibirImagen } from '../middleware/subidaImagen.js'

const router = Router()

router.get('/', buscarOfertas)
// La imagen se recibe despues de comprobar la sesion, para no leer ficheros de cualquiera
router.post('/', requireAuth, requireRol('ofertante'), recibirImagen, crearOferta)
// Van antes de /:id para que "recomendadas" y "mias" no se lean como el id de una oferta
router.get('/recomendadas', requireAuth, requireRol('voluntario'), getRecomendaciones)
router.get('/mias',requireAuth, requireRol('ofertante'), getMisOfertas)
router.get('/mias/:id', requireAuth, requireRol('ofertante'), getMiOferta)
// La entidad ve los voluntarios mas compatibles con su oferta y puede invitarles
router.get(
  '/mias/:id/voluntarios-recomendados',
  requireAuth,
  requireRol('ofertante'),
  getVoluntariosRecomendados
)
router.post('/mias/:id/invitaciones', requireAuth, requireRol('ofertante'), invitarVoluntario)
router.get('/:id', getOferta)
router.patch('/:id/cerrar', requireAuth, requireRol('ofertante'), cerrarOferta)
router.put('/:id', requireAuth, requireRol('ofertante'), recibirImagen, editarOferta)
router.delete('/:id', requireAuth, requireRol('ofertante'), eliminarOferta)

export default router
