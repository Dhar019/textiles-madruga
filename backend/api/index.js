// api/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: 'https://textiles-madruga.netlify.app' }));
app.use(express.json());

// ============================================
// RUTAS (IMPORTADAS DESDE BACKEND)
// ============================================
const authRoutes = require('../backend/routes/auth');
const productRoutes = require('../backend/routes/products');
const offerRoutes = require('../backend/routes/offers');
const userRoutes = require('../backend/routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/users', userRoutes);

// ============================================
// RUTA DE SALUD
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API de Textiles Madruga en Vercel' });
});

// ============================================
// EXPORTAR PARA VERCEL
// ============================================
module.exports = app;