// ============================================
// SERVER.JS - VERSIÓN DE PRUEBA (SIN MONGODB)
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// ============================================
// RUTAS DE PRUEBA
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API de Textiles Madruga (sin base de datos)',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/products', (req, res) => {
    res.json([
        { id: 1, nombre: 'Camisa Azul', precio: 25 },
        { id: 2, nombre: 'Vestido Verano', precio: 45 }
    ]);
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`✅ Servidor de prueba corriendo en http://localhost:${PORT}`);
    console.log(`📁 API disponible en http://localhost:${PORT}/api/health`);
});

// Exportar para Cloudflare Pages
module.exports = app;