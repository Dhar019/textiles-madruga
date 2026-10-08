// ============================================
// SCRIPT.JS - Textiles Madruga
// Versión 4.1 - Sesiones con timeout y sendBeacon
// ============================================

const API_URL = 'https://textiles-madruga-api.eldani000219.workers.dev/api';
const SESSION_KEY = 'tm_session';

// ============================================
// MODAL DE CONFIRMACIÓN PROPIO
// ============================================
function confirmar(opciones) {
    return new Promise((resolve) => {
        if (typeof opciones === 'string') {
            opciones = { mensaje: opciones };
        }
        
        const {
            titulo = '¿Estás seguro?',
            mensaje = 'Esta acción no se puede deshacer.',
            tipo = 'info',
            textoAceptar = 'Aceptar',
            textoCancelar = 'Cancelar'
        } = opciones;

        const modal = document.getElementById('modal-confirmar');
        const overlay = document.getElementById('confirmar-overlay');
        const btnAceptar = document.getElementById('confirmar-aceptar');
        const btnCancelar = document.getElementById('confirmar-cancelar');
        const icono = document.getElementById('confirmar-icono');
        const tituloEl = document.getElementById('confirmar-titulo');
        const mensajeEl = document.getElementById('confirmar-mensaje');

        tituloEl.textContent = titulo;
        mensajeEl.textContent = mensaje;
        btnAceptar.textContent = textoAceptar;
        btnCancelar.textContent = textoCancelar;

        icono.className = 'confirmar-icono';
        if (tipo === 'peligro') {
            icono.classList.add('peligro');
            btnAceptar.className = 'confirmar-btn confirmar-btn-aceptar peligro';
        } else if (tipo === 'exito') {
            icono.classList.add('exito');
            btnAceptar.className = 'confirmar-btn confirmar-btn-aceptar';
        } else {
            btnAceptar.className = 'confirmar-btn confirmar-btn-aceptar';
        }

        modal.className = 'confirmar-visible';
        document.body.style.overflow = 'hidden';

        const cerrar = (resultado) => {
            modal.className = 'confirmar-oculto';
            document.body.style.overflow = 'auto';
            btnAceptar.onclick = null;
            btnCancelar.onclick = null;
            overlay.onclick = null;
            resolve(resultado);
        };

        btnAceptar.onclick = () => cerrar(true);
        btnCancelar.onclick = () => cerrar(false);
        overlay.onclick = () => cerrar(false);

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escapeHandler);
                cerrar(false);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    });
}

// ============================================
// TURNSTILE
// ============================================
let turnstileToken = null;

window.onTurnstileSuccess = function(token) {
    turnstileToken = token;
    console.log('✅ Turnstile token recibido');
};

// ============================================
// POLÍTICAS DE SEGURIDAD POR ROL
// ============================================
const POLITICAS_SEGURIDAD = {
    cliente: {
        inactividadMs: 2 * 60 * 60 * 1000,
        abandonoMovilMs: 4 * 60 * 60 * 1000,
        tokenExpiryMs: 7 * 24 * 60 * 60 * 1000,
        avisoPrevioMs: 2 * 60 * 1000
    },
    admin: {
        inactividadMs: 15 * 60 * 1000,
        abandonoMovilMs: 15 * 60 * 1000,
        tokenExpiryMs: 8 * 60 * 60 * 1000,
        avisoPrevioMs: 1 * 60 * 1000
    }
};

function obtenerPoliticaSeguridad() {
    const session = getSession();
    if (session && (session.role === 'admin' || session.role === 'superadmin')) {
        return POLITICAS_SEGURIDAD.admin;
    }
    return POLITICAS_SEGURIDAD.cliente;
}

let datosGlobales = null;
let adminDatos = null;
let modoEdicion = null;
let temporizadorInactividad = null;
let temporizadorAviso = null;
let tiempoOculto = null;
let verificadorSesion = null;

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
        const politica = data.role === 'admin' || data.role === 'superadmin'
            ? POLITICAS_SEGURIDAD.admin
            : POLITICAS_SEGURIDAD.cliente;
        if (data.lastActivity && (Date.now() - data.lastActivity) > politica.inactividadMs) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return data;
    } catch { return null; }
}

function createSession(token, user) {
    const rol = user.role || 'user';
    const politica = (rol === 'admin' || rol === 'superadmin')
        ? POLITICAS_SEGURIDAD.admin
        : POLITICAS_SEGURIDAD.cliente;

    const session = {
        token,
        username: user.username,
        role: rol,
        userId: user.id,
        email: user.email || '',
        expiry: Date.now() + politica.tokenExpiryMs,
        lastActivity: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

function actualizarActividad() {
    const session = getSession();
    if (session) {
        session.lastActivity = Date.now();
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
}

async function logout() {
    try {
        const session = getSession();
        if (session && session.token) {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
        }
    } catch (error) {
        console.warn('⚠️ No se pudo cerrar la sesión en el servidor:', error);
    }

    detenerTemporizadorInactividad();
    detenerTemporizadorAviso();
    detenerVerificadorSesion();

    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('tm_pestana_activa');

    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.className = 'admin-oculto';

    document.body.classList.remove('admin-abierto');

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
            body: JSON.stringify({ username, password, turnstileToken: turnstileToken || '' })
        });

        if (respuesta.status === 409) {
            const data = await respuesta.json();
            return { success: false, message: data.error || 'Ya hay una sesión activa en otro dispositivo' };
        }

        if (respuesta.status === 429) {
            const data = await respuesta.json();
            return { success: false, message: data.error || 'Demasiados intentos fallidos' };
        }

        const data = await respuesta.json();
        if (!respuesta.ok) {
            return { success: false, message: data.error || 'Error al iniciar sesión' };
        }
        const session = createSession(data.token, data.user);
        return { success: true, session };
    } catch (error) {
        console.error('Error en login:', error);
        return { success: false, message: 'Error de conexión con el servidor' };
    }
}

async function registerUser(username, password, email = '', name = '') {
    try {
        if (username.length > 40) return { success: false, message: 'El nombre no puede tener más de 40 caracteres.' };
        if (username.length < 3) return { success: false, message: 'El nombre debe tener al menos 3 caracteres.' };
        if (password.length < 6) return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };

        const respuesta = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role: 'user', email, name })
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
// 2. VERIFICACIÓN PERIÓDICA DE SESIÓN
// ============================================
function iniciarVerificadorSesion() {
    detenerVerificadorSesion();
    verificadorSesion = setInterval(async () => {
        const session = getSession();
        if (!session || !session.token) return;

        try {
            const respuesta = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });

            if (respuesta.status === 401 || respuesta.status === 403) {
                console.log('🔒 Sesión reemplazada en otro dispositivo');
                mostrarNotificacion('Tu sesión fue cerrada desde otro dispositivo', 'warning');
                logout();
            }
        } catch (error) {
            console.warn('⚠️ Verificación de sesión falló:', error);
        }
    }, 30000);
}

function detenerVerificadorSesion() {
    if (verificadorSesion) {
        clearInterval(verificadorSesion);
        verificadorSesion = null;
    }
}

// ============================================
// 3. SEGURIDAD: CIERRE AUTOMÁTICO POR INACTIVIDAD
// ============================================
function reiniciarTemporizadorInactividad() {
    if (!isLoggedIn()) return;

    actualizarActividad();
    const politica = obtenerPoliticaSeguridad();

    detenerTemporizadorInactividad();
    detenerTemporizadorAviso();

    const tiempoAviso = politica.inactividadMs - politica.avisoPrevioMs;
    if (tiempoAviso > 0) {
        temporizadorAviso = setTimeout(() => {
            const segundosRestantes = Math.floor(politica.avisoPrevioMs / 1000);
            const minutos = Math.floor(segundosRestantes / 60);
            const segundos = segundosRestantes % 60;
            mostrarNotificacion(
                `⏰ Tu sesión expirará en ${minutos}m ${segundos}s por inactividad`,
                'warning'
            );
        }, tiempoAviso);
    }

    temporizadorInactividad = setTimeout(() => {
        mostrarNotificacion('Sesión cerrada por inactividad', 'info');
        logout();
    }, politica.inactividadMs);
}

function detenerTemporizadorInactividad() {
    if (temporizadorInactividad) {
        clearTimeout(temporizadorInactividad);
        temporizadorInactividad = null;
    }
}

function detenerTemporizadorAviso() {
    if (temporizadorAviso) {
        clearTimeout(temporizadorAviso);
        temporizadorAviso = null;
    }
}

['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'].forEach(evento => {
    document.addEventListener(evento, reiniciarTemporizadorInactividad, { passive: true });
});

window.addEventListener('load', () => {
    const pestanaActiva = sessionStorage.getItem('tm_pestana_activa');
    const sesionActiva = isLoggedIn();

    if (sesionActiva && pestanaActiva === 'false') {
        logout();
        return;
    }

    sessionStorage.setItem('tm_pestana_activa', 'true');

    if (sesionActiva) {
        reiniciarTemporizadorInactividad();
        iniciarVerificadorSesion();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        tiempoOculto = Date.now();
    } else {
        if (tiempoOculto && isLoggedIn()) {
            const politica = obtenerPoliticaSeguridad();
            const tiempoTranscurrido = Date.now() - tiempoOculto;

            if (tiempoTranscurrido > politica.abandonoMovilMs) {
                mostrarNotificacion('Sesión cerrada por inactividad', 'info');
                logout();
                return;
            }
        }
        tiempoOculto = null;
    }
});

// ============================================
// 4. CIERRE DE SESIÓN AL CERRAR PESTAÑA/VENTANA
// ============================================
window.addEventListener('pagehide', () => {
    if (isLoggedIn()) {
        sessionStorage.setItem('tm_pestana_activa', 'false');
        
        const session = getSession();
        if (session && session.token) {
            const url = `${API_URL}/auth/logout`;
            try {
                const blob = new Blob(
                    [JSON.stringify({ token: session.token })],
                    { type: 'application/json' }
                );
                navigator.sendBeacon(url, blob);
                console.log('🔓 Logout enviado vía sendBeacon (pagehide)');
            } catch (e) {
                console.warn('No se pudo cerrar sesión con sendBeacon:', e);
            }
        }
    }
});

window.addEventListener('beforeunload', () => {
    if (isLoggedIn()) {
        const session = getSession();
        if (session && session.token) {
            const url = `${API_URL}/auth/logout`;
            try {
                const blob = new Blob(
                    [JSON.stringify({ token: session.token })],
                    { type: 'application/json' }
                );
                navigator.sendBeacon(url, blob);
                console.log('🔓 Logout enviado vía sendBeacon (beforeunload)');
            } catch (e) {}
        }
    }
});

// ============================================
// 5. NOTIFICACIONES
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
    }, 5000);
}

// ============================================
// 6. CARGA DE PRODUCTOS
// ============================================
async function cargarProductos() {
    try {
        const respuesta = await fetch(`${API_URL}/productos`, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });
        
        if (!respuesta.ok) throw new Error(`Error HTTP: ${respuesta.status}`);
        
        const data = await respuesta.json();
        let productos = Array.isArray(data) ? data : data.productos;
        if (!Array.isArray(productos)) throw new Error('La API no devolvió un array');

        const datos = {
            ofertas: productos.filter(p => p.enOferta).map(p => p.id || p._id),
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
        console.warn('⚠️ Error al cargar desde servidor:', error.message);
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
            const encontrado = productos.find(p =>
                String(p.id) === String(id) || String(p._id) === String(id)
            );
            if (encontrado) return encontrado;
        }
    }
    return null;
}

// ============================================
// 7. RENDERIZADO DE PRODUCTOS
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
        const tipoOferta = producto.tipoOferta || 'descuento';
        const descuento = producto.descuento || 0;
        const promocion = producto.promocion || '';
        const precioOferta = descuento > 0 
            ? producto.precio * (1 - descuento / 100) 
            : producto.precio;

        let badge = '';
        let descripcionOferta = '';

        switch (tipoOferta) {
            case 'descuento':
                badge = `-${descuento}%`;
                descripcionOferta = `${descuento}% de descuento`;
                break;
            case '2x1':
                badge = '2x1';
                descripcionOferta = 'Lleva 2, paga 1';
                break;
            case '3x2':
                badge = '3x2';
                descripcionOferta = 'Lleva 3, paga 2';
                break;
            case 'descuento_2x1':
                badge = `-${descuento}% + 2x1`;
                descripcionOferta = `${descuento}% OFF + Lleva 2, paga 1`;
                break;
            case 'descuento_3x2':
                badge = `-${descuento}% + 3x2`;
                descripcionOferta = `${descuento}% OFF + Lleva 3, paga 2`;
                break;
            case 'personalizado':
                badge = promocion || 'OFERTA';
                descripcionOferta = promocion;
                break;
        }

        const mostrarPrecioOferta = descuento > 0;

        html += `
            <div class="producto-card oferta-destacada">
                <span class="badge-oferta">${badge}</span>
                <img src="${producto.imagen}" alt="${producto.nombre}" class="producto-img" onclick="abrirLightbox('${producto.imagen}', '${producto.nombre}')" style="cursor: zoom-in;" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;">
                <h3 class="producto-nombre">${producto.nombre}</h3>
                <p class="producto-descripcion-corta">${descripcionOferta}</p>
                <p class="producto-precio">
                    ${mostrarPrecioOferta 
                        ? `<span class="tachado">$${producto.precio.toFixed(2)}</span>
                           <span class="precio-oferta-grande">$${precioOferta.toFixed(2)}</span>`
                        : `$${producto.precio.toFixed(2)}`}
                </p>
                <button class="btn-secundario btn-detalle" data-id="${producto.id || producto._id}">Ver detalle</button>
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
        const tipoOferta = producto.tipoOferta || 'descuento';
        const descuento = enOferta ? (producto.descuento || 0) : 0;
        const promocion = producto.promocion || '';
        const precioOferta = descuento > 0 ? producto.precio * (1 - descuento / 100) : null;

        let badge = '';
        if (enOferta) {
            switch (tipoOferta) {
                case 'descuento': badge = `-${descuento}%`; break;
                case '2x1': badge = '2x1'; break;
                case '3x2': badge = '3x2'; break;
                case 'descuento_2x1': badge = `-${descuento}% + 2x1`; break;
                case 'descuento_3x2': badge = `-${descuento}% + 3x2`; break;
                case 'personalizado': badge = promocion || 'OFERTA'; break;
            }
        }

        html += `
            <div class="producto-card ${enOferta ? 'oferta-destacada' : ''}">
                ${enOferta ? `<span class="badge-oferta">${badge}</span>` : ''}
                <img src="${producto.imagen}" alt="${producto.nombre}" class="producto-img" loading="lazy" onclick="abrirLightbox('${producto.imagen}', '${producto.nombre}')" style="cursor: zoom-in;" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;">
                <p class="producto-hint">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        <line x1="11" y1="8" x2="11" y2="14"/>
                        <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                    Toca la imagen para verla completa
                </p>
                <h3 class="producto-nombre">${producto.nombre}</h3>
                <p class="producto-precio">
                    ${enOferta && descuento > 0
                        ? `<span class="tachado">$${producto.precio.toFixed(2)}</span> $${precioOferta.toFixed(2)}${unidad}` 
                        : `$${producto.precio.toFixed(2)}${unidad}`}
                </p>
                <button class="btn-secundario btn-detalle" data-id="${producto.id || producto._id}">Ver detalle</button>
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
// 8. MODAL DE DETALLE
// ============================================
const modal = document.getElementById('modal-detalle');
const modalBody = document.getElementById('modal-body');
const modalCerrar = document.getElementById('modal-cerrar');
const modalOverlay = document.getElementById('modal-overlay');

function abrirModal(producto, datos) {
    if (!producto || !datos) return;

    const unidad = producto.unidad || '';
    const enOferta = producto.enOferta || false;
    const tipoOfertaActual = producto.tipoOferta || 'descuento';
    const descuentoActual = producto.descuento || 0;
    const promocionActual = producto.promocion || '';
    const precioOferta = descuentoActual > 0 
        ? (producto.precio * (1 - descuentoActual / 100)).toFixed(2) 
        : null;

    const categoriaMap = { 'hombre': 'Hombre', 'mujer': 'Mujer', 'telas': 'Telas', 'objetos': 'Otros' };
    let categoriaTexto = 'Producto';
    for (const [key, value] of Object.entries(datos.productos)) {
        if (value.some(p => String(p.id) === String(producto.id) || String(p._id) === String(producto._id))) {
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
    const descripcion = producto.descripcion || descripciones[0];

    let etiquetaOferta = '';
    if (enOferta) {
        switch (tipoOfertaActual) {
            case 'descuento':
                etiquetaOferta = `${descuentoActual}% de descuento`;
                break;
            case '2x1':
                etiquetaOferta = 'Lleva 2, paga 1';
                break;
            case '3x2':
                etiquetaOferta = 'Lleva 3, paga 2';
                break;
            case 'descuento_2x1':
                etiquetaOferta = `${descuentoActual}% OFF + Lleva 2, paga 1`;
                break;
            case 'descuento_3x2':
                etiquetaOferta = `${descuentoActual}% OFF + Lleva 3, paga 2`;
                break;
            case 'personalizado':
                etiquetaOferta = promocionActual;
                break;
        }
    }

    modalBody.innerHTML = `
        <div class="modal-producto">
            <div class="modal-producto-imagen">
                <img src="${producto.imagen}" alt="${producto.nombre}" onclick="abrirLightbox('${producto.imagen}', '${producto.nombre}')" style="cursor: zoom-in;" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;">
            </div>
            <div class="modal-producto-info">
                <span class="categoria">${categoriaTexto}</span>
                <h2>${producto.nombre}</h2>
                <div>
                    ${enOferta && descuentoActual > 0 ? `<span class="precio-oferta">$${producto.precio.toFixed(2)}</span>` : ''}
                    <span class="precio">${enOferta && descuentoActual > 0 ? `$${precioOferta}` : `$${producto.precio.toFixed(2)}`}${unidad}</span>
                </div>
                ${enOferta && etiquetaOferta ? `
                    <div style="background:#FFF5EB;padding:10px 16px;border-radius:8px;border-left:3px solid var(--color-naranja);margin:8px 0;">
                        <strong style="color:var(--color-naranja);font-size:0.85rem;">🏷️ ${etiquetaOferta}</strong>
                    </div>
                ` : ''}
                <p class="descripcion">${descripcion}</p>
                <p style="font-size: 0.9rem; color: var(--color-gris);">Disponible para pedido por encargo</p>
                <button class="btn-comprar" onclick="solicitarPedido('${producto.nombre}')">Solicitar pedido</button>
            </div>
        </div>
    `;

    modal.className = 'modal-visible';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-abierto');
}

function cerrarModal() {
    modal.className = 'modal-oculto';
    document.body.style.overflow = 'auto';
    document.body.classList.remove('modal-abierto');
}

modalCerrar?.addEventListener('click', cerrarModal);
modalOverlay?.addEventListener('click', cerrarModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

// ============================================
// 9. LIGHTBOX DE IMAGEN
// ============================================
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxCerrar = document.getElementById('lightbox-cerrar');

function abrirLightbox(src, alt) {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || 'Imagen ampliada';
    lightbox.className = 'lightbox-visible';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('lightbox-abierto');
}

function cerrarLightbox() {
    if (!lightbox) return;
    lightbox.className = 'lightbox-oculto';
    document.body.style.overflow = 'auto';
    document.body.classList.remove('lightbox-abierto');
}

lightboxImg?.addEventListener('click', function(e) {
    e.stopPropagation();
    cerrarLightbox();
});

lightboxCerrar?.addEventListener('click', cerrarLightbox);
lightboxOverlay?.addEventListener('click', cerrarLightbox);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox?.className === 'lightbox-visible') {
        cerrarLightbox();
    }
});

window.abrirLightbox = abrirLightbox;
window.cerrarLightbox = cerrarLightbox;

// ============================================
// 10. SOLICITAR PEDIDO (SIN REGISTRO)
// ============================================
function solicitarPedido(producto) {
    const modalPedido = document.getElementById('modal-pedido');
    if (!modalPedido) {
        mostrarNotificacion(
            `Contáctanos para pedir "${producto}": textilesmadruga@email.com`,
            'success'
        );
        return;
    }

    document.getElementById('modal-pedido-producto').textContent = `Producto: ${producto}`;
    modalPedido.className = 'login-visible';
    document.body.style.overflow = 'hidden';

    const cerrar = () => {
        modalPedido.className = 'login-oculto';
        document.body.style.overflow = 'auto';
        document.getElementById('modal-pedido-form').reset();
    };

    document.getElementById('modal-pedido-cerrar').onclick = cerrar;
    document.getElementById('modal-pedido-overlay').onclick = cerrar;

    document.getElementById('modal-pedido-form').onsubmit = (e) => {
        e.preventDefault();
        const nombre = document.getElementById('pedido-nombre').value;
        const contacto = document.getElementById('pedido-contacto').value;
        const cantidad = document.getElementById('pedido-cantidad').value;
        const notas = document.getElementById('pedido-notas').value;

        console.log('📦 Pedido recibido:', { producto, nombre, contacto, cantidad, notas });

        mostrarNotificacion(
            `¡Pedido enviado! Te contactaremos pronto, ${nombre}.`,
            'success'
        );
        cerrar();
    };
}

// ============================================
// 11. PANEL DE ADMINISTRACIÓN
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
    document.body.classList.add('admin-abierto');
    cargarAdminProductos();
    reiniciarTemporizadorInactividad();
    iniciarVerificadorSesion();
}

function cerrarAdmin() {
    adminPanel.className = 'admin-oculto';
    document.body.style.overflow = 'auto';
    document.body.classList.remove('admin-abierto');
    if (formProducto) formProducto.className = 'form-oculto';
}

function cargarAdminProductos() {
    if (!datosGlobales) return;
    adminDatos = JSON.parse(JSON.stringify(datosGlobales));
    renderizarAdminProductos();
    cargarOfertasAdmin();
    renderizarUsuariosAdmin();
}

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

function renderizarAdminProductos() {
    if (!adminDatos) return;

    let html = '';
    const categoriaNombres = { 'hombre': 'Hombre', 'mujer': 'Mujer', 'telas': 'Telas', 'objetos': 'Otros' };

    for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
        const productos = adminDatos.productos[categoria] || [];
        productos.forEach(producto => {
            const enOferta = producto.enOferta || false;
            const id = producto.id || producto._id || 'sin-id';
            const descripcion = producto.descripcion || 'Sin descripción';

            html += `
                <div class="admin-producto-item" data-id="${id}" data-categoria="${categoria}">
                    <div class="info">
                        <img src="${producto.imagen}" alt="${producto.nombre}" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;">
                        <div class="info-texto">
                            <span class="nombre">${producto.nombre}</span>
                            <span class="descripcion">${descripcion.substring(0, 60)}${descripcion.length > 60 ? '...' : ''}</span>
                            <span class="id-producto">ID: ${id}</span>
                        </div>
                        <span class="precio">$${producto.precio.toFixed(2)}</span>
                        <span class="categoria-tag">${categoriaNombres[categoria]}</span>
                        ${enOferta ? '<span style="background:#E87A20;color:white;padding:2px 12px;border-radius:50px;font-size:0.7rem;font-weight:600;">OFERTA</span>' : ''}
                    </div>
                    <div class="acciones">
                        <button class="btn-oferta ${enOferta ? 'activo' : ''}" onclick="toggleOfertaAdmin('${id}')">
                            ${enOferta ? 'Quitar oferta' : 'Oferta'}
                        </button>
                        <button class="btn-editar" onclick="editarProductoAdmin('${id}')">Editar</button>
                        <button class="btn-eliminar" onclick="eliminarProductoAdmin('${id}')">Eliminar</button>
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
            body: JSON.stringify({ 
                enOferta: nuevaOferta,
                tipoOferta: producto.tipoOferta || 'descuento',
                descuento: producto.descuento || 15,
                promocion: producto.promocion || ''
            })
        });

        if (!respuesta.ok) throw new Error('Error al actualizar oferta');

        mostrarNotificacion(nuevaOferta ? 'Añadido a ofertas' : 'Quitado de ofertas', 'success');

        const datosActualizados = await cargarProductos();
        if (datosActualizados) {
            datosGlobales = datosActualizados;
            adminDatos = JSON.parse(JSON.stringify(datosActualizados));
            renderizarAdminProductos();
            cargarOfertasAdmin();
            renderizarOfertas(datosActualizados.ofertas, datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.hombre, '#ropa-hombre .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.mujer, '#ropa-mujer .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.telas, '#telas .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.objetos, '#otros .grid-productos', datosActualizados);
        }
    } catch (error) {
        mostrarNotificacion('Error al actualizar oferta', 'error');
    }
}

async function eliminarProductoAdmin(id) {
    const confirmado = await confirmar({ 
        titulo: 'Eliminar producto',
        mensaje: '¿Seguro que quieres eliminar este producto? Esta acción no se puede deshacer.',
        tipo: 'peligro',
        textoAceptar: 'Eliminar',
        textoCancelar: 'Cancelar'
    });
    
    if (!confirmado) return;

    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${session.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) {
            const errorData = await respuesta.json().catch(() => ({}));
            console.error('Error del servidor:', respuesta.status, errorData);
            throw new Error(errorData.error || `Error ${respuesta.status}`);
        }

        const data = await respuesta.json();
        console.log('✅ Respuesta del servidor:', data);

        mostrarNotificacion('Producto eliminado', 'success');

        const datosActualizados = await cargarProductos();
        if (datosActualizados) {
            datosGlobales = datosActualizados;
            adminDatos = JSON.parse(JSON.stringify(datosActualizados));
            renderizarAdminProductos();
            cargarOfertasAdmin();
            renderizarOfertas(datosActualizados.ofertas, datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.hombre, '#ropa-hombre .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.mujer, '#ropa-mujer .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.telas, '#telas .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.objetos, '#otros .grid-productos', datosActualizados);
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
        mostrarNotificacion(`Error al eliminar: ${error.message}`, 'error');
    }
}

function editarProductoAdmin(id) {
    modoEdicion = id;
    const producto = obtenerProductoPorId(id, adminDatos);
    if (!producto) {
        mostrarNotificacion('Producto no encontrado', 'error');
        return;
    }

    document.getElementById('prod-nombre').value = producto.nombre || '';
    document.getElementById('prod-precio').value = producto.precio || '';
    document.getElementById('prod-imagen').value = producto.imagen || '';
    document.getElementById('prod-descripcion').value = producto.descripcion || '';
    document.getElementById('prod-id').value = producto.id || producto._id || 'sin-id';

    for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
        if (adminDatos.productos[categoria]?.some(p => 
            String(p._id) === String(id) || String(p.id) === String(id)
        )) {
            document.getElementById('prod-categoria').value = categoria;
            break;
        }
    }

    const preview = document.getElementById('drop-zone-preview');
    const content = document.getElementById('drop-zone-content');
    if (producto.imagen && preview && content) {
        preview.src = producto.imagen;
        preview.style.display = 'block';
        content.style.display = 'none';
    } else if (preview && content) {
        preview.style.display = 'none';
        preview.src = '';
        content.style.display = 'flex';
    }

    formProducto.className = 'form-visible';
    document.querySelector('#producto-form button[type="submit"]').textContent = 'Actualizar';
    document.getElementById('form-title').textContent = 'Editar Producto';
    formProducto.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('producto-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const nombre = document.getElementById('prod-nombre').value.trim();
    const precio = parseFloat(document.getElementById('prod-precio').value);
    let imagen = document.getElementById('prod-imagen').value.trim();
    const categoria = document.getElementById('prod-categoria').value;
    const descripcion = document.getElementById('prod-descripcion').value.trim();
    let idEditable = document.getElementById('prod-id').value.trim();

    if (idEditable === 'sin-id') idEditable = '';

    if (!nombre || !precio) {
        mostrarNotificacion('Completa nombre y precio', 'error');
        return;
    }

    if (!imagen) imagen = 'assets/img/placeholder.webp';

    const session = getSession();
    if (!session) { mostrarNotificacion('No hay sesión activa', 'error'); return; }

    try {
        const productoData = { nombre, precio, imagen, categoria, descripcion };
        if (idEditable && !modoEdicion) {
            productoData.id = idEditable;
        }

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

        if (!respuesta.ok) {
            const errorData = await respuesta.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al guardar');
        }

        modoEdicion = null;
        formProducto.className = 'form-oculto';
        this.reset();

        const preview = document.getElementById('drop-zone-preview');
        const content = document.getElementById('drop-zone-content');
        if (preview && content) {
            preview.style.display = 'none';
            preview.src = '';
            content.style.display = 'flex';
        }
        document.getElementById('prod-id').value = '';

        document.querySelector('#producto-form button[type="submit"]').textContent = 'Crear';
        document.getElementById('form-title').textContent = 'Nuevo Producto';

        mostrarNotificacion('Producto guardado', 'success');

        const datosActualizados = await cargarProductos();
        if (datosActualizados) {
            datosGlobales = datosActualizados;
            adminDatos = JSON.parse(JSON.stringify(datosActualizados));
            renderizarAdminProductos();
            renderizarOfertas(datosActualizados.ofertas, datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.hombre, '#ropa-hombre .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.mujer, '#ropa-mujer .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.telas, '#telas .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.objetos, '#otros .grid-productos', datosActualizados);
            cargarOfertasAdmin();
        }
    } catch (error) {
        console.error('Error guardar:', error);
        mostrarNotificacion(error.message || 'Error al guardar producto', 'error');
    }
});

btnCancelarForm?.addEventListener('click', function() {
    formProducto.className = 'form-oculto';
    modoEdicion = null;
    document.getElementById('producto-form').reset();

    const preview = document.getElementById('drop-zone-preview');
    const content = document.getElementById('drop-zone-content');
    if (preview && content) {
        preview.style.display = 'none';
        preview.src = '';
        content.style.display = 'flex';
    }
});

btnNuevoProducto?.addEventListener('click', function() {
    modoEdicion = null;
    document.getElementById('producto-form').reset();
    document.getElementById('prod-id').value = '';

    const preview = document.getElementById('drop-zone-preview');
    const content = document.getElementById('drop-zone-content');
    if (preview && content) {
        preview.style.display = 'none';
        preview.src = '';
        content.style.display = 'flex';
    }

    formProducto.className = 'form-visible';
    document.querySelector('#producto-form button[type="submit"]').textContent = 'Crear';
    document.getElementById('form-title').textContent = 'Nuevo Producto';
});

adminCerrar?.addEventListener('click', cerrarAdmin);
adminOverlay?.addEventListener('click', cerrarAdmin);

// ============================================
// 12. GESTIÓN DE OFERTAS CON TIPOS AVANZADOS
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
            const descuento = producto.descuento || 0;
            const tipoOferta = producto.tipoOferta || 'descuento';
            const promocion = producto.promocion || '';
            const precioOferta = descuento > 0 
                ? producto.precio * (1 - descuento / 100) 
                : producto.precio;
            const imagen = producto.imagen || 'assets/img/placeholder.webp';
            const descripcion = producto.descripcion || 'Sin descripción';
            const id = producto.id || producto._id || 'sin-id';
            const categoria = producto.categoria || 'sin categoría';

            html += `
                <div class="oferta-editar-item" data-id="${id}">
                    <div class="oferta-card-producto">
                        <img src="${imagen}" alt="${producto.nombre}" class="oferta-card-img" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;">
                        <div class="oferta-card-info">
                            <span class="oferta-card-nombre">${producto.nombre}</span>
                            <span class="oferta-card-descripcion">${descripcion.substring(0, 80)}${descripcion.length > 80 ? '...' : ''}</span>
                            <span class="oferta-card-categoria">${categoria}</span>
                            <span class="oferta-card-id">ID: ${id}</span>
                        </div>
                    </div>
                    
                    <div class="oferta-card-precios">
                        <span class="oferta-card-precio-original">$${producto.precio.toFixed(2)}</span>
                        ${descuento > 0 ? `
                            <span class="oferta-card-precio-oferta">$${precioOferta.toFixed(2)}</span>
                        ` : ''}
                    </div>
                    
                    <div class="oferta-card-edicion">
                        <div class="campo">
                            <label>Tipo de oferta</label>
                            <select id="tipo-${id}" class="oferta-select">
                                <option value="descuento" ${tipoOferta === 'descuento' ? 'selected' : ''}>Descuento</option>
                                <option value="2x1" ${tipoOferta === '2x1' ? 'selected' : ''}>Lleva 2, paga 1</option>
                                <option value="3x2" ${tipoOferta === '3x2' ? 'selected' : ''}>Lleva 3, paga 2</option>
                                <option value="descuento_2x1" ${tipoOferta === 'descuento_2x1' ? 'selected' : ''}>Descuento + 2x1</option>
                                <option value="descuento_3x2" ${tipoOferta === 'descuento_3x2' ? 'selected' : ''}>Descuento + 3x2</option>
                                <option value="personalizado" ${tipoOferta === 'personalizado' ? 'selected' : ''}>Personalizado</option>
                            </select>
                        </div>
                        
                        <div class="campo">
                            <label>Descuento (%)</label>
                            <input type="number" 
                                   id="descuento-${id}" 
                                   value="${descuento}" 
                                   min="0" 
                                   max="100"
                                   onkeydown="if(event.key==='Enter'){event.preventDefault();guardarOferta('${id}');}">
                        </div>
                        
                        <div class="campo">
                            <label>Promoción (texto)</label>
                            <input type="text" 
                                   id="promocion-${id}" 
                                   value="${promocion}" 
                                   placeholder="Ej: 2x1, Envío gratis"
                                   onkeydown="if(event.key==='Enter'){event.preventDefault();guardarOferta('${id}');}">
                        </div>
                        
                        <button class="btn-admin btn-primario btn-guardar-oferta" onclick="guardarOferta('${id}')">
                            💾 Guardar
                        </button>
                        
                        <button class="btn-admin btn-peligro" onclick="quitarOferta('${id}')">
                            🗑 Quitar
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Error al cargar ofertas:', error);
        container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Error al cargar ofertas.</p>';
    }
}

async function guardarOferta(id) {
    const tipoOferta = document.getElementById(`tipo-${id}`).value;
    const descuento = parseInt(document.getElementById(`descuento-${id}`).value) || 0;
    const promocion = document.getElementById(`promocion-${id}`).value.trim();
    
    if (tipoOferta === 'descuento' && (descuento <= 0 || descuento > 100)) {
        mostrarNotificacion('El descuento debe estar entre 1 y 100', 'error');
        return;
    }
    
    if (tipoOferta === 'personalizado' && !promocion) {
        mostrarNotificacion('Escribe un texto para la promoción personalizada', 'error');
        return;
    }
    
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/offers/toggle/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ 
                enOferta: true,
                tipoOferta, 
                descuento, 
                promocion
            })
        });
        
        if (!respuesta.ok) throw new Error('Error al guardar oferta');
        
        mostrarNotificacion('Oferta guardada', 'success');
        
        const datosActualizados = await cargarProductos();
        if (datosActualizados) {
            datosGlobales = datosActualizados;
            adminDatos = JSON.parse(JSON.stringify(datosActualizados));
            renderizarAdminProductos();
            cargarOfertasAdmin();
            renderizarOfertas(datosActualizados.ofertas, datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.hombre, '#ropa-hombre .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.mujer, '#ropa-mujer .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.telas, '#telas .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.objetos, '#otros .grid-productos', datosActualizados);
        }
    } catch (error) {
        console.error('Error al guardar oferta:', error);
        mostrarNotificacion('Error al guardar oferta', 'error');
    }
}

async function actualizarDescuento(productoId, descuento) {
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/products/${productoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ descuento: parseInt(descuento) })
        });

        if (!respuesta.ok) throw new Error('Error al actualizar');

        mostrarNotificacion('Descuento actualizado', 'success');

        const datosActualizados = await cargarProductos();
        if (datosActualizados) {
            datosGlobales = datosActualizados;
            adminDatos = JSON.parse(JSON.stringify(datosActualizados));
            renderizarAdminProductos();
            cargarOfertasAdmin();
            renderizarOfertas(datosActualizados.ofertas, datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.hombre, '#ropa-hombre .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.mujer, '#ropa-mujer .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.telas, '#telas .grid-productos', datosActualizados);
            renderizarProductosConModal(datosActualizados.productos.objetos, '#otros .grid-productos', datosActualizados);
        }
    } catch (error) {
        console.error('Error al actualizar descuento:', error);
        mostrarNotificacion('Error al actualizar descuento', 'error');
    }
}

async function quitarOferta(productoId) {
    const confirmado = await confirmar({ 
        titulo: 'Quitar oferta',
        mensaje: 'El producto dejará de aparecer en la sección de ofertas.',
        tipo: 'info',
        textoAceptar: 'Quitar oferta',
        textoCancelar: 'Cancelar'
    });
    
    if (!confirmado) return;

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
// 13. GESTIÓN DE USUARIOS
// ============================================
async function renderizarUsuariosAdmin() {
    const container = document.getElementById('admin-usuarios-lista');
    if (!container) return;

    if (!isSuperAdmin()) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--color-gris);background:white;border-radius:12px;border:1px dashed #EDE8E1;">
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
                            <button class="btn-eliminar-usuario" onclick="eliminarUsuario('${user._id}')">Eliminar</button>
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
    
    const confirmado = await confirmar({ 
        titulo: 'Eliminar usuario',
        mensaje: '¿Seguro que quieres eliminar este usuario? Perderá acceso inmediatamente.',
        tipo: 'peligro',
        textoAceptar: 'Eliminar usuario',
        textoCancelar: 'Cancelar'
    });
    
    if (!confirmado) return;

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
            { id: 'email', label: 'Email', type: 'email', placeholder: 'usuario@ejemplo.com' },
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
                        role: datos.role,
                        email: datos.email || '',
                        name: datos.username
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
// 14. FILTROS DE BÚSQUEDA
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
        const nombre = item.querySelector('.oferta-card-nombre')?.textContent.toLowerCase() || '';
        item.style.display = nombre.includes(termino) ? 'flex' : 'none';
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
// 15. MODAL GENÉRICO
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
    if (campo.type === 'select') {
        html += `
            <div class="login-group">
                <label>${campo.label}</label>
                <select id="${campo.id}">
                    ${campo.opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
            </div>
        `;
    } else if (campo.type === 'password') {
        // ✅ Campo de contraseña con ojito
        html += `
            <div class="login-group">
                <label>${campo.label}</label>
                <input type="password" id="${campo.id}" placeholder="${campo.placeholder || ''}" ${campo.required ? 'required' : ''}>
                <button type="button" class="toggle-password" aria-label="Mostrar contraseña">
                    <svg class="icono-ojo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        html += `
            <div class="login-group">
                <label>${campo.label}</label>
                <input type="${campo.type || 'text'}" id="${campo.id}" placeholder="${campo.placeholder || ''}" ${campo.required ? 'required' : ''}>
            </div>
        `;
    }
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
    // ✅ Activar el ojito para los campos de contraseña
camposContainer.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const input = this.parentElement.querySelector('input[type="password"], input[type="text"]');
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        this.classList.toggle('visible');
    });
});
}

// ============================================
// 16. MODAL DE BIENVENIDA
// ============================================
function mostrarModalBienvenida() {
    const modal = document.getElementById('modal-bienvenida');
    if (!modal) return;
    modal.className = 'bienvenida-visible';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('bienvenida-abierta');
}

function cerrarModalBienvenida() {
    const modal = document.getElementById('modal-bienvenida');
    if (!modal) return;
    modal.className = 'bienvenida-oculto';
    document.body.style.overflow = 'auto';
    document.body.classList.remove('bienvenida-abierta');
}

document.getElementById('modal-bienvenida-crear')?.addEventListener('click', function() {
    cerrarModalBienvenida();
    abrirModalGenerico({
        titulo: 'Crear Cuenta',
        subtitulo: 'Es rápido, gratis y seguro',
        campos: [
            { id: 'username', label: 'Usuario', type: 'text', placeholder: 'Tu nombre de usuario', required: true },
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 6 caracteres', required: true },
            { id: 'email', label: 'Email', type: 'email', placeholder: 'tucorreo@ejemplo.com', required: true }
        ],
        onSubmit: async (datos) => {
            const result = await registerUser(datos.username, datos.password, datos.email, datos.username);
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
// 17. LOGIN/LOGOUT
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
    btnCerrarSesion.addEventListener('click', async function(e) {
        e.preventDefault();
        
        const confirmado = await confirmar({ 
            titulo: '¿Cerrar sesión?',
            mensaje: 'Tendrás que volver a iniciar sesión para acceder al panel.',
            tipo: 'info',
            textoAceptar: 'Sí, cerrar sesión',
            textoCancelar: 'Cancelar'
        });
        
        if (confirmado) logout();
    });
}

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
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 6 caracteres', required: true },
            { id: 'email', label: 'Email', type: 'email', placeholder: 'tucorreo@ejemplo.com', required: true }
        ],
        onSubmit: async (datos) => {
            const result = await registerUser(datos.username, datos.password, datos.email, datos.username);
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
// 18. FORZAR CIERRE DE SESIÓN (por si quedó colgada)
// ============================================
document.getElementById('forzar-cierre-link')?.addEventListener('click', function(e) {
    e.preventDefault();
    cerrarLogin();
    
    abrirModalGenerico({
        titulo: 'Forzar cierre de sesión',
        subtitulo: 'Introduce tus credenciales para desbloquear tu cuenta',
        campos: [
            { id: 'username', label: 'Usuario', type: 'text', placeholder: 'Tu nombre de usuario', required: true },
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Tu contraseña', required: true }
        ],
        onSubmit: async (datos) => {
            if (!datos.username || !datos.password) {
                mostrarNotificacion('Completa ambos campos', 'error');
                return false;
            }
            
            try {
                const respuesta = await fetch(`${API_URL}/auth/force-logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        username: datos.username, 
                        password: datos.password 
                    })
                });
                
                const data = await respuesta.json();
                
                if (respuesta.ok) {
                    mostrarNotificacion('Sesión cerrada. Ya puedes iniciar sesión.', 'success');
                    localStorage.removeItem(SESSION_KEY);
                    sessionStorage.removeItem('tm_pestana_activa');
                    
                    setTimeout(() => mostrarLogin(), 800);
                } else {
                    mostrarNotificacion(data.error || 'Error al forzar cierre', 'error');
                    return false;
                }
            } catch (error) {
                mostrarNotificacion('Error de conexión', 'error');
                return false;
            }
        }
    });
});

// ============================================
// 19. OJITO PARA CONTRASEÑA
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
// 20. DROP ZONE PARA IMÁGENES
// ============================================
function inicializarDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('prod-imagen-file');
    const preview = document.getElementById('drop-zone-preview');
    const hiddenInput = document.getElementById('prod-imagen');
    const content = document.getElementById('drop-zone-content');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            manejarArchivoImagen(files[0], preview, hiddenInput, content);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            manejarArchivoImagen(e.target.files[0], preview, hiddenInput, content);
        }
    });
}

function manejarArchivoImagen(file, preview, hiddenInput, content) {
    if (!file.type.startsWith('image/')) {
        mostrarNotificacion('Solo se permiten imágenes', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        mostrarNotificacion('La imagen no puede superar los 5 MB', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        preview.src = dataUrl;
        preview.style.display = 'block';
        content.style.display = 'none';
        hiddenInput.value = dataUrl;
    };
    reader.readAsDataURL(file);
}

// ============================================
// 21. INICIO
// ============================================
async function iniciar() {
    console.log('🚀 Cargando productos...');

    localStorage.removeItem('productos_data');

    let datos = null;
    try {
        datos = await cargarProductos();
    } catch (e) {
        console.warn('⚠️ Error en cargarProductos:', e);
    }

    if (datos) {
        datosGlobales = datos;
        adminDatos = JSON.parse(JSON.stringify(datos));

        renderizarOfertas(datos.ofertas, datos);
        renderizarProductosConModal(datos.productos.hombre, '#ropa-hombre .grid-productos', datos);
        renderizarProductosConModal(datos.productos.mujer, '#ropa-mujer .grid-productos', datos);
        renderizarProductosConModal(datos.productos.telas, '#telas .grid-productos', datos);
        renderizarProductosConModal(datos.productos.objetos, '#otros .grid-productos', datos);

        console.log('✅ Productos cargados correctamente');
    } else {
        console.warn('⚠️ No hay productos. La web funcionará sin catálogo.');
    }

    actualizarBotonAcceder();

    if (!isLoggedIn()) {
        setTimeout(mostrarModalBienvenida, 1500);
    } else {
        iniciarVerificadorSesion();
    }
}

document.addEventListener('DOMContentLoaded', iniciar);
document.addEventListener('DOMContentLoaded', inicializarDropZone);

// ============================================
// 22. EXPOSICIÓN GLOBAL
// ============================================
window.confirmar = confirmar;
window.guardarOferta = guardarOferta;
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
// 23. MENÚ HAMBURGUESA
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