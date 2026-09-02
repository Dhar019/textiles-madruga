require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE DE SEGURIDAD
// ============================================
app.use(helmet());
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5500',
        'https://textiles-madruga.netlify.app'
    ],
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));

// ============================================
// RUTAS
// ============================================

// IMPORTAR RUTAS (con verificación)
let authRoutes, productRoutes, offerRoutes, userRoutes;

try {
    authRoutes = require('./routes/auth');
    console.log('✅ authRoutes cargado');
} catch (e) {
    console.error('❌ Error cargando authRoutes:', e.message);
    authRoutes = express.Router();
}

try {
    productRoutes = require('./routes/products');
    console.log('✅ productRoutes cargado');
} catch (e) {
    console.error('❌ Error cargando productRoutes:', e.message);
    productRoutes = express.Router();
}

try {
    offerRoutes = require('./routes/offers');
    console.log('✅ offerRoutes cargado');
} catch (e) {
    console.error('❌ Error cargando offerRoutes:', e.message);
    offerRoutes = express.Router();
}

try {
    userRoutes = require('./routes/users');
    console.log('✅ userRoutes cargado');
} catch (e) {
    console.error('❌ Error cargando userRoutes:', e.message);
    userRoutes = express.Router();
}

// VERIFICAR QUE SON FUNCIONES VÁLIDAS
if (typeof authRoutes !== 'function') {
    console.warn('⚠️ authRoutes no es función, creando router vacío');
    authRoutes = express.Router();
}
if (typeof productRoutes !== 'function') {
    console.warn('⚠️ productRoutes no es función, creando router vacío');
    productRoutes = express.Router();
}
if (typeof offerRoutes !== 'function') {
    console.warn('⚠️ offerRoutes no es función, creando router vacío');
    offerRoutes = express.Router();
}
if (typeof userRoutes !== 'function') {
    console.warn('⚠️ userRoutes no es función, creando router vacío');
    userRoutes = express.Router();
}

// REGISTRAR RUTAS
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/users', userRoutes);

// ============================================
// RUTA DE SALUD
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor Textiles Madruga funcionando' });
});

// ============================================
// CONEXIÓN A MONGODB
// ============================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Conectado a MongoDB');
        inicializarSuperAdmin();
    })
    .catch(err => {
        console.error('❌ Error al conectar a MongoDB:', err);
        process.exit(1);
    });

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
// MANEJO DE ERRORES GLOBAL
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(err.status || 500).json({ 
        error: err.message || 'Error interno del servidor' 
    });
});

// ============================================
// MANEJO DE RUTAS NO ENCONTRADAS (404)
// ============================================
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📁 API disponible en http://localhost:${PORT}/api`);
});