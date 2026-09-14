// ============================================
// SEED.CJS - Poblar MongoDB desde productos.json
// ============================================

const fs = require('fs');

// Leer productos.json
const productosJSON = JSON.parse(fs.readFileSync('./productos.json', 'utf8'));

// Convertir a array plano de productos
const productos = [];
for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
    if (productosJSON.productos[categoria]) {
        productosJSON.productos[categoria].forEach(p => {
            productos.push({
                id: p.id,
                nombre: p.nombre,
                precio: p.precio,
                categoria: categoria,
                imagen: p.imagen,
                unidad: p.unidad || '',
                enOferta: productosJSON.ofertas.includes(p.id),
                descuento: productosJSON.ofertas.includes(p.id) ? 15 : 0
            });
        });
    }
}

// Generar el script de mongosh
let script = '// Script generado automáticamente desde productos.json\n';
script += 'const db = db.getSiblingDB("textiles");\n\n';

// Usuarios
script += '// ============================================\n';
script += '// USUARIOS\n';
script += '// ============================================\n';
script += 'db.users.deleteMany({})\n';
script += 'db.users.insertMany([\n';
script += '  { username: "Texmadmin", password: "TexMadmin2026*/", role: "superadmin", name: "Texmadmin", createdAt: new Date() },\n';
script += '  { username: "admin1", password: "admin123", role: "admin", name: "Administrador 1", createdAt: new Date() },\n';
script += '  { username: "usuario1", password: "user123", role: "user", name: "Usuario Normal", createdAt: new Date() }\n';
script += '])\n\n';

// Productos
script += '// ============================================\n';
script += '// PRODUCTOS\n';
script += '// ============================================\n';
script += 'db.products.deleteMany({})\n';
script += 'db.products.insertMany([\n';
productos.forEach((p, i) => {
    script += `  { id: ${p.id}, nombre: "${p.nombre}", precio: ${p.precio}, categoria: "${p.categoria}", imagen: "${p.imagen}", unidad: "${p.unidad}", enOferta: ${p.enOferta}, descuento: ${p.descuento} }${i < productos.length - 1 ? ',' : ''}\n`;
});
script += '])\n\n';

// Ofertas
script += '// ============================================\n';
script += '// OFERTAS\n';
script += '// ============================================\n';
script += 'db.offers.deleteMany({})\n';
script += 'db.offers.insertMany([\n';
productosJSON.ofertas.forEach((id, i) => {
    script += `  { productoId: ${id}, descuento: 15, activa: true, createdAt: new Date() }${i < productosJSON.ofertas.length - 1 ? ',' : ''}\n`;
});
script += '])\n\n';

// Verificación
script += '// ============================================\n';
script += '// VERIFICACIÓN\n';
script += '// ============================================\n';
script += 'print("✅ Usuarios creados:", db.users.countDocuments())\n';
script += 'print("✅ Productos creados:", db.products.countDocuments())\n';
script += 'print("✅ Ofertas creadas:", db.offers.countDocuments())\n';

// Guardar el script
fs.writeFileSync('./seed-mongo.js', script, 'utf8');
console.log('✅ Archivo seed-mongo.js generado correctamente desde productos.json');
console.log(`📦 ${productos.length} productos listos para insertar`);
console.log(`🔥 ${productosJSON.ofertas.length} ofertas listas para insertar`);