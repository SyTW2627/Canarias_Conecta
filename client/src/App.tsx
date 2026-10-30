/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el componente raiz de la aplicacion React (pagina Home).
 */
import { useState } from 'react'
import './App.css'
import Login, { type Usuario } from './pages/Login.tsx'
import Register from './pages/Register.tsx'

const PASOS = [
  {
    numero: 1,
    titulo: 'Elige una oferta',
    texto: 'Filtra por disponibilidad, horario e intereses.',
  },
  {
    numero: 2,
    titulo: 'Inscríbete',
    texto: 'El ofertante revisa tu perfil y acepta tu solicitud.',
  },
  {
    numero: 3,
    titulo: 'Construye tu trayectoria',
    texto: 'Cada colaboración queda en tu perfil con su valoración.',
  },
]



// Recupera la sesion guardada al iniciar sesion, si existe
function usuarioGuardado(): Usuario | null {
  try {
    const guardado = localStorage.getItem('usuario')
    return guardado ? (JSON.parse(guardado) as Usuario) : null
  } catch {
    return null
  }
}

function App() {
  const [apiStatus, setApiStatus] = useState<string | null>(null)
  const [pantalla, setPantalla] = useState<'home' | 'login' | 'registro'>('home')
  const [usuario, setUsuario] = useState<Usuario | null>(usuarioGuardado)

  // Se usa tanto al iniciar sesion como al registrarse
  function handleLogin(nuevoUsuario: Usuario) {
    setUsuario(nuevoUsuario)
    setPantalla('home')
  }

  function cerrarSesion() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }


  async function checkApi() {
    setApiStatus('Comprobando...')
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { status: string; message: string } = await res.json()
      setApiStatus(`${data.status}: ${data.message}`)
    } catch (err) {
      setApiStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (pantalla === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onVolver={() => setPantalla('home')}
        onRegistro={() => setPantalla('registro')}
      />
    )
  }

  if (pantalla === 'registro') {
    return (
      <Register
        onRegistro={handleLogin}
        onVolver={() => setPantalla('home')}
        onIrALogin={() => setPantalla('login')}
      />
    )
  }

  return (
    <div className="home">
      <header className="nav">
        <span className="logo">Canarias Conecta</span>

        {usuario ? (
          <>
            <span>Hola, {usuario.nombre}</span>
            <button type="button" className="btn btn-outline" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setPantalla('login')
              }}
            >
              Iniciar sesión
            </a>
            <button type="button" className="btn" onClick={() => setPantalla('registro')}>
              Registrarse
            </button>
          </>
        )}
      </header>

      <main>
        <section className="hero">
          <h1>El voluntariado se adapta a tu tiempo, no al revés</h1>
          <p>
            Encuentra tareas solidarias de una jornada o por un periodo corto, y
            decide cuándo, cuánto y en qué participar.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-outline">
              Necesito ayuda
            </button>
          </div>
        </section>

        <section className="steps">
          <h2>Cómo funciona</h2>
          <div className="steps-grid">
            {PASOS.map((paso) => (
              <article key={paso.numero} className="card">
                <span className="tag">{paso.numero}</span>
                <h3>{paso.titulo}</h3>
                <p>{paso.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="info-sections">
          <article className="info-section">
            <img src="/carrusel/imagen_manos.jpg" alt="Personas colaborando" />
            <div>
              <h2>Quiénes somos</h2>
            <p>
              Somos Canarias Conecta, una plataforma que nace para unir personas, compartir ideas y crear oportunidades
              en nuestras islas. Creemos en el poder de la colaboración y en la importancia de construir una comunidad
              en la que todos podamos aportar algo. Queremos conectar a quienes tienen ganas de participar, proponer
              iniciativas y contribuir a construir una Canarias mejor, más unida y participativa.
            </p>
            </div>
          </article>

          <article className="info-section info-section-reverse">
            <img src="/carrusel/imagen_necesitamos.jpg" alt="Voluntariado colaborando" />
            <div>
              <h2>¿Por qué te necesitamos?</h2>
              <p>
                Creemos que el cambio empieza cuando las personas se implican. Tu voz, tus ideas y tus
                experiencias pueden marcar la diferencia y ayudar a mejorar nuestro entorno. Canarias se
                construye entre todos, y queremos que tengas un espacio donde expresarte, compartir tus 
                propuestas y formar parte de las decisiones e iniciativas que contribuyen al bienestar de nuestra comunidad.
              </p>
            </div>
          </article>

          <article className="info-section">
            <img src="/carrusel/image_3.jpg" alt="Pequeñas acciones, grandes cambios" />
            <div>
              <h2>Conecta y transforma</h2>
              <p>
                En Canarias Conecta puedes pasar de tener una idea a formar parte del cambio. 
                Descubre iniciativas, comparte propuestas, conecta con otras personas y colabora
                en proyectos que generen un impacto positivo en nuestras islas. Participa, aporta
                tu granito de arena y comprueba cómo, cuando sumamos esfuerzos, podemos transformar
                pequeñas ideas en grandes oportunidades para todos.
              </p>
            </div>
          </article>
        </section>

      </main>

      <aside className="api-check">
        <button type="button" className="btn btn-outline" onClick={checkApi}>
          Test de API
        </button>
        {apiStatus && <p role="status">{apiStatus}</p>}
      </aside>
    </div>
  )
}

export default App