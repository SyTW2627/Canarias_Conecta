import { Router } from 'express'
import { getMisInscripciones } from '../controllers/inscripcionController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

router.get('/mias', requireAuth, requireRol('voluntario'), getMisInscripciones)

export default router
