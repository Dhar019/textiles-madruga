require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('./models/Product');

const JSON_PATH = path.join(__dirname, '..', 'productos.json');

async function migrateData() {
    try {
        console.log('🚀 Iniciando migración de datos...');
        console.log('📡 Conectando a MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        console.log('📖 Leyendo productos.json...');
        if (!fs.existsSync(JSON_PATH)) {
            console.error('❌ No se encontró el archivo productos.json en la raíz del proyecto');
            process.exit(1);
        }

        const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
        console.log(`📦 Encontrados ${data.productos.hombre.length + data.productos.mujer.length + data.productos.telas.length + data.productos.objetos.length} productos`);

        console.log('🧹 Limpiando productos existentes...');
        await Product.deleteMany({});
        console.log('✅ Productos existentes eliminados');

        const allProducts = [
            ...data.productos.hombre.map(p => ({ ...p, categoria: 'hombre', enOferta: data.ofertas.includes(p.id), ofertaData: data.ofertas.includes(p.id) ? { tipo: 'porcentaje', detalles: '', colores: '' } : undefined })),
            ...data.productos.mujer.map(p => ({ ...p, categoria: 'mujer', enOferta: data.ofertas.includes(p.id), ofertaData: data.ofertas.includes(p.id) ? { tipo: 'porcentaje', detalles: '', colores: '' } : undefined })),
            ...data.productos.telas.map(p => ({ ...p, categoria: 'telas', enOferta: data.ofertas.includes(p.id), ofertaData: data.ofertas.includes(p.id) ? { tipo: 'porcentaje', detalles: '', colores: '' } : undefined })),
            ...data.productos.objetos.map(p => ({ ...p, categoria: 'objetos', enOferta: data.ofertas.includes(p.id), ofertaData: data.ofertas.includes(p.id) ? { tipo: 'porcentaje', detalles: '', colores: '' } : undefined }))
        ];

        allProducts.forEach(p => delete p.id);

        console.log(`💾 Guardando ${allProducts.length} productos en MongoDB...`);
        await Product.insertMany(allProducts);
        console.log(`✅ ${allProducts.length} productos migrados correctamente`);

        console.log('\n📊 RESUMEN DE MIGRACIÓN:');
        console.log(`   Total productos: ${allProducts.length}`);
        console.log(`   Productos en oferta: ${allProducts.filter(p => p.enOferta).length}`);

        console.log('\n✅ Migración completada con éxito');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

migrateData();