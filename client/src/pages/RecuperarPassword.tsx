/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Pantalla donde el usuario pide un enlace para restablecer su contrasena.
 */
import { useState, type FormEvent } from 'react'
import './Login.css'

type RecuperarPasswordProps = {
  onVolver: () => void
  onIrALogin: () => void
}

function RecuperarPassword({ onVolver, onIrALogin }: RecuperarPasswordProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)

    try {
      const res = await fetch('/api/auth/recuperar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'No se pudo enviar el correo')
        return
      }

      setEnviado(data.message)
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
          <h1>Recuperar contraseña</h1>
          <p className="login-subtitulo">
            Escribe el email de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
          </p>

          {enviado ? (
            <p className="login-exito" role="status">
              {enviado} Revisa también la carpeta de spam. El enlace caduca en 1 hora.
            </p>
          ) : (
            <>
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

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="btn login-submit" disabled={cargando || !email}>
                {cargando ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </>
          )}

          <div className="login-enlaces">
            <button type="button" className="login-enlace" onClick={onIrALogin}>
              Volver a iniciar sesión
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default RecuperarPassword
