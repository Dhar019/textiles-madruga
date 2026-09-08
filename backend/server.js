// ============================================
// SERVER.JS - VERSIÓN DEFINITIVA
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5500',
        'https://textiles-madruga.netlify.app'
    ],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// ============================================
// FUNCIONES AUXILIARES PARA RUTAS
// ============================================

// Función para crear un router vacío válido
function crearRouterVacio(nombre) {
    const router = express.Router();
    router.get('/', (req, res) => {
        res.json({ 
            message: `Ruta ${nombre} en construcción`,
            status: 'pending'
        });
    });
    router.get('/health', (req, res) => {
        res.json({ status: 'ok', module: nombre });
    });
    console.log(`🔄 Router vacío creado para: ${nombre}`);
    return router;
}

// Función para asegurar que cualquier cosa sea un router válido
function asegurarRouter(router, nombre) {
    try {
        // Si ya es una función, devolverla
        if (typeof router === 'function') {
            return router;
        }
        
        // Si es un objeto que podría tener un router
        if (router && typeof router === 'object') {
            // Intentar extraer .router o .default
            if (typeof router.router === 'function') return router.router;
            if (typeof router.default === 'function') return router.default;
        }
        
        // Si llegamos aquí, crear un router vacío
        console.warn(`⚠️ Creando router vacío para ${nombre}`);
        return crearRouterVacio(nombre);
    } catch (error) {
        console.error(`❌ Error asegurando router ${nombre}:`, error.message);
        return crearRouterVacio(nombre);
    }
}

// Función para cargar una ruta de forma segura
function cargarRutaSegura(rutaPath, nombre) {
    try {
        const modulo = require(rutaPath);
        console.log(`📂 Cargando módulo: ${rutaPath}`);
        
        // Si es una función (router) - CASO 1
        if (typeof modulo === 'function') {
            console.log(`✅ ${nombre} es una función`);
            return modulo;
        }
        
        // Si es un objeto con .router - CASO 2
        if (modulo && typeof modulo === 'object') {
            if (typeof modulo.router === 'function') {
                console.log(`✅ ${nombre} tiene .router`);
                return modulo.router;
            }
            if (typeof modulo.default === 'function') {
                console.log(`✅ ${nombre} tiene .default`);
                return modulo.default;
            }
            // Si tiene un router exportado como module.exports = { router }
            if (modulo.router && typeof modulo.router === 'object') {
                console.log(`✅ ${nombre} tiene router como objeto`);
                return modulo.router;
            }
        }
        
        console.warn(`⚠️ ${nombre} no exporta una función válida, creando router vacío`);
        return null;
    } catch (error) {
        console.error(`❌ Error cargando ${nombre}:`, error.message);
        return null;
    }
}

// ============================================
// IMPORTAR RUTAS (CON MANEJO ROBUSTO)
// ============================================

let authRoutes = cargarRutaSegura('./routes/auth', 'auth');
let productRoutes = cargarRutaSegura('./routes/products', 'product');
let offerRoutes = cargarRutaSegura('./routes/offers', 'offer');
let userRoutes = cargarRutaSegura('./routes/users', 'user');

// Asegurar que TODAS las rutas sean routers válidos
authRoutes = asegurarRouter(authRoutes, 'auth');
productRoutes = asegurarRouter(productRoutes, 'product');
offerRoutes = asegurarRouter(offerRoutes, 'offer');
userRoutes = asegurarRouter(userRoutes, 'user');

// ============================================
// REGISTRAR RUTAS (CADA UNA POR SEPARADO)
// ============================================

console.log('📋 Registrando rutas...');

// Verificar que todas son funciones antes de registrar
console.log('✅ auth es función?', typeof authRoutes === 'function');
console.log('✅ product es función?', typeof productRoutes === 'function');
console.log('✅ offer es función?', typeof offerRoutes === 'function');
console.log('✅ user es función?', typeof userRoutes === 'function');

// Registrar cada ruta con try/catch individual
try {
    app.use('/api/auth', authRoutes);
    console.log('✅ Ruta auth registrada en /api/auth');
} catch (error) {
    console.error('❌ Error registrando auth:', error.message);
    // Crear router de emergencia
    const routerEmergencia = crearRouterVacio('auth');
    app.use('/api/auth', routerEmergencia);
    console.log('🔄 Ruta auth reemplazada por router de emergencia');
}

try {
    app.use('/api/products', productRoutes);
    console.log('✅ Ruta product registrada en /api/products');
} catch (error) {
    console.error('❌ Error registrando product:', error.message);
    const routerEmergencia = crearRouterVacio('product');
    app.use('/api/products', routerEmergencia);
    console.log('🔄 Ruta product reemplazada por router de emergencia');
}

try {
    app.use('/api/offers', offerRoutes);
    console.log('✅ Ruta offer registrada en /api/offers');
} catch (error) {
    console.error('❌ Error registrando offer:', error.message);
    const routerEmergencia = crearRouterVacio('offer');
    app.use('/api/offers', routerEmergencia);
    console.log('🔄 Ruta offer reemplazada por router de emergencia');
}

try {
    app.use('/api/users', userRoutes);
    console.log('✅ Ruta user registrada en /api/users');
} catch (error) {
    console.error('❌ Error registrando user:', error.message);
    const routerEmergencia = crearRouterVacio('user');
    app.use('/api/users', routerEmergencia);
    console.log('🔄 Ruta user reemplazada por router de emergencia');
}

// ============================================
// RUTA DE SALUD
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API de Textiles Madruga funcionando',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// RUTA DE PRODUCTOS (DESDE productos.json)
// ============================================
app.get('/api/productos', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'productos.json');
        const data = fs.readFileSync(filePath, 'utf8');
        const productos = JSON.parse(data);
        res.json(productos);
    } catch (error) {
        console.error('❌ Error al leer productos.json:', error.message);
        res.status(500).json({ 
            error: 'Error al cargar los productos',
            details: error.message 
        });
    }
});

// ============================================
// CONEXIÓN A MONGODB
// ============================================
if (process.env.MONGODB_URI) {
    const mongoURI = process.env.MONGODB_URI;
    console.log('📡 Intentando conectar a MongoDB...');
    
    const mongooseOptions = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        retryReads: true,
    };
    
    if (process.env.NODE_ENV !== 'production') {
        mongooseOptions.tlsAllowInvalidCertificates = true;
    }
    
    mongoose.connect(mongoURI, mongooseOptions)
        .then(() => {
            console.log('✅ Conectado a MongoDB');
            inicializarSuperAdmin();
        })
        .catch(err => {
            console.error('❌ Error al conectar a MongoDB:', err.message);
            console.log('⚠️ El servidor continuará funcionando sin base de datos');
        });
} else {
    console.log('⚠️ MONGODB_URI no configurada, modo sin base de datos');
}

// ============================================
// INICIALIZAR SUPERADMIN
// ============================================
async function inicializarSuperAdmin() {
    try {
        let User;
        try {
            User = require('./models/User');
        } catch (e) {
            console.warn('⚠️ Modelo User no encontrado, omitiendo SuperAdmin');
            return;
        }
        
        const superAdminExists = await User.findOne({ username: 'Texmadmin' });

        if (!superAdminExists) {
            const superAdmin = new User({
                username: 'Texmadmin',
                password: 'TexMadmin2026*/',
                role: 'superadmin',
                name: 'Texmadmin'
            });
            await superAdmin.save();
            console.log('👑 SuperAdmin creado automáticamente');
            console.log('📋 Usuario: Texmadmin');
            console.log('🔑 Contraseña: TexMadmin2026*/');
        } else {
            console.log('👑 SuperAdmin ya existe');
        }
    } catch (error) {
        console.error('❌ Error al crear SuperAdmin:', error.message);
    }
}

// ============================================
// MANEJO DE RUTAS NO ENCONTRADAS (404)
// ============================================
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// ============================================
// MANEJO DE ERRORES GLOBAL
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(err.status || 500).json({ 
        error: err.message || 'Error interno del servidor' 
    });
});

// ============================================
// EXPORTAR PARA CLOUDFLARE PAGES
// ============================================
module.exports = app;

// ============================================
// INICIAR LOCALMENTE (SOLO PARA PRUEBAS)
// ============================================
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
        console.log(`📁 API disponible en http://localhost:${PORT}/api/health`);
        console.log(`📁 Entorno: ${process.env.NODE_ENV || 'desarrollo'}`);
    });
}