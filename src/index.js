// ============================================
// INDEX.JS - API TEXTILES MADRUGA (WORKERS)
// ============================================

// ✅ Este es el formato CORRECTO para Cloudflare Workers
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // ============================================
        // RUTAS
        // ============================================

        // Health check
        if (path === '/api/health') {
            return new Response(JSON.stringify({
                status: 'ok',
                message: 'API de Textiles Madruga funcionando en Cloudflare Workers',
                timestamp: new Date().toISOString()
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Productos (prueba)
        if (path === '/api/productos') {
            return new Response(JSON.stringify({
                message: 'Lista de productos',
                productos: [
                    { id: 1, nombre: 'Camisa Azul', precio: 25 },
                    { id: 2, nombre: 'Vestido Verano', precio: 45 }
                ]
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Ruta raíz
        if (path === '/') {
            return new Response(JSON.stringify({
                message: 'API Textiles Madruga',
                version: '1.0.0',
                endpoints: ['/api/health', '/api/productos']
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // ============================================
        // RUTA NO ENCONTRADA (404)
        // ============================================
        return new Response(JSON.stringify({
            error: 'Ruta no encontrada',
            path: path
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
};