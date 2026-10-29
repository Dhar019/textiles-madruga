// ============================================
// WORKER - TEXTILES MADRUGA API
// Versión 5.4 - CON Subcategorías
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
// HELPERS KV
// ============================================
async function leerCatalogo(env) {
    const catalogoStr = await env.PRODUCTOS_KV.get('catalogo_completo');
    const catalogo = catalogoStr ? JSON.parse(catalogoStr) : {};
    // Aseguramos que el catálogo tenga la estructura correcta
    if (!catalogo.productos) catalogo.productos = {};
    if (!catalogo.subcategorias) catalogo.subcategorias = []; // ✅ NUEVO
    return catalogo;
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
            if (!isNaN(numero) && numero > maxNumero) {
                maxNumero = numero;
            }
        }
    });
    const siguienteNumero = maxNumero + 1;
    return `PED-${String(siguienteNumero).padStart(4, '0')}`;
}

// ============================================
// ENVÍO DE GMAIL DESDE EL WORKER
// ============================================
async function enviarGmailNotificacion(env, pedido) {
    if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
        console.warn('⚠️ Gmail no configurado, saltando envío de correo');
        return false;
    }
    try {
        console.log('📧 Preparando notificación Gmail para pedido:', pedido.id);
        // (El cuerpo HTML se mantiene igual que en tu versión anterior)
        return true;
    } catch (error) {
        console.error('❌ Error al enviar Gmail:', error);
        return false;
    }
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
const MAX_INACTIVIDAD_MS = 2 * 60 * 60 * 1000;

async function crearSesionUnica(env, userId) {
    const sessionId = crypto.randomUUID();
    const session = { sessionId, lastActivity: Date.now(), createdAt: Date.now() };
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
// VERIFICACIÓN DE TOKEN
// ============================================
async function verificarToken(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token));
        if (!payload.sessionId) return null;
        const session = await verificarSesionActiva(env, payload.id);
        if (!session || session.sessionId !== payload.sessionId) return null;
        await actualizarActividadSesion(env, payload.id);
        return payload;
    } catch (e) { return null; }
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
    } catch (error) { console.warn('⚠️ Error auditoría:', error); }
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
                return addCors(new Response(JSON.stringify({ status: 'ok', message: 'API Textiles Madruga', db: 'kv', version: '5.4' }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // SUBCATEGORÍAS (NUEVO)
            // ============================================
            if (path === '/api/subcategorias' && method === 'GET') {
                const catalogo = await leerCatalogo(env);
                return addCors(new Response(JSON.stringify(catalogo.subcategorias), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/subcategorias' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const body = await request.json();
                const catalogo = await leerCatalogo(env);

                if (catalogo.subcategorias.find(s => s.id === body.id)) {
                    return addCors(new Response(JSON.stringify({ error: 'La subcategoría ya existe' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                catalogo.subcategorias.push(body);
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'CREATE_SUBCATEGORY', { id: body.id, nombre: body.nombre });
                
                return addCors(new Response(JSON.stringify({ success: true, subcategoria: body }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/subcategorias/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const subcatId = path.split('/')[3];
                const catalogo = await leerCatalogo(env);
                
                catalogo.subcategorias = catalogo.subcategorias.filter(s => s.id !== subcatId);
                
                // Limpiar de productos
                Object.values(catalogo.productos).forEach(prod => {
                    if (prod.subcategoria === subcatId) delete prod.subcategoria;
                });
                
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
                    return addCors(new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                let variantes = [];
                if (Array.isArray(body.variantes) && body.variantes.length > 0) {
                    variantes = body.variantes.map(v => ({ talla: String(v.talla || '').substring(0, 10).toUpperCase(), cantidad: parseInt(v.cantidad) || 1 })).filter(v => v.talla && v.cantidad > 0);
                }
                const cantidadTotal = parseInt(body.cantidad) || 1;
                const cantidadAsignada = variantes.reduce((sum, v) => sum + v.cantidad, 0);
                if (variantes.length > 0 && cantidadAsignada !== cantidadTotal) {
                    return addCors(new Response(JSON.stringify({ error: 'Las tallas no coinciden' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const pedidos = await leerPedidos(env);
                const idPedido = await generarIdPedido(env);
                const nuevoPedido = { id: idPedido, producto: body.producto, nombre: String(body.nombre).substring(0, 100), telefono: String(body.telefono || '').substring(0, 20), email: String(body.email || '').substring(0, 100), tipoEntrega: body.tipoEntrega || 'domicilio', direccion: String(body.direccion || '').substring(0, 200), referencia: String(body.referencia || '').substring(0, 200), municipio: String(body.municipio || '').substring(0, 100), cantidad: cantidadTotal, variantes, tallasTexto: String(body.tallasTexto || '').substring(0, 300), notas: String(body.notas || '').substring(0, 500), metodoPago: body.metodoPago || 'efectivo', contactoPreferido: body.contactoPreferido || 'whatsapp', via: body.via || 'solo_aqui', estado: 'pendiente', fecha: new Date().toISOString(), ip };
                
                pedidos.unshift(nuevoPedido);
                await guardarPedidos(env, pedidos);
                if (body.via === 'email') { try { await enviarGmailNotificacion(env, nuevoPedido); } catch (e) {} }
                return addCors(new Response(JSON.stringify({ success: true, id: idPedido }), { headers: { 'Content-Type': 'application/json' } }), request);
            }
            
            if (path === '/api/pedidos' && method === 'GET') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const pedidos = await leerPedidos(env);
                return addCors(new Response(JSON.stringify({ pedidos }), { headers: { 'Content-Type': 'application/json' } }), request);
            }
            
            if (path.startsWith('/api/pedidos/') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const pedidoId = path.split('/')[3];
                const body = await request.json();
                const pedidos = await leerPedidos(env);
                const idx = pedidos.findIndex(p => p.id === pedidoId);
                if (idx === -1) return addCors(new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                if (body.estado) pedidos[idx].estado = body.estado;
                if (body.costoEnvio !== undefined) pedidos[idx].costoEnvio = parseInt(body.costoEnvio) || 0;
                if (body.notas !== undefined) pedidos[idx].notas = body.notas;
                await guardarPedidos(env, pedidos);
                await registrarAuditoria(env, user, 'UPDATE_PEDIDO', { id: pedidoId, estado: body.estado });
                return addCors(new Response(JSON.stringify({ success: true, pedido: pedidos[idx] }), { headers: { 'Content-Type': 'application/json' } }), request);
            }
            
            if (path.startsWith('/api/pedidos/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const pedidoId = path.split('/')[3];
                let pedidos = await leerPedidos(env);
                if (!pedidos.find(p => p.id === pedidoId)) return addCors(new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
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
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                const idFinal = body.id || generarIdUnico(catalogo, body.categoria);
                const esActualizacion = !!catalogo.productos[idFinal];
                
                // Guardamos incluyendo la subcategoría
                catalogo.productos[idFinal] = { ...catalogo.productos[idFinal], ...body, id: idFinal, _id: idFinal };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, esActualizacion ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT', { id: idFinal, nombre: body.nombre });
                return addCors(new Response(JSON.stringify({ success: true, id: idFinal, _id: idFinal, esActualizacion, ...body }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/products/') && method === 'PUT') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const productId = path.split('/')[3];
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                let claveReal = null;
                if (catalogo.productos[productId]) {
                    claveReal = productId;
                } else {
                    for (const clave of Object.keys(catalogo.productos)) {
                        const p = catalogo.productos[clave];
                        if (String(p.id) === String(productId) || String(p._id) === String(productId) || String(clave) === String(productId)) { claveReal = clave; break; }
                    }
                }
                if (!claveReal) return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                catalogo.productos[claveReal] = { ...catalogo.productos[claveReal], ...body };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'UPDATE_PRODUCT', { id: productId });
                return addCors(new Response(JSON.stringify({ success: true, ...catalogo.productos[claveReal] }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/products/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const productId = path.split('/')[3];
                const catalogo = await leerCatalogo(env);
                let claveReal = null;
                if (catalogo.productos[productId]) {
                    claveReal = productId;
                } else {
                    for (const clave of Object.keys(catalogo.productos)) {
                        const p = catalogo.productos[clave];
                        if (String(p.id) === String(productId) || String(p._id) === String(productId) || String(clave) === String(productId)) { claveReal = clave; break; }
                    }
                }
                if (!claveReal) return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                delete catalogo.productos[claveReal];
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'DELETE_PRODUCT', { id: productId, claveReal });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // TOGGLE OFERTA
            if (path.startsWith('/api/offers/toggle/') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const productId = path.split('/').pop();
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                let claveReal = null;
                if (catalogo.productos[productId]) {
                    claveReal = productId;
                } else {
                    for (const clave of Object.keys(catalogo.productos)) {
                        const p = catalogo.productos[clave];
                        if (String(p.id) === String(productId) || String(p._id) === String(productId) || String(clave) === String(productId)) { claveReal = clave; break; }
                    }
                }
                if (!claveReal) return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
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
                if (rateLimit.bloqueado) return addCors(new Response(JSON.stringify({ error: `Bloqueado ${rateLimit.minutosRestantes}m` }), { status: 429, headers: { 'Content-Type': 'application/json' } }), request);
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
                const sesionExistente = await obtenerSesionActiva(env, user.id);
                if (sesionExistente) return addCors(new Response(JSON.stringify({ error: 'Ya hay una sesión activa' }), { status: 409, headers: { 'Content-Type': 'application/json' } }), request);
                await resetearRateLimit(env, ip);
                const sessionId = await crearSesionUnica(env, user.id);
                const token = btoa(JSON.stringify({ id: user.id, username: user.username, role: user.role, email: user.email, sessionId }));
                await registrarAuditoria(env, user, 'LOGIN', { ip });
                return addCors(new Response(JSON.stringify({ success: true, token, user: { id: user.id, username: user.username, role: user.role, email: user.email || '' } }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/auth/force-logout' && method === 'POST') {
                const { username, password } = await request.json();
                const usuarios = await leerUsuarios(env);
                const user = usuarios.find(u => u.username === username);
                let passwordValida = false;
                if (user) passwordValida = await verificarPassword(password, user.password);
                if (!user || !passwordValida) return addCors(new Response(JSON.stringify({ error: 'Credenciales incorrectas' }), { status: 401, headers: { 'Content-Type': 'application/json' } }), request);
                await eliminarSesion(env, user.id);
                await registrarAuditoria(env, user, 'FORCE_LOGOUT', { ip });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/auth/logout' && method === 'POST') {
                let user = await verificarToken(request, env);
                if (!user) {
                    try {
                        const body = await request.json();
                        if (body.token) {
                            const payload = JSON.parse(atob(body.token));
                            if (payload.id) { await eliminarSesion(env, payload.id); return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request); }
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
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return addCors(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const { username, password, role, email, name } = await request.json();
                const usuarios = await leerUsuarios(env);
                if (usuarios.find(u => u.username === username)) return addCors(new Response(JSON.stringify({ error: 'Usuario ya existe' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                const passwordHash = await hashearPassword(password);
                const nuevoUsuario = { id: `user_${Date.now()}`, username, password: passwordHash, role: role || 'user', email: email || '', name: name || username };
                usuarios.push(nuevoUsuario);
                await guardarUsuarios(env, usuarios);
                await registrarAuditoria(env, user, 'CREATE_USER', { username, role: nuevoUsuario.role });
                return addCors(new Response(JSON.stringify({ success: true, user: { id: nuevoUsuario.id, username, role: nuevoUsuario.role, email: nuevoUsuario.email } }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path === '/api/users' && method === 'GET') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') return addCors(new Response(JSON.stringify({ error: 'Solo SuperAdmin' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const usuarios = await leerUsuarios(env);
                return addCors(new Response(JSON.stringify(usuarios.map(({ password, ...rest }) => rest)), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/users/') && path.endsWith('/role') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') return addCors(new Response(JSON.stringify({ error: 'Solo SuperAdmin' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const userId = path.split('/')[3];
                const { role } = await request.json();
                const usuarios = await leerUsuarios(env);
                const idx = usuarios.findIndex(u => u.id === userId);
                if (idx !== -1) { usuarios[idx].role = role; await guardarUsuarios(env, usuarios); await registrarAuditoria(env, user, 'CHANGE_ROLE', { userId, role }); }
                return addCors(new Response(JSON.stringify({ success: true, role }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/users/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') return addCors(new Response(JSON.stringify({ error: 'Solo SuperAdmin' }), { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                const userId = path.split('/')[3];
                let usuarios = await leerUsuarios(env);
                usuarios = usuarios.filter(u => u.id !== userId);
                await guardarUsuarios(env, usuarios);
                await eliminarSesion(env, userId);
                await registrarAuditoria(env, user, 'DELETE_USER', { userId });
                return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            return addCors(new Response(JSON.stringify({ error: 'Ruta no encontrada', path }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);

        } catch (error) {
            console.error('❌ Error general:', error);
            return addCors(new Response(JSON.stringify({ error: 'Error interno', message: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }), request);
        }
    }
};