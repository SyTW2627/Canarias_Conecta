/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Prepara el perfil de un voluntario tal y como lo ve una entidad (sin datos de contacto).
 */

// Usuario voluntario con voluntario.interesIds poblado ({ id, nombre })
export type VoluntarioPoblado = {
  id: string
  nombre: string
  email: string
  telefono?: string
  avatarUrl?: string
  isla?: string
  municipio?: string
  voluntario?: {
    fechaNacimiento?: Date
    biografia?: string
    interesIds: Array<{ id: string; nombre: string }>
    habilidades: string[]
    idiomas: string[]
    islasPreferidas?: string[]
    disponibilidad?: Array<{ diaSemana: number; horaInicio: string; horaFin: string }>
    estadisticas?: {
      horasTotales?: number
      colaboraciones?: number
      valoracionMedia?: number
      numValoraciones?: number
    }
  }
}

export function edadDesde(fechaNacimiento?: Date): number | null {
  if (!fechaNacimiento) return null
  const hoy = new Date()
  let edad = hoy.getUTCFullYear() - fechaNacimiento.getUTCFullYear()
  const mes = hoy.getUTCMonth() - fechaNacimiento.getUTCMonth()
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < fechaNacimiento.getUTCDate())) edad--
  return edad
}

// El email y el telefono no van aqui: solo se comparten al aceptar una inscripcion
export function perfilPublicoVoluntario(voluntario: VoluntarioPoblado) {
  const perfil = voluntario.voluntario
  return {
    id: voluntario.id,
    nombre: voluntario.nombre,
    avatarUrl: voluntario.avatarUrl ?? null,
    isla: voluntario.isla ?? null,
    municipio: voluntario.municipio ?? null,
    edad: edadDesde(perfil?.fechaNacimiento),
    biografia: perfil?.biografia ?? null,
    intereses: (perfil?.interesIds ?? []).map(({ id, nombre }) => ({ id, nombre })),
    habilidades: perfil?.habilidades ?? [],
    idiomas: perfil?.idiomas ?? [],
    estadisticas: {
      horasTotales: perfil?.estadisticas?.horasTotales ?? 0,
      colaboraciones: perfil?.estadisticas?.colaboraciones ?? 0,
      valoracionMedia: perfil?.estadisticas?.valoracionMedia ?? 0,
      numValoraciones: perfil?.estadisticas?.numValoraciones ?? 0
    }
  }
}
