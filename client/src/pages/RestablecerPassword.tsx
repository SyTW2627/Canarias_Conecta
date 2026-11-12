/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla a la que lleva el enlace del correo para elegir una contrasena nueva.
 */
import { useState, type FormEvent } from 'react'
import './Login.css'

const PASSWORD_MIN = 8

type RestablecerPasswordProps = {
  token: string | null
  onVolver: () => void
  onIrALogin: () => void
  onRecuperarPassword: () => void
  // Las sesiones anteriores dejan de valer al cambiar la contrasena
  onPasswordCambiada: () => void
}

function RestablecerPassword({
  token,
  onVolver,
  onIrALogin,
  onRecuperarPassword,
  onPasswordCambiada,
}: RestablecerPasswordProps) {
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < PASSWORD_MIN) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
      return
    }
    if (password !== repetida) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)
    try {
      const res = await fetch('/api/auth/restablecer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'No se pudo cambiar la contraseña')
        return
      }

      setHecho(data.message)
      onPasswordCambiada()
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
          <h1>Nueva contraseña</h1>

          {!token ? (
            <p className="login-error" role="alert">
              El enlace no es válido. Pide uno nuevo desde la pantalla de recuperación.
            </p>
          ) : hecho ? (
            <p className="login-exito" role="status">{hecho}</p>
          ) : (
            <>
              <p className="login-subtitulo">Elige una contraseña nueva para tu cuenta.</p>

              <label className="campo">
                <span>Contraseña nueva</span>
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
              </label>
              <p className="login-ayuda">Al menos {PASSWORD_MIN} caracteres.</p>

              <label className="campo">
                <span>Repite la contraseña</span>
                <input
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
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
                disabled={cargando || !password || !repetida}
              >
                {cargando ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </>
          )}

          <div className="login-enlaces">
            <button type="button" className="login-enlace" onClick={onIrALogin}>
              {hecho ? 'Iniciar sesión' : 'Volver a iniciar sesión'}
            </button>
            {!hecho && (
              <button type="button" className="login-enlace" onClick={onRecuperarPassword}>
                Pedir otro enlace
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}

export default RestablecerPassword
