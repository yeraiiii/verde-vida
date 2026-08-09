# Verde Vida · Tienda de Nutrición

Catálogo web profesional de alimentación y nutrición con panel de administración.

## Características

- **Catálogo público** para clientes: inicio, catálogo con búsqueda y filtros, ficha de producto con propiedades y características.
- **Panel admin** (`/admin.html`): crear, editar, destacar, ocultar y eliminar productos. Solo `admin` puede modificarlos.
- **Base de datos SQLite** persistente. Estética de herboristería minimalista y elegante.

## Usuarios y contraseñas

- **Admin:** usuario `admin`, contraseña `admin` (por defecto).
- Para cambiarla en producción: `ADMIN_PASSWORD=miclave npm start`.

## Cómo ejecutar en local

```bash
npm install
npm start
```

Abre http://localhost:3000

## Cómo publicar gratis en internet (Glitch)

**Glitch** permite alojar apps de Node gratis con almacenamiento persistente (SQLite sobrevive a reinicios), sin tarjeta de crédito.

1. Crea una cuenta gratuita en https://glitch.com (puedes entrar con tu cuenta de Google o GitHub).
2. Crea un repositorio en GitHub con estos archivos:
   - Botón **"+"** → *New repository* (público).
   - Sube el contenido del proyecto (arrastra los archivos; no hace falta `node_modules/` ni `data/`).
3. En Glitch: botón **"New Project"** → **"Import from GitHub"** → pega la URL de tu repositorio.
4. Espera a que instale dependencias (2-3 minutos). La app arranca sola con `npm start`.
5. Tu web queda publicada en `https://TU-NOMBRE.glitch.me`.

### Cambiar la contraseña del admin en Glitch

- En Glitch, abre el archivo `.env` (o pestaña **Env**) y añade:
  ```
  ADMIN_PASSWORD=tuclave_segura
  ```
- Reinicia la app (botón **Tools → Restart**).

### Configurar la contraseña al arrancar

Cualquier host puede definir `ADMIN_PASSWORD`. Si la app ya se inició una vez, la contraseña queda guardada en la base de datos y `ADMIN_PASSWORD` no la sobrescribe. Para forzarla, borra el archivo `data/tienda.db` y reinicia (perderás los cambios).

## Despliegue en Render (alternativa)

Render también tiene tier gratis sin tarjeta, pero su almacenamiento es efímero: **la base de datos se pierde al reiniciar o hacer deploy**. Por eso se recomienda Glitch para guardar datos.

## Estructura

```
server.js          Servidor Express + API + SQLite
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
