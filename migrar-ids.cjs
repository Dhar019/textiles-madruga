// migrar-ids.cjs
// Migra los IDs de los productos a 6-8 dígitos únicos

const API_URL = 'https://textiles-madruga-api.eldani000219.workers.dev/api';

async function migrarIds() {
    console.log('🔍 Obteniendo productos del servidor...');
    
    // 1. Obtener todos los productos
    const respuesta = await fetch(`${API_URL}/productos`);
    if (!respuesta.ok) {
        console.error('❌ Error al obtener productos:', respuesta.status);
        return;
    }
    
    const data = await respuesta.json();
    const productos = Array.isArray(data) ? data : data.productos;
    
    if (!productos || productos.length === 0) {
        console.log('⚠️ No hay productos para migrar');
        return;
    }
    
    console.log(`📦 ${productos.length} productos encontrados`);
    
    // 2. Función para generar ID de 6-8 dígitos
    function generarIdUnico(idsExistentes) {
        let intentos = 0;
        while (intentos < 10000) {
            // Entre 6 y 8 dígitos (100000 a 99999999)
            const longitud = 6 + Math.floor(Math.random() * 3); // 6, 7 u 8
            const min = Math.pow(10, longitud - 1);
            const max = Math.pow(10, longitud) - 1;
            const id = String(Math.floor(min + Math.random() * (max - min + 1)));
            
            if (!idsExistentes.has(id)) {
                return id;
            }
            intentos++;
        }
        // Fallback: timestamp de 8 dígitos
        return String(Date.now()).slice(-8);
    }
    
    // 3. Identificar qué IDs hay que migrar (los que no son 6-8 dígitos puros)
    const idsExistentes = new Set();
    const aMigrar = [];
    
    productos.forEach(p => {
        const id = String(p.id || p._id || '');
        const esValido = /^\d{6,8}$/.test(id); // 6-8 dígitos puros
        if (esValido) {
            idsExistentes.add(id);
        } else {
            aMigrar.push(p);
        }
    });
    
    console.log(`✅ ${productos.length - aMigrar.length} productos ya tienen ID válido`);
    console.log(`🔄 ${aMigrar.length} productos necesitan migración`);
    
    if (aMigrar.length === 0) {
        console.log('🎉 ¡Todo está perfecto! No hay nada que migrar.');
        return;
    }
    
    // 4. Pedir credenciales de admin
    const username = 'Texmadmin';
    const password = 'TexMadmin2026*/';
    
    console.log('🔐 Iniciando sesión como admin...');
    
    // 5. Login
    const loginResp = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, turnstileToken: '' })
    });
    
    if (!loginResp.ok) {
        console.error('❌ Error al hacer login:', loginResp.status);
        const err = await loginResp.text();
        console.error(err);
        return;
    }
    
    const loginData = await loginResp.json();
    const token = loginData.token;
    console.log('✅ Sesión iniciada');
    
    // 6. Migrar cada producto
    for (const producto of aMigrar) {
        const idViejo = String(producto.id || producto._id || '');
        const idNuevo = generarIdUnico(idsExistentes);
        idsExistentes.add(idNuevo);
        
        console.log(`🔄 Migrando "${producto.nombre}": ${idViejo} → ${idNuevo}`);
        
        // Crear nuevo producto con ID nuevo
        const nuevoProducto = {
            ...producto,
            id: idNuevo,
            _id: idNuevo
        };
        
        // Eliminar el viejo
        const delResp = await fetch(`${API_URL}/products/${idViejo}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!delResp.ok) {
            console.error(`   ❌ Error al eliminar viejo: ${delResp.status}`);
            continue;
        }
        
        // Crear el nuevo
        const createResp = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(nuevoProducto)
        });
        
        if (!createResp.ok) {
            console.error(`   ❌ Error al crear nuevo: ${createResp.status}`);
            continue;
        }
        
        console.log(`   ✅ Migrado correctamente`);
    }
    
    console.log('');
    console.log('🎉 ¡Migración completada!');
    console.log(`📊 Total migrados: ${aMigrar.length}`);
    console.log('');
    console.log('⚠️ IMPORTANTE: Recarga la web para ver los cambios');
}

migrarIds().catch(err => {
    console.error('❌ Error fatal:', err);
});