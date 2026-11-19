/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla de registro donde el usuario crea su cuenta introduciendo sus datos.
 */
import { useState, type FormEvent } from 'react'
import './Login.css'
import './Register.css'
import type { Usuario } from './Login.tsx'

type RegisterProps = {
  onRegistro: (usuario: Usuario) => void
  onVolver: () => void
  onIrALogin?: () => void
}

const PASSWORD_MIN = 8

const ROLES: { valor: Usuario['rol']; titulo: string; texto: string }[] = [
  { valor: 'voluntario', titulo: 'Voluntario', texto: 'Quiero colaborar en tareas solidarias.' },
  { valor: 'ofertante', titulo: 'Ofertante', texto: 'Publico tareas y busco voluntarios.' },
]

function Register({ onRegistro, onVolver, onIrALogin }: RegisterProps) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [rol, setRol] = useState<Usuario['rol']>('voluntario')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Validaciones basicas antes de llamar a la API (el servidor vuelve a validar)
    if (password.length < PASSWORD_MIN) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
      return
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password, rol }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'No se pudo crear la cuenta')
        return
      }

      // Tras registrarse el usuario queda con la sesion iniciada
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.user))
      onRegistro(data.user)
    } catch {
      setError('No se pudo conectar con el servidor')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login">
      <header className="nav">
        <button type="button" className="brand brand-btn" onClick={onVolver}>
          <img
            src="/fotos/Logo_Canarias_Conecta_Sinfondo.png"
            alt="Logo de Canarias Conecta"
          />
          <span className="logo">Canarias Conecta</span>
        </button>
      </header>

      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h1>Crear cuenta</h1>
          <p className="login-subtitulo">Regístrate para empezar a participar.</p>

          <fieldset className="registro-roles">
            <legend>¿Cómo quieres participar?</legend>
            {ROLES.map((opcion) => (
              <label
                key={opcion.valor}
                className={rol === opcion.valor ? 'registro-rol registro-rol-activo' : 'registro-rol'}
              >
                <input
                  type="radio"
                  name="rol"
                  value={opcion.valor}
                  checked={rol === opcion.valor}
                  onChange={() => setRol(opcion.valor)}
                />
                <span className="registro-rol-titulo">{opcion.titulo}</span>
                <span className="registro-rol-texto">{opcion.texto}</span>
              </label>
            ))}
          </fieldset>

          <label className="campo">
            <span>{rol === 'ofertante' ? 'Nombre de la entidad' : 'Nombre completo'}</span>
            <input
              type="text"
              autoComplete={rol === 'ofertante' ? 'organization' : 'name'}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </label>

          <label className="campo">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </label>

          <label className="campo">
            <span>Contraseña</span>
            <div className="campo-password">
              <input
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={PASSWORD_MIN}
                required
              />
              <button
                type="button"
                className="ver-password"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verPassword}
              >
                {verPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <small className="campo-ayuda">Mínimo {PASSWORD_MIN} caracteres.</small>
          </label>

          <label className="campo">
            <span>Repetir contraseña</span>
            <input
              type={verPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn login-submit"
            disabled={cargando || !nombre || !email || !password || !confirmarPassword}
          >
            {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <div className="login-enlaces">
            <button type="button" className="login-enlace" onClick={onIrALogin}>
              ¿Ya tienes cuenta? Inicia sesión
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default Register
