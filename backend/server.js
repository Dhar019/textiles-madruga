// ============================================
// SERVER.JS - VERSIÓN HÍBRIDA PARA CLOUDFLARE
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
// RUTAS
// ============================================

// ============================================
// IMPORTAR RUTAS CON VERIFICACIÓN MEJORADA
// ============================================

let authRoutes, productRoutes, offerRoutes, userRoutes;

// Función auxiliar para cargar rutas de forma segura
function cargarRuta(ruta) {
    try {
        const modulo = require(ruta);
        // Si es una función, devolverla
        if (typeof modulo === 'function') {
            return modulo;
        }
        // Si tiene un router exportado como .router o .default
        if (modulo && typeof modulo === 'object') {
            if (typeof modulo.router === 'function') return modulo.router;
            if (typeof modulo.default === 'function') return modulo.default;
        }
        console.warn(`⚠️ ${ruta} no exporta una función, creando router vacío`);
        return express.Router();
    } catch (e) {
        console.error(`❌ Error cargando ${ruta}:`, e.message);
        return express.Router();
    }
}

authRoutes = cargarRuta('./routes/auth');
productRoutes = cargarRuta('./routes/products');
offerRoutes = cargarRuta('./routes/offers');
userRoutes = cargarRuta('./routes/users');

// Verificar que son funciones válidas
console.log('✅ authRoutes:', typeof authRoutes === 'function' ? 'función OK' : 'ERROR');
console.log('✅ productRoutes:', typeof productRoutes === 'function' ? 'función OK' : 'ERROR');
console.log('✅ offerRoutes:', typeof offerRoutes === 'function' ? 'función OK' : 'ERROR');
console.log('✅ userRoutes:', typeof userRoutes === 'function' ? 'función OK' : 'ERROR');

// REGISTRAR RUTAS (solo si son funciones)
if (typeof authRoutes === 'function') app.use('/api/auth', authRoutes);
else console.warn('⚠️ authRoutes no es función, omitiendo ruta');

if (typeof productRoutes === 'function') app.use('/api/products', productRoutes);
else console.warn('⚠️ productRoutes no es función, omitiendo ruta');

if (typeof offerRoutes === 'function') app.use('/api/offers', offerRoutes);
else console.warn('⚠️ offerRoutes no es función, omitiendo ruta');

if (typeof userRoutes === 'function') app.use('/api/users', userRoutes);
else console.warn('⚠️ userRoutes no es función, omitiendo ruta');

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
// CONEXIÓN A MONGODB (SOLO SI HAY URI)
// ============================================
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('✅ Conectado a MongoDB');
            inicializarSuperAdmin();
        })
        .catch(err => {
            console.error('❌ Error al conectar a MongoDB:', err);
        });
} else {
    console.log('⚠️ MONGODB_URI no configurada, modo sin base de datos');
}

// ============================================
// INICIALIZAR SUPERADMIN
// ============================================
async function inicializarSuperAdmin() {
    try {
        const User = require('./models/User');
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
        console.error('❌ Error al crear SuperAdmin:', error);
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
    console.error('❌ Error:', err);
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
    app.listen(process.env.PORT || 5000, () => {
        console.log(`✅ Servidor corriendo en http://localhost:${process.env.PORT || 5000}`);
        console.log(`📁 API disponible en http://localhost:${process.env.PORT || 5000}/api/health`);
    });
}