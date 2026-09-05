// ============================================
// SERVER.JS - VERSIÓN DE PRUEBA (SIN MONGODB)
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// RUTAS DE PRUEBA
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API de Textiles Madruga funcionando',
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

// ✅ Esto es lo que Cloudflare Pages necesita
module.exports = app;

// ============================================
// INICIAR LOCALMENTE (SOLO PARA PRUEBAS)
// ============================================

// ⚠️ ESTA PARTE SOLO SE EJECUTA EN LOCAL
if (require.main === module) {
    app.listen(process.env.PORT || 5000, () => {
        console.log(`✅ Servidor corriendo en http://localhost:${process.env.PORT || 5000}`);
        console.log(`📁 API disponible en http://localhost:${process.env.PORT || 5000}/api/health`);
    });
}