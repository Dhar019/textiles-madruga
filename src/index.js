// ============================================
// WORKER - TEXTILES MADRUGA API
// Versión completa con CORS + MongoDB
// ============================================

const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://dhar019.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
};

let cachedDb = null;

async function connectToDatabase(env) {
    if (cachedDb) return cachedDb;

    const uri = env.MONGODB_URI;
    console.log('🔍 URI existe?', !!uri);

    if (!uri) {
        console.warn('⚠️ MONGODB_URI no configurada');
        return null;
    }

    try {
        const { MongoClient } = await import('mongodb');
        const client = new MongoClient(uri, {
            maxPoolSize: 1,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        });
        await client.connect();
        console.log('✅ Conectado a MongoDB');
        cachedDb = client.db('textiles');
        return cachedDb;
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        return null;
    }
}

async function autenticarUsuario(db, username, password) {
    if (!db) return null;
    try {
        const users = db.collection('users');
        const user = await users.findOne({ username });
        if (!user) return null;
        if (user.password !== password) return null;
        return user;
    } catch (error) {
        return null;
    }
}

async function obtenerProductos(db) {
    if (!db) {
        return {
            message: "Lista de productos (sin BD)",
            productos: [
                { id: 1, nombre: "Camisa Azul", precio: 25, categoria: "hombre" },
                { id: 2, nombre: "Vestido Verano", precio: 45, categoria: "mujer" }
            ]
        };
    }

    try {
        const productos = db.collection('products');
        const lista = await productos.find({}).toArray();
        return { message: "Lista de productos", productos: lista };
    } catch (error) {
        return { message: "Error al obtener productos", productos: [] };
    }
}

function addCors(response) {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // CORS preflight
        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            // HEALTH
            if (path === '/api/health' && method === 'GET') {
                let dbStatus = 'disconnected';
                try {
                    const db = await connectToDatabase(env);
                    dbStatus = db ? 'connected' : 'disconnected';
                } catch (e) {}
                return addCors(new Response(JSON.stringify({
                    status: 'ok',
                    message: 'API de Textiles Madruga funcionando',
                    db: dbStatus,
                    timestamp: new Date().toISOString()
                }), { headers: { 'Content-Type': 'application/json' } }));
            }

            // PRODUCTOS
            if (path === '/api/productos' && method === 'GET') {
                try {
                    const db = await connectToDatabase(env);
                    const data = await obtenerProductos(db);
                    return addCors(new Response(JSON.stringify(data), {
                        headers: { 'Content-Type': 'application/json' }
                    }));
                } catch (error) {
                    return addCors(new Response(JSON.stringify({
                        message: "Error al obtener productos",
                        productos: []
                    }), { headers: { 'Content-Type': 'application/json' } }));
                }
            }

            // LOGIN
            if (path === '/api/auth/login' && method === 'POST') {
                try {
                    const body = await request.json();
                    const { username, password } = body || {};

                    if (!username || !password) {
                        return addCors(new Response(JSON.stringify({
                            error: 'Usuario y contraseña requeridos'
                        }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
                    }

                    const db = await connectToDatabase(env);
                    if (!db) {
                        return addCors(new Response(JSON.stringify({
                            error: 'Error de conexión a la base de datos'
                        }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
                    }

                    const user = await autenticarUsuario(db, username, password);

                    if (!user) {
                        return addCors(new Response(JSON.stringify({
                            error: 'Usuario o contraseña incorrectos'
                        }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
                    }

                    const token = btoa(JSON.stringify({
                        id: user._id,
                        username: user.username,
                        role: user.role || 'user'
                    }));

                    return addCors(new Response(JSON.stringify({
                        success: true,
                        token,
                        user: {
                            id: user._id,
                            username: user.username,
                            role: user.role || 'user'
                        }
                    }), { headers: { 'Content-Type': 'application/json' } }));

                } catch (error) {
                    return addCors(new Response(JSON.stringify({
                        error: 'Error en el servidor'
                    }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
                }
            }

            // REGISTRO
            if (path === '/api/auth/register' && method === 'POST') {
                try {
                    const body = await request.json();
                    const { username, password, role = 'user' } = body || {};

                    if (!username || !password) {
                        return addCors(new Response(JSON.stringify({
                            error: 'Usuario y contraseña requeridos'
                        }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
                    }

                    const db = await connectToDatabase(env);
                    if (!db) {
                        return addCors(new Response(JSON.stringify({
                            error: 'Error de conexión a la base de datos'
                        }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
                    }

                    const users = db.collection('users');
                    const existingUser = await users.findOne({ username });

                    if (existingUser) {
                        return addCors(new Response(JSON.stringify({
                            error: 'El usuario ya existe'
                        }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
                    }

                    const result = await users.insertOne({
                        username,
                        password,
                        role: role === 'admin' ? 'admin' : 'user',
                        createdAt: new Date()
                    });

                    const token = btoa(JSON.stringify({
                        id: result.insertedId,
                        username,
                        role: role === 'admin' ? 'admin' : 'user'
                    }));

                    return addCors(new Response(JSON.stringify({
                        success: true,
                        token,
                        user: {
                            id: result.insertedId,
                            username,
                            role: role === 'admin' ? 'admin' : 'user'
                        }
                    }), { headers: { 'Content-Type': 'application/json' } }));

                } catch (error) {
                    return addCors(new Response(JSON.stringify({
                        error: 'Error en el servidor'
                    }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
                }
            }

            // PERFIL (/me)
            if (path === '/api/auth/me' && method === 'GET') {
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return addCors(new Response(JSON.stringify({
                        error: 'No autorizado'
                    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
                }

                try {
                    const token = authHeader.replace('Bearer ', '');
                    const payload = JSON.parse(atob(token));
                    return addCors(new Response(JSON.stringify({ user: payload }), {
                        headers: { 'Content-Type': 'application/json' }
                    }));
                } catch (error) {
                    return addCors(new Response(JSON.stringify({
                        error: 'Token inválido'
                    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
                }
            }

            // 404
            return addCors(new Response(JSON.stringify({
                error: 'Ruta no encontrada',
                path
            }), { status: 404, headers: { 'Content-Type': 'application/json' } }));

        } catch (error) {
            console.error('❌ Error general:', error);
            return addCors(new Response(JSON.stringify({
                error: 'Error interno del servidor',
                message: error.message
            }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
        }
    }
};