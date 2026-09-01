const express = require('express');
const router = express.Router();

// Obtener todos los usuarios
router.get('/', (req, res) => {
    res.json({ message: 'Usuarios funcionando' });
});

// Cambiar rol de usuario
router.patch('/:id/role', (req, res) => {
    res.json({ message: 'Rol actualizado' });
});

// Eliminar usuario
router.delete('/:id', (req, res) => {
    res.json({ message: 'Usuario eliminado' });
});

module.exports = router;