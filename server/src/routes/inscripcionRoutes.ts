import { Router } from 'express'
import {
  aceptarInscripcion,
  completarInscripcion,
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
// Cuando termina la actividad, confirma si el voluntario participo
router.patch('/:id/completar', requireAuth, requireRol('ofertante'), completarInscripcion)

export default router
