import { Router } from 'express'
import {
  aceptarInscripcion,
  crearInscripcion,
  getCandidatosOferta,
  getMisInscripciones,
  rechazarInscripcion,
} from '../controllers/inscripcionController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

router.post('/', requireAuth, requireRol('voluntario'), crearInscripcion)
router.get('/mias', requireAuth, requireRol('voluntario'), getMisInscripciones)
// El ofertante revisa los candidatos de sus ofertas y decide sobre cada solicitud
router.get('/oferta/:ofertaId', requireAuth, requireRol('ofertante'), getCandidatosOferta)
router.patch('/:id/aceptar', requireAuth, requireRol('ofertante'), aceptarInscripcion)
router.patch('/:id/rechazar', requireAuth, requireRol('ofertante'), rechazarInscripcion)

export default router
