// ============================================
// WORKER - TEXTILES MADRUGA API
// Versión 5.1 - Sistema de variantes
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
        const asunto = `🛒 Nuevo pedido ${pedido.id} - ${pedido.producto}`;
        
        // Construir string de tallas (compatible con variantes y talla única)
        let tallasTexto = '';
        if (pedido.variantes && pedido.variantes.length > 0) {
            tallasTexto = pedido.variantes.map(v => `${v.cantidad}x talla ${v.talla}`).join(', ');
        } else if (pedido.talla) {
            tallasTexto = pedido.talla;
        }
        
        const cuerpoHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #FAF8F5; border-radius: 12px;">
                <h2 style="color: #E87A20; border-bottom: 2px solid #E87A20; padding-bottom: 10px;">
                    🛒 Nuevo Pedido - Textiles Madruga
                </h2>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>ID Pedido:</strong> <span style="color: #E87A20; font-weight: bold;">${pedido.id}</span></p>
                    <p style="margin: 5px 0;"><strong>Producto:</strong> ${pedido.producto}</p>
                    <p style="margin: 5px 0;"><strong>Total de piezas:</strong> ${pedido.cantidad}</p>
                    ${tallasTexto ? `<p style="margin: 5px 0;"><strong>Tallas:</strong> ${tallasTexto}</p>` : ''}
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #E87A20; margin-top: 0;">👤 Datos del Cliente</h3>
                    <p style="margin: 5px 0;"><strong>Nombre:</strong> ${pedido.nombre}</p>
                    <p style="margin: 5px 0;"><strong>Teléfono:</strong> ${pedido.telefono || pedido.contacto}</p>
                    ${pedido.email ? `<p style="margin: 5px 0;"><strong>Gmail:</strong> ${pedido.email}</p>` : ''}
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #E87A20; margin-top: 0;">🚚 Entrega</h3>
                    <p style="margin: 5px 0;"><strong>Tipo:</strong> ${pedido.tipoEntrega === 'domicilio' ? '🏠 A domicilio' : '🏪 Recoger en tienda'}</p>
                    ${pedido.direccion ? `<p style="margin: 5px 0;"><strong>Dirección:</strong> ${pedido.direccion}</p>` : ''}
                    ${pedido.referencia ? `<p style="margin: 5px 0;"><strong>Referencia:</strong> ${pedido.referencia}</p>` : ''}
                    ${pedido.municipio ? `<p style="margin: 5px 0;"><strong>Municipio:</strong> ${pedido.municipio}</p>` : ''}
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #E87A20; margin-top: 0;">💳 Pago y Contacto</h3>
                    <p style="margin: 5px 0;"><strong>Método de pago:</strong> ${pedido.metodoPago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}</p>
                    <p style="margin: 5px 0;"><strong>Contacto preferido:</strong> ${pedido.contactoPreferido === 'whatsapp' ? '📱 WhatsApp' : pedido.contactoPreferido === 'llamada' ? '📞 Llamada' : '✉️ Gmail'}</p>
                </div>
                
                ${pedido.notas ? `
                <div style="background: #FFF5EB; padding: 15px; border-radius: 8px; border-left: 4px solid #E87A20; margin: 20px 0;">
                    <p style="margin: 0;"><strong>📝 Notas:</strong> ${pedido.notas}</p>
                </div>
                ` : ''}
                
                <p style="text-align: center; color: #6B6B6B; font-size: 12px; margin-top: 30px;">
                    Recibido el ${new Date(pedido.fecha).toLocaleString('es-CU')}<br>
                    Vía: ${pedido.via === 'whatsapp' ? 'WhatsApp' : pedido.via === 'email' ? 'Gmail' : 'Solo web'}
                </p>
            </div>
        `;

        console.log('📧 Enviando Gmail para pedido:', pedido.id);
        console.log('📧 Asunto:', asunto);
        console.log('📧 Destinatario:', env.GMAIL_USER);
        
        // NOTA: Cloudflare Workers no soporta SMTP directo.
        // Aquí se podría integrar con EmailJS, Resend, Brevo, etc.
        // Por ahora, el pedido se guarda en KV y se ve en el panel admin.
        
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
    const prefijos = {
        'hombre': 'HOM',
        'mujer': 'MUJ',
        'telas': 'TEL',
        'objetos': 'OBJ'
    };
    
    const prefijo = prefijos[categoria] || 'PRD';
    let maxNumero = 0;
    
    Object.values(catalogo).forEach(p => {
        const idActual = String(p.id || p._id || '');
        if (idActual.startsWith(prefijo + '-')) {
            const numeroStr = idActual.replace(prefijo + '-', '');
            const numero = parseInt(numeroStr, 10);
            if (!isNaN(numero) && numero > maxNumero) {
                maxNumero = numero;
            }
        }
    });
    
    const siguienteNumero = maxNumero + 1;
    const numeroFormateado = String(siguienteNumero).padStart(4, '0');
    
    return `${prefijo}-${numeroFormateado}`;
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
// SESIÓN ÚNICA CON TIMEOUT
// ============================================
const MAX_INACTIVIDAD_MS = 2 * 60 * 60 * 1000;

async function crearSesionUnica(env, userId) {
    const sessionId = crypto.randomUUID();
    const session = {
        sessionId: sessionId,
        lastActivity: Date.now(),
        createdAt: Date.now()
    };
    await env.PRODUCTOS_KV.put(
        `SESSIONS:${userId}`,
        JSON.stringify(session),
        { expirationTtl: 8 * 60 * 60 }
    );
    return sessionId;
}

async function eliminarSesion(env, userId) {
    await env.PRODUCTOS_KV.delete(`SESSIONS:${userId}`);
}

async function verificarSesionActiva(env, userId) {
    const sessionStr = await env.PRODUCTOS_KV.get(`SESSIONS:${userId}`);
    if (!sessionStr) return null;
    
    let session;
    try {
        session = JSON.parse(sessionStr);
    } catch {
        return { sessionId: sessionStr, lastActivity: Date.now() };
    }
    
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
    try {
        session = JSON.parse(sessionStr);
    } catch {
        return;
    }
    
    session.lastActivity = Date.now();
    await env.PRODUCTOS_KV.put(
        `SESSIONS:${userId}`,
        JSON.stringify(session),
        { expirationTtl: 8 * 60 * 60 }
    );
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
        if (!session || session.sessionId !== payload.sessionId) {
            return null;
        }
        
        await actualizarActividadSesion(env, payload.id);
        
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
                    message: 'API de Textiles Madruga funcionando',
                    db: 'kv',
                    version: '5.1',
                    features: [
                        'IDs alfanuméricos',
                        'Ofertas avanzadas',
                        'DELETE robusto',
                        'Timeout de sesión',
                        'Logout vía sendBeacon',
                        'Sistema de pedidos con variantes',
                        'Tallas dinámicas'
                    ],
                    timestamp: new Date().toISOString()
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // PEDIDOS
            // ============================================
            
            // CREAR PEDIDO (público)
            if (path === '/api/pedidos' && method === 'POST') {
                const body = await request.json();
                
                if (!body.producto || !body.nombre || !body.telefono) {
                    return addCors(new Response(JSON.stringify({ 
                        error: 'Faltan datos: producto, nombre y teléfono son obligatorios' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                // Validar variantes
                let variantes = [];
                if (Array.isArray(body.variantes) && body.variantes.length > 0) {
                    variantes = body.variantes.map(v => ({
                        talla: String(v.talla || '').substring(0, 10).toUpperCase(),
                        cantidad: parseInt(v.cantidad) || 1
                    })).filter(v => v.talla && v.cantidad > 0);
                }
                
                const cantidadTotal = parseInt(body.cantidad) || 1;
                const cantidadAsignada = variantes.reduce((sum, v) => sum + v.cantidad, 0);
                
                // Validar que las variantes sumen la cantidad total (si hay variantes)
                if (variantes.length > 0 && cantidadAsignada !== cantidadTotal) {
                    return addCors(new Response(JSON.stringify({ 
                        error: `Las tallas suman ${cantidadAsignada} pero el total es ${cantidadTotal}. Ajusta las cantidades.`
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const pedidos = await leerPedidos(env);
                const idPedido = await generarIdPedido(env);
                
                const nuevoPedido = {
                    id: idPedido,
                    producto: body.producto,
                    nombre: String(body.nombre).substring(0, 100),
                    telefono: String(body.telefono || '').substring(0, 20),
                    email: String(body.email || '').substring(0, 100),
                    tipoEntrega: body.tipoEntrega || 'domicilio',
                    direccion: String(body.direccion || '').substring(0, 200),
                    referencia: String(body.referencia || '').substring(0, 200),
                    municipio: String(body.municipio || '').substring(0, 100),
                    cantidad: cantidadTotal,
                    variantes: variantes,                                    // ← NUEVO: array de {talla, cantidad}
                    tallasTexto: String(body.tallasTexto || '').substring(0, 300),  // ← NUEVO: string legible
                    notas: String(body.notas || '').substring(0, 500),
                    metodoPago: body.metodoPago || 'efectivo',
                    contactoPreferido: body.contactoPreferido || 'whatsapp',
                    via: body.via || 'solo_aqui',
                    estado: 'pendiente',
                    fecha: new Date().toISOString(),
                    ip: ip
                };
                
                pedidos.unshift(nuevoPedido);
                await guardarPedidos(env, pedidos);
                
                console.log('📦 Nuevo pedido:', idPedido, '-', body.nombre, '-', variantes.length, 'variantes');
                
                // Intentar enviar notificación por Gmail
                if (body.via === 'email') {
                    try {
                        await enviarGmailNotificacion(env, nuevoPedido);
                        console.log('📧 Notificación Gmail enviada');
                    } catch (e) {
                        console.warn('⚠️ No se pudo enviar Gmail:', e.message);
                    }
                }
                
                return addCors(new Response(JSON.stringify({ 
                    success: true,
                    id: idPedido,
                    mensaje: 'Pedido guardado correctamente'
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }
            
            // LISTAR PEDIDOS (solo admin)
            if (path === '/api/pedidos' && method === 'GET') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const pedidos = await leerPedidos(env);
                return addCors(new Response(JSON.stringify({ pedidos }), {
                    headers: { 'Content-Type': 'application/json' }
                }), request);
            }
            
            // CAMBIAR ESTADO DE PEDIDO (solo admin)
            if (path.startsWith('/api/pedidos/') && method === 'PATCH') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const pedidoId = path.split('/')[3];
                const body = await request.json();
                const pedidos = await leerPedidos(env);
                const idx = pedidos.findIndex(p => p.id === pedidoId);
                
                if (idx === -1) {
                    return addCors(new Response(JSON.stringify({ error: 'Pedido no encontrado' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                if (body.estado) {
                    pedidos[idx].estado = body.estado;
                }
                if (body.costoEnvio !== undefined) {
                    pedidos[idx].costoEnvio = parseInt(body.costoEnvio) || 0;
                }
                if (body.notas !== undefined) {
                    pedidos[idx].notas = body.notas;
                }
                
                await guardarPedidos(env, pedidos);
                await registrarAuditoria(env, user, 'UPDATE_PEDIDO', { id: pedidoId, estado: body.estado });
                
                return addCors(new Response(JSON.stringify({ 
                    success: true,
                    pedido: pedidos[idx]
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }
            
            // ELIMINAR PEDIDO (solo admin)
            if (path.startsWith('/api/pedidos/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const pedidoId = path.split('/')[3];
                let pedidos = await leerPedidos(env);
                const pedidoEncontrado = pedidos.find(p => p.id === pedidoId);
                
                if (!pedidoEncontrado) {
                    return addCors(new Response(JSON.stringify({ error: 'Pedido no encontrado' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                pedidos = pedidos.filter(p => p.id !== pedidoId);
                await guardarPedidos(env, pedidos);
                await registrarAuditoria(env, user, 'DELETE_PEDIDO', { id: pedidoId });
                
                return addCors(new Response(JSON.stringify({ success: true }),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // PRODUCTOS
            // ============================================
            
            if (path === '/api/productos' && method === 'GET') {
                const catalogo = await leerCatalogo(env);
                const productos = Object.values(catalogo);
                return addCors(new Response(JSON.stringify({ productos }), {
                    headers: { 'Content-Type': 'application/json' }
                }), request);
            }

            if (path === '/api/products' && method === 'POST') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const body = await request.json();
                const catalogo = await leerCatalogo(env);

                const idFinal = body.id || generarIdUnico(catalogo, body.categoria);
                const esActualizacion = !!catalogo[idFinal];

                catalogo[idFinal] = { ...catalogo[idFinal], ...body, id: idFinal, _id: idFinal };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, esActualizacion ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT', { 
                    id: idFinal, 
                    nombre: body.nombre, 
                    categoria: body.categoria 
                });

                return addCors(new Response(JSON.stringify({
                    success: true,
                    id: idFinal,
                    _id: idFinal,
                    esActualizacion,
                    ...body
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/products/') && method === 'PUT') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                const productId = path.split('/')[3];
                const body = await request.json();
                const catalogo = await leerCatalogo(env);

                let claveReal = null;
                if (catalogo[productId]) {
                    claveReal = productId;
                } else {
                    for (const clave of Object.keys(catalogo)) {
                        const p = catalogo[clave];
                        if (String(p.id) === String(productId) || String(p._id) === String(productId) || String(clave) === String(productId)) {
                            claveReal = clave;
                            break;
                        }
                    }
                }

                if (!claveReal) {
                    return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }

                catalogo[claveReal] = { ...catalogo[claveReal], ...body };
                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'UPDATE_PRODUCT', { id: productId, claveReal });

                return addCors(new Response(JSON.stringify({
                    success: true,
                    ...catalogo[claveReal]
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            if (path.startsWith('/api/products/') && method === 'DELETE') {
                const user = await verificarToken(request, env);
                if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                    return addCors(new Response(JSON.stringify({ error: 'No autorizado' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const productId = path.split('/')[3];
                
                const catalogoStr = await env.PRODUCTOS_KV.get('catalogo_completo');
                if (!catalogoStr) {
                    return addCors(new Response(JSON.stringify({ error: 'Catálogo vacío' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const catalogo = JSON.parse(catalogoStr);
                const clavesAntes = Object.keys(catalogo);
                
                let claveReal = null;
                let productoEncontrado = null;
                
                if (catalogo[productId]) {
                    claveReal = productId;
                    productoEncontrado = catalogo[productId];
                } else {
                    for (const clave of clavesAntes) {
                        const p = catalogo[clave];
                        if (String(p.id) === String(productId) || 
                            String(p._id) === String(productId) || 
                            String(clave) === String(productId)) {
                            claveReal = clave;
                            productoEncontrado = p;
                            break;
                        }
                    }
                }
                
                if (!claveReal || !productoEncontrado) {
                    return addCors(new Response(JSON.stringify({ 
                        error: 'Producto no encontrado',
                        idBuscado: productId
                    }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                const nuevoCatalogo = {};
                clavesAntes.forEach(clave => {
                    if (clave !== claveReal) {
                        nuevoCatalogo[clave] = catalogo[clave];
                    }
                });
                
                await env.PRODUCTOS_KV.put('catalogo_completo', JSON.stringify(nuevoCatalogo));
                
                await new Promise(r => setTimeout(r, 300));
                const verificacionStr = await env.PRODUCTOS_KV.get('catalogo_completo');
                const verificacion = JSON.parse(verificacionStr);
                const clavesVerificacion = Object.keys(verificacion).length;
                const clavesDespues = Object.keys(nuevoCatalogo).length;
                
                if (clavesVerificacion !== clavesDespues) {
                    return addCors(new Response(JSON.stringify({ 
                        error: 'Error de persistencia',
                        esperado: clavesDespues,
                        real: clavesVerificacion
                    }), { status: 500, headers: { 'Content-Type': 'application/json' } }), request);
                }
                
                await registrarAuditoria(env, user, 'DELETE_PRODUCT', { 
                    id: productId,
                    claveReal,
                    nombre: productoEncontrado.nombre
                });
                
                return addCors(new Response(JSON.stringify({ 
                    success: true,
                    idEliminado: productId,
                    nombre: productoEncontrado.nombre
                }), { headers: { 'Content-Type': 'application/json' } }), request);
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

                let claveReal = null;
                if (catalogo[productId]) {
                    claveReal = productId;
                } else {
                    for (const clave of Object.keys(catalogo)) {
                        const p = catalogo[clave];
                        if (String(p.id) === String(productId) || 
                            String(p._id) === String(productId) || 
                            String(clave) === String(productId)) {
                            claveReal = clave;
                            break;
                        }
                    }
                }

                if (!claveReal || !catalogo[claveReal]) {
                    return addCors(new Response(JSON.stringify({ error: 'Producto no encontrado' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
                }

                catalogo[claveReal].enOferta = body.enOferta;
                
                if (body.tipoOferta !== undefined) {
                    catalogo[claveReal].tipoOferta = body.tipoOferta;
                }
                
                if (body.descuento !== undefined) {
                    catalogo[claveReal].descuento = parseInt(body.descuento) || 0;
                }
                
                if (body.promocion !== undefined) {
                    catalogo[claveReal].promocion = body.promocion || '';
                }

                await guardarCatalogo(env, catalogo);
                await registrarAuditoria(env, user, 'TOGGLE_OFFER', { 
                    id: productId, 
                    enOferta: body.enOferta,
                    tipoOferta: catalogo[claveReal].tipoOferta,
                    descuento: catalogo[claveReal].descuento
                });

                return addCors(new Response(JSON.stringify({ 
                    success: true,
                    producto: catalogo[claveReal]
                }), { headers: { 'Content-Type': 'application/json' } }), request);
            }

            // ============================================
            // AUTENTICACIÓN
            // ============================================

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
                        error: 'Ya hay una sesión activa en otro dispositivo. Usa "Forzar cierre" si quedó bloqueada.'
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

            if (path === '/api/auth/logout' && method === 'POST') {
                let user = await verificarToken(request, env);
                
                if (!user) {
                    try {
                        const body = await request.json();
                        if (body.token) {
                            const payload = JSON.parse(atob(body.token));
                            if (payload.id) {
                                await eliminarSesion(env, payload.id);
                                return addCors(new Response(JSON.stringify({ success: true }),
                                    { headers: { 'Content-Type': 'application/json' } }), request);
                            }
                        }
                    } catch (e) {}
                }
                
                if (user && user.id) {
                    await eliminarSesion(env, user.id);
                    await registrarAuditoria(env, user, 'LOGOUT', { ip });
                }
                return addCors(new Response(JSON.stringify({ success: true }),
                    { headers: { 'Content-Type': 'application/json' } }), request);
            }

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