// ============================================
// SERVER.JS - VERSIÓN DEFINITIVA CON MANEJO DE RUTAS
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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
// FUNCIÓN PARA CREAR UN ROUTER VACÍO VÁLIDO
// ============================================
function crearRouterVacio(nombre) {
    const router = express.Router();
    router.get('/', (req, res) => {
        res.json({ 
            message: `Ruta ${nombre} en construcción`,
            status: 'pending'
        });
    });
    console.log(`🔄 Router vacío creado para: ${nombre}`);
    return router;
}

// ============================================
// IMPORTAR Y REGISTRAR RUTAS (VERSIÓN ROBUSTA)
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

// Cargar rutas (SIEMPRE devuelven un router válido)
let authRoutes = cargarRutaSegura('./routes/auth', 'auth');
let productRoutes = cargarRutaSegura('./routes/products', 'product');
let offerRoutes = cargarRutaSegura('./routes/offers', 'offer');
let userRoutes = cargarRutaSegura('./routes/users', 'user');

// Si alguna ruta es null, crear un router vacío
if (!authRoutes) authRoutes = crearRouterVacio('auth');
if (!productRoutes) productRoutes = crearRouterVacio('product');
if (!offerRoutes) offerRoutes = crearRouterVacio('offer');
if (!userRoutes) userRoutes = crearRouterVacio('user');

// ============================================
// REGISTRAR RUTAS (FORMA SEGURA)
// ============================================

console.log('📋 Registrando rutas...');

// Lista de rutas a registrar
const rutasParaRegistrar = [
    { nombre: 'auth', router: authRoutes, path: '/api/auth' },
    { nombre: 'product', router: productRoutes, path: '/api/products' },
    { nombre: 'offer', router: offerRoutes, path: '/api/offers' },
    { nombre: 'user', router: userRoutes, path: '/api/users' }
];

// Registrar cada ruta con verificación
rutasParaRegistrar.forEach(({ nombre, router, path }) => {
    try {
        // Verificar que el router es una función ANTES de usar app.use()
        if (typeof router === 'function') {
            app.use(path, router);
            console.log(`✅ Ruta ${nombre} registrada en ${path}`);
        } else {
            console.error(`❌ ERROR: router ${nombre} NO es una función, creando uno vacío`);
            const routerVacio = crearRouterVacio(nombre);
            app.use(path, routerVacio);
            console.log(`🔄 Ruta ${nombre} reemplazada por router vacío en ${path}`);
        }
    } catch (error) {
        console.error(`❌ Error registrando ruta ${nombre}:`, error.message);
        // En caso de error extremo, crear un router vacío y registrarlo
        try {
            const routerEmergencia = crearRouterVacio(nombre);
            app.use(path, routerEmergencia);
            console.log(`🚨 Ruta ${nombre} registrada con router de emergencia`);
        } catch (e) {
            console.error(`💀 No se pudo recuperar la ruta ${nombre}:`, e.message);
        }
    }
});

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
const fs = require('fs');
const path = require('path');

app.get('/api/productos', (req, res) => {
    try {
        // Leer el archivo productos.json
        const filePath = path.join(__dirname, 'productos.json');
        const data = fs.readFileSync(filePath, 'utf8');
        const productos = JSON.parse(data);
        
        // Devolver los productos con las rutas de imagen corregidas
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