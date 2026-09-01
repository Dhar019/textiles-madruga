const express = require('express');
const router = express.Router();

// Obtener todos los productos
router.get('/', (req, res) => {
    res.json({ message: 'Productos funcionando' });
});

// Obtener un producto por ID
router.get('/:id', (req, res) => {
    res.json({ message: 'Producto individual' });
});

// Crear producto (solo admin)
router.post('/', (req, res) => {
    res.json({ message: 'Producto creado' });
});

// Actualizar producto (solo admin)
router.put('/:id', (req, res) => {
    res.json({ message: 'Producto actualizado' });
});

// Eliminar producto (solo admin)
router.delete('/:id', (req, res) => {
    res.json({ message: 'Producto eliminado' });
});

module.exports = router;