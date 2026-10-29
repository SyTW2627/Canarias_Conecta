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

// Imagenes del carrusel. Coloca los archivos en public/carrusel/ y añade aqui
// una entrada por imagen, por ejemplo:
// { src: '/carrusel/foto1.jpg', alt: 'Voluntarios en la playa' },
const IMAGENES: { src: string; alt: string }[] = [
   { src: '/carrusel/image_4.jpg', alt: '1' },
   { src: '/carrusel/image_2.jpg', alt: '2' },
   { src: '/carrusel/image_3.jpg', alt: '3' }
   
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
  const [imagenActual, setImagenActual] = useState(0)
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

  function anteriorImagen() {
    setImagenActual((i) => (i - 1 + IMAGENES.length) % IMAGENES.length)
  }

  function siguienteImagen() {
    setImagenActual((i) => (i + 1) % IMAGENES.length)
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

        <section className="about">
          <h2>Quiénes somos</h2>
          <div className="about-box">
            <p>Somos un grupo de estudiantes con la intención de mejorar 
              la calidad de los servicios de voluntariado.</p>
          </div>
        </section>

        <section className="gallery">
          <h2>Galería</h2>
          {IMAGENES.length === 0 ? (
            <div className="carousel carousel-empty">
              <p>Aún no hay imágenes en el carrusel.</p>
            </div>
          ) : (
            <div className="carousel">
              <img
                className="carousel-img"
                src={IMAGENES[imagenActual].src}
                alt={IMAGENES[imagenActual].alt}
              />
              <button
                type="button"
                className="carousel-btn carousel-prev"
                onClick={anteriorImagen}
                aria-label="Imagen anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="carousel-btn carousel-next"
                onClick={siguienteImagen}
                aria-label="Imagen siguiente"
              >
                ›
              </button>
              <div className="carousel-dots">
                {IMAGENES.map((imagen, i) => (
                  <button
                    key={imagen.src}
                    type="button"
                    className={i === imagenActual ? 'dot dot-active' : 'dot'}
                    onClick={() => setImagenActual(i)}
                    aria-label={`Ir a la imagen ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
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