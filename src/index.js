// ============================================
// WORKER - TEXTILES MADRUGA API
// Versión 6.2 - Sin Turnstile + Verificación Permisiva
// ============================================

// ============================================
// CORS
// ============================================
function getCorsHeaders(request) {
    const origin = request.headers.get('Origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
        'Access-Control-Max-Age': '86400'
    };
}

function addCors(response, request) {
    const newHeaders = new Headers(response.headers);
    const cors = getCorsHeaders(request);
    Object.entries(cors).forEach(([key, value]) => newHeaders.set(key, value));
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

// ============================================
// HELPERS KV Y MIGRACIÓN
// ============================================
const CATEGORIAS_POR_DEFECTO = [
    { id: 'hombre', nombre: 'Hombre', subcategorias: [{ id: 'camisas', nombre: 'Camisas' }, { id: 'pantalones', nombre: 'Pantalones' }, { id: 'chaquetas', nombre: 'Chaquetas' }] },
    { id: 'mujer', nombre: 'Mujer', subcategorias: [{ id: 'vestidos', nombre: 'Vestidos' }, { id: 'blusas', nombre: 'Blusas' }, { id: 'faldas', nombre: 'Faldas' }] },
    { id: 'telas', nombre: 'Telas', subcategorias: [{ id: 'lino', nombre: 'Lino' }, { id: 'algodon', nombre: 'Algodón' }, { id: 'seda', nombre: 'Seda' }] },
    { id: 'objetos', nombre: 'Objetos', subcategorias: [{ id: 'ceramica', nombre: 'Cerámica' }, { id: 'mochilas', nombre: 'Mochilas' }, { id: 'accesorios', nombre: 'Accesorios' }] }
];

async function leerCatalogo(env) {
    const catalogoStr = await env.PRODUCTOS_KV.get('catalogo_completo');
    if (!catalogoStr) {
        return { productos: {}, categorias: JSON.parse(JSON.stringify(CATEGORIAS_POR_DEFECTO)) };
    }
    const data = JSON.parse(catalogoStr);
    if (!data.categorias) {
        data.categorias = JSON.parse(JSON.stringify(CATEGORIAS_POR_DEFECTO));
        await guardarCatalogo(env, data);
    }
    if (!data.productos) data.productos = {};
    return data;
}

async function guardarCatalogo(env, catalogo) {
    await env.PRODUCTOS_KV.put('catalogo_completo', JSON.stringify(catalogo));
}

async function leerUsuarios(env) {
    const usuariosStr = await env.PRODUCTOS_KV.get('usuarios');
    return usuariosStr ? JSON.parse(usuariosStr) : [];
}

async function guardarUsuarios(env, usuarios) {
    await env.PRODUCTOS_KV.put('usuarios', JSON.stringify(usuarios));
}

// ============================================
// HELPERS PEDIDOS
// ============================================
async function leerPedidos(env) {
    const pedidosStr = await env.PRODUCTOS_KV.get('pedidos');
    return pedidosStr ? JSON.parse(pedidosStr) : [];
}

async function guardarPedidos(env, pedidos) {
    await env.PRODUCTOS_KV.put('pedidos', JSON.stringify(pedidos));
}

async function generarIdPedido(env) {
    const pedidos = await leerPedidos(env);
    let maxNumero = 0;
    pedidos.forEach(p => {
        const idActual = String(p.id || '');
        if (idActual.startsWith('PED-')) {
            const numeroStr = idActual.replace('PED-', '');
            const numero = parseInt(numeroStr, 10);
            if (!isNaN(numero) && numero > maxNumero) maxNumero = numero;
        }
    });
    return `PED-${String(maxNumero + 1).padStart(4, '0')}`;
}

// ============================================
// ENVÍO DE GMAIL (SIMULADO)
// ============================================
async function enviarGmailNotificacion(env, pedido) {
    if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
        console.warn('⚠️ Gmail no configurado, saltando envío de correo');
        return false;
    }
    console.log('📧 [SIMULADO] Enviando Gmail para pedido:', pedido.id);
    return true;
}

// ============================================
// GENERAR ID ALFANUMÉRICO PRODUCTO
// ============================================
function generarIdUnico(catalogo, categoria) {
    const prefijos = { 'hombre': 'HOM', 'mujer': 'MUJ', 'telas': 'TEL', 'objetos': 'OBJ' };
    const prefijo = prefijos[categoria] || 'PRD';
    let maxNumero = 0;
    Object.values(catalogo.productos || {}).forEach(p => {
        const idActual = String(p.id || p._id || '');
        if (idActual.startsWith(prefijo + '-')) {
            const numeroStr = idActual.replace(prefijo + '-', '');
            const numero = parseInt(numeroStr, 10);
            if (!isNaN(numero) && numero > maxNumero) maxNumero = numero;
        }
    });
    return `${prefijo}-${String(maxNumero + 1).padStart(4, '0')}`;
}

// ============================================
// HASH DE CONTRASEÑAS
// ============================================
async function hashearPassword(password) {
    const encoder = new TextEncoder();
    const salt = crypto.randomUUID();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return `sha256$${salt}$${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

async function verificarPassword(password, hash) {
    if (!hash) return false;
    if (!hash.startsWith('sha256$')) return password === hash;
    const [_, salt, hashOriginal] = hash.split('$');
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('') === hashOriginal;
}

// ============================================
// SESIÓN ÚNICA CON TIMEOUT
// ============================================
const MAX_INACTIVIDAD_MS = 24 * 60 * 60 * 1000;

async function crearSesionUnica(env, userId) {
    const sessionId = crypto.randomUUID();
    const session = { sessionId: sessionId, lastActivity: Date.now(), createdAt: Date.now() };
    await env.PRODUCTOS_KV.put(`SESSIONS:${userId}`, JSON.stringify(session), { expirationTtl: 8 * 60 * 60 });
    return sessionId;
}

async function eliminarSesion(env, userId) {
    await env.PRODUCTOS_KV.delete(`SESSIONS:${userId}`);
}

async function verificarSesionActiva(env, userId) {
    const sessionStr = await env.PRODUCTOS_KV.get(`SESSIONS:${userId}`);
    if (!sessionStr) return null;
    let session;
    try { session = JSON.parse(sessionStr); } catch { return { sessionId: sessionStr, lastActivity: Date.now() }; }
    if (Date.now() - session.lastActivity > MAX_INACTIVIDAD_MS) {
        await env.PRODUCTOS_KV.delete(`SESSIONS:${userId}`);
        return null;
    }
    return session;
}

async function actualizarActividadSesion(env, userId) {
    const sessionStr = await env.PRODUCTOS_KV.get(`SESSIONS:${userId}`);
    if (!sessionStr) return;
    let session;
    try { session = JSON.parse(sessionStr); } catch { return; }
    session.lastActivity = Date.now();
    await env.PRODUCTOS_KV.put(`SESSIONS:${userId}`, JSON.stringify(session), { expirationTtl: 8 * 60 * 60 });
}

async function obtenerSesionActiva(env, userId) {
    return await verificarSesionActiva(env, userId);
}

// ============================================
// VERIFICACIÓN DE TOKEN (PERMISIVA)
// ============================================
async function verificarToken(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token));
        
        if (!payload.id || !payload.username) return null;
        
        await actualizarActividadSesion(env, payload.id);
        
        return payload;
    } catch (e) { 
        return null; 
    }
}

// ============================================
// RATE LIMITING
// ============================================
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

async function verificarRateLimit(env, ip) {
    const key = `RATELIMIT:${ip}`;
    const dataStr = await env.PRODUCTOS_KV.get(key);
    if (!dataStr) return { bloqueado: false, intentos: 0 };
    const data = JSON.parse(dataStr);
    if (data.bloqueadoHasta && data.bloqueadoHasta > Date.now()) {
        return { bloqueado: true, minutosRestantes: Math.ceil((data.bloqueadoHasta - Date.now()) / 60000) };
    }
    if (data.bloqueadoHasta && data.bloqueadoHasta <= Date.now()) {
        await env.PRODUCTOS_KV.delete(key);
        return { bloqueado: false, intentos: 0 };
    }
    return { bloqueado: false, intentos: data.intentos || 0 };
}

async function registrarIntentoFallido(env, ip) {
    const key = `RATELIMIT:${ip}`;
    const dataStr = await env.PRODUCTOS_KV.get(key);
    const data = dataStr ? JSON.parse(dataStr) : { intentos: 0 };
    data.intentos = (data.intentos || 0) + 1;
    if (data.intentos >= MAX_INTENTOS) data.bloqueadoHasta = Date.now() + BLOQUEO_MINUTOS * 60 * 1000;
    await env.PRODUCTOS_KV.put(key, JSON.stringify(data), { expirationTtl: BLOQUEO_MINUTOS * 60 });
    return data;
}

async function resetearRateLimit(env, ip) {
    await env.PRODUCTOS_KV.delete(`RATELIMIT:${ip}`);
}

// ============================================
// AUDITORÍA
// ============================================
async function registrarAuditoria(env, user, action, details = {}) {
    try {
        const timestamp = new Date().toISOString();
        const key = `AUDIT:${timestamp}:${user.id}`;
        await env.PRODUCTOS_KV.put(key, JSON.stringify({ userId: user.id, username: user.username, role: user.role, action, details, timestamp }), { expirationTtl: 90 * 24 * 60 * 60 });
    } catch (error) { console.warn('⚠️ No se pudo registrar auditoría:', error); }
}

// ============================================
// WORKER PRINCIPAL
// ============================================
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: getCorsHeaders(request) });
        }

        try {
            // HEALTH
            if (path === '/api/health' && method === 'GET') {
                return addCors(new Response(JSON.stringify({
                    status: 'ok',
                    message: 'API de Textiles Madruga funcionando',
                    db: 'kv',
                    version: '6.2',
                    features: ['IDs alfanuméricos', 'Ofertas', 'Categorías Anidadas', 'Sistema de pedidos', 'Tallas', 'Sesión Persistente', 'Reset Password'],
                    timestamp: new Date().toISOString()
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // CATEGORÍAS
            // ============================================
            if (path === '/api/categorias' && method === 'GET') {
                const catalogo = await leerCatalogo(env);
                return addCors(new Response(JSON.stringify(catalogo.categorias), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/categorias' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                if (catalogo.categorias.find(c => c.id === body.id)) {
                    return addCors(new Response(JSON.stringify({ error: 'La categoría ya existe' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                catalogo.categorias.push({ id: body.id, nombre: body.nombre, subcategorias: [] });
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'CREATE_CATEGORY', { id: body.id, nombre: body.nombre });
                return addCors(new Response(JSON.stringify({ success: true, categoria: body }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/categorias/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const catId = path.split('/')[3];
                const catalogo = await leerCatalogo(env);
                catalogo.categorias = catalogo.categorias.filter(c => c.id !== catId);
                Object.values(catalogo.productos).forEach(prod => {
                    if (prod.categoria === catId) delete prod.categoria;
                    if (prod.subcategoria && !catalogo.categorias.some(c => c.subcategorias.some(s => s.id === prod.subcategoria))) delete prod.subcategoria;
                });
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'DELETE_CATEGORY', { id: catId });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // SUBCATEGORÍAS
            // ============================================
            if (path === '/api/subcategorias' && method === 'GET') {
                const catalogo = await leerCatalogo(env);
                const subcategorias = [];
                catalogo.categorias.forEach(cat => {
                    if (cat.subcategorias) {
                        cat.subcategorias.forEach(sub => subcategorias.push({ ...sub, categoriaPadre: cat.id }));
                    }
                });
                return addCors(new Response(JSON.stringify(subcategorias), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/subcategorias' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                const categoriaPadre = catalogo.categorias.find(c => c.id === body.categoriaPadre);
                if (!categoriaPadre) {
                    return addCors(new Response(JSON.stringify({ error: 'Categoría padre no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                if (categoriaPadre.subcategorias.find(s => s.id === body.id)) {
                    return addCors(new Response(JSON.stringify({ error: 'La subcategoría ya existe en esta categoría' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                categoriaPadre.subcategorias.push({ id: body.id, nombre: body.nombre });
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'CREATE_SUBCATEGORY', { id: body.id, nombre: body.nombre, padre: body.categoriaPadre });
                return addCors(new Response(JSON.stringify({ success: true, subcategoria: body }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/subcategorias/') && method === 'PUT') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const subcatId = path.split('/')[3];
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                let subcatEncontrada = null;
                let categoriaOriginal = null;
                catalogo.categorias.forEach(cat => {
                    const sub = cat.subcategorias.find(s => s.id === subcatId);
                    if (sub) { subcatEncontrada = sub; categoriaOriginal = cat; }
                });
                if (!subcatEncontrada) {
                    return addCors(new Response(JSON.stringify({ error: 'Subcategoría no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                if (body.categoriaPadre && body.categoriaPadre !== categoriaOriginal.id) {
                    const nuevaCategoria = catalogo.categorias.find(c => c.id === body.categoriaPadre);
                    if (!nuevaCategoria) {
                        return addCors(new Response(JSON.stringify({ error: 'Categoría padre no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                    }
                    categoriaOriginal.subcategorias = categoriaOriginal.subcategorias.filter(s => s.id !== subcatId);
                    nuevaCategoria.subcategorias.push({ id: subcatId, nombre: body.nombre });
                } else if (body.nombre) {
                    subcatEncontrada.nombre = body.nombre;
                }
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'UPDATE_SUBCATEGORY', { id: subcatId });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/subcategorias/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const subcatId = path.split('/')[3];
                const catalogo = await leerCatalogo(env);
                catalogo.categorias.forEach(cat => { cat.subcategorias = cat.subcategorias.filter(s => s.id !== subcatId); });
                Object.values(catalogo.productos).forEach(prod => { if (prod.subcategoria === subcatId) delete prod.subcategoria; });
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'DELETE_SUBCATEGORY', { id: subcatId });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // PEDIDOS
            // ============================================
            if (path === '/api/pedidos' && method === 'POST') {
                const body = await request.json();
                if (!body.producto || !body.nombre || !body.telefono) {
                    return addCors(new Response(JSON.stringify({ error: 'Faltan datos: producto, nombre y teléfono son obligatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                let variantes = [];
                if (Array.isArray(body.variantes) && body.variantes.length > 0) {
                    variantes = body.variantes.map(v => ({ talla: String(v.talla || '').substring(0, 10).toUpperCase(), cantidad: parseInt(v.cantidad) || 1 })).filter(v => v.talla && v.cantidad > 0);
                }
                const cantidadTotal = parseInt(body.cantidad) || 1;
                const cantidadAsignada = variantes.reduce((sum, v) => sum + v.cantidad, 0);
                if (variantes.length > 0 && cantidadAsignada !== cantidadTotal) {
                    return addCors(new Response(JSON.stringify({ error: `Las tallas suman ${cantidadAsignada} pero el total es ${cantidadTotal}. Ajusta las cantidades.` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const pedidos = await leerPedidos(env);
                const idPedido = await generarIdPedido(env);
                const nuevoPedido = {
                    id: idPedido, producto: body.producto,
                    nombre: String(body.nombre).substring(0, 100),
                    telefono: String(body.telefono || '').substring(0, 20),
                    email: String(body.email || '').substring(0, 100),
                    tipoEntrega: body.tipoEntrega || 'domicilio',
                    direccion: String(body.direccion || '').substring(0, 200),
                    referencia: String(body.referencia || '').substring(0, 200),
                    municipio: String(body.municipio || '').substring(0, 100),
                    cantidad: cantidadTotal, variantes,
                    tallasTexto: String(body.tallasTexto || '').substring(0, 300),
                    notas: String(body.notas || '').substring(0, 500),
                    metodoPago: body.metodoPago || 'efectivo',
                    contactoPreferido: body.contactoPreferido || 'whatsapp',
                    via: body.via || 'solo_aqui',
                    estado: 'pendiente', fecha: new Date().toISOString(), ip
                };
                pedidos.unshift(nuevoPedido);
                await guardarPedidos(env, pedidos);
                if (body.via === 'email') { try { await enviarGmailNotificacion(env, nuevoPedido); } catch (e) {} }
                return addCors(new Response(JSON.stringify({ success: true, id: idPedido, mensaje: 'Pedido guardado correctamente' }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/pedidos' && method === 'GET') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const pedidos = await leerPedidos(env);
                return addCors(new Response(JSON.stringify({ pedidos }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/pedidos/') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const pedidoId = path.split('/')[3];
                const body = await request.json();
                const pedidos = await leerPedidos(env);
                const idx = pedidos.findIndex(p => p.id === pedidoId);
                if (idx === -1) return addCors(new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                if (body.estado) pedidos[idx].estado = body.estado;
                if (body.costoEnvio !== undefined) pedidos[idx].costoEnvio = parseInt(body.costoEnvio) || 0;
                if (body.notas !== undefined) pedidos[idx].notas = body.notas;
                await guardarPedidos(env, pedidos);
                await registrarAuditoria(env, user, 'UPDATE_PEDIDO', { id: pedidoId, estado: body.estado });
                return addCors(new Response(JSON.stringify({ success: true, pedido: pedidos[idx] }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/pedidos/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const pedidoId = path.split('/')[3];
                let pedidos = await leerPedidos(env);
                if (!pedidos.find(p => p.id === pedidoId)) return addCors(new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                pedidos = pedidos.filter(p => p.id !== pedidoId);
                await guardarPedidos(env, pedidos);
                await registrarAuditoria(env, user, 'DELETE_PEDIDO', { id: pedidoId });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // PRODUCTOS
            // ============================================
            if (path === '/api/productos' && method === 'GET') {
                const catalogo = await leerCatalogo(env);
                const productos = Object.values(catalogo.productos);
                return addCors(new Response(JSON.stringify({ productos }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/products' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                const idFinal = body.id || generarIdUnico(catalogo, body.categoria);
                const esActualizacion = !!catalogo.productos[idFinal];
                catalogo.productos[idFinal] = { ...catalogo.productos[idFinal], ...body, id: idFinal, _id: idFinal };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, esActualizacion ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT', { id: idFinal, nombre: body.nombre, categoria: body.categoria, subcategoria: body.subcategoria });
                return addCors(new Response(JSON.stringify({ success: true, id: idFinal, _id: idFinal, esActualizacion, ...body }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/products/') && method === 'PUT') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const productId = path.split('/')[3];
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                let claveReal = null;
                if (catalogo.productos[productId]) claveReal = productId;
                else {
                    for (const clave of Object.keys(catalogo.productos)) {
                        const p = catalogo.productos[clave];
                        if (String(p.id) === String(productId) || String(p._id) === String(productId) || String(clave) === String(productId)) { claveReal = clave; break; }
                    }
                }
                if (!claveReal) return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                catalogo.productos[claveReal] = { ...catalogo.productos[claveReal], ...body };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'UPDATE_PRODUCT', { id: productId, claveReal, tipoTallas: body.tipoTallas, subcategoria: body.subcategoria });
                return addCors(new Response(JSON.stringify({ success: true, ...catalogo.productos[claveReal] }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/products/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const productId = path.split('/')[3];
                const catalogo = await leerCatalogo(env);
                let claveReal = null;
                let productoEncontrado = null;
                if (catalogo.productos[productId]) { claveReal = productId; productoEncontrado = catalogo.productos[productId]; }
                else {
                    for (const clave of Object.keys(catalogo.productos)) {
                        const p = catalogo.productos[clave];
                        if (String(p.id) === String(productId) || String(p._id) === String(productId) || String(clave) === String(productId)) { claveReal = clave; productoEncontrado = p; break; }
                    }
                }
                if (!claveReal || !productoEncontrado) return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado', idBuscado: productId }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                delete catalogo.productos[claveReal];
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'DELETE_PRODUCT', { id: productId, claveReal, nombre: productoEncontrado.nombre });
                return addCors(new Response(JSON.stringify({ success: true, idEliminado: productId, nombre: productoEncontrado.nombre }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // TOGGLE OFERTA
            if (path.startsWith('/api/offers/toggle/') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const productId = path.split('/').pop();
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                let claveReal = null;
                if (catalogo.productos[productId]) claveReal = productId;
                else {
                    for (const clave of Object.keys(catalogo.productos)) {
                        const p = catalogo.productos[clave];
                        if (String(p.id) === String(productId) || String(p._id) === String(productId) || String(clave) === String(productId)) { claveReal = clave; break; }
                    }
                }
                if (!claveReal || !catalogo.productos[claveReal]) return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                catalogo.productos[claveReal].enOferta = body.enOferta;
                if (body.tipoOferta !== undefined) catalogo.productos[claveReal].tipoOferta = body.tipoOferta;
                if (body.descuento !== undefined) catalogo.productos[claveReal].descuento = parseInt(body.descuento) || 0;
                if (body.promocion !== undefined) catalogo.productos[claveReal].promocion = body.promocion || '';
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'TOGGLE_OFFER', { id: productId, enOferta: body.enOferta });
                return addCors(new Response(JSON.stringify({ success: true, producto: catalogo.productos[claveReal] }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // AUTENTICACIÓN
            // ============================================
            if (path === '/api/auth/login' && (method === 'POST' || method === 'GET')) {
                const rateLimit = await verificarRateLimit(env, ip);
                if (rateLimit.bloqueado) {
                    return addCors(new Response(JSON.stringify({ error: `Demasiados intentos fallidos. Intenta en ${rateLimit.minutosRestantes} minutos.` }), { status: 429, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                let username, password;
                if (method === 'POST') {
                    const body = await request.json();
                    username = body.username;
                    password = body.password;
                } else {
                    username = url.searchParams.get('username');
                    password = url.searchParams.get('password');
                }
                
                const usuarios = await leerUsuarios(env);
                const user = usuarios.find(u => u.username === username);
                let passwordValida = false;
                if (user) passwordValida = await verificarPassword(password, user.password);
                
                if (!user || !passwordValida) {
                    const intentosData = await registrarIntentoFallido(env, ip);
                    return addCors(new Response(JSON.stringify({ error: 'Credenciales incorrectas', intentosRestantes: Math.max(0, MAX_INTENTOS - intentosData.intentos) }), { status: 401, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                // ✅ Sin bloqueo 409
                await resetearRateLimit(env, ip);
                const sessionId = await crearSesionUnica(env, user.id);
                const token = btoa(JSON.stringify({ id: user.id, username: user.username, role: user.role, email: user.email, sessionId: sessionId }));
                await registrarAuditoria(env, user, 'LOGIN', { ip });
                return addCors(new Response(JSON.stringify({ success: true, token, user: { id: user.id, username: user.username, role: user.role, email: user.email || '' } }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/auth/force-logout' && method === 'POST') {
                const { username, password } = await request.json();
                const usuarios = await leerUsuarios(env);
                const user = usuarios.find(u => u.username === username);
                let passwordValida = false;
                if (user) passwordValida = await verificarPassword(password, user.password);
                if (!user || !passwordValida) {
                    return addCors(new Response(JSON.stringify({ error: 'Credenciales incorrectas' }), { status: 401, headers: { 'Content-Type': 'application/json' } }), request);
                }
                await eliminarSesion(env, user.id);
                await registrarAuditoria(env, user, 'FORCE_LOGOUT', { ip });
                return addCors(new Response(JSON.stringify({ success: true, message: 'Sesión cerrada. Ya puedes iniciar sesión de nuevo.' }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/auth/logout' && method === 'POST') {
                let user = await verificarToken(request, env);
                if (!user) {
                    try {
                        const body = await request.json();
                        if (body.token) {
                            const payload = JSON.parse(atob(body.token));
                            if (payload.id) {
                                await eliminarSesion(env, payload.id);
                                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
                            }
                        }
                    } catch (e) {}
                }
                if (user && user.id) {
                    await eliminarSesion(env, user.id);
                    await registrarAuditoria(env, user, 'LOGOUT', { ip });
                }
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/auth/register' && method === 'POST') {
                const body = await request.json();
                const { username, password, role, email, name } = body;
                
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const usuarios = await leerUsuarios(env);
                if (usuarios.find(u => u.username === username)) {
                    return addCors(new Response(JSON.stringify({ error: 'El usuario ya existe' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const passwordHash = await hashearPassword(password);
                const nuevoUsuario = { id: `user_${Date.now()}`, username, password: passwordHash, role: role || 'user', email: email || '', name: name || username };
                usuarios.push(nuevoUsuario);
                await guardarUsuarios(env, usuarios);
                await registrarAuditoria(env, user, 'CREATE_USER', { username, role: nuevoUsuario.role });
                return addCors(new Response(JSON.stringify({ success: true, user: { id: nuevoUsuario.id, username, role: nuevoUsuario.role, email: nuevoUsuario.email } }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/users' && method === 'GET') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') {
                    return addCors(new Response(JSON.stringify({ error: 'Solo el SuperAdmin puede ver usuarios' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const usuarios = await leerUsuarios(env);
                const usuariosSinPass = usuarios.map(({ password, ...rest }) => rest);
                return addCors(new Response(JSON.stringify(usuariosSinPass), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/users/') && path.endsWith('/password') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') {
                    return addCors(new Response(JSON.stringify({ error: 'Solo el SuperAdmin puede resetear contraseñas' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const userId = path.split('/')[3];
                const { password } = await request.json();
                if (!password || password.length < 6) {
                    return addCors(new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const usuarios = await leerUsuarios(env);
                const idx = usuarios.findIndex(u => u.id === userId);
                if (idx === -1) {
                    return addCors(new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                usuarios[idx].password = await hashearPassword(password);
                await guardarUsuarios(env, usuarios);
                await registrarAuditoria(env, user, 'RESET_PASSWORD', { userId });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/users/') && path.endsWith('/role') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') {
                    return addCors(new Response(JSON.stringify({ error: 'Solo el SuperAdmin puede cambiar roles' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const userId = path.split('/')[3];
                const { role } = await request.json();
                const usuarios = await leerUsuarios(env);
                const idx = usuarios.findIndex(u => u.id === userId);
                if (idx !== -1) {
                    usuarios[idx].role = role;
                    await guardarUsuarios(env, usuarios);
                    await registrarAuditoria(env, user, 'CHANGE_ROLE', { userId, role });
                }
                return addCors(new Response(JSON.stringify({ success: true, role }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/users/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') {
                    return addCors(new Response(JSON.stringify({ error: 'Solo el SuperAdmin puede eliminar usuarios' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const userId = path.split('/')[3];
                let usuarios = await leerUsuarios(env);
                usuarios = usuarios.filter(u => u.id !== userId);
                await guardarUsuarios(env, usuarios);
                await eliminarSesion(env, userId);
                await registrarAuditoria(env, user, 'DELETE_USER', { userId });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // 404
            return addCors(new Response(JSON.stringify({ error: 'Ruta no encontrada', path }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);

        } catch (error) {
            console.error('❌ Error general:', error);
            return addCors(new Response(JSON.stringify({ error: 'Error interno del servidor', message: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }), request);
        }
    }
};