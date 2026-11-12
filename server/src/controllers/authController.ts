/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Gestiona el registro y el inicio de sesion de los usuarios.
 */

import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, ROLES_REGISTRO, TIPOS_ENTIDAD } from '../models/User.js'
import { ISLAS } from '../models/constantes.js'
import { Categoria } from '../models/Categoria.js'
import { isObjectIdOrHexString } from 'mongoose'
import { Token } from '../models/Token.js'
import { enviarCorreo } from '../services/correo.js'

const PASSWORD_MIN = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RECUPERACION_MS = 60 * 60 * 1000
// Tiempo minimo entre dos correos de recuperacion para la misma cuenta
const RECUPERACION_ESPERA_MS = 60 * 1000
const MENSAJE_RECUPERACION =
  'Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer la contraseña.'

function esRolValido(rol: string): rol is (typeof ROLES_REGISTRO)[number] {
  return (ROLES_REGISTRO as readonly string[]).includes(rol)
}

function esValorPermitido<T extends readonly string[]>(valor: string, opciones: T): valor is T[number] {
  return (opciones as readonly string[]).includes(valor)
}

// PATCH /api/auth/me -> actualiza los datos editables del usuario autenticado
export async function actualizarPerfil(req: Request, res: Response): Promise<void> {
  if (!req.usuario) {
    res.status(401).json({ message: 'Debes iniciar sesión' })
    return
  }

  const {
    nombre,
    email,
    passwordActual,
    passwordNueva,
    interesIds,
    telefono,
    isla,
    municipio,
    tipoEntidad,
    descripcion,
    web,
    personaContacto,
    cif,
    direccion,
  } = req.body ?? {}
  if (
    (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim())) ||
    (email !== undefined && (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()))) ||
    (passwordActual !== undefined && typeof passwordActual !== 'string') ||
    (passwordNueva !== undefined && typeof passwordNueva !== 'string')
    || (interesIds !== undefined &&
      (!Array.isArray(interesIds) ||
        interesIds.some((id) => typeof id !== 'string' || !isObjectIdOrHexString(id)))) ||
    (telefono !== undefined && typeof telefono !== 'string') ||
    (isla !== undefined && (typeof isla !== 'string' || !esValorPermitido(isla, ISLAS))) ||
    (municipio !== undefined && (typeof municipio !== 'string' || !municipio.trim())) ||
    (tipoEntidad !== undefined &&
      (typeof tipoEntidad !== 'string' || !esValorPermitido(tipoEntidad, TIPOS_ENTIDAD))) ||
    (descripcion !== undefined && typeof descripcion !== 'string') ||
    (web !== undefined && typeof web !== 'string') ||
    (personaContacto !== undefined && typeof personaContacto !== 'string') ||
    (cif !== undefined && typeof cif !== 'string') ||
    (direccion !== undefined && typeof direccion !== 'string')
  ) {
    res.status(400).json({ message: 'Los datos del perfil no son válidos' })
    return
  }

  if (
    nombre === undefined &&
    email === undefined &&
    passwordNueva === undefined &&
    interesIds === undefined &&
    telefono === undefined &&
    isla === undefined &&
    municipio === undefined &&
    tipoEntidad === undefined &&
    descripcion === undefined &&
    web === undefined &&
    personaContacto === undefined &&
    cif === undefined &&
    direccion === undefined
  ) {
    res.status(400).json({ message: 'No hay cambios que guardar' })
    return
  }

  if (passwordNueva !== undefined && passwordNueva.length < PASSWORD_MIN) {
    res.status(400).json({ message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` })
    return
  }

  try {
    const user = await User.findById(req.usuario.id).select('+password')
    if (!user) {
      res.status(404).json({ message: 'No se encontró el usuario' })
      return
    }

    if (passwordNueva !== undefined) {
      if (!passwordActual || !(await bcrypt.compare(passwordActual, user.password))) {
        res.status(401).json({ message: 'La contraseña actual no es correcta' })
        return
      }
      user.password = await bcrypt.hash(passwordNueva, 10)
    }

    if (nombre !== undefined) user.nombre = nombre.trim()
    if (email !== undefined) user.email = email.trim().toLowerCase()
    if (interesIds !== undefined) {
      const idsUnicos = [...new Set(interesIds)]
      const categorias = await Categoria.find({ _id: { $in: idsUnicos }, activa: true }).select('_id')
      if (categorias.length !== idsUnicos.length) {
        res.status(400).json({ message: 'Algún interés seleccionado no es válido' })
        return
      }
      user.set('voluntario.interesIds', idsUnicos)
    }
    if (req.usuario.rol === 'ofertante') {
      if (telefono !== undefined) user.telefono = telefono.trim() || undefined
      if (isla !== undefined) user.isla = isla || undefined
      if (municipio !== undefined) user.municipio = municipio.trim()
      if (tipoEntidad !== undefined) user.set('ofertante.tipoEntidad', tipoEntidad)
      if (descripcion !== undefined) user.set('ofertante.descripcion', descripcion.trim() || undefined)
      if (web !== undefined) user.set('ofertante.web', web.trim() || undefined)
      if (personaContacto !== undefined) {
        user.set('ofertante.personaContacto', personaContacto.trim() || undefined)
      }
      if (cif !== undefined) user.set('ofertante.cif', cif.trim() || undefined)
      if (direccion !== undefined) user.set('ofertante.direccion', direccion.trim() || undefined)
    }
    await user.save()

    res.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        interesIds: user.voluntario?.interesIds?.map((id) => id.toString()) ?? [],
        telefono: user.telefono,
        isla: user.isla,
        municipio: user.municipio,
        ofertante: user.ofertante
          ? {
              tipoEntidad: user.ofertante.tipoEntidad,
              descripcion: user.ofertante.descripcion,
              web: user.ofertante.web,
              personaContacto: user.ofertante.personaContacto,
              cif: user.ofertante.cif,
              direccion: user.ofertante.direccion,
              verificada: user.ofertante.verificada,
              estadisticas: user.ofertante.estadisticas,
            }
          : undefined,
      },
    })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Ya existe una cuenta con ese email' })
      return
    }

    console.error('Error al actualizar el perfil:', error)
    res.status(500).json({ message: 'No se pudo actualizar el perfil' })
  }

}

// GET /api/auth/me -> datos editables del usuario autenticado
export async function getPerfil(req: Request, res: Response): Promise<void> {
  if (!req.usuario) {
    res.status(401).json({ message: 'Debes iniciar sesión' })
    return
  }

  try {
    const user = await User.findById(req.usuario.id).populate('voluntario.interesIds', 'nombre')
    if (!user) {
      res.status(404).json({ message: 'No se encontró el usuario' })
      return
    }
    const intereses = (user.voluntario?.interesIds ?? []) as unknown as Array<{
      id: string
      nombre: string
    }>
    res.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        intereses: intereses.map((interes) => ({
          id: interes.id,
          nombre: interes.nombre,
        })),
        telefono: user.telefono,
        isla: user.isla,
        municipio: user.municipio,
        ofertante: user.ofertante
          ? {
              tipoEntidad: user.ofertante.tipoEntidad,
              descripcion: user.ofertante.descripcion,
              web: user.ofertante.web,
              personaContacto: user.ofertante.personaContacto,
              cif: user.ofertante.cif,
              direccion: user.ofertante.direccion,
              verificada: user.ofertante.verificada,
              estadisticas: user.ofertante.estadisticas,
            }
          : undefined,
      },
    })
  } catch (error) {
    console.error('Error al obtener el perfil:', error)
    res.status(500).json({ message: 'No se pudo cargar el perfil' })
  }
}

// POST /api/auth/register -> crea el usuario y devuelve { token, user } para entrar directamente
export async function register(req: Request, res: Response): Promise<void> {
  const { nombre, email, password, rol } = req.body ?? {}

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password ||
    typeof rol !== 'string'
  ) {
    res.status(400).json({ message: 'Nombre, email, contraseña y rol son obligatorios' })
    return
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({ message: 'El email no es válido' })
    return
  }

  if (password.length < PASSWORD_MIN) {
    res.status(400).json({ message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` })
    return
  }

  if (!esRolValido(rol)) {
    res.status(400).json({ message: 'El rol no es válido' })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('Falta la variable JWT_SECRET en el archivo .env')
    res.status(500).json({ message: 'Error al registrar el usuario' })
    return
  }

  try {
    const user = await User.create({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      rol
    })

    const token = jwt.sign({ id: user.id, rol: user.rol }, secret, { expiresIn: '1d' })

    res.status(201).json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    })
  } catch (error) {
    // 11000 = indice unico duplicado: ya existe un usuario con ese email
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Ya existe una cuenta con ese email' })
      return
    }
    console.error('Error al registrar el usuario:', error)
    res.status(500).json({ message: 'Error al registrar el usuario' })
  }
}

// POST /api/auth/login -> { token, user } si las credenciales son correctas
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ message: 'El email y la contraseña son obligatorios' })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('Falta la variable JWT_SECRET en el archivo .env')
    res.status(500).json({ message: 'Error al iniciar sesión' })
    return
  }

  try {
    // password tiene select: false en el modelo, hay que pedirlo explicitamente
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')

    // Mismo mensaje si no existe el usuario o falla la contrasena, para no revelar emails
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: 'Email o contraseña incorrectos' })
      return
    }

    const token = jwt.sign({ id: user.id, rol: user.rol }, secret, { expiresIn: '1d' })

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    })
  } catch (error) {
    console.error('Error al iniciar sesión:', error)
    res.status(500).json({ message: 'Error al iniciar sesión' })
  }
}

// Solo se guarda el hash: quien lea la base de datos no puede usar los enlaces pendientes
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// POST /api/auth/recuperar-password -> envia un enlace para elegir una contrasena nueva.
// Responde igual exista o no la cuenta, para no revelar que emails estan registrados
export async function solicitarRecuperacion(req: Request, res: Response): Promise<void> {
  const { email } = req.body ?? {}

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({ message: 'El email no es válido' })
    return
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase(), estado: 'activo' })

    if (user) {
      const ahora = Date.now()
      // Un token que caduca dentro de mas de (1 h - 1 min) se ha pedido hace menos de un minuto
      const reciente = await Token.exists({
        usuarioId: user._id,
        tipo: 'recuperar_password',
        usado: false,
        expiraEn: { $gt: new Date(ahora + RECUPERACION_MS - RECUPERACION_ESPERA_MS) }
      })

      if (!reciente) {
        const token = randomBytes(32).toString('hex')

        // Solo vale el ultimo enlace enviado
        await Token.deleteMany({ usuarioId: user._id, tipo: 'recuperar_password' })
        await Token.create({
          usuarioId: user._id,
          tipo: 'recuperar_password',
          tokenHash: hashToken(token),
          expiraEn: new Date(ahora + RECUPERACION_MS)
        })

        const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')
        const enlace = `${base}/restablecer-password?token=${token}`
        const nombre = escaparHtml(user.nombre)

        await enviarCorreo({
          para: user.email,
          asunto: 'Restablece tu contraseña de Canarias Conecta',
          texto:
            `Hola, ${user.nombre}:\n\n` +
            'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.\n' +
            `Abre este enlace para elegir una nueva (caduca en 1 hora):\n\n${enlace}\n\n` +
            'Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará.',
          html:
            `<p>Hola, ${nombre}:</p>` +
            '<p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>' +
            `<p><a href="${enlace}">Elegir una nueva contraseña</a></p>` +
            '<p>El enlace caduca en 1 hora. Si no lo has pedido tú, ignora este correo: ' +
            'tu contraseña no cambiará.</p>'
        })
      }
    }

    res.json({ message: MENSAJE_RECUPERACION })
  } catch (error) {
    console.error('Error al solicitar la recuperación de contraseña:', error)
    res.status(500).json({ message: 'No se pudo enviar el correo. Inténtalo más tarde' })
  }
}

// POST /api/auth/restablecer-password -> cambia la contrasena con el token del correo
export async function restablecerPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body ?? {}

  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    res.status(400).json({ message: 'El enlace no es válido o ha caducado' })
    return
  }

  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    res.status(400).json({ message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` })
    return
  }

  try {
    // Se marca como usado en la misma operacion: el enlace solo sirve una vez
    const guardado = await Token.findOneAndUpdate(
      {
        tokenHash: hashToken(token),
        tipo: 'recuperar_password',
        usado: false,
        expiraEn: { $gt: new Date() }
      },
      { usado: true }
    )

    if (!guardado) {
      res.status(400).json({ message: 'El enlace no es válido o ha caducado' })
      return
    }

    const user = await User.findOneAndUpdate(
      { _id: guardado.usuarioId, estado: 'activo' },
      { password: await bcrypt.hash(password, 10), passwordCambiadaEn: new Date() }
    )

    if (!user) {
      res.status(400).json({ message: 'El enlace no es válido o ha caducado' })
      return
    }

    await Token.deleteMany({ usuarioId: user._id, tipo: 'recuperar_password' })

    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión con la nueva.' })
  } catch (error) {
    console.error('Error al restablecer la contraseña:', error)
    res.status(500).json({ message: 'No se pudo cambiar la contraseña' })
  }
}
