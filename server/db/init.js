/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Crea la base de datos local canarias_conecta y sus colecciones iniciales.
 * Uso: mongosh "mongodb://127.0.0.1:27017" server/db/init.js
 */

db = db.getSiblingDB('canarias_conecta')

// MongoDB solo crea la base de datos cuando contiene al menos una coleccion
const colecciones = [
  'users',
  'categorias',
  'ofertas',
  'inscripciones',
  'solicitudes_ayuda',
  'notificaciones',
  'tokens'
]

for (const nombre of colecciones) {
  if (!db.getCollectionNames().includes(nombre)) {
    db.createCollection(nombre)
    print(`Coleccion creada: ${nombre}`)
  } else {
    print(`La coleccion ya existe: ${nombre}`)
  }
}

print(`Base de datos lista: ${db.getName()}`)
