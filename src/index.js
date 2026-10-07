// ============================================
// WORKER - TEXTILES MADRUGA API
// Versión 3.6 - Con Turnstile, sin jose
// Base64 + SHA-256 + RateLimit + Turnstile + Auditoría
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
    return catalogoStr ? JSON.parse(catalogoStr) : {};
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
// HASH DE CONTRASEÑAS (SHA-256 con salt)
// ============================================
async function hashearPassword(password) {
    const encoder = new TextEncoder();
    const salt = crypto.randomUUID();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256$${salt}$${hashHex}`;
}

async function verificarPassword(password, hash) {
    if (!hash) return false;
    if (!hash.startsWith('sha256$')) {
        return password === hash;
    }
    const [_, salt, hashOriginal] = hash.split('$');
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hashOriginal;
}

// ============================================
// SESIÓN BLOQUEADA
// ============================================
async function crearSesionUnica(env, userId) {
    const sessionId = crypto.randomUUID();
    await env.PRODUCTOS_KV.put(
        `SESSIONS:${userId}`,
        sessionId,
        { expirationTtl: 8 * 60 * 60 }
    );
    return sessionId;
}

async function eliminarSesion(env, userId) {
    await env.PRODUCTOS_KV.delete(`SESSIONS:${userId}`);
}

async function obtenerSesionActiva(env, userId) {
    return await env.PRODUCTOS_KV.get(`SESSIONS:${userId}`);
}

// ============================================
// VERIFICACIÓN DE TOKEN (SIN JOSE, SOLO BASE64)
// ============================================
async function verificarToken(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token));

        if (!payload.sessionId) return null;
        const kvSessionId = await env.PRODUCTOS_KV.get(`SESSIONS:${payload.id}`);
        if (!kvSessionId || kvSessionId !== payload.sessionId) {
            return null;
        }

        return payload;
    } catch (e) {
        console.error('Token verify failed:', e.message);
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
        const minutosRestantes = Math.ceil((data.bloqueadoHasta - Date.now()) / 60000);
        return { bloqueado: true, minutosRestantes };
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

    if (data.intentos >= MAX_INTENTOS) {
        data.bloqueadoHasta = Date.now() + BLOQUEO_MINUTOS * 60 * 1000;
    }

    await env.PRODUCTOS_KV.put(key, JSON.stringify(data), {
        expirationTtl: BLOQUEO_MINUTOS * 60
    });

    return data;
}

async function resetearRateLimit(env, ip) {
    await env.PRODUCTOS_KV.delete(`RATELIMIT:${ip}`);
}

// ============================================
// TURNSTILE
// ============================================
async function verificarTurnstile(token, ip, env) {
    if (!token) return false;
    if (!env.TURNSTILE_SECRET_KEY) {
        console.warn('⚠️ TURNSTILE_SECRET_KEY no configurada, saltando verificación');
        return true;
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: env.TURNSTILE_SECRET_KEY,
                response: token,
                remoteip: ip
            })
        });
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('Turnstile verification failed:', error);
        return false;
    }
}

// ============================================
// AUDITORÍA
// ============================================
async function registrarAuditoria(env, user, action, details = {}) {
    try {
        const timestamp = new Date().toISOString();
        const key = `AUDIT:${timestamp}:${user.id}`;
        await env.PRODUCTOS_KV.put(key, JSON.stringify({
            userId: user.id,
            username: user.username,
            role: user.role,
            action,
            details,
            timestamp
        }), { expirationTtl: 90 * 24 * 60 * 60 });
    } catch (error) {
        console.warn('⚠️ No se pudo registrar auditoría:', error);
    }
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

        // CORS preflight
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
                    'Access-Control-Max-Age': '86400'
                }
            });
        }

        try {
            // HEALTH
            if (path === '/api/health' && method === 'GET') {
                return addCors(new Response(JSON.stringify({
                    status: 'ok',
                    message: 'API de Textiles Madruga funcionando (KV)',
                    db: 'kv',
                    security: ['Base64', 'SHA-256', 'RateLimit', 'Turnstile', 'Audit'],
                    timestamp: new Date().toISOString()
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // PRODUCTOS (LISTAR)
            if (path === '/api/productos' && method === 'GET') {
                const catalogo = await leerCatalogo(env);
                const productos = Object.values(catalogo);
                return addCors(new Response(JSON.stringify({ productos }), {
                    headers: { 'Content-Type': 'application/json' }
                }), request);
            }

            // CREAR PRODUCTO
            if (path === '/api/products' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const body = await request.json();
                const id = body.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const catalogo = await leerCatalogo(env);
                catalogo[id] = { ...body, _id: id };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'CREATE_PRODUCT', { id, nombre: body.nombre });
                return addCors(new Response(JSON.stringify({
                    success: true,
                    _id: id,
                    ...body
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ACTUALIZAR PRODUCTO
            if (path.startsWith('/api/products/') && method === 'PUT') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const productId = path.split('/')[3];
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                if (!catalogo[productId]) {
                    return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                catalogo[productId] = { ...catalogo[productId], ...body };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'UPDATE_PRODUCT', { id: productId });
                return addCors(new Response(JSON.stringify({
                    success: true,
                    ...catalogo[productId]
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ELIMINAR PRODUCTO
            if (path.startsWith('/api/products/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const productId = path.split('/')[3];
                const catalogo = await leerCatalogo(env);
                delete catalogo[productId];
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'DELETE_PRODUCT', { id: productId });
                return addCors(new Response(JSON.stringify({ success: true }),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // TOGGLE OFERTA
            if (path.startsWith('/api/offers/toggle/') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const productId = path.split('/').pop();
                const body = await request.json();
                const catalogo = await leerCatalogo(env);
                if (catalogo[productId]) {
                    catalogo[productId].enOferta = body.enOferta;
                    if (body.descuento !== undefined) {
                        catalogo[productId].descuento = body.descuento;
                    }
                    await guardarCatalogo(env, catalogo);
                    await registrarAuditoria(env, user, 'TOGGLE_OFFER', { id: productId, enOferta: body.enOferta });
                }
                return addCors(new Response(JSON.stringify({ success: true }),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // LOGIN (CON TURNSTILE, SIN JOSE)
            if (path === '/api/auth/login' && (method === 'POST' || method === 'GET')) {
                const rateLimit = await verificarRateLimit(env, ip);
                if (rateLimit.bloqueado) {
                    return addCors(new Response(JSON.stringify({
                        error: `Demasiados intentos fallidos. Intenta en ${rateLimit.minutosRestantes} minutos.`
                    }), { status: 429, headers: { 'Content-Type': 'application/json' } }), request);
                }

                let username, password, turnstileToken;
                
                if (method === 'POST') {
                    const body = await request.json();
                    username = body.username;
                    password = body.password;
                    turnstileToken = body.turnstileToken;
                } else {
                    username = url.searchParams.get('username');
                    password = url.searchParams.get('password');
                    turnstileToken = url.searchParams.get('turnstileToken');
                }

                if (env.TURNSTILE_SECRET_KEY && turnstileToken) {
                    const turnstileOk = await verificarTurnstile(turnstileToken, ip, env);
                    if (!turnstileOk) {
                        return addCors(new Response(JSON.stringify({ error: 'Verificación de seguridad fallida' }),
                            { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                    }
                }

                const usuarios = await leerUsuarios(env);
                const user = usuarios.find(u => u.username === username);

                let passwordValida = false;
                if (user) {
                    passwordValida = await verificarPassword(password, user.password);
                }

                if (!user || !passwordValida) {
                    const intentosData = await registrarIntentoFallido(env, ip);
                    return addCors(new Response(JSON.stringify({
                        error: 'Credenciales incorrectas',
                        intentosRestantes: Math.max(0, MAX_INTENTOS - intentosData.intentos)
                    }), { status: 401, headers: { 'Content-Type': 'application/json' } }), request);
                }

                const sesionExistente = await obtenerSesionActiva(env, user.id);
                if (sesionExistente) {
                    return addCors(new Response(JSON.stringify({
                        error: 'Ya hay una sesión activa en otro dispositivo. Cierra sesión allí primero.'
                    }), { status: 409, headers: { 'Content-Type': 'application/json' } }), request);
                }

                await resetearRateLimit(env, ip);
                const sessionId = await crearSesionUnica(env, user.id);

                const token = btoa(JSON.stringify({
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    email: user.email,
                    sessionId: sessionId
                }));

                await registrarAuditoria(env, user, 'LOGIN', { ip });

                return addCors(new Response(JSON.stringify({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        email: user.email || ''
                    }
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // FORZAR CIERRE DE SESIÓN
            if (path === '/api/auth/force-logout' && method === 'POST') {
                const { username, password } = await request.json();
                const usuarios = await leerUsuarios(env);

                const user = usuarios.find(u => u.username === username);
                let passwordValida = false;
                if (user) {
                    passwordValida = await verificarPassword(password, user.password);
                }

                if (!user || !passwordValida) {
                    return addCors(new Response(JSON.stringify({ error: 'Credenciales incorrectas' }),
                        { status: 401, headers: { 'Content-Type': 'application/json' } }), request);
                }

                await eliminarSesion(env, user.id);
                await registrarAuditoria(env, user, 'FORCE_LOGOUT', { ip });

                return addCors(new Response(JSON.stringify({
                    success: true,
                    message: 'Sesión cerrada. Ya puedes iniciar sesión de nuevo.'
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // LOGOUT
            if (path === '/api/auth/logout' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (user && user.id) {
                    await eliminarSesion(env, user.id);
                    await registrarAuditoria(env, user, 'LOGOUT', { ip });
                }
                return addCors(new Response(JSON.stringify({ success: true }),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // REGISTRO
            if (path === '/api/auth/register' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const { username, password, role, email, name } = await request.json();
                const usuarios = await leerUsuarios(env);

                if (usuarios.find(u => u.username === username)) {
                    return addCors(new Response(JSON.stringify({ error: 'El usuario ya existe' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }

                const passwordHash = await hashearPassword(password);

                const nuevoUsuario = {
                    id: `user_${Date.now()}`,
                    username,
                    password: passwordHash,
                    role: role || 'user',
                    email: email || '',
                    name: name || username
                };
                usuarios.push(nuevoUsuario);
                await guardarUsuarios(env, usuarios);
                await registrarAuditoria(env, user, 'CREATE_USER', { username, role: nuevoUsuario.role });

                return addCors(new Response(JSON.stringify({
                    success: true,
                    user: { id: nuevoUsuario.id, username, role: nuevoUsuario.role, email: nuevoUsuario.email }
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // LISTAR USUARIOS
            if (path === '/api/users' && method === 'GET') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') {
                    return addCors(new Response(JSON.stringify({ error: 'Solo el SuperAdmin puede ver usuarios' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const usuarios = await leerUsuarios(env);
                const usuariosSinPass = usuarios.map(({ password, ...rest }) => rest);
                return addCors(new Response(JSON.stringify(usuariosSinPass),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // CAMBIAR ROL
            if (path.startsWith('/api/users/') && path.endsWith('/role') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') {
                    return addCors(new Response(JSON.stringify({ error: 'Solo el SuperAdmin puede cambiar roles' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
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
                return addCors(new Response(JSON.stringify({ success: true, role }),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ELIMINAR USUARIO
            if (path.startsWith('/api/users/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || user.role !== 'superadmin') {
                    return addCors(new Response(JSON.stringify({ error: 'Solo el SuperAdmin puede eliminar usuarios' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const userId = path.split('/')[3];
                let usuarios = await leerUsuarios(env);
                usuarios = usuarios.filter(u => u.id !== userId);
                await guardarUsuarios(env, usuarios);
                await eliminarSesion(env, userId);
                await registrarAuditoria(env, user, 'DELETE_USER', { userId });
                return addCors(new Response(JSON.stringify({ success: true }),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // 404
            return addCors(new Response(JSON.stringify({ error: 'Ruta no encontrada', path }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }), request);

        } catch (error) {
            console.error('❌ Error general:', error);
            return addCors(new Response(JSON.stringify({
                error: 'Error interno del servidor',
                message: error.message
            }), { status: 500, headers: { 'Content-Type': 'application/json' } }), request);
        }
    }
};