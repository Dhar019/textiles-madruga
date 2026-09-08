# Textiles Madruga API

API REST para tienda de textiles, desplegada en Cloudflare Workers con Express y Mongoose.

## Arquitectura

- **Runtime**: Cloudflare Workers (con `nodejs_compat`)
- **Framework**: Express.js (vía `httpServerHandler`)
- **Base de datos**: MongoDB Atlas (driver nativo mongoose con `maxPoolSize: 1`)
- **Auth**: JWT

## Estructura del proyecto

```
src/
├── index.ts          # App Express + httpServerHandler
├── db.ts             # Conexión a MongoDB (lazy init)
├── models/
│   ├── User.ts       # Modelo de usuario
│   ├── Product.ts    # Modelo de producto
│   └── Offer.ts      # Modelo de oferta
├── routes/
│   ├── auth.ts       # /api/auth/* (login, register, me)
│   ├── productos.ts  # /api/productos/* (CRUD)
│   ├── offers.ts     # /api/offers/* (CRUD)
│   └── users.ts      # /api/users/* (CRUD, protegido)
```

## Requisitos previos

1. Tener una cuenta de MongoDB Atlas con un cluster activo
2. Tener tu connection string `mongodb+srv://...`
3. Tener Node.js 18+ instalado
4. Tener Wrangler instalado (`npm install -g wrangler` o usar `npx`)

## Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables locales (desarrollo)

```bash
cp .dev.vars.example .dev.vars
# Edita .dev.vars con tu connection string real de MongoDB Atlas
```

### 3. Configurar secrets en Cloudflare (producción)

```bash
# Tu connection string de MongoDB Atlas
npx wrangler secret put MONGODB_URI
# Pega: mongodb+srv://usuario:password@cluster0.fdbbgyi.mongodb.net/textiles?retryWrites=true&w=majority

# Tu secreto JWT
npx wrangler secret put JWT_SECRET
# Pega: textiles_madruga_super_secret_key_2026
```

## Desarrollo local

```bash
npm run dev
```

El servidor local estará en `http://localhost:8787`

## Despliegue

```bash
npm run deploy
```

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check + estado DB |
| POST | `/api/auth/login` | No | Iniciar sesión |
| POST | `/api/auth/register` | No | Registrarse |
| GET | `/api/auth/me` | Sí | Verificar token y obtener perfil |
| GET | `/api/productos` | No | Listar productos (`?categoria=`, `?activo=`) |
| GET | `/api/productos/:id` | No | Obtener producto por ID |
| POST | `/api/productos` | Sí | Crear producto |
| PUT | `/api/productos/:id` | Sí | Actualizar producto |
| DELETE | `/api/productos/:id` | Sí | Eliminar producto |
| GET | `/api/offers` | No | Listar ofertas activas (`?all=true` para todas) |
| GET | `/api/offers/:id` | No | Obtener oferta por ID |
| POST | `/api/offers` | Sí | Crear oferta |
| PUT | `/api/offers/:id` | Sí | Actualizar oferta |
| DELETE | `/api/offers/:id` | Sí | Eliminar oferta |
| GET | `/api/users` | Sí | Listar usuarios |
| GET | `/api/users/:id` | Sí | Obtener usuario por ID |
| PUT | `/api/users/:id` | Sí | Actualizar usuario |
| DELETE | `/api/users/:id` | Sí | Eliminar usuario |

## Verificación post-despliegue

```bash
# Health check
curl https://textiles-madruga-api.eldani000219.workers.dev/api/health

# Login
curl -X POST https://textiles-madruga-api.eldani000219.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@textiles.com","password":"tu_password"}'

# Listar productos
curl https://textiles-madruga-api.eldani000219.workers.dev/api/productos
```

## Notas importantes

- **maxPoolSize: 1**: Workers tiene un límite de 6 conexiones TCP por aislado. Usamos 1 para evitar agotarlas.
- **bufferCommands: false**: No acumula operaciones en memoria mientras la conexión no está lista.
- **Lazy init**: La conexión a MongoDB se hace en el primer request, no en el scope global.
- **bcrypt**: El código usa comparación simple de passwords. En producción, instala `bcryptjs` y hashea los passwords.
