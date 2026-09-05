// ============================================
// WORKER.JS - API PARA TEXTILES MADRUGA
// DESPLEGADO EN CLOUDFLARE WORKERS
// ============================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ============================================
    // HEADERS BASE (CORS Y JSON)
    // ============================================
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // ============================================
    // MANEJO DE PETICIONES OPTIONS (CORS)
    // ============================================
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // ============================================
    // 1. HEALTH CHECK
    // ============================================
    if (path === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'API de Textiles Madruga funcionando',
        timestamp: new Date().toISOString(),
        environment: 'Cloudflare Workers'
      }), { headers });
    }

    // ============================================
    // 2. PRODUCTOS
    // ============================================
    if (path === '/api/products' && request.method === 'GET') {
      return new Response(JSON.stringify([
        { 
          id: 1, 
          nombre: 'Camisa Azul', 
          precio: 25, 
          imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Camisa+Azul',
          categoria: 'hombre'
        },
        { 
          id: 2, 
          nombre: 'Vestido Verano', 
          precio: 45, 
          imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Vestido+Verano',
          categoria: 'mujer'
        },
        { 
          id: 3, 
          nombre: 'Tela Algodón', 
          precio: 12, 
          imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Tela+Algod%C3%B3n',
          categoria: 'telas'
        },
        { 
          id: 4, 
          nombre: 'Cartera Artesanal', 
          precio: 18, 
          imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Cartera',
          categoria: 'objetos'
        }
      ]), { headers });
    }

    // ============================================
    // 3. PRODUCTOS POR CATEGORÍA
    // ============================================
    if (path === '/api/products/hombre' && request.method === 'GET') {
      return new Response(JSON.stringify([
        { id: 1, nombre: 'Camisa Azul', precio: 25, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Camisa+Azul' },
        { id: 101, nombre: 'Camisa Blanca', precio: 28, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Camisa+Blanca' }
      ]), { headers });
    }

    if (path === '/api/products/mujer' && request.method === 'GET') {
      return new Response(JSON.stringify([
        { id: 2, nombre: 'Vestido Verano', precio: 45, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Vestido+Verano' },
        { id: 102, nombre: 'Blusa Floral', precio: 32, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Blusa+Floral' }
      ]), { headers });
    }

    if (path === '/api/products/telas' && request.method === 'GET') {
      return new Response(JSON.stringify([
        { id: 3, nombre: 'Tela Algodón', precio: 12, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Tela+Algod%C3%B3n' },
        { id: 103, nombre: 'Tela Lino', precio: 15, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Tela+Lino' }
      ]), { headers });
    }

    if (path === '/api/products/objetos' && request.method === 'GET') {
      return new Response(JSON.stringify([
        { id: 4, nombre: 'Cartera Artesanal', precio: 18, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Cartera' },
        { id: 104, nombre: 'Llavero de Cuero', precio: 8, imagen: 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Llavero' }
      ]), { headers });
    }

    // ============================================
    // 4. OFERTAS
    // ============================================
    if (path === '/api/offers' && request.method === 'GET') {
      return new Response(JSON.stringify({
        ofertas: [1, 2],
        descuentos: {
          1: { porcentaje: 20, precioOferta: 20.00 },
          2: { porcentaje: 15, precioOferta: 38.25 }
        }
      }), { headers });
    }

    // ============================================
    // 5. PRODUCTO POR ID
    // ============================================
    if (path.startsWith('/api/products/') && request.method === 'GET') {
      const id = path.split('/')[3];
      
      // Simular producto según ID
      const producto = {
        id: parseInt(id) || 1,
        nombre: `Producto ${id}`,
        precio: 25 + parseInt(id) * 5,
        imagen: `https://placehold.co/280x250/1A1A1A/F5E6D3?text=Producto+${id}`,
        descripcion: 'Este es un producto de prueba para Textiles Madruga.',
        categoria: 'hombre',
        enOferta: parseInt(id) % 2 === 0
      };

      return new Response(JSON.stringify(producto), { headers });
    }

    // ============================================
    // 6. AUTENTICACIÓN (BÁSICA)
    // ============================================
    if (path === '/api/auth/login' && request.method === 'POST') {
      const body = await request.json();
      
      // Credenciales de prueba
      if (body.username === 'Texmadmin' && body.password === 'TexMadmin2026*') {
        return new Response(JSON.stringify({
          success: true,
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZTQyM2Q4YzIwMDAwMDAwMDAwMDAwIiwidXNlcm5hbWUiOiJUZXhtYWRtaW4iLCJyb2xlIjoic3VwZXJhZG1pbiIsImlhdCI6MTY5NjQwMDAwMCwiZXhwIjoxNjk3MDA0ODAwfQ.dummy_signature',
          user: {
            id: '65e423d8c2000000000000',
            username: 'Texmadmin',
            role: 'superadmin'
          }
        }), { headers });
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciales incorrectas'
      }), { status: 401, headers });
    }

    // ============================================
    // 7. VERIFICAR TOKEN
    // ============================================
    if (path === '/api/auth/me' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          error: 'Token no proporcionado'
        }), { status: 401, headers });
      }

      // Simular usuario (siempre devuelve el admin)
      return new Response(JSON.stringify({
        id: '65e423d8c2000000000000',
        username: 'Texmadmin',
        role: 'superadmin'
      }), { headers });
    }

    // ============================================
    // 8. REGISTRO DE USUARIO
    // ============================================
    if (path === '/api/auth/register' && request.method === 'POST') {
      const body = await request.json();
      
      return new Response(JSON.stringify({
        success: true,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZTQyM2Q4YzIwMDAwMDAwMDAwMDAwIiwidXNlcm5hbWUiOiJUZXhtYWRtaW4iLCJyb2xlIjoic3VwZXJhZG1pbiIsImlhdCI6MTY5NjQwMDAwMCwiZXhwIjoxNjk3MDA0ODAwfQ.dummy_signature',
        user: {
          id: '65e423d8c2000000000000',
          username: body.username,
          role: 'user'
        }
      }), { headers });
    }

    // ============================================
    // 9. RUTA NO ENCONTRADA (404)
    // ============================================
    return new Response(JSON.stringify({
      error: 'Ruta no encontrada',
      path: path,
      method: request.method
    }), { status: 404, headers });
  }
};