/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla de inicio de sesion donde el usuario introduce sus credenciales.
 */
import { useState, type FormEvent } from 'react'
import './Login.css'

export type Usuario = {
  id: string
  nombre: string
  email: string
  rol: 'voluntario' | 'ofertante'
  interesIds?: string[]
  acreditaciones?: {
    id: string
    nombre: string
    identificador: string | null
    fechaObtencion: string
  }[]
  avatarUrl?: string
}

type LoginProps = {
  onLogin: (usuario: Usuario) => void
  onVolver: () => void
  onRecuperarPassword?: () => void
  onRegistro?: () => void
}

function Login({ onLogin, onVolver, onRecuperarPassword, onRegistro }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'No se pudo iniciar sesión')
        return
      }

      // El token se usara en las peticiones que requieran autenticacion
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.user))
      onLogin(data.user)
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
          <h1>Iniciar sesión</h1>
          <p className="login-subtitulo">Accede con tu email y contraseña.</p>

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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn login-submit"
            disabled={cargando || !email || !password}
          >
            {cargando ? 'Entrando...' : 'Iniciar sesión'}
          </button>

          <div className="login-enlaces">
            <button type="button" className="login-enlace" onClick={onRecuperarPassword}>
              ¿Olvidaste tu contraseña?
            </button>
            <button type="button" className="login-enlace" onClick={onRegistro}>
              Crear una cuenta
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default Login
