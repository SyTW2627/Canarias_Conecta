/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Define el componente raiz de la aplicacion React (pagina Home).
 */
import { useEffect, useState } from 'react'
import './App.css'
import Login, { type Usuario } from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import RecuperarPassword from './pages/RecuperarPassword.tsx'
import RestablecerPassword from './pages/RestablecerPassword.tsx'
import HomePage from './pages/HomePage.tsx'
import OfertaDetalle from './pages/OfertaDetalle.tsx'
import GestionarOfertas from './pages/GestionarOfertas.tsx'
import VolunteerProfile from './pages/VolunteerProfile.tsx'
import OrganizationProfile from './pages/OrganizationProfile.tsx'
import Oportunidades from './pages/Oportunidades.tsx'
import MisInscripciones from './pages/MisInscripciones.tsx'
import EditarOferta from './pages/EditarOferta.tsx'
import PublicarOferta from './pages/PublicarOferta.tsx'
import Candidatos from './pages/Candidatos.tsx'

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

// Cada pantalla tiene su URL para que funcionen recargar y el boton atras
type Ruta =
  | { pagina: 'inicio' }
  | { pagina: 'oportunidades' }
  | { pagina: 'oferta'; id: string }
  | { pagina: 'gestion' }
  | { pagina: 'nuevaOferta' }
  | { pagina: 'editarOferta'; id: string }
  | { pagina: 'candidatos'; id: string }
  | { pagina: 'inscripciones' }
  | { pagina: 'perfil' }
  | { pagina: 'restablecer' }

function rutaDe(pathname: string): Ruta {
  const id = pathname.match(/^\/ofertas\/([^/]+)\/?$/)?.[1]
  if (id) return { pagina: 'oferta', id }
  const idEditar = pathname.match(/^\/gestionar-ofertas\/([^/]+)\/editar\/?$/)?.[1]
  if (idEditar) return { pagina: 'editarOferta', id: idEditar }
  const idCandidatos = pathname.match(/^\/gestionar-ofertas\/([^/]+)\/candidatos\/?$/)?.[1]
  if (idCandidatos) return { pagina: 'candidatos', id: idCandidatos }
  if (/^\/gestionar-ofertas\/?$/.test(pathname)) return { pagina: 'gestion' }
  if (/^\/gestionar-ofertas\/nueva\/?$/.test(pathname)) return { pagina: 'nuevaOferta' }
  if (/^\/oportunidades\/?$/.test(pathname)) return { pagina: 'oportunidades' }
  if (/^\/mis_inscripciones\/?$/.test(pathname)) return { pagina: 'inscripciones' }
  if (/^\/perfil\/?$/.test(pathname)) return { pagina: 'perfil' }
  if (/^\/restablecer-password\/?$/.test(pathname)) return { pagina: 'restablecer' }
  return { pagina: 'inicio' }
}

function rutaActual(): Ruta {
  return rutaDe(window.location.pathname)
}

function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(usuarioGuardado)
  const [pantalla, setPantalla] = useState<'publica' | 'login' | 'registro' | 'recuperar' | 'autenticada'>(
    usuario ? 'autenticada' : 'publica',
  )
  const [experienciaActual, setExperienciaActual] = useState(0)
  const [mostrarAyuda, setMostrarAyuda] = useState(false)
  const [ruta, setRuta] = useState(rutaActual)

  useEffect(() => {
    const actualizarRuta = () => setRuta(rutaActual())

    // Los enlaces entre pantallas, y los que vuelven al inicio, cambian la URL sin recargar la pagina
    function navegarSinRecargar(evento: MouseEvent) {
      const conModificador =
        evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey
      if (evento.defaultPrevented || evento.button !== 0 || conModificador) return

      const enlace = (evento.target as Element).closest('a')
      if (!enlace || enlace.target || enlace.origin !== window.location.origin) return

      // Un enlace a una seccion de la misma pantalla lo resuelve el navegador
      if (enlace.pathname === window.location.pathname && enlace.hash) return

      const abrePantalla = rutaDe(enlace.pathname).pagina !== 'inicio'
      const vuelveAlInicio = rutaActual().pagina !== 'inicio' && enlace.pathname === '/'
      if (!abrePantalla && !vuelveAlInicio) return

      evento.preventDefault()
      window.history.pushState(null, '', enlace.href)
      actualizarRuta()
    }

    window.addEventListener('popstate', actualizarRuta)
    document.addEventListener('click', navegarSinRecargar)
    return () => {
      window.removeEventListener('popstate', actualizarRuta)
      document.removeEventListener('click', navegarSinRecargar)
    }
  }, [])

  // Al cambiar de pantalla la seccion del enlace aun no existia: hay que desplazarse aqui
  useEffect(() => {
    const seccion = window.location.hash
      ? document.getElementById(window.location.hash.slice(1))
      : null

    if (seccion) {
      seccion.scrollIntoView()
    } else if (ruta.pagina !== 'inicio') {
      window.scrollTo(0, 0)
    }
  }, [ruta])

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

  function actualizarUsuario(nuevoUsuario: Usuario) {
    setUsuario(nuevoUsuario)
    localStorage.setItem('usuario', JSON.stringify(nuevoUsuario))
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


  // Sale de la pantalla del enlace del correo; se quita el token de la URL y del historial
  function salirDeRestablecer(destino: 'publica' | 'login' | 'recuperar') {
    window.history.replaceState(null, '', '/')
    setRuta({ pagina: 'inicio' })
    setPantalla(usuario && destino === 'publica' ? 'autenticada' : destino)
  }

  // El enlace del correo se abre tanto con sesion como sin ella
  if (ruta.pagina === 'restablecer') {
    return (
      <RestablecerPassword
        token={new URLSearchParams(window.location.search).get('token')}
        onVolver={() => salirDeRestablecer('publica')}
        onIrALogin={() => salirDeRestablecer('login')}
        onRecuperarPassword={() => salirDeRestablecer('recuperar')}
        onPasswordCambiada={() => {
          localStorage.removeItem('token')
          localStorage.removeItem('usuario')
          setUsuario(null)
        }}
      />
    )
  }

  if (pantalla === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onVolver={() => setPantalla('publica')}
        onRecuperarPassword={() => setPantalla('recuperar')}
        onRegistro={() => setPantalla('registro')}
      />
    )
  }

  if (pantalla === 'recuperar') {
    return (
      <RecuperarPassword
        onVolver={() => setPantalla('publica')}
        onIrALogin={() => setPantalla('login')}
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
    if (ruta.pagina === 'oferta') {
      return (
        <OfertaDetalle
          key={ruta.id}
          ofertaId={ruta.id}
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
        />
      )
    }

    if (ruta.pagina === 'oportunidades') {
      return <Oportunidades usuario={usuario} onCerrarSesion={cerrarSesion} />
    }

    if (ruta.pagina === 'inscripciones' && usuario.rol === 'voluntario') {
      return <MisInscripciones usuario={usuario} onCerrarSesion={cerrarSesion} />
    }

    // Un voluntario que llegue a /gestionar-ofertas ve el inicio
    if (ruta.pagina === 'gestion' && usuario.rol === 'ofertante') {
      return <GestionarOfertas usuario={usuario} onCerrarSesion={cerrarSesion} />
    }

    if (ruta.pagina === 'nuevaOferta' && usuario.rol === 'ofertante') {
      return <PublicarOferta usuario={usuario} onCerrarSesion={cerrarSesion} />
    }

    if (ruta.pagina === 'editarOferta' && usuario.rol === 'ofertante') {
      return (
        <EditarOferta
          key={ruta.id}
          ofertaId={ruta.id}
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
        />
      )
    }

    if (ruta.pagina === 'candidatos' && usuario.rol === 'ofertante') {
      return (
        <Candidatos
          key={ruta.id}
          ofertaId={ruta.id}
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
        />
      )
    }

    if (ruta.pagina === 'perfil' && usuario.rol === 'voluntario') {
      return (
        <VolunteerProfile
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
          onUsuarioActualizado={actualizarUsuario}
        />
      )
    }

    if (ruta.pagina === 'perfil' && usuario.rol === 'ofertante') {
      return (
        <OrganizationProfile
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
          onUsuarioActualizado={actualizarUsuario}
        />
      )
    }

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
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setMostrarAyuda(true)}
            >
              Necesito ayuda
            </button>
          </div>
          {mostrarAyuda && (
            <aside className="help-banner" role="dialog" aria-labelledby="help-banner-title">
              <button
                type="button"
                className="help-banner-close"
                aria-label="Cerrar ayuda"
                onClick={() => setMostrarAyuda(false)}
              >
                ×
              </button>
              <h2 id="help-banner-title">¿Necesitas ayuda?</h2>
              <p>
                Para solicitar ayuda a través de Canarias Conecta, primero debes crear una
                cuenta o iniciar sesión. Así podremos ponerte en contacto con la organización
                adecuada y mantenerte informado sobre tu solicitud.
              </p>
              <div className="help-banner-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setMostrarAyuda(false)
                    setPantalla('registro')
                  }}
                >
                  Crear una cuenta
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setMostrarAyuda(false)
                    setPantalla('login')
                  }}
                >
                  Iniciar sesión
                </button>
              </div>
            </aside>
          )}
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
