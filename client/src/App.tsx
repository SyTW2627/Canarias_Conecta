/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el componente raiz de la aplicacion React (pagina Home).
 */
import { useState } from 'react'
import './App.css'
import Login, { type Usuario } from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import HomePage from './pages/HomePage.tsx'

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

const EXPERIENCIAS = [
  {
    imagen: '/fotos/voluntariado-1.png',
    texto: 'Ayuda en tu comunidad',
  },
  {
    imagen: '/fotos/voluntariado-2.png',
    texto: 'Comparte tu tiempo',
  },
  {
    imagen: '/fotos/voluntariado-3.png',
    texto: 'Cada acción cuenta',
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
  const [usuario, setUsuario] = useState<Usuario | null>(usuarioGuardado)
  const [pantalla, setPantalla] = useState<'publica' | 'login' | 'registro' | 'autenticada'>(
    usuario ? 'autenticada' : 'publica',
  )
  const [experienciaActual, setExperienciaActual] = useState(0)

  // Se usa tanto al iniciar sesion como al registrarse
  function handleLogin(nuevoUsuario: Usuario) {
    setUsuario(nuevoUsuario)
    setPantalla('autenticada')
  }

  function cerrarSesion() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
    setPantalla('publica')
  }

  function experienciaAnterior() {
    setExperienciaActual(
    (indice) => (indice - 1 + EXPERIENCIAS.length) % EXPERIENCIAS.length,
    )
  }

  function experienciaSiguiente() {
    setExperienciaActual(
      (indice) => (indice + 1) % EXPERIENCIAS.length,
    )
  }


  if (pantalla === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onVolver={() => setPantalla('publica')}
        onRegistro={() => setPantalla('registro')}
      />
    )
  }

  if (pantalla === 'registro') {
    return (
      <Register
        onRegistro={handleLogin}
        onVolver={() => setPantalla('publica')}
        onIrALogin={() => setPantalla('login')}
      />
    )
  }

  if (pantalla === 'autenticada' && usuario) {
    return <HomePage usuario={usuario} onCerrarSesion={cerrarSesion} />
  }

  return (
    <div className="home">
      <header className="nav">
        <div className="brand">
          <img
            src="/fotos/Logo_Canarias_Conecta_Sinfondo.png"
            alt="Logo de Canarias Conecta"
          />
          <span className="logo">Canarias Conecta</span>
        </div>

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
          <h2 className="section-title">Cómo funciona</h2>
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
            <img src="/fotos/imagen_manos.jpg" alt="Personas colaborando" />
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
            <img src="/fotos/imagen_necesitamos.jpg" alt="Voluntariado colaborando" />
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
            <img src="/fotos/imagen_personamayor.jpg" alt="Pequeñas acciones, grandes cambios" />
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

        <section className="experiencias">
          <h2 className="section-title">Experiencias de voluntariado</h2>

          <div className="experiencias-carrusel">
            <img
              src={EXPERIENCIAS[experienciaActual].imagen}
              alt={EXPERIENCIAS[experienciaActual].texto}
            />

          <div className="experiencias-texto">
            <p>{EXPERIENCIAS[experienciaActual].texto}</p>
          </div>

          <button
            type="button"
            className="experiencias-btn experiencias-prev"
            onClick={experienciaAnterior}
            aria-label="Experiencia anterior"
          >
            ‹
          </button>

          <button
            type="button"
            className="experiencias-btn experiencias-next"
            onClick={experienciaSiguiente}
            aria-label="Experiencia siguiente"
          >
            ›
          </button>
        </div>

        <div className="experiencias-puntos">
          {EXPERIENCIAS.map((experiencia, indice) => (
            <button
              key={experiencia.imagen}
              type="button"
              className={indice === experienciaActual ? 'punto activo' : 'punto'}
              onClick={() => setExperienciaActual(indice)}
              aria-label={`Ver experiencia ${indice + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="estadisticas">
        <h2 className="section-title">Juntos hacemos la diferencia</h2>

        <article>
          <strong>250+</strong>
          <span>Voluntarios</span>
        </article>

        <article>
          <strong>40+</strong>
          <span>Organizaciones</span>
        </article>

        <article>
          <strong>120+</strong>
          <span>Oportunidades</span>
        </article>
      </section>

      </main>

      <section className="testimonios">
        <h2 className="section-title">Opiniones de nuestros voluntarios</h2>

        <div className="testimonios-grid">
          <article>
            <p>
              “Encontré una forma sencilla de colaborar sin tener que comprometer
              todo mi tiempo.”
            </p>
            <strong>— Laura, voluntaria</strong>
          </article>

          <article>
            <p>
              “Canarias Conecta nos ayudó a encontrar personas con ganas de
              participar en nuestros proyectos.”
            </p>
            <strong>— Asociación Horizonte</strong>
          </article>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <img
            src="/fotos/Logo_Canarias_Conecta_Sinfondo.png"
            alt="Logo de Canarias Conecta"
          />
          <p>Conectando personas con oportunidades para ayudar.</p>
        </div>

        <div className="footer-links">
          <div>
            <h3>Información</h3>
              <a href="/politica-privacidad">Política de privacidad</a>
              <a href="/terminos-condiciones">Términos y condiciones</a>
              <a href="/contacto">Contacto</a>
          </div>

          <div>
            <h3>Síguenos</h3>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
                Facebook
              </a>
              <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
