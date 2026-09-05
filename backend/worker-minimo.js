// ============================================
// WORKER MÍNIMO - FUNCIONA SIEMPRE
// ============================================

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Headers CORS
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // Respuesta para OPTIONS (CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // ============================================
    // RUTAS
    // ============================================

    // HEALTH CHECK
    if (path === '/api/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'API funcionando en Cloudflare Workers',
        timestamp: new Date().toISOString()
      }), { headers });
    }

    // PRODUCTOS
    if (path === '/api/products') {
      return new Response(JSON.stringify([
        { id: 1, nombre: 'Camisa Azul', precio: 25 },
        { id: 2, nombre: 'Vestido Verano', precio: 45 }
      ]), { headers });
    }

    // 404
    return new Response(JSON.stringify({
      error: 'Ruta no encontrada',
      path: path
    }), { status: 404, headers });
  }
};