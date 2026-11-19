/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Agrupa los valores compartidos por varios modelos.
 */

export const ISLAS = [
  'tenerife',
  'gran_canaria',
  'lanzarote',
  'fuerteventura',
  'la_palma',
  'la_gomera',
  'el_hierro',
  'la_graciosa'
] as const

// Hora en formato HH:mm
export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
