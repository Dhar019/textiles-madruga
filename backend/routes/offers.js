const express = require('express');
const router = express.Router();

// Obtener todas las ofertas
router.get('/', (req, res) => {
    res.json({ message: 'Ofertas funcionando' });
});

// Activar/desactivar oferta
router.patch('/toggle/:id', (req, res) => {
    res.json({ message: 'Oferta toggleada' });
});

module.exports = router;