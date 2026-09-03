// ============================================
// SERVER.JS - VERSIÓN DE PRUEBA (SIN MONGODB)
// ============================================

const express = require('express');
const cors = require('cors');
//const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
//app.use(helmet());
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
// EXPORTAR PARA CLOUDFLARE PAGES
// ============================================

// Esto es lo que Cloudflare Pages necesita
module.exports = app;

// Iniciar localmente (solo para pruebas con node server.js)
if (require.main === module) {
    app.listen(process.env.PORT || 5000, () => {
        console.log(`✅ Servidor corriendo en http://localhost:${process.env.PORT || 5000}`);
        console.log(`📁 API disponible en http://localhost:${process.env.PORT || 5000}/api/health`);
    });
}