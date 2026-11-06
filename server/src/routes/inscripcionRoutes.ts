import { Router } from 'express'
import { crearInscripcion, getMisInscripciones } from '../controllers/inscripcionController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

router.post('/', requireAuth, requireRol('voluntario'), crearInscripcion)
router.get('/mias', requireAuth, requireRol('voluntario'), getMisInscripciones)

export default router
