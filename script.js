// ============================================
// SCRIPT.JS - Textiles Madruga
// ============================================

const API_URL = 'https://textiles-madruga-api.eldani000219.workers.dev/api';
const SESSION_KEY = 'tm_session';

let datosGlobales = null;
let adminDatos = null;
let modoEdicion = null;

// ============================================
// 1. AUTENTICACIÓN
// ============================================
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
    } catch { return null; }
}

function createSession(token, user) {
    const session = {
        token,
        username: user.username,
        role: user.role,
        userId: user.id,
        expiry: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.className = 'admin-oculto';
    actualizarBotonAcceder();
    actualizarBotonCerrarSesion();
    mostrarNotificacion('Sesión cerrada correctamente', 'info');
    setTimeout(() => location.reload(), 500);
}

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
        const session = createSession(data.token, data.user);
        return { success: true, session };
    } catch (error) {
        return { success: false, message: 'Error de conexión con el servidor' };
    }
}

async function registerUser(username, password) {
    try {
        if (username.length > 40) return { success: false, message: 'El nombre no puede tener más de 40 caracteres.' };
        if (username.length < 3) return { success: false, message: 'El nombre debe tener al menos 3 caracteres.' };
        if (password.length < 6) return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };

        const respuesta = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role: 'user' })
        });
        const data = await respuesta.json();
        if (!respuesta.ok) {
            return { success: false, message: data.error || 'Error al registrar usuario' };
        }
        const session = createSession(data.token, data.user);
        return { success: true, session };
    } catch (error) {
        return { success: false, message: 'Error de conexión con el servidor' };
    }
}

function isAdmin() {
    const session = getSession();
    return session && (session.role === 'admin' || session.role === 'superadmin');
}

function isSuperAdmin() {
    const session = getSession();
    return session && session.role === 'superadmin';
}

function isLoggedIn() {
    return getSession() !== null;
}

function protegerAdmin() {
    if (!isAdmin()) {
        if (isLoggedIn()) mostrarNotificacion('No tienes permisos de administrador', 'error');
        cerrarAdmin();
        mostrarLogin();
        return false;
    }
    return true;
}

// ============================================
// 2. NOTIFICACIONES
// ============================================
function mostrarNotificacion(mensaje, tipo = 'info') {
    const existente = document.querySelector('.notificacion');
    if (existente) existente.remove();

    const notificacion = document.createElement('div');
    notificacion.className = 'notificacion notificacion-' + tipo;
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);

    setTimeout(() => notificacion.classList.add('visible'), 10);
    setTimeout(() => {
        notificacion.classList.remove('visible');
        setTimeout(() => notificacion.remove(), 300);
    }, 4000);
}

// ============================================
// 3. CARGA DE PRODUCTOS
// ============================================
async function cargarProductos() {
    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        if (!respuesta.ok) throw new Error('Error al cargar productos');
        const data = await respuesta.json();
        let productos = Array.isArray(data) ? data : data.productos;
        if (!Array.isArray(productos)) throw new Error('La API no devolvió un array');

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
        return cargarProductosLocal();
    }
}

function cargarProductosLocal() {
    const datosGuardados = localStorage.getItem('productos_data');
    if (datosGuardados) {
        try { return JSON.parse(datosGuardados); } catch (e) {}
    }
    return null;
}

function obtenerProductoPorId(id, datos) {
    if (!datos || !datos.productos) return null;
    for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
        const productos = datos.productos[categoria];
        if (productos) {
            const encontrado = productos.find(p => p._id === id || p.id === id);
            if (encontrado) return encontrado;
        }
    }
    return null;
}

// ============================================
// 4. RENDERIZADO DE PRODUCTOS
// ============================================
function renderizarOfertas(ofertasIds, datos) {
    const contenedor = document.querySelector('#ofertas-ropa .grid-productos');
    if (!contenedor) return;

    if (!ofertasIds || ofertasIds.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay ofertas disponibles.</p>';
        return;
    }

    const productosOferta = ofertasIds.map(id => obtenerProductoPorId(id, datos)).filter(p => p !== null);

    if (productosOferta.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay ofertas disponibles.</p>';
        return;
    }

    let html = '';
    productosOferta.forEach(producto => {
        const descuento = producto.descuento || 15;
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
    contenedor.querySelectorAll('.btn-detalle').forEach(btn => {
        btn.addEventListener('click', function() {
            const producto = obtenerProductoPorId(this.dataset.id, datos);
            if (producto) abrirModal(producto, datos);
        });
    });
}

function renderizarProductosConModal(productos, contenedorSelector, datos) {
    const contenedor = document.querySelector(contenedorSelector);
    if (!contenedor) return;

    if (!productos || productos.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay productos en esta categoría.</p>';
        return;
    }

    let html = '';
    productos.forEach(producto => {
        const unidad = producto.unidad || '';
        const enOferta = producto.enOferta || false;
        const descuento = enOferta ? (producto.descuento || 15) : 0;
        const precioOferta = enOferta ? producto.precio * (1 - descuento / 100) : null;

        html += `
            <div class="producto-card ${enOferta ? 'oferta-destacada' : ''}">
                ${enOferta ? `<span class="badge-oferta">-${descuento}%</span>` : ''}
                <img src="${producto.imagen}" alt="${producto.nombre}" class="producto-img" loading="lazy">
                <h3 class="producto-nombre">${producto.nombre}</h3>
                <p class="producto-precio">
                    ${enOferta 
                        ? `<span class="tachado">$${producto.precio.toFixed(2)}</span> $${precioOferta.toFixed(2)}${unidad}` 
                        : `$${producto.precio.toFixed(2)}${unidad}`}
                </p>
                <button class="btn-secundario btn-detalle" data-id="${producto._id || producto.id}">Ver detalle</button>
            </div>
        `;
    });

    contenedor.innerHTML = html;
    contenedor.querySelectorAll('.btn-detalle').forEach(btn => {
        btn.addEventListener('click', function() {
            const producto = obtenerProductoPorId(this.dataset.id, datos);
            if (producto) abrirModal(producto, datos);
        });
    });
}

// ============================================
// 5. MODAL DE DETALLE
// ============================================
const modal = document.getElementById('modal-detalle');
const modalBody = document.getElementById('modal-body');
const modalCerrar = document.getElementById('modal-cerrar');
const modalOverlay = document.getElementById('modal-overlay');

function abrirModal(producto, datos) {
    if (!producto || !datos) return;

    const unidad = producto.unidad || '';
    const enOferta = producto.enOferta || false;
    const descuento = enOferta ? (producto.descuento || 15) : 0;
    const precioOferta = enOferta ? (producto.precio * (1 - descuento / 100)).toFixed(2) : null;

    const categoriaMap = { 'hombre': 'Hombre', 'mujer': 'Mujer', 'telas': 'Telas', 'objetos': 'Otros' };
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
                <p style="font-size: 0.9rem; color: var(--color-gris);">Disponible para pedido por encargo</p>
                <button class="btn-comprar" onclick="solicitarPedido('${producto.nombre}')">Solicitar pedido</button>
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
    mostrarNotificacion('Contáctanos para realizar el pedido: textilesmadruga@email.com', 'success');
}

function cerrarModal() {
    modal.className = 'modal-oculto';
    document.body.style.overflow = 'auto';
}

modalCerrar?.addEventListener('click', cerrarModal);
modalOverlay?.addEventListener('click', cerrarModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

// ============================================
// 6. PANEL DE ADMINISTRACIÓN
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
    if (formProducto) formProducto.className = 'form-oculto';
}

function cargarAdminProductos() {
    if (!datosGlobales) return;
    adminDatos = JSON.parse(JSON.stringify(datosGlobales));
    renderizarAdminProductos();
    cargarOfertasAdmin();
    renderizarUsuariosAdmin();
}

// ============================================
// 6.1 CAMBIO DE PESTAÑAS
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tabContent = document.getElementById(`tab-${tabName}`);
            if (tabContent) tabContent.classList.add('active');

            if (tabName === 'ofertas') cargarOfertasAdmin();
            else if (tabName === 'seguridad') renderizarUsuariosAdmin();
            else if (tabName === 'productos') renderizarAdminProductos();
        });
    });
});

// ============================================
// 6.2 ADMIN - PRODUCTOS
// ============================================
function renderizarAdminProductos() {
    if (!adminDatos) return;

    let html = '';
    const categoriaNombres = { 'hombre': 'Hombre', 'mujer': 'Mujer', 'telas': 'Telas', 'objetos': 'Otros' };

    for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
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

async function toggleOfertaAdmin(id) {
    if (!adminDatos) return;
    const producto = obtenerProductoPorId(id, adminDatos);
    if (!producto) return;

    const nuevaOferta = !producto.enOferta;

    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/offers/toggle/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ enOferta: nuevaOferta })
        });

        if (!respuesta.ok) throw new Error('Error al actualizar oferta');

        producto.enOferta = nuevaOferta;
        if (nuevaOferta) {
            adminDatos.ofertas = adminDatos.ofertas || [];
            if (!adminDatos.ofertas.includes(id)) adminDatos.ofertas.push(id);
        } else {
            adminDatos.ofertas = adminDatos.ofertas.filter(o => o !== id);
        }

        mostrarNotificacion(nuevaOferta ? 'Añadido a ofertas' : 'Quitado de ofertas', 'success');
        renderizarAdminProductos();
        cargarOfertasAdmin();
        renderizarOfertas(adminDatos.ofertas, adminDatos);
    } catch (error) {
        mostrarNotificacion('Error al actualizar oferta', 'error');
    }
}

async function eliminarProductoAdmin(id) {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) return;

    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.token}` }
        });

        if (!respuesta.ok) throw new Error('Error al eliminar');

        for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
            const productos = adminDatos.productos[categoria];
            if (productos) {
                const index = productos.findIndex(p => (p._id || p.id) === id);
                if (index !== -1) { productos.splice(index, 1); break; }
            }
        }
        adminDatos.ofertas = adminDatos.ofertas.filter(o => o !== id);

        mostrarNotificacion('Producto eliminado', 'success');
        renderizarAdminProductos();
        cargarOfertasAdmin();
        renderizarOfertas(adminDatos.ofertas, adminDatos);
    } catch (error) {
        mostrarNotificacion('Error al eliminar producto', 'error');
    }
}

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

document.getElementById('producto-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const nombre = document.getElementById('prod-nombre').value.trim();
    const precio = parseFloat(document.getElementById('prod-precio').value);
    let imagen = document.getElementById('prod-imagen').value.trim();
    const categoria = document.getElementById('prod-categoria').value;

    if (!nombre || !precio) {
        mostrarNotificacion('Completa nombre y precio', 'error');
        return;
    }

    if (!imagen) imagen = 'https://placehold.co/280x250/1A1A1A/F5E6D3?text=Sin+Imagen';

    const session = getSession();
    if (!session) { mostrarNotificacion('No hay sesión activa', 'error'); return; }

    try {
        const productoData = { nombre, precio, imagen, categoria };
        let respuesta;

        if (modoEdicion) {
            respuesta = await fetch(`${API_URL}/products/${modoEdicion}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify(productoData)
            });
        } else {
            respuesta = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify(productoData)
            });
        }

        if (!respuesta.ok) throw new Error('Error al guardar');

        const data = await respuesta.json();
        const producto = data.product || data;

        if (modoEdicion) {
            const oldProducto = obtenerProductoPorId(modoEdicion, adminDatos);
            if (oldProducto) {
                oldProducto.nombre = producto.nombre;
                oldProducto.precio = producto.precio;
                oldProducto.imagen = producto.imagen;
                oldProducto.categoria = producto.categoria;
            }
        } else {
            if (!adminDatos.productos[categoria]) adminDatos.productos[categoria] = [];
            adminDatos.productos[categoria].push(producto);
        }

        modoEdicion = null;
        formProducto.className = 'form-oculto';
        this.reset();
        document.querySelector('#producto-form button[type="submit"]').textContent = '✦ Crear';
        document.getElementById('form-title').textContent = '✦ Nuevo Producto';

        mostrarNotificacion('Producto guardado', 'success');
        renderizarAdminProductos();
        renderizarOfertas(adminDatos.ofertas, adminDatos);
    } catch (error) {
        mostrarNotificacion('Error al guardar producto', 'error');
    }
});

btnCancelarForm?.addEventListener('click', function() {
    formProducto.className = 'form-oculto';
    modoEdicion = null;
    document.getElementById('producto-form').reset();
});

btnNuevoProducto?.addEventListener('click', function() {
    modoEdicion = null;
    document.getElementById('producto-form').reset();
    formProducto.className = 'form-visible';
});

adminCerrar?.addEventListener('click', cerrarAdmin);
adminOverlay?.addEventListener('click', cerrarAdmin);

// ============================================
// 6.3 ADMIN - OFERTAS
// ============================================
async function cargarOfertasAdmin() {
    const container = document.getElementById('lista-ofertas-admin');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando ofertas...</p>';

    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        if (!respuesta.ok) throw new Error('Error al cargar');
        const data = await respuesta.json();
        const productos = Array.isArray(data) ? data : data.productos;
        const ofertas = productos.filter(p => p.enOferta);

        if (ofertas.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay ofertas activas.</p>';
            return;
        }

        let html = '';
        ofertas.forEach(producto => {
            const descuento = producto.descuento || 15;
            const precioOferta = producto.precio * (1 - descuento / 100);

            html += `
                <div class="oferta-editar-item">
                    <div class="header">
                        <span class="nombre">${producto.nombre}</span>
                        <span class="precio">
                            <span class="tachado">$${producto.precio.toFixed(2)}</span>
                            $${precioOferta.toFixed(2)}
                        </span>
                    </div>
                    <div class="campos">
                        <div class="campo">
                            <label>Descuento (%)</label>
                            <input type="number" value="${descuento}" min="0" max="100" onchange="actualizarDescuento('${producto._id}', this.value)">
                        </div>
                    </div>
                    <button class="btn-admin btn-peligro" onclick="quitarOferta('${producto._id}')">Quitar oferta</button>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Error al cargar ofertas.</p>';
    }
}

async function actualizarDescuento(productoId, descuento) {
    try {
        const session = getSession();
        await fetch(`${API_URL}/products/${productoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ descuento: parseInt(descuento) })
        });
        mostrarNotificacion('Descuento actualizado', 'success');
    } catch (error) {
        mostrarNotificacion('Error al actualizar descuento', 'error');
    }
}

async function quitarOferta(productoId) {
    if (!confirm('¿Quitar esta oferta?')) return;

    try {
        const session = getSession();
        await fetch(`${API_URL}/offers/toggle/${productoId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ enOferta: false })
        });
        mostrarNotificacion('Oferta eliminada', 'success');
        cargarOfertasAdmin();
    } catch (error) {
        mostrarNotificacion('Error al quitar oferta', 'error');
    }
}

// ============================================
// 6.4 ADMIN - SEGURIDAD (USUARIOS)
// ============================================
async function renderizarUsuariosAdmin() {
    const container = document.getElementById('admin-usuarios-lista');
    if (!container) return;

    if (!isSuperAdmin()) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--color-gris);background:white;border-radius:12px;border:1px dashed #EDE8E1;">
                <span style="font-size:2rem;display:block;margin-bottom:10px;">🔒</span>
                <p style="font-weight:600;color:var(--color-negro);">Acceso restringido</p>
                <p style="font-size:0.85rem;">Solo el SuperAdministrador puede gestionar usuarios</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando usuarios...</p>';

    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });

        if (!respuesta.ok) throw new Error('Error al cargar usuarios');

        const users = await respuesta.json();

        if (users.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:30px;color:var(--color-gris);">No hay usuarios.</p>';
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
        container.innerHTML = '<p style="text-align:center;padding:30px;color:var(--color-gris);">Error al cargar usuarios. <button onclick="renderizarUsuariosAdmin()" class="btn-admin btn-secundario" style="margin-top:10px;">Reintentar</button></p>';
    }
}

async function cambiarRolUsuario(userId, nuevoRol) {
    if (!isSuperAdmin()) { mostrarNotificacion('Solo el SuperAdmin', 'error'); return; }

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

        if (!respuesta.ok) throw new Error('Error');
        mostrarNotificacion('Rol actualizado', 'success');
        renderizarUsuariosAdmin();
    } catch (error) {
        mostrarNotificacion('Error al actualizar rol', 'error');
    }
}

async function eliminarUsuario(userId) {
    if (!isSuperAdmin()) { mostrarNotificacion('Solo el SuperAdmin', 'error'); return; }
    if (!confirm('¿Eliminar este usuario?')) return;

    try {
        const session = getSession();
        await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        mostrarNotificacion('Usuario eliminado', 'success');
        renderizarUsuariosAdmin();
    } catch (error) {
        mostrarNotificacion('Error al eliminar usuario', 'error');
    }
}

// ============================================
// 6.5 ADMIN - NUEVO USUARIO (MODAL)
// ============================================
document.getElementById('btn-nuevo-usuario')?.addEventListener('click', function() {
    if (!isSuperAdmin()) {
        mostrarNotificacion('Solo el SuperAdministrador puede crear usuarios', 'error');
        return;
    }

    abrirModalGenerico({
        titulo: 'Nuevo Usuario',
        subtitulo: 'Crea una cuenta con rol de admin o usuario',
        campos: [
            { id: 'username', label: 'Usuario', type: 'text', placeholder: 'Nombre de usuario', required: true },
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 6 caracteres', required: true },
            { id: 'role', label: 'Rol', type: 'select', opciones: [
                { value: 'user', label: 'Usuario' },
                { value: 'admin', label: 'Administrador' }
            ]}
        ],
        onSubmit: async (datos) => {
            if (!datos.username || datos.username.length < 3) {
                mostrarNotificacion('Nombre inválido (mínimo 3 caracteres)', 'error');
                return false;
            }
            if (!datos.password || datos.password.length < 6) {
                mostrarNotificacion('Contraseña inválida (mínimo 6 caracteres)', 'error');
                return false;
            }

            try {
                const session = getSession();
                const respuesta = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.token}`
                    },
                    body: JSON.stringify({
                        username: datos.username,
                        password: datos.password,
                        role: datos.role
                    })
                });

                if (!respuesta.ok) {
                    const data = await respuesta.json();
                    throw new Error(data.error || 'Error al crear usuario');
                }

                mostrarNotificacion(`Usuario "${datos.username}" creado`, 'success');
                renderizarUsuariosAdmin();
            } catch (error) {
                mostrarNotificacion(error.message, 'error');
                return false;
            }
        }
    });
});

// ============================================
// 7. BUSCADORES
// ============================================
function filtrarProductosAdmin(termino) {
    const items = document.querySelectorAll('#admin-productos-lista .admin-producto-item');
    termino = termino.toLowerCase();
    items.forEach(item => {
        const nombre = item.querySelector('.nombre')?.textContent.toLowerCase() || '';
        item.style.display = nombre.includes(termino) ? 'flex' : 'none';
    });
}

function filtrarOfertasAdmin(termino) {
    const items = document.querySelectorAll('#lista-ofertas-admin .oferta-editar-item');
    termino = termino.toLowerCase();
    items.forEach(item => {
        const nombre = item.querySelector('.nombre')?.textContent.toLowerCase() || '';
        item.style.display = nombre.includes(termino) ? 'block' : 'none';
    });
}

function filtrarUsuariosAdmin(termino) {
    const items = document.querySelectorAll('#admin-usuarios-lista .usuario-item');
    termino = termino.toLowerCase();
    items.forEach(item => {
        const nombre = item.querySelector('.nombre')?.textContent.toLowerCase() || '';
        item.style.display = nombre.includes(termino) ? 'flex' : 'none';
    });
}

// ============================================
// 8. MODAL GENÉRICO
// ============================================
function abrirModalGenerico({ titulo, subtitulo, campos, onSubmit }) {
    const modal = document.getElementById('modal-generico');
    const overlay = document.getElementById('modal-generico-overlay');
    const cerrar = document.getElementById('modal-generico-cerrar');
    const form = document.getElementById('modal-generico-form');
    const camposContainer = document.getElementById('modal-generico-campos');
    const submitBtn = document.getElementById('modal-generico-submit');

    document.getElementById('modal-generico-titulo').textContent = titulo;
    document.getElementById('modal-generico-subtitulo').textContent = subtitulo;

    let html = '';
    campos.forEach(campo => {
        html += `
            <div class="login-group">
                <label>${campo.label}</label>
                ${campo.type === 'select' 
                    ? `<select id="${campo.id}">${campo.opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>`
                    : `<input type="${campo.type || 'text'}" id="${campo.id}" placeholder="${campo.placeholder || ''}" ${campo.required ? 'required' : ''}>`
                }
            </div>
        `;
    });
    camposContainer.innerHTML = html;
    submitBtn.textContent = 'Aceptar';

    modal.className = 'login-visible';
    document.body.style.overflow = 'hidden';

    const cerrarModal = () => {
        modal.className = 'login-oculto';
        document.body.style.overflow = 'auto';
        form.reset();
    };
    cerrar.onclick = cerrarModal;
    overlay.onclick = cerrarModal;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const datos = {};
        campos.forEach(campo => {
            datos[campo.id] = document.getElementById(campo.id).value;
        });
        const resultado = await onSubmit(datos);
        if (resultado !== false) cerrarModal();
    };
}

// ============================================
// 9. MODAL DE BIENVENIDA
// ============================================
function mostrarModalBienvenida() {
    const modal = document.getElementById('modal-bienvenida');
    if (!modal) return;
    modal.className = 'bienvenida-visible';
    document.body.style.overflow = 'hidden';
}

function cerrarModalBienvenida() {
    const modal = document.getElementById('modal-bienvenida');
    if (!modal) return;
    modal.className = 'bienvenida-oculto';
    document.body.style.overflow = 'auto';
    localStorage.setItem('tm_bienvenida_vista', Date.now().toString());
}

document.getElementById('modal-bienvenida-crear')?.addEventListener('click', function() {
    cerrarModalBienvenida();
    abrirModalGenerico({
        titulo: 'Crear Cuenta',
        subtitulo: 'Es rápido, gratis y seguro',
        campos: [
            { id: 'username', label: 'Usuario', type: 'text', placeholder: 'Tu nombre de usuario', required: true },
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 6 caracteres', required: true }
        ],
        onSubmit: async (datos) => {
            const result = await registerUser(datos.username, datos.password);
            if (result.success) {
                actualizarBotonAcceder();
                mostrarNotificacion('¡Bienvenido a Textiles Madruga!', 'success');
            } else {
                mostrarNotificacion(result.message, 'error');
                return false;
            }
        }
    });
});

document.getElementById('modal-bienvenida-continuar')?.addEventListener('click', function() {
    cerrarModalBienvenida();
    mostrarNotificacion('¡Disfruta explorando nuestro catálogo!', 'info');
});

document.getElementById('modal-bienvenida-cerrar')?.addEventListener('click', cerrarModalBienvenida);
document.getElementById('modal-bienvenida-overlay')?.addEventListener('click', cerrarModalBienvenida);

// ============================================
// 10. LOGIN/LOGOUT
// ============================================
const btnAcceder = document.getElementById('btn-acceder');
const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

if (btnAcceder) {
    btnAcceder.addEventListener('click', function(e) {
        e.preventDefault();
        const session = getSession();
        if (session) {
            if (isAdmin()) abrirAdmin();
            else mostrarNotificacion('Sesión activa como: ' + session.username, 'info');
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
        } else {
            btnAcceder.textContent = 'Acceder a la cuenta';
            btnAcceder.classList.remove('activo');
        }
    }
    actualizarBotonCerrarSesion();
}

function actualizarBotonCerrarSesion() {
    const session = getSession();
    if (btnCerrarSesion) {
        if (session) btnCerrarSesion.classList.add('visible');
        else btnCerrarSesion.classList.remove('visible');
    }
}

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('¿Cerrar sesión?')) logout();
    });
}

// ============================================
// 11. LOGIN Y REGISTRO
// ============================================
document.getElementById('login-form')?.addEventListener('submit', async function(e) {
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
        } else {
            mostrarNotificacion('Bienvenido ' + username, 'success');
        }
    } else {
        mostrarNotificacion(result.message, 'error');
    }
});

document.getElementById('login-registro-link')?.addEventListener('click', function(e) {
    e.preventDefault();
    cerrarLogin();
    abrirModalGenerico({
        titulo: 'Crear Cuenta',
        subtitulo: 'Es rápido, gratis y seguro',
        campos: [
            { id: 'username', label: 'Usuario', type: 'text', placeholder: 'Tu nombre de usuario', required: true },
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 6 caracteres', required: true }
        ],
        onSubmit: async (datos) => {
            const result = await registerUser(datos.username, datos.password);
            if (result.success) {
                actualizarBotonAcceder();
                mostrarNotificacion('Usuario creado. Sesión iniciada.', 'success');
            } else {
                mostrarNotificacion(result.message, 'error');
                return false;
            }
        }
    });
});

loginCerrar?.addEventListener('click', cerrarLogin);
loginOverlay?.addEventListener('click', cerrarLogin);

// ============================================
// 12. OJITO CONTRASEÑA
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input[type="password"], input[type="text"]');
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            this.classList.toggle('visible');
        });
    });
});

// ============================================
// 13. INICIAR
// ============================================
async function iniciar() {
    console.log('🚀 Cargando productos...');

    const datos = await cargarProductos();
    if (!datos) { console.error('❌ No se pudieron cargar los datos'); return; }

    datosGlobales = datos;
    adminDatos = JSON.parse(JSON.stringify(datos));

    renderizarOfertas(datos.ofertas, datos);
    renderizarProductosConModal(datos.productos.hombre, '#ropa-hombre .grid-productos', datos);
    renderizarProductosConModal(datos.productos.mujer, '#ropa-mujer .grid-productos', datos);
    renderizarProductosConModal(datos.productos.telas, '#telas .grid-productos', datos);
    renderizarProductosConModal(datos.productos.objetos, '#otros .grid-productos', datos);

    actualizarBotonAcceder();
    console.log('✅ Productos cargados correctamente');

    if (!isLoggedIn()) {
        const ultimaVista = localStorage.getItem('tm_bienvenida_vista');
        const yaVista = ultimaVista && (Date.now() - parseInt(ultimaVista)) < 24 * 60 * 60 * 1000;
        if (!yaVista) setTimeout(mostrarModalBienvenida, 1500);
    }
}

document.addEventListener('DOMContentLoaded', iniciar);

// ============================================
// 14. EXPONER FUNCIONES GLOBALES
// ============================================
window.toggleOfertaAdmin = toggleOfertaAdmin;
window.editarProductoAdmin = editarProductoAdmin;
window.eliminarProductoAdmin = eliminarProductoAdmin;
window.abrirAdmin = abrirAdmin;
window.cerrarAdmin = cerrarAdmin;
window.mostrarLogin = mostrarLogin;
window.cerrarLogin = cerrarLogin;
window.logout = logout;
window.cambiarRolUsuario = cambiarRolUsuario;
window.renderizarUsuariosAdmin = renderizarUsuariosAdmin;
window.mostrarNotificacion = mostrarNotificacion;
window.solicitarPedido = solicitarPedido;
window.cargarOfertasAdmin = cargarOfertasAdmin;
window.actualizarDescuento = actualizarDescuento;
window.quitarOferta = quitarOferta;
window.filtrarProductosAdmin = filtrarProductosAdmin;
window.filtrarOfertasAdmin = filtrarOfertasAdmin;
window.filtrarUsuariosAdmin = filtrarUsuariosAdmin;
window.abrirModalGenerico = abrirModalGenerico;
window.mostrarModalBienvenida = mostrarModalBienvenida;
window.cerrarModalBienvenida = cerrarModalBienvenida;
window.eliminarUsuario = eliminarUsuario;

// ============================================
// 15. MENÚ HAMBURGUESA
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const hamburguesa = document.getElementById('menu-hamburguesa');
    const nav = document.getElementById('nav-principal');

    if (hamburguesa && nav) {
        hamburguesa.addEventListener('click', function(event) {
            event.stopPropagation();
            this.classList.toggle('activo');
            nav.classList.toggle('activo');
        });

        nav.querySelectorAll('a').forEach(enlace => {
            enlace.addEventListener('click', () => {
                hamburguesa.classList.remove('activo');
                nav.classList.remove('activo');
            });
        });

        document.addEventListener('click', function(event) {
            if (!nav.contains(event.target) && !hamburguesa.contains(event.target)) {
                hamburguesa.classList.remove('activo');
                nav.classList.remove('activo');
            }
        });
    }
});