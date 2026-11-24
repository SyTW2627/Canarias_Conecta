/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define los endpoints de la API de ofertas de empleo y candidaturas.
 */

import { Router } from 'express'
import {
  buscarEmpleos,
  cerrarEmpleo,
  crearCandidatura,
  crearEmpleo,
  getCandidaturasEmpleo,
  getEmpleo,
  getMisCandidaturas,
  getMisEmpleos,
  resolverCandidatura,
  retirarCandidatura
} from '../controllers/empleoController.js'
import { requireAuth, requireRol } from '../middleware/auth.js'

const router = Router()

router.get('/', buscarEmpleos)
router.post('/', requireAuth, requireRol('ofertante'), crearEmpleo)
// Van antes de /:id para que "mias" y "candidaturas" no se lean como el id de una oferta
router.get('/mias', requireAuth, requireRol('ofertante'), getMisEmpleos)
router.get('/candidaturas/mias', requireAuth, requireRol('voluntario'), getMisCandidaturas)
router.patch('/candidaturas/:id/retirar', requireAuth, requireRol('voluntario'), retirarCandidatura)
router.patch('/candidaturas/:id', requireAuth, requireRol('ofertante'), resolverCandidatura)
router.get('/:id', getEmpleo)
router.patch('/:id/cerrar', requireAuth, requireRol('ofertante'), cerrarEmpleo)
router.post('/:id/candidaturas', requireAuth, requireRol('voluntario'), crearCandidatura)
router.get('/:id/candidaturas', requireAuth, requireRol('ofertante'), getCandidaturasEmpleo)

export default router
