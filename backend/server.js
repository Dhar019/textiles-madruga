// ============================================
// SERVER.JS - VERSIÓN DEFINITIVA
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
// IMPORTAR Y REGISTRAR RUTAS
// ============================================

let authRoutes, productRoutes, offerRoutes, userRoutes;

// Función auxiliar para cargar rutas de forma segura
function cargarRuta(ruta) {
    try {
        const modulo = require(ruta);
        console.log(`📂 Cargando módulo: ${ruta}`);
        
        if (typeof modulo === 'function') {
            console.log(`✅ ${ruta} es una función`);
            return modulo;
        }
        
        if (modulo && typeof modulo === 'object') {
            if (typeof modulo.router === 'function') {
                console.log(`✅ ${ruta} tiene .router`);
                return modulo.router;
            }
            if (typeof modulo.default === 'function') {
                console.log(`✅ ${ruta} tiene .default`);
                return modulo.default;
            }
        }
        
        console.warn(`⚠️ ${ruta} no exporta una función, creando router vacío`);
        return express.Router();
    } catch (e) {
        console.error(`❌ Error cargando ${ruta}:`, e.message);
        return express.Router();
    }
}

// Cargar rutas
authRoutes = cargarRuta('./routes/auth');
productRoutes = cargarRuta('./routes/products');
offerRoutes = cargarRuta('./routes/offers');
userRoutes = cargarRuta('./routes/users');

// Registrar rutas con verificación robusta
console.log('📋 Registrando rutas...');

const rutasConfig = [
    { nombre: 'auth', ruta: authRoutes, path: '/api/auth' },
    { nombre: 'product', ruta: productRoutes, path: '/api/products' },
    { nombre: 'offer', ruta: offerRoutes, path: '/api/offers' },
    { nombre: 'user', ruta: userRoutes, path: '/api/users' }
];

rutasConfig.forEach(({ nombre, ruta, path }) => {
    try {
        if (typeof ruta === 'function') {
            app.use(path, ruta);
            console.log(`✅ Ruta ${nombre} registrada en ${path}`);
        } else if (ruta && typeof ruta === 'object' && ruta.router) {
            app.use(path, ruta.router);
            console.log(`✅ Ruta ${nombre} registrada desde objeto.router en ${path}`);
        } else {
            console.warn(`⚠️ Ruta ${nombre} no es válida, creando router vacío para ${path}`);
            const emptyRouter = express.Router();
            emptyRouter.get('/', (req, res) => {
                res.json({ 
                    message: `Ruta ${nombre} en construcción`,
                    status: 'pending'
                });
            });
            app.use(path, emptyRouter);
            console.log(`🔄 Ruta ${nombre} reemplazada por router vacío`);
        }
    } catch (error) {
        console.error(`❌ Error registrando ruta ${nombre}:`, error.message);
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
// CONEXIÓN A MONGODB (CORREGIDA PARA CLOUDFLARE)
// ============================================
if (process.env.MONGODB_URI) {
    const mongoURI = process.env.MONGODB_URI;
    console.log('📡 Intentando conectar a MongoDB...');
    
    // Opciones de conexión robustas
    const mongooseOptions = {
        serverSelectionTimeoutMS: 10000,  // 10 segundos
        socketTimeoutMS: 45000,
        retryWrites: true,
        retryReads: true,
    };
    
    // Solo añadir opciones SSL en desarrollo local
    if (process.env.NODE_ENV !== 'production') {
        console.log('🔧 Modo desarrollo: permitiendo certificados no válidos');
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
        // Verificar que el modelo existe
        let User;
        try {
            User = require('./models/User');
        } catch (e) {
            console.warn('⚠️ Modelo User no encontrado, omitiendo creación de SuperAdmin');
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