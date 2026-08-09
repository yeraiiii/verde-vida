# Verde Vida · Tienda de Nutrición

Catálogo web profesional de alimentación y nutrición con panel de administración.

## Características

- **Catálogo público** para clientes: inicio, catálogo con búsqueda y filtros, ficha de producto con propiedades y características.
- **Panel admin** (`/admin.html`): crear, editar, destacar, ocultar y eliminar productos. Los cambios se ven al instante en la web pública.
- **Base de datos persistente**: SQLite en local, PostgreSQL en producción (Neon). Estética de herboristería minimalista y elegante.

## Usuarios y contraseñas

- **Admin:** usuario `admin`, contraseña `admin` (por defecto).
- En producción usa la variable `ADMIN_PASSWORD` para tu propia clave.

## Cómo ejecutar en local

```bash
npm install
npm start
```

Abre http://localhost:3000

- En local usa SQLite (archivo `data/tienda.db`).
- Si defines `DATABASE_URL` usa PostgreSQL en su lugar.

## Cómo publicar gratis en internet (Render + Neon)

**Neon** guarda la base de datos PostgreSQL (plan gratis, sin fecha de caducidad). **Render** aloja la web (plan gratis, sin tarjeta). Cada vez que editas productos desde el panel admin, los clientes los ven al instante.

### 1. Crear la base de datos en Neon

1. Crea una cuenta gratis en https://neon.tech (con Google/GitHub/email).
2. Crea un proyecto: *New Project* → elige región (p. ej. `Frankfurt`) → *Create Project*.
3. En *Connection Details* copia el **Connection String** con `psql` o directamente:
   ```
   postgresql://USER:PASSWORD@EP.neon.tech/verdevida?sslmode=require
   ```
   Guárdalo; lo pegarás en Render (paso 3).

### 2. Crear la web en Render

1. Crea una cuenta gratis en https://render.com.
2. **New** → **Blueprint** → elige el repositorio GitHub `yeraiiii/verde-vida`. Render lee `render.yaml` y prepara el despliegue automáticamente.
3. En *Environment*, define estas variables:
   - `DATABASE_URL`: el Connection String de Neon del paso 1.
   - `ADMIN_PASSWORD`: tu contraseña para el panel admin (la que quieras).
   - `SESSION_SECRET`: cualquier texto largo aleatorio (o deja que Render lo genere).
4. *Apply* → Render instala, arranca y te da una URL pública tipo `https://verde-vida.onrender.com`.

> La primera vez, el panel crea los productos de ejemplo. Entra en `https://TU-URL/admin` con `admin` / tu `ADMIN_PASSWORD`.

### Notas

- El plan gratis de Render **"duerme"** el sitio tras ~15 min sin visitas. Al abrir la URL se despierta solo (tarda unos segundos) y **no pierde datos** (están en Neon).
- Los cambios del panel admin se ven al instante en la web pública; no hace falta redeploy.
- Para publicar una versión nueva de la web, haz *push* a GitHub: Render redeploy automáticamente.

## Estructura

```
server.js          Servidor Express + API
db.js              Capa de base de datos (SQLite local / PostgreSQL producción)
public/
  index.html       Inicio (hero, categorías, destacados)
  catalogo.html    Catálogo con búsqueda y filtros
  producto.html    Ficha de producto
  admin.html       Panel de administración
  css/style.css    Estética herboristería
  js/              Lógica del frontend
  img/             Imágenes de los productos (SVG generadas)
```

## API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/products` | Listar productos (filtros: `category`, `search`, `featured`) |
| GET | `/api/products/:id` | Ficha de un producto |
| GET | `/api/categories` | Categorías con nº de productos |
| POST | `/api/admin/login` | Iniciar sesión admin → token |
| GET | `/api/admin/products` | Listar todos (admin) |
| POST | `/api/admin/products` | Crear producto (admin) |
| PUT | `/api/admin/products/:id` | Editar producto (admin) |
| DELETE | `/api/admin/products/:id` | Eliminar producto (admin) |
