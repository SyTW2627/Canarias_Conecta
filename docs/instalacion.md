<!--
  Proyecto: Canarias Conecta
  Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
  Funcion: Explica como instalar la aplicacion en desarrollo y en produccion.
-->
# Instalación

## Desarrollo

Necesitas **Node.js 22** (ver `.nvmrc`) y **MongoDB 8.0**.

### 1. Instalar MongoDB

**Windows**

```powershell
winget install MongoDB.Server
winget install MongoDB.Shell
winget install MongoDB.Compass.Full   # opcional, interfaz gráfica
```

**WSL / Ubuntu 24.04**

```bash
sudo apt update && sudo apt install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### 2. Preparar y arrancar el proyecto

```bash
git clone https://github.com/SyTW2627/Canarias_Conecta.git
cd Canarias_Conecta && git switch Dev

mongosh "mongodb://127.0.0.1:27017" server/db/init.js   # crea la base de datos

cd server
npm install
cp .env.example .env
npm run seed        # usuarios y ofertas de ejemplo, opcional
npm run dev         # API en http://localhost:3000

# en otra terminal
cd client
npm install
npm run dev         # web en http://localhost:5173
```

Para comprobarlo, <http://localhost:3000/api/health> debe devolver `"database": "conectado"`.
Puedes entrar con `laura@ejemplo.com` / `Ejemplo123`, que crea `npm run seed`.

### Problemas habituales

| Síntoma | Solución |
|---|---|
| `Error al conectar con MongoDB` | MongoDB no está arrancado: `Get-Service MongoDB` (Windows) o `sudo systemctl start mongod` (Linux) |
| `Falta la variable MONGODB_URI` | Falta `server/.env`: `cp .env.example .env` |
| *No se pudo conectar con el servidor* en la web | El servidor no está arrancado en el puerto 3000 |

## Producción

> Todavía no está desplegada. Esta sección describe cómo se haría.

En producción, el cliente se compila a ficheros estáticos que sirve **Nginx**, y Nginx redirige
`/api` al servidor Node.

```bash
cd server && npm ci && npm run build     # genera server/dist
cd ../client && npm ci && npm run build  # genera client/dist
```

`server/.env` con valores propios. **No se ejecuta `npm run seed`.**

```bash
PORT=3000
MONGODB_URI=mongodb://<usuario>:<contraseña>@127.0.0.1:27017/canarias_conecta   # o la URI de MongoDB Atlas
JWT_SECRET=<salida de: openssl rand -hex 32>
```

El servidor se arranca con `npm start` desde `server/`, como servicio systemd o con pm2 para que
se reinicie solo. Configuración mínima de Nginx:

```nginx
server {
    server_name <dominio>;
    root /ruta/a/Canarias_Conecta/client/dist;

    location /api/ { proxy_pass http://127.0.0.1:3000; }
    location /     { try_files $uri /index.html; }
}
```

HTTPS con `sudo certbot --nginx -d <dominio>`. Solo se despliega la rama `main`.

**Pendiente antes de desplegar**

- Limitar CORS al dominio propio, porque ahora `cors()` acepta cualquier origen.
