const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        maxlength: 40
    },
    precio: {
        type: Number,
        required: true
    },
    imagen: {
        type: String,
        default: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Sin+Imagen'
    },
    categoria: {
        type: String,
        enum: ['hombre', 'mujer', 'telas', 'objetos'],
        required: true
    },
    descuento: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    unidad: {
        type: String,
        default: ''
    },
    enOferta: {
        type: Boolean,
        default: false
    },
    ofertaData: {
        tipo: {
            type: String,
            enum: ['porcentaje', '2x1', '3x2', 'lleva3paga2', 'envio_gratis'],
            default: 'porcentaje'
        },
        detalles: { type: String, default: '' },
        colores: { type: String, default: '' }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', ProductSchema);