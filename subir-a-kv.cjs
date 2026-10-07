// subir-a-kv.cjs
const fs = require('fs');
const { execSync } = require('child_process');

const productos = JSON.parse(fs.readFileSync('productos.json', 'utf-8'));

const productosKV = {};
productos.forEach(p => {
    const key = p._id || p.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    productosKV[key] = p;
});

const contenidoKV = JSON.stringify(productosKV);

console.log(`🚀 Subiendo ${productos.length} productos a Cloudflare KV...`);

try {
    fs.writeFileSync('catalogo_temp.json', contenidoKV);
    
    const namespaceId = "e4227e455ffe46a6ba849a14bebf6f66";
    execSync(`npx wrangler kv key put --remote --namespace-id=${namespaceId} "catalogo_completo" --path=./catalogo_temp.json`, { stdio: 'inherit' });
    
    console.log('✅ Catálogo subido correctamente.');
    fs.unlinkSync('catalogo_temp.json');
} catch (error) {
    console.error('❌ Error al subir a KV:', error);
}