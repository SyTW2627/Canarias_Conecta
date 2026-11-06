/**
 * Perfil de una organización ofertante.
 */
import { useEffect, useState, type FormEvent } from 'react'
import './OrganizationProfile.css'
import type { Usuario } from './Login.tsx'
import { ISLAS, type Oferta } from '../ofertas.ts'

type OrganizationProfileProps = {
  usuario: Usuario
  onCerrarSesion: () => void
  onUsuarioActualizado: (usuario: Usuario) => void
}

type PerfilOrganizacion = Usuario & {
  telefono?: string
  municipio?: string
  isla?: string
  ofertante?: {
    tipoEntidad?: string
    descripcion?: string
    web?: string
    personaContacto?: string
    cif?: string
    direccion?: string
    verificada?: boolean
    estadisticas?: {
      ofertasPublicadas?: number
      valoracionMedia?: number
      numValoraciones?: number
    }
  }
}

const TIPOS_ENTIDAD: Record<string, string> = {
  ong: 'ONG',
  asociacion: 'Asociación',
  fundacion: 'Fundación',
  administracion_publica: 'Administración pública',
  empresa: 'Empresa',
  particular: 'Particular',
}

function inicialesDe(nombre: string): string {
  return nombre.trim().slice(0, 2).toUpperCase()
}

function OrganizationProfile({ usuario, onCerrarSesion, onUsuarioActualizado }: OrganizationProfileProps) {
  const [perfil, setPerfil] = useState<PerfilOrganizacion>(usuario)
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [mostrarEditor, setMostrarEditor] = useState(false)
  const [nombre, setNombre] = useState(usuario.nombre)
  const [email, setEmail] = useState(usuario.email)
  const [telefono, setTelefono] = useState('')
  const [isla, setIsla] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [tipoEntidad, setTipoEntidad] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [web, setWeb] = useState('')
  const [personaContacto, setPersonaContacto] = useState('')
  const [cif, setCif] = useState('')
  const [direccion, setDireccion] = useState('')
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [errorEditor, setErrorEditor] = useState<string | null>(null)
  const [guardandoEditor, setGuardandoEditor] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token') ?? ''
    const opciones = { headers: { Authorization: `Bearer ${token}` } }

    Promise.all([
      fetch('/api/auth/me', opciones),
      fetch('/api/ofertas/mias', opciones),
    ])
      .then(async ([perfilRes, ofertasRes]) => {
        const perfilData = await perfilRes.json()
        const ofertasData = await ofertasRes.json()
        if (!perfilRes.ok) throw new Error(perfilData.message ?? 'No se pudo cargar el perfil')
        if (!ofertasRes.ok) throw new Error(ofertasData.message ?? 'No se pudieron cargar las ofertas')
        setPerfil(perfilData.user)
        setOfertas(ofertasData)
        const datosPerfil = perfilData.user
        setNombre(datosPerfil.nombre)
        setEmail(datosPerfil.email)
        setTelefono(datosPerfil.telefono ?? '')
        setIsla(datosPerfil.isla ?? '')
        setMunicipio(datosPerfil.municipio ?? '')
        setTipoEntidad(datosPerfil.ofertante?.tipoEntidad ?? '')
        setDescripcion(datosPerfil.ofertante?.descripcion ?? '')
        setWeb(datosPerfil.ofertante?.web ?? '')
        setPersonaContacto(datosPerfil.ofertante?.personaContacto ?? '')
        setCif(datosPerfil.ofertante?.cif ?? '')
        setDireccion(datosPerfil.ofertante?.direccion ?? '')
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  async function guardarPerfil(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorEditor(null)
    setGuardandoEditor(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
        body: JSON.stringify({
          nombre,
          email,
          telefono,
          isla,
          municipio,
          tipoEntidad,
          descripcion,
          web,
          personaContacto,
          cif,
          direccion,
          ...(passwordNueva && { passwordActual, passwordNueva }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'No se pudo actualizar el perfil')

      const nuevoPerfil = {
        ...perfil,
        ...data.user,
        telefono,
        isla,
        municipio,
        ofertante: {
          ...perfil.ofertante,
          tipoEntidad,
          descripcion,
          web,
          personaContacto,
          cif,
          direccion,
        },
      }
      setPerfil(nuevoPerfil)
      onUsuarioActualizado(data.user)
      setPasswordActual('')
      setPasswordNueva('')
      setMostrarEditor(false)
    } catch (reason) {
      setErrorEditor(reason instanceof Error ? reason.message : 'No se pudo actualizar el perfil')
    } finally {
      setGuardandoEditor(false)
    }
  }

  const datos = perfil.ofertante
  const publicadas = ofertas.filter((oferta) => (oferta as Oferta & { estado?: string }).estado === 'publicada').length
  const activas = ofertas.filter((oferta) => {
    const estado = (oferta as Oferta & { estado?: string }).estado
    return estado === 'publicada' || estado === 'borrador'
  }).length

  return (
    <div className="authenticated-home organization-profile">
      <header className="nav authenticated-nav">
        <a className="brand" href="/">
          <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
          <span className="logo">Canarias Conecta</span>
        </a>
        <nav className="authenticated-links" aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/gestionar-ofertas">Gestionar ofertas</a>
          <a href="/perfil" aria-current="page">Mi perfil</a>
        </nav>
        <div className="authenticated-user">
          <span>Hola, {perfil.nombre}</span>
          <button type="button" className="btn btn-outline" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="organization-profile-main">
        <h1 className="section-title organization-profile-title">Mi perfil</h1>
        {error && <p className="organization-error" role="alert">{error}</p>}

        <div className="organization-profile-grid">
          <section className="organization-card organization-main-card">
            <div className="organization-avatar" aria-hidden="true">{inicialesDe(perfil.nombre)}</div>
            <h2>{perfil.nombre}</h2>
            <p className="organization-type">
              {TIPOS_ENTIDAD[datos?.tipoEntidad ?? ''] ?? 'Organización'}
            </p>
            {datos?.verificada && <span className="organization-verified">Entidad verificada</span>}
            <p className="organization-location">
              {perfil.municipio && perfil.isla
                ? `${perfil.municipio}, ${ISLAS[perfil.isla] ?? perfil.isla}`
                : 'Ubicación no indicada'}
            </p>
            <button type="button" className="btn organization-edit-button" onClick={() => {
              setErrorEditor(null)
              setMostrarEditor(true)
            }}>
              Editar perfil
            </button>
          </section>

          <section className="organization-statistics" aria-label="Resumen de la organización">
            <article><strong>{publicadas}</strong><span>Ofertas publicadas</span></article>
            <article><strong>{activas}</strong><span>Ofertas activas</span></article>
            <article>
              <strong>{datos?.estadisticas?.valoracionMedia ? datos.estadisticas.valoracionMedia.toFixed(1) : '—'}</strong>
              <span>Valoración media</span>
            </article>
          </section>
        </div>

        <div className="organization-details-grid">
          <section className="organization-card">
            <h2>Sobre nuestra organización</h2>
            <p>{datos?.descripcion ?? 'Todavía no has añadido una descripción.'}</p>
          </section>
          <section className="organization-card">
            <h2>Información de contacto</h2>
            <dl className="organization-contact">
              <div><dt>Email</dt><dd>{perfil.email}</dd></div>
              {perfil.telefono && <div><dt>Teléfono</dt><dd>{perfil.telefono}</dd></div>}
              {datos?.personaContacto && <div><dt>Persona de contacto</dt><dd>{datos.personaContacto}</dd></div>}
              {datos?.direccion && <div><dt>Dirección</dt><dd>{datos.direccion}</dd></div>}
              {datos?.cif && <div><dt>CIF</dt><dd>{datos.cif}</dd></div>}
              {datos?.web && <div><dt>Web</dt><dd><a href={datos.web} target="_blank" rel="noreferrer">{datos.web}</a></dd></div>}
            </dl>
          </section>
        </div>

        <section className="organization-card organization-offers">
          <div className="organization-section-heading">
            <h2>Ofertas publicadas</h2>
            <a className="text-link" href="/gestionar-ofertas">Gestionar ofertas</a>
          </div>
          {ofertas.length === 0 ? (
            <p>Aún no has publicado ninguna oferta.</p>
          ) : (
            <div className="organization-offer-list">
              {ofertas.slice(0, 4).map((oferta) => (
                <article key={oferta.id}>
                  <h3>{oferta.titulo}</h3>
                  <span>{oferta.ubicacion?.municipio ?? 'Online'}</span>
                  <span>{(oferta as Oferta & { estado?: string }).estado ?? 'publicada'}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {mostrarEditor && (
        <div className="organization-modal-backdrop" role="presentation">
          <section className="organization-modal" role="dialog" aria-modal="true" aria-labelledby="organization-modal-title">
            <div className="organization-modal-header">
              <h2 id="organization-modal-title">Editar perfil</h2>
              <button type="button" className="organization-modal-close" onClick={() => setMostrarEditor(false)} aria-label="Cerrar">×</button>
            </div>
            <form onSubmit={guardarPerfil}>
              <div className="organization-form-grid">
                <label><span>Nombre</span><input value={nombre} onChange={(event) => setNombre(event.target.value)} required /></label>
                <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                <label><span>Tipo de entidad</span>
                  <select value={tipoEntidad} onChange={(event) => setTipoEntidad(event.target.value)} required>
                    <option value="">Selecciona un tipo</option>
                    {Object.entries(TIPOS_ENTIDAD).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                  </select>
                </label>
                <label><span>Isla</span>
                  <select value={isla} onChange={(event) => setIsla(event.target.value)} required>
                    <option value="">Selecciona una isla</option>
                    {Object.entries(ISLAS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                  </select>
                </label>
                <label><span>Municipio</span><input value={municipio} onChange={(event) => setMunicipio(event.target.value)} required /></label>
                <label><span>Teléfono</span><input value={telefono} onChange={(event) => setTelefono(event.target.value)} /></label>
                <label><span>Persona de contacto</span><input value={personaContacto} onChange={(event) => setPersonaContacto(event.target.value)} /></label>
                <label><span>Página web</span><input type="url" value={web} onChange={(event) => setWeb(event.target.value)} /></label>
                <label><span>CIF</span><input value={cif} onChange={(event) => setCif(event.target.value)} /></label>
                <label><span>Dirección</span><input value={direccion} onChange={(event) => setDireccion(event.target.value)} /></label>
              </div>
              <label className="organization-form-full"><span>Descripción</span><textarea value={descripcion} onChange={(event) => setDescripcion(event.target.value)} rows={4} /></label>
              <p className="organization-modal-help">Deja las contraseñas vacías si no quieres cambiarla.</p>
              <div className="organization-form-grid">
                <label><span>Contraseña actual</span><input type="password" value={passwordActual} onChange={(event) => setPasswordActual(event.target.value)} /></label>
                <label><span>Nueva contraseña</span><input type="password" minLength={8} value={passwordNueva} onChange={(event) => setPasswordNueva(event.target.value)} /></label>
              </div>
              {errorEditor && <p className="organization-modal-error" role="alert">{errorEditor}</p>}
              <div className="organization-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setMostrarEditor(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={guardandoEditor}>{guardandoEditor ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <footer className="footer">
        <div className="footer-brand">
          <img src="/fotos/Logo_Canarias_Conecta_Sinfondo.png" alt="Logo de Canarias Conecta" />
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
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default OrganizationProfile
