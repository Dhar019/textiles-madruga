// ============================================
// INDEX.TS - API TEXTILES MADRUGA (WORKERS)
// ============================================

import express from 'express';

const app = express();

// ============================================
// MIDDLEWARE (SIN body-parser)
// ============================================

// ✅ Express ya incluye su propio parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ============================================
// RUTAS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'API de Textiles Madruga funcionando en Cloudflare Workers',
        timestamp: new Date().toISOString()
    });
});

// Ruta de productos (prueba)
app.get('/api/productos', (req, res) => {
    res.json({
        message: 'Lista de productos',
        productos: [
            { id: 1, nombre: 'Camisa Azul', precio: 25 },
            { id: 2, nombre: 'Vestido Verano', precio: 45 }
        ]
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'API Textiles Madruga',
        version: '1.0.0',
        endpoints: [
            '/api/health',
            '/api/productos'
        ]
    });
});

// ============================================
// MANEJO DE ERRORES
// ============================================

// Ruta no encontrada (404)
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.path
    });
});

// Error global
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// EXPORTAR PARA CLOUDFLARE WORKERS
// ============================================

export default app;