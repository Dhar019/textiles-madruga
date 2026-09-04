// ============================================
// SCRIPT.JS - Textiles Madruga
// Sistema completo con Backend + JWT
// ============================================

// ============================================
// 1. CONFIGURACIÓN Y CONSTANTES
// ============================================
const API_URL = 'https://textiles-madruga-api.eldani000219.workers.dev/api';
const USERS_KEY = 'tm_users';
const SESSION_KEY = 'tm_session';

let datosGlobales = null;
let adminDatos = null;
let modoEdicion = null;

// ============================================
// 2. SISTEMA DE AUTENTICACIÓN CON JWT
// ============================================

// 2.1 Obtener sesión desde localStorage (con token)
function getSession() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return null;
    try {
        const data = JSON.parse(session);
        if (data.expiry < Date.now()) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

// 2.2 Crear sesión con token y datos del usuario
function createSession(token, user) {
    const session = {
        token,
        username: user.username,
        role: user.role,
        userId: user.id,
        expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 días
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

// 2.3 Cerrar sesión
function logout() {
    localStorage.removeItem(SESSION_KEY);
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
        adminPanel.className = 'admin-oculto';
    }
    actualizarBotonAcceder();
    actualizarBotonCerrarSesion();
    mostrarNotificacion('Sesión cerrada correctamente', 'info');
    setTimeout(() => location.reload(), 500);
}

// 2.4 Login con el backend
async function login(username, password) {
    try {
        const respuesta = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            return { success: false, message: data.error || 'Error al iniciar sesión' };
        }

        // Guardar sesión con token
        const session = createSession(data.token, data.user);
        return { success: true, session };
    } catch (error) {
        console.error('Error en login:', error);
        return { success: false, message: 'Error de conexión con el servidor' };
    }
}

// 2.5 Registro de usuario
async function registerUser(username, password, role = 'user') {
    try {
        if (username.length > 40) {
            return { success: false, message: 'El nombre de usuario no puede tener más de 40 caracteres.' };
        }
        if (username.length < 3) {
            return { success: false, message: 'El nombre de usuario debe tener al menos 3 caracteres.' };
        }
        if (password.length < 6) {
            return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
        }

        const respuesta = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            return { success: false, message: data.error || 'Error al registrar usuario' };
        }

        // Guardar sesión con token
        const session = createSession(data.token, data.user);
        return { success: true, session };
    } catch (error) {
        console.error('Error en registro:', error);
        return { success: false, message: 'Error de conexión con el servidor' };
    }
}

// 2.6 Obtener perfil del usuario
async function getProfile() {
    const session = getSession();
    if (!session) return null;

    try {
        const respuesta = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${session.token}`
            }
        });

        if (!respuesta.ok) {
            return null;
        }

        return await respuesta.json();
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        return null;
    }
}

// 2.7 Verificar roles
function isAdmin() {
    const session = getSession();
    return session && (session.role === 'admin' || session.role === 'superadmin');
}

function isSuperAdmin() {
    const session = getSession();
    return session && session.role === 'superadmin' && session.username === 'Texmadmin';
}

function isLoggedIn() {
    return getSession() !== null;
}

function protegerAdmin() {
    if (!isAdmin()) {
        if (isLoggedIn()) {
            mostrarNotificacion('No tienes permisos de administrador', 'error');
        }
        cerrarAdmin();
        mostrarLogin();
        return false;
    }
    return true;
}

// ============================================
// 3. NOTIFICACIONES (SIN EMOJIS)
// ============================================

function mostrarNotificacion(mensaje, tipo = 'info') {
    const notificacionExistente = document.querySelector('.notificacion');
    if (notificacionExistente) {
        notificacionExistente.remove();
    }
    
    const notificacion = document.createElement('div');
    notificacion.className = 'notificacion notificacion-' + tipo;
    notificacion.textContent = mensaje;
    
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        notificacion.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
        notificacion.classList.remove('visible');
        setTimeout(() => {
            notificacion.remove();
        }, 300);
    }, 4000);
}

// ============================================
// 4. CARGA DE DATOS DESDE EL BACKEND
// ============================================

async function cargarProductos() {
    try {
        const respuesta = await fetch(`${API_URL}/products`);
        if (!respuesta.ok) {
            throw new Error('Error al cargar productos');
        }
        const productos = await respuesta.json();
        console.log('📦 Productos cargados desde el servidor');

        // Convertir al formato que espera el frontend
        const datos = {
            ofertas: productos.filter(p => p.enOferta).map(p => p._id),
            productos: {
                hombre: productos.filter(p => p.categoria === 'hombre'),
                mujer: productos.filter(p => p.categoria === 'mujer'),
                telas: productos.filter(p => p.categoria === 'telas'),
                objetos: productos.filter(p => p.categoria === 'objetos')
            }
        };

        localStorage.setItem('productos_data', JSON.stringify(datos));
        return datos;
    } catch (error) {
        console.warn('⚠️ Error al cargar desde servidor:', error);
        // Fallback a localStorage
        return cargarProductosLocal();
    }
}

function cargarProductosLocal() {
    const datosGuardados = localStorage.getItem('productos_data');
    if (datosGuardados) {
        try {
            const datos = JSON.parse(datosGuardados);
            console.log('📦 Datos cargados desde localStorage (fallback)');
            return datos;
        } catch (e) {
            console.log('⚠️ Error al parsear localStorage');
        }
    }
    
    // Fallback final: cargar desde JSON local
    try {
        const respuesta = fetch('productos.json');
        // ... (código de fallback existente)
        return null;
    } catch (e) {
        console.error('❌ Error al cargar productos:', e);
        return null;
    }
}

// ============================================
// 5. FUNCIONES DE BÚSQUEDA Y UTILIDADES
// ============================================

function obtenerProductoPorId(id, datos) {
    if (!datos || !datos.productos) return null;
    const todasLasCategorias = ['hombre', 'mujer', 'telas', 'objetos'];
    for (const categoria of todasLasCategorias) {
        const productos = datos.productos[categoria];
        if (productos) {
            const encontrado = productos.find(p => p._id === id || p.id === id);
            if (encontrado) return encontrado;
        }
    }
    return null;
}

// ============================================
// 6. RENDERIZADO DE PRODUCTOS Y OFERTAS
// ============================================

function renderizarOfertas(ofertasIds, datos) {
    const contenedor = document.querySelector('#ofertas-ropa .grid-productos');
    if (!contenedor) {
        console.warn('⚠️ Contenedor de ofertas no encontrado');
        return;
    }

    if (!ofertasIds || ofertasIds.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay ofertas disponibles.</p>';
        return;
    }

    const productosOferta = ofertasIds
        .map(id => obtenerProductoPorId(id, datos))
        .filter(p => p !== null);

    if (productosOferta.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay ofertas disponibles.</p>';
        return;
    }

    let html = '';
    productosOferta.forEach(producto => {
        const descuento = producto.descuento || Math.floor(Math.random() * 20) + 10;
        const precioOferta = producto.precio * (1 - descuento / 100);

        html += `
            <div class="producto-card oferta-destacada">
                <span class="badge-oferta">-${descuento}%</span>
                <img src="${producto.imagen}" alt="${producto.nombre}" class="producto-img">
                <h3 class="producto-nombre">${producto.nombre}</h3>
                <p class="producto-precio">
                    <span class="tachado">$${producto.precio.toFixed(2)}</span> $${precioOferta.toFixed(2)}
                </p>
                <button class="btn-secundario btn-detalle" data-id="${producto._id || producto.id}">Ver detalle</button>
            </div>
        `;
    });

    contenedor.innerHTML = html;

    const botones = contenedor.querySelectorAll('.btn-detalle');
    botones.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            console.log(`🖱️ Clic en oferta: ID ${id}`);
            const producto = obtenerProductoPorId(id, datos);
            if (producto) {
                abrirModal(producto, datos);
            } else {
                console.error('❌ Producto no encontrado con ID:', id);
                mostrarNotificacion('Error: Producto no encontrado', 'error');
            }
        });
    });
}

function renderizarProductosConModal(productos, contenedorSelector, datos) {
    const contenedor = document.querySelector(contenedorSelector);
    if (!contenedor) {
        console.warn('⚠️ Contenedor no encontrado:', contenedorSelector);
        return;
    }

    if (!productos || productos.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay productos disponibles en esta categoría.</p>';
        return;
    }

    let html = '';
    productos.forEach(producto => {
        const precio = producto.precio;
        const unidad = producto.unidad || '';
        
        const enOferta = producto.enOferta || false;
        const descuento = enOferta ? (producto.descuento || Math.floor(Math.random() * 20) + 10) : 0;
        const precioOferta = enOferta ? precio * (1 - descuento / 100) : null;

        html += `
            <div class="producto-card ${enOferta ? 'oferta-destacada' : ''}">
                ${enOferta ? `<span class="badge-oferta">-${descuento}%</span>` : ''}
                <img src="${producto.imagen}" alt="${producto.nombre}" class="producto-img" loading="lazy">
                <h3 class="producto-nombre">${producto.nombre}</h3>
                <p class="producto-precio">
                    ${enOferta 
                        ? `<span class="tachado">$${precio.toFixed(2)}</span> $${precioOferta.toFixed(2)}${unidad}` 
                        : `$${precio.toFixed(2)}${unidad}`}
                </p>
                <button class="btn-secundario btn-detalle" data-id="${producto._id || producto.id}">Ver detalle</button>
            </div>
        `;
    });

    contenedor.innerHTML = html;

    const botones = contenedor.querySelectorAll('.btn-detalle');
    botones.forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const producto = obtenerProductoPorId(id, datos);
            if (producto) {
                abrirModal(producto, datos);
            } else {
                console.error('❌ Producto no encontrado con ID:', id);
            }
        });
    });
}

// ============================================
// 7. MODAL DE DETALLE DE PRODUCTO
// ============================================

const modal = document.getElementById('modal-detalle');
const modalBody = document.getElementById('modal-body');
const modalCerrar = document.getElementById('modal-cerrar');
const modalOverlay = document.getElementById('modal-overlay');

function abrirModal(producto, datos) {
    if (!producto || !datos) return;

    const unidad = producto.unidad || '';
    const enOferta = producto.enOferta || false;
    const descuento = enOferta ? (producto.descuento || Math.floor(Math.random() * 20) + 10) : 0;
    const precioOferta = enOferta ? (producto.precio * (1 - descuento / 100)).toFixed(2) : null;

    const categoriaMap = {
        'hombre': 'Hombre',
        'mujer': 'Mujer',
        'telas': 'Telas',
        'objetos': 'Otros'
    };
    let categoriaTexto = 'Producto';
    for (const [key, value] of Object.entries(datos.productos)) {
        if (value.some(p => p._id === producto._id || p.id === producto.id)) {
            categoriaTexto = categoriaMap[key] || key;
            break;
        }
    }

    const descripciones = [
        'Prenda confeccionada con materiales de alta calidad y acabados profesionales.',
        'Diseño exclusivo, ideal para cualquier ocasión. Combina estilo y comodidad.',
        'Hecho con dedicación y atención al detalle. Perfecto para quienes buscan lo mejor.',
        'Telas seleccionadas con los más altos estándares de calidad y durabilidad.'
    ];
    const descripcion = descripciones[(producto._id || producto.id) % descripciones.length];

    modalBody.innerHTML = `
        <div class="modal-producto">
            <div class="modal-producto-imagen">
                <img src="${producto.imagen}" alt="${producto.nombre}">
            </div>
            <div class="modal-producto-info">
                <span class="categoria">${categoriaTexto}</span>
                <h2>${producto.nombre}</h2>
                <div>
                    ${enOferta ? `<span class="precio-oferta">$${producto.precio.toFixed(2)}</span>` : ''}
                    <span class="precio">${enOferta ? `$${precioOferta}` : `$${producto.precio.toFixed(2)}`}${unidad}</span>
                </div>
                <p class="descripcion">${descripcion}</p>
                <p style="font-size: 0.9rem; color: var(--color-gris);">
                    Disponible para pedido por encargo
                </p>
                <button class="btn-comprar" onclick="solicitarPedido('${producto.nombre}')">
                    Solicitar pedido
                </button>
            </div>
        </div>
    `;

    modal.className = 'modal-visible';
    document.body.style.overflow = 'hidden';
}

function solicitarPedido(producto) {
    if (!isLoggedIn()) {
        mostrarNotificacion('Debes iniciar sesión para solicitar un pedido', 'warning');
        cerrarModal();
        mostrarLogin();
        return;
    }
    mostrarNotificacion('Gracias por tu interés. Contáctanos para realizar el pedido: textilesmadruga@email.com', 'success');
}

function cerrarModal() {
    modal.className = 'modal-oculto';
    document.body.style.overflow = 'auto';
}

modalCerrar.addEventListener('click', cerrarModal);
modalOverlay.addEventListener('click', cerrarModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModal();
});

// ============================================
// 8. PANEL DE ADMINISTRACIÓN
// ============================================

const adminPanel = document.getElementById('admin-panel');
const adminCerrar = document.getElementById('admin-cerrar');
const adminOverlay = document.getElementById('admin-overlay');
const btnNuevoProducto = document.getElementById('btn-nuevo-producto');
const btnGuardarCambios = document.getElementById('btn-guardar-cambios');
const btnRestaurar = document.getElementById('btn-restaurar');
const formProducto = document.getElementById('form-producto');
const btnCancelarForm = document.getElementById('btn-cancelar-form');
const adminProductosLista = document.getElementById('admin-productos-lista');

const loginModal = document.getElementById('login-modal');
const loginCerrar = document.getElementById('login-cerrar');
const loginOverlay = document.getElementById('login-overlay');

function mostrarLogin() {
    if (loginModal) {
        loginModal.className = 'login-visible';
        document.body.style.overflow = 'hidden';
    }
}

function cerrarLogin() {
    if (loginModal) {
        loginModal.className = 'login-oculto';
        document.body.style.overflow = 'auto';
    }
}

function abrirAdmin() {
    if (!protegerAdmin()) return;
    adminPanel.className = 'admin-visible';
    document.body.style.overflow = 'hidden';
    cargarAdminProductos();
}

function cerrarAdmin() {
    adminPanel.className = 'admin-oculto';
    document.body.style.overflow = 'auto';
    
    const formProductoEl = document.getElementById('form-producto');
    if (formProductoEl) formProductoEl.className = 'form-oculto';
}

function cargarAdminProductos() {
    if (!datosGlobales) return;
    adminDatos = JSON.parse(JSON.stringify(datosGlobales));
    renderizarAdminProductos();
    renderizarUsuariosAdmin();
}

function renderizarAdminProductos() {
    if (!adminDatos) return;
    
    let html = '';
    const todasLasCategorias = ['hombre', 'mujer', 'telas', 'objetos'];
    const categoriaNombres = {
        'hombre': 'Hombre',
        'mujer': 'Mujer',
        'telas': 'Telas',
        'objetos': 'Otros'
    };

    for (const categoria of todasLasCategorias) {
        const productos = adminDatos.productos[categoria] || [];
        productos.forEach(producto => {
            const enOferta = producto.enOferta || false;
            const id = producto._id || producto.id;
            html += `
                <div class="admin-producto-item" data-id="${id}" data-categoria="${categoria}">
                    <div class="info">
                        <img src="${producto.imagen}" alt="${producto.nombre}">
                        <span class="nombre">${producto.nombre}</span>
                        <span class="precio">$${producto.precio.toFixed(2)}</span>
                        <span class="categoria-tag">${categoriaNombres[categoria]}</span>
                        ${enOferta ? '<span style="background:#E87A20;color:white;padding:2px 12px;border-radius:50px;font-size:0.7rem;font-weight:600;">OFERTA</span>' : ''}
                    </div>
                    <div class="acciones">
                        <button class="btn-oferta ${enOferta ? 'activo' : ''}" onclick="toggleOfertaAdmin('${id}')">
                            ${enOferta ? '✕ Quitar oferta' : '✓ Oferta'}
                        </button>
                        <button class="btn-editar" onclick="editarProductoAdmin('${id}')">✎</button>
                        <button class="btn-eliminar" onclick="eliminarProductoAdmin('${id}')">✕</button>
                    </div>
                </div>
            `;
        });
    }

    adminProductosLista.innerHTML = html;
}

// ============================================
// 8.1 ADMIN - Toggle oferta (Backend)
// ============================================

async function toggleOfertaAdmin(id) {
    if (!adminDatos) return;
    
    const producto = obtenerProductoPorId(id, adminDatos);
    if (!producto) {
        mostrarNotificacion('Producto no encontrado', 'error');
        return;
    }

    const nuevaOferta = !producto.enOferta;

    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/offers/toggle/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ 
                enOferta: nuevaOferta,
                ofertaData: {
                    tipo: 'porcentaje',
                    detalles: '',
                    colores: ''
                }
            })
        });

        if (!respuesta.ok) {
            throw new Error('Error al actualizar oferta');
        }

        const data = await respuesta.json();
        
        // Actualizar datos locales
        producto.enOferta = nuevaOferta;
        if (nuevaOferta) {
            adminDatos.ofertas = adminDatos.ofertas || [];
            if (!adminDatos.ofertas.includes(id)) {
                adminDatos.ofertas.push(id);
            }
        } else {
            adminDatos.ofertas = adminDatos.ofertas.filter(o => o !== id);
        }

        mostrarNotificacion(nuevaOferta ? 'Producto añadido a ofertas' : 'Producto quitado de ofertas', 'success');
        renderizarAdminProductos();
        renderizarOfertas(adminDatos.ofertas, adminDatos);
    } catch (error) {
        console.error('Error al toggle oferta:', error);
        mostrarNotificacion('Error al actualizar oferta', 'error');
    }
}

// ============================================
// 8.2 ADMIN - Eliminar producto (Backend)
// ============================================

async function eliminarProductoAdmin(id) {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) return;
    
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.token}`
            }
        });

        if (!respuesta.ok) {
            throw new Error('Error al eliminar producto');
        }

        // Eliminar de datos locales
        for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
            const productos = adminDatos.productos[categoria];
            if (productos) {
                const index = productos.findIndex(p => (p._id || p.id) === id);
                if (index !== -1) {
                    productos.splice(index, 1);
                    break;
                }
            }
        }
        adminDatos.ofertas = adminDatos.ofertas.filter(o => o !== id);

        mostrarNotificacion('Producto eliminado correctamente', 'success');
        renderizarAdminProductos();
        renderizarOfertas(adminDatos.ofertas, adminDatos);
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        mostrarNotificacion('Error al eliminar producto', 'error');
    }
}

// ============================================
// 8.3 ADMIN - Editar producto (Backend)
// ============================================

function editarProductoAdmin(id) {
    modoEdicion = id;
    const producto = obtenerProductoPorId(id, adminDatos);
    if (!producto) return;

    document.getElementById('prod-nombre').value = producto.nombre;
    document.getElementById('prod-precio').value = producto.precio;
    document.getElementById('prod-imagen').value = producto.imagen || '';
    
    for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
        if (adminDatos.productos[categoria]?.some(p => (p._id || p.id) === id)) {
            document.getElementById('prod-categoria').value = categoria;
            break;
        }
    }

    formProducto.className = 'form-visible';
    document.querySelector('#producto-form button[type="submit"]').textContent = '✎ Actualizar';
    document.getElementById('form-title').textContent = '✎ Editar Producto';
}

// ============================================
// 8.4 ADMIN - Guardar producto (Backend)
// ============================================

document.getElementById('producto-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('prod-nombre').value.trim();
    const precio = parseFloat(document.getElementById('prod-precio').value);
    let imagen = document.getElementById('prod-imagen').value.trim();
    const categoria = document.getElementById('prod-categoria').value;

    if (!nombre || !precio) {
        mostrarNotificacion('Completa los campos obligatorios (nombre y precio)', 'error');
        return;
    }

    if (!imagen) {
        imagen = 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Sin+Imagen';
    }

    const session = getSession();
    if (!session) {
        mostrarNotificacion('No hay sesión activa', 'error');
        return;
    }

    try {
        let respuesta;
        const productoData = { nombre, precio, imagen, categoria };

        if (modoEdicion) {
            // Actualizar producto existente
            respuesta = await fetch(`${API_URL}/products/${modoEdicion}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify(productoData)
            });
        } else {
            // Crear nuevo producto
            respuesta = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify(productoData)
            });
        }

        if (!respuesta.ok) {
            throw new Error('Error al guardar producto');
        }

        const data = await respuesta.json();
        const producto = data.product;

        // Actualizar datos locales
        if (modoEdicion) {
            const oldProducto = obtenerProductoPorId(modoEdicion, adminDatos);
            if (oldProducto) {
                oldProducto.nombre = producto.nombre;
                oldProducto.precio = producto.precio;
                oldProducto.imagen = producto.imagen;
                oldProducto.categoria = producto.categoria;
            }
        } else {
            adminDatos.productos[categoria].push(producto);
        }

        modoEdicion = null;
        formProducto.className = 'form-oculto';
        document.getElementById('producto-form').reset();
        document.querySelector('#producto-form button[type="submit"]').textContent = '✦ Crear';
        document.getElementById('form-title').textContent = '✦ Nuevo Producto';
        
        mostrarNotificacion('Producto guardado correctamente', 'success');
        renderizarAdminProductos();
        renderizarOfertas(adminDatos.ofertas, adminDatos);
    } catch (error) {
        console.error('Error al guardar producto:', error);
        mostrarNotificacion('Error al guardar producto', 'error');
    }
});

btnCancelarForm.addEventListener('click', function() {
    formProducto.className = 'form-oculto';
    modoEdicion = null;
    document.querySelector('#producto-form button[type="submit"]').textContent = '✦ Crear';
    document.getElementById('form-title').textContent = '✦ Nuevo Producto';
    document.getElementById('producto-form').reset();
});

btnGuardarCambios.addEventListener('click', async function() {
    if (!adminDatos) return;
    
    try {
        // Guardar cambios en el backend (ya se guardan en cada operación)
        mostrarNotificacion('Cambios guardados correctamente', 'success');
    } catch (error) {
        console.error('❌ Error al guardar cambios:', error);
        mostrarNotificacion('Error al guardar cambios. Intenta de nuevo.', 'error');
    }
});

btnRestaurar.addEventListener('click', function() {
    if (!confirm('⚠️ Esto restaurará los datos originales. ¿Continuar?')) return;
    localStorage.removeItem('productos_data');
    mostrarNotificacion('Datos restaurados. Recargando...', 'info');
    setTimeout(() => location.reload(), 1000);
});

btnNuevoProducto.addEventListener('click', function() {
    modoEdicion = null;
    document.getElementById('producto-form').reset();
    document.querySelector('#producto-form button[type="submit"]').textContent = '✦ Crear';
    document.getElementById('form-title').textContent = '✦ Nuevo Producto';
    formProducto.className = 'form-visible';
});

adminCerrar.addEventListener('click', cerrarAdmin);
adminOverlay.addEventListener('click', cerrarAdmin);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && adminPanel.className === 'admin-visible') {
        cerrarAdmin();
    }
});

// ============================================
// 8.5 GESTIÓN DE USUARIOS (SOLO SUPERADMIN)
// ============================================

function renderizarUsuariosAdmin() {
    const container = document.getElementById('admin-usuarios-lista');
    if (!container) {
        console.warn('⚠️ Contenedor admin-usuarios-lista no encontrado');
        return;
    }
    
    const tabSeguridad = document.querySelector('[data-tab="seguridad"]');
    
    if (!isSuperAdmin()) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--color-gris);background:white;border-radius:12px;border:1px dashed #EDE8E1;">
                <span style="font-size:2rem;display:block;margin-bottom:10px;">🔒</span>
                <p style="font-weight:600;color:var(--color-negro);">Acceso restringido</p>
                <p style="font-size:0.85rem;">Solo el SuperAdministrador puede gestionar usuarios</p>
            </div>
        `;
        if (tabSeguridad) tabSeguridad.style.display = 'none';
        return;
    }
    
    if (tabSeguridad) tabSeguridad.style.display = 'block';
    
    // Cargar usuarios desde el backend
    cargarUsuariosDesdeBackend(container);
}

async function cargarUsuariosDesdeBackend(container) {
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${session.token}`
            }
        });

        if (!respuesta.ok) {
            throw new Error('Error al cargar usuarios');
        }

        const users = await respuesta.json();
        
        if (users.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:var(--color-gris);background:white;border-radius:12px;border:1px dashed #EDE8E1;">
                    <span style="font-size:2rem;display:block;margin-bottom:10px;">👤</span>
                    <p style="font-weight:600;color:var(--color-negro);">No hay usuarios registrados</p>
                </div>
            `;
            return;
        }

        let html = '';
        users.forEach(user => {
            const rolClase = user.role === 'superadmin' ? 'superadmin' : user.role === 'admin' ? 'admin' : 'user';
            const rolTexto = user.role === 'superadmin' ? 'SuperAdmin' : user.role === 'admin' ? 'Admin' : 'Usuario';
            
            html += `
                <div class="usuario-item">
                    <div class="info">
                        <span class="nombre">${user.username}</span>
                        <span class="rol-tag ${rolClase}">${rolTexto}</span>
                    </div>
                    <div class="acciones">
                        ${user.username !== 'Texmadmin' ? `
                            ${user.role !== 'admin' ? 
                                `<button class="btn-hacer-admin" onclick="cambiarRolUsuario('${user._id}', 'admin')">Hacer admin</button>` :
                                `<button class="btn-quitar-admin" onclick="cambiarRolUsuario('${user._id}', 'user')">Quitar admin</button>`
                            }
                            <button class="btn-eliminar-usuario" onclick="eliminarUsuario('${user._id}')">✕</button>
                        ` : '<span style="color:var(--color-gris);font-size:0.75rem;font-weight:500;">Protegido</span>'}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        container.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--color-gris);">
                <p>Error al cargar usuarios</p>
                <button onclick="renderizarUsuariosAdmin()" class="btn-admin btn-secundario" style="margin-top:10px;">Reintentar</button>
            </div>
        `;
    }
}

async function cambiarRolUsuario(userId, nuevoRol) {
    if (!isSuperAdmin()) {
        mostrarNotificacion('Solo el SuperAdministrador puede gestionar usuarios', 'error');
        return;
    }
    
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/users/${userId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ role: nuevoRol })
        });

        if (!respuesta.ok) {
            const data = await respuesta.json();
            throw new Error(data.error || 'Error al actualizar rol');
        }

        mostrarNotificacion('Rol actualizado correctamente', 'success');
        renderizarUsuariosAdmin();
    } catch (error) {
        console.error('Error al cambiar rol:', error);
        mostrarNotificacion(error.message || 'Error al actualizar rol', 'error');
    }
}

async function eliminarUsuario(userId) {
    if (!isSuperAdmin()) {
        mostrarNotificacion('Solo el SuperAdministrador puede eliminar usuarios', 'error');
        return;
    }
    if (!confirm('¿Seguro que quieres eliminar este usuario?')) return;
    
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.token}`
            }
        });

        if (!respuesta.ok) {
            const data = await respuesta.json();
            throw new Error(data.error || 'Error al eliminar usuario');
        }

        mostrarNotificacion('Usuario eliminado correctamente', 'success');
        renderizarUsuariosAdmin();
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        mostrarNotificacion(error.message || 'Error al eliminar usuario', 'error');
    }
}

document.getElementById('btn-nuevo-usuario')?.addEventListener('click', async function() {
    if (!isSuperAdmin()) {
        mostrarNotificacion('Solo el SuperAdministrador puede crear usuarios', 'error');
        return;
    }
    
    const username = prompt('Nombre de usuario (3-40 caracteres):');
    if (!username) return;
    if (username.length > 40) {
        mostrarNotificacion('El nombre no puede tener más de 40 caracteres', 'error');
        return;
    }
    if (username.length < 3) {
        mostrarNotificacion('El nombre debe tener al menos 3 caracteres', 'error');
        return;
    }
    
    const password = prompt('Contraseña (mínimo 6 caracteres):');
    if (!password) return;
    if (password.length < 6) {
        mostrarNotificacion('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    const esAdmin = confirm('¿Quieres que este usuario sea administrador? (Sí = Admin, No = Usuario)');
    const role = esAdmin ? 'admin' : 'user';
    
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ username, password, role })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(data.error || 'Error al crear usuario');
        }

        mostrarNotificacion(`Usuario "${username}" creado correctamente`, 'success');
        renderizarUsuariosAdmin();
    } catch (error) {
        console.error('Error al crear usuario:', error);
        mostrarNotificacion(error.message || 'Error al crear usuario', 'error');
    }
});

// ============================================
// 9. BOTÓN ACCEDER - LOGIN
// ============================================

const btnAcceder = document.getElementById('btn-acceder');

if (btnAcceder) {
    btnAcceder.addEventListener('click', function(e) {
        e.preventDefault();
        const session = getSession();
        if (session) {
            if (isAdmin()) {
                abrirAdmin();
                cargarAdminProductos();
            } else {
                mostrarNotificacion('Sesión activa como: ' + session.username, 'info');
            }
        } else {
            mostrarLogin();
        }
    });
}

function actualizarBotonAcceder() {
    const session = getSession();
    if (btnAcceder) {
        if (session) {
            btnAcceder.textContent = 'Sesión activa';
            btnAcceder.classList.add('activo');
            btnAcceder.title = isAdmin() ? 'Hacer clic para gestionar' : 'Sesión activa';
            btnAcceder.style.cursor = isAdmin() ? 'pointer' : 'default';
            if (isAdmin()) {
                btnAcceder.classList.add('admin');
            } else {
                btnAcceder.classList.remove('admin');
            }
        } else {
            btnAcceder.textContent = 'Acceder a la cuenta';
            btnAcceder.classList.remove('activo');
            btnAcceder.classList.remove('admin');
            btnAcceder.title = 'Iniciar sesión';
            btnAcceder.style.cursor = 'pointer';
        }
    }
    actualizarBotonCerrarSesion();
}

if (btnAcceder) {
    btnAcceder.addEventListener('dblclick', function(e) {
        e.preventDefault();
        if (isLoggedIn()) {
            if (confirm('¿Seguro que quieres cerrar sesión?')) {
                logout();
            }
        }
    });
}

// ============================================
// 10. BOTÓN CERRAR SESIÓN
// ============================================

const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

function actualizarBotonCerrarSesion() {
    const session = getSession();
    if (btnCerrarSesion) {
        if (session) {
            btnCerrarSesion.classList.add('visible');
            btnCerrarSesion.textContent = 'Cerrar sesión';
        } else {
            btnCerrarSesion.classList.remove('visible');
        }
    }
}

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('¿Seguro que quieres cerrar sesión?')) {
            logout();
        }
    });
}

document.getElementById('btn-cerrar-sesion-admin')?.addEventListener('click', function() {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
        logout();
    }
});

// ============================================
// 11. LOGIN - EVENTOS Y REGISTRO
// ============================================

document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    
    const result = await login(username, password);
    if (result.success) {
        cerrarLogin();
        actualizarBotonAcceder();
        if (isAdmin()) {
            mostrarNotificacion('Bienvenido administrador', 'success');
            abrirAdmin();
            cargarAdminProductos();
        } else {
            mostrarNotificacion('Bienvenido ' + username, 'success');
        }
    } else {
        mostrarNotificacion(result.message, 'error');
    }
});

document.getElementById('login-registro-link')?.addEventListener('click', async function(e) {
    e.preventDefault();
    
    const username = prompt('Crear nuevo usuario\n\nEl nombre de usuario debe tener entre 3 y 40 caracteres:');
    if (!username) return;
    
    if (username.length > 40) {
        mostrarNotificacion('El nombre de usuario no puede tener más de 40 caracteres.', 'error');
        return;
    }
    if (username.length < 3) {
        mostrarNotificacion('El nombre de usuario debe tener al menos 3 caracteres.', 'error');
        return;
    }
    
    const password = prompt('Contraseña (mínimo 6 caracteres):');
    if (!password) return;
    if (password.length < 6) {
        mostrarNotificacion('La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }
    
    const result = await registerUser(username, password, 'user');
    if (result.success) {
        cerrarLogin();
        actualizarBotonAcceder();
        mostrarNotificacion('Usuario creado correctamente. Sesión iniciada.', 'success');
    } else {
        mostrarNotificacion(result.message, 'error');
    }
});

loginCerrar.addEventListener('click', cerrarLogin);
loginOverlay.addEventListener('click', cerrarLogin);

document.getElementById('login-pass').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('login-form').dispatchEvent(new Event('submit'));
    }
});

// ============================================
// 12. OJITO PARA MOSTRAR/OCULTAR CONTRASEÑA
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input[type="password"], input[type="text"]');
            if (!input) return;
            
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            const svg = this.querySelector('.icono-ojo');
            if (svg) {
                if (isPassword) {
                    svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
                } else {
                    svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
                }
            }
            this.classList.toggle('visible');
        });
    });
});

// ============================================
// 13. FUNCIÓN PRINCIPAL (INICIAR)
// ============================================

async function iniciar() {
    console.log('🚀 Cargando productos...');

    let datos = await cargarProductos();
    if (!datos) {
        console.error('❌ No se pudieron cargar los datos');
        return;
    }
    
    datosGlobales = datos;
    adminDatos = JSON.parse(JSON.stringify(datos));

    renderizarOfertas(datos.ofertas, datos);
    
    if (datos.productos) {
        renderizarProductosConModal(datos.productos.hombre, '#ropa-hombre .grid-productos', datos);
        renderizarProductosConModal(datos.productos.mujer, '#ropa-mujer .grid-productos', datos);
        renderizarProductosConModal(datos.productos.telas, '#telas .grid-productos', datos);
        renderizarProductosConModal(datos.productos.objetos, '#otros .grid-productos', datos);
    }

    actualizarBotonAcceder();

    const session = getSession();
    const sesionEstado = document.getElementById('sesion-estado');
    const sesionRol = document.getElementById('sesion-rol');
    if (sesionEstado) {
        sesionEstado.textContent = session ? 'Activa' : 'Inactiva';
        sesionEstado.style.color = session ? '#27ae60' : '#e74c3c';
    }
    if (sesionRol) {
        sesionRol.textContent = session ? (session.role === 'superadmin' ? 'SuperAdministrador' : session.role === 'admin' ? 'Administrador' : 'Usuario') : 'Sin sesión';
    }

    console.log('✅ Productos cargados correctamente');
}

document.addEventListener('DOMContentLoaded', iniciar);

// ============================================
// 14. EXPONER FUNCIONES PARA USO EN HTML
// ============================================
window.toggleOfertaAdmin = toggleOfertaAdmin;
window.editarProductoAdmin = editarProductoAdmin;
window.eliminarProductoAdmin = eliminarProductoAdmin;
window.abrirAdmin = abrirAdmin;
window.cerrarAdmin = cerrarAdmin;
window.mostrarLogin = mostrarLogin;
window.cerrarLogin = cerrarLogin;
window.logout = logout;
window.isAdmin = isAdmin;
window.isSuperAdmin = isSuperAdmin;
window.cambiarRolUsuario = cambiarRolUsuario;
window.renderizarUsuariosAdmin = renderizarUsuariosAdmin;
window.mostrarNotificacion = mostrarNotificacion;
window.solicitarPedido = solicitarPedido;
window.cargarUsuariosDesdeBackend = cargarUsuariosDesdeBackend;