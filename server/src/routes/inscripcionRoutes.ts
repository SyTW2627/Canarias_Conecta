import { Router } from 'express'
import {
  aceptarInscripcion,
  cancelarInscripcion,
  completarInscripcion,
  crearInscripcion,
  getCandidatosOferta,
  getMisInscripciones,
  rechazarInscripcion,
  valorarVoluntario,
} from '../controllers/inscripcionController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

router.post('/', requireAuth, requireRol('voluntario'), crearInscripcion)
router.get('/mias', requireAuth, requireRol('voluntario'), getMisInscripciones)
router.patch('/:id/cancelar', requireAuth, requireRol('voluntario'), cancelarInscripcion)
// El ofertante revisa los candidatos de sus ofertas y decide sobre cada solicitud
router.get('/oferta/:ofertaId', requireAuth, requireRol('ofertante'), getCandidatosOferta)
router.patch('/:id/aceptar', requireAuth, requireRol('ofertante'), aceptarInscripcion)
router.patch('/:id/rechazar', requireAuth, requireRol('ofertante'), rechazarInscripcion)
// Cuando termina la actividad, confirma si el voluntario participo
router.patch('/:id/completar', requireAuth, requireRol('ofertante'), completarInscripcion)
router.patch('/:id/valorar', requireAuth, requireRol('ofertante'), valorarVoluntario)

export default router
