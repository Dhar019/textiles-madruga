const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authMiddleware, adminMiddleware, superAdminMiddleware } = require('../middleware/auth');

// ============================================
// OBTENER TODOS LOS PRODUCTOS (Público)
// ============================================
router.get('/', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener productos.' });
    }
});

// ============================================
// OBTENER UN PRODUCTO POR ID (Público)
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ error: 'Error al obtener producto.' });
    }
});

// ============================================
// CREAR PRODUCTO (Admin + SuperAdmin)
// ============================================
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { nombre, precio, imagen, categoria, descuento, unidad } = req.body;

        const newProduct = new Product({
            nombre,
            precio,
            imagen,
            categoria,
            descuento: descuento || 0,
            unidad: unidad || ''
        });

        await newProduct.save();
        res.status(201).json({ success: true, product: newProduct });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'Error al crear producto.' });
    }
});

// ============================================
// ACTUALIZAR PRODUCTO (Admin + SuperAdmin)
// ============================================
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { nombre, precio, imagen, categoria, descuento, unidad } = req.body;

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        product.nombre = nombre || product.nombre;
        product.precio = precio || product.precio;
        product.imagen = imagen || product.imagen;
        product.categoria = categoria || product.categoria;
        product.descuento = descuento !== undefined ? descuento : product.descuento;
        product.unidad = unidad !== undefined ? unidad : product.unidad;

        await product.save();
        res.json({ success: true, product });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error al actualizar producto.' });
    }
});

// ============================================
// ELIMINAR PRODUCTO (Admin + SuperAdmin)
// ============================================
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        await product.deleteOne();
        res.json({ success: true, message: 'Producto eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto.' });
    }
});

module.exports = router;