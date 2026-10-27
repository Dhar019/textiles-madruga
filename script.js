// ============================================
// SCRIPT.JS - Textiles Madruga
// Versión 6.0 - Refactorizado y optimizado
// ============================================

// ============================================
// 1. CONFIGURACIÓN Y CONSTANTES
// ============================================
const API_URL = 'https://textiles-madruga-api.eldani000219.workers.dev/api';
const SESSION_KEY = 'tm_session';

const NEGOCIO = {
    whatsapp: '+5354108544',
    email: 'textilesmadruga@gmail.com',
    telegram: ''
};

// ============================================
// 2. ESTADO GLOBAL
// ============================================
let datosGlobales = null;
let adminDatos = null;
let modoEdicion = null;
let temporizadorInactividad = null;
let temporizadorAviso = null;
let tiempoOculto = null;
let verificadorSesion = null;
let productoPedidoActual = '';
let pedidosGlobales = [];
let filtroPedidoActual = 'todos';
let varianteIdCounter = 0;

// ============================================
// 3. HELPERS GENERALES
// ============================================
function scrollModalAlTop(modalElement) {
    if (!modalElement) return;
    const contenido = modalElement.querySelector(
        '.login-contenido, .modal-contenido, .admin-contenido, .confirmar-contenido, .bienvenida-contenido'
    );
    if (contenido) contenido.scrollTop = 0;
    
    const form = modalElement.querySelector('.login-form, .admin-tab-content');
    if (form) form.scrollTop = 0;
    
    document.body.scrollTop = 0;
}

// ============================================
// 4. POLÍTICAS DE SEGURIDAD
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
    return (session && (session.role === 'admin' || session.role === 'superadmin'))
        ? POLITICAS_SEGURIDAD.admin
        : POLITICAS_SEGURIDAD.cliente;
}

// ============================================
// 5. AUTENTICACIÓN
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
            body: JSON.stringify({ username, password })
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
// 6. VERIFICACIÓN PERIÓDICA DE SESIÓN
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
// 7. SEGURIDAD: INACTIVIDAD
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
// 8. NOTIFICACIONES
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
// 9. MODAL DE CONFIRMACIÓN
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
// 10. CARGA DE PRODUCTOS CON REINTENTOS
// ============================================
async function cargarProductos(intentos = 3) {
    console.log(`🔄 Cargando productos... (Intento ${4 - intentos}/3)`);
    
    if (intentos === 3) {
        document.querySelectorAll('.grid-productos').forEach(grid => {
            if (grid.children.length === 0) {
                grid.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando productos...</p>';
            }
        });
    }

    try {
        const respuesta = await fetch(`${API_URL}/productos`, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store'
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
        console.warn(`⚠️ Error al cargar (Intento ${4 - intentos}):`, error.message);
        
        if (intentos > 1) {
            const espera = (4 - intentos) * 1000;
            console.log(`⏳ Reintentando en ${espera/1000} segundos...`);
            await new Promise(resolve => setTimeout(resolve, espera));
            return cargarProductos(intentos - 1);
        }
        
        console.error('❌ No se pudo conectar después de varios intentos. Usando caché local.');
        const datosLocales = cargarProductosLocal();
        
        if (datosLocales) {
            mostrarNotificacion('Usando datos guardados. Algunos productos pueden no estar actualizados.', 'warning');
        } else {
            mostrarNotificacion('No se pudieron cargar los productos. Comprueba tu conexión.', 'error');
        }
        
        return datosLocales;
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

function obtenerProductoPorNombre(nombre) {
    if (!datosGlobales || !datosGlobales.productos) return null;
    for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
        const productos = datosGlobales.productos[categoria] || [];
        const encontrado = productos.find(p => p.nombre === nombre);
        if (encontrado) return encontrado;
    }
    return null;
}

// ============================================
// 11. HELPERS PARA TALLAS
// ============================================
function obtenerTallasDelProductoActual() {
    const producto = obtenerProductoPorNombre(productoPedidoActual);
    return producto?.tallasDisponibles || [];
}

function obtenerTipoTallasDelProductoActual() {
    const producto = obtenerProductoPorNombre(productoPedidoActual);
    return producto?.tipoTallas || 'alfabeticas';
}

// ============================================
// 12. RENDERIZADO DE PRODUCTOS
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
            case 'personalizado':
                badge = descuento > 0 ? `-${descuento}%` : 'OFERTA';
                descripcionOferta = promocion || 'Oferta especial';
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
                        ? `<span class="tachado">${producto.precio.toFixed(2)} CUP</span>
                           <span class="precio-oferta-grande">${precioOferta.toFixed(2)} CUP</span>`
                        : `${producto.precio.toFixed(2)} CUP`}
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
                case 'personalizado': badge = descuento > 0 ? `-${descuento}%` : 'OFERTA'; break;
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
                        ? `<span class="tachado">${producto.precio.toFixed(2)} CUP</span> ${precioOferta.toFixed(2)} CUP${unidad}` 
                        : `${producto.precio.toFixed(2)} CUP${unidad}`}
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
// 13. MODAL DE DETALLE
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
            case 'personalizado':
                const descuentoTexto = descuentoActual > 0 ? `${descuentoActual}% de descuento` : '';
                const promocionTexto = promocionActual || '';
                if (descuentoTexto && promocionTexto) {
                    etiquetaOferta = `${descuentoTexto} + ${promocionTexto}`;
                } else if (descuentoTexto) {
                    etiquetaOferta = descuentoTexto;
                } else {
                    etiquetaOferta = promocionTexto || 'Oferta especial';
                }
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
                    ${enOferta && descuentoActual > 0 ? `<span class="precio-oferta">${producto.precio.toFixed(2)} CUP</span>` : ''}
                    <span class="precio">${enOferta && descuentoActual > 0 ? `${precioOferta} CUP` : `${producto.precio.toFixed(2)} CUP`}${unidad}</span>
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
    scrollModalAlTop(modal);
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
// 14. LIGHTBOX DE IMAGEN
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
// 15. SISTEMA DE VARIANTES (TALLAS DINÁMICAS)
// ============================================
function crearVarianteHTML(talla = '', cantidad = 1) {
    varianteIdCounter++;
    const id = varianteIdCounter;
    
    const tallasDisponibles = obtenerTallasDelProductoActual();
    const tipoTallas = obtenerTipoTallasDelProductoActual();
    
    if (tipoTallas === 'sin_tallas' || tallasDisponibles.length === 0) {
        return `
            <div class="variante-item variante-sin-tallas" data-variante-id="${id}">
                <div class="variante-sin-tallas-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>Este producto no maneja tallas. Solo indica la cantidad.</span>
                </div>
                <div class="variante-cantidad-wrapper" style="flex: 0 0 140px;">
                    <button type="button" class="variante-btn-restar" onclick="cambiarCantidadVariante(${id}, -1)">−</button>
                    <input type="number" 
                           class="variante-cantidad" 
                           value="${cantidad}" 
                           min="1" 
                           max="999"
                           oninput="actualizarValidacionVariantes()">
                    <button type="button" class="variante-btn-sumar" onclick="cambiarCantidadVariante(${id}, 1)">+</button>
                </div>
            </div>
        `;
    }
    
    let opcionesHTML = '<option value="">-- Selecciona talla --</option>';
    tallasDisponibles.forEach(t => {
        const seleccionado = (t === talla) ? 'selected' : '';
        opcionesHTML += `<option value="${t}" ${seleccionado}>${t}</option>`;
    });
    
    return `
        <div class="variante-item" data-variante-id="${id}">
            <select class="variante-talla-select" onchange="actualizarValidacionVariantes()">
                ${opcionesHTML}
            </select>
            <div class="variante-cantidad-wrapper">
                <button type="button" class="variante-btn-restar" onclick="cambiarCantidadVariante(${id}, -1)">−</button>
                <input type="number" 
                       class="variante-cantidad" 
                       value="${cantidad}" 
                       min="1" 
                       max="999"
                       oninput="actualizarValidacionVariantes()">
                <button type="button" class="variante-btn-sumar" onclick="cambiarCantidadVariante(${id}, 1)">+</button>
            </div>
            <button type="button" class="variante-eliminar" onclick="eliminarVariante(${id})" aria-label="Eliminar variante">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `;
}

function añadirVariante(talla = '', cantidad = 1) {
    const lista = document.getElementById('lista-variantes');
    if (!lista) return;
    lista.insertAdjacentHTML('beforeend', crearVarianteHTML(talla, cantidad));
    actualizarValidacionVariantes();
    const items = lista.querySelectorAll('.variante-item');
    const ultimo = items[items.length - 1];
    ultimo?.querySelector('.variante-talla-select')?.focus();
}

function eliminarVariante(id) {
    const item = document.querySelector(`.variante-item[data-variante-id="${id}"]`);
    if (!item) return;
    
    const total = document.querySelectorAll('.variante-item').length;
    if (total <= 1) {
        mostrarNotificacion('Debe haber al menos una talla', 'warning');
        return;
    }
    
    item.style.opacity = '0';
    item.style.transform = 'translateX(-20px)';
    setTimeout(() => {
        item.remove();
        actualizarValidacionVariantes();
    }, 200);
}

function cambiarCantidadVariante(id, delta) {
    const item = document.querySelector(`.variante-item[data-variante-id="${id}"]`);
    if (!item) return;
    const input = item.querySelector('.variante-cantidad');
    let valor = parseInt(input.value) || 1;
    valor = Math.max(1, Math.min(999, valor + delta));
    input.value = valor;
    actualizarValidacionVariantes();
}

function cambiarCantidadTotal(delta) {
    const input = document.getElementById('cantidad-total');
    if (!input) return;
    let valor = parseInt(input.value) || 1;
    valor = Math.max(1, Math.min(999, valor + delta));
    input.value = valor;
    actualizarValidacionVariantes();
}

function actualizarValidacionVariantes() {
    const items = document.querySelectorAll('.variante-item');
    let totalAsignado = 0;
    let tallasValidas = 0;
    
    items.forEach(item => {
        const tallaSelect = item.querySelector('.variante-talla-select');
        const esSinTallas = item.classList.contains('variante-sin-tallas');
        const talla = esSinTallas ? 'UNICA' : (tallaSelect?.value.trim() || '');
        const cantidad = parseInt(item.querySelector('.variante-cantidad')?.value) || 0;
        
        if (talla && cantidad > 0) {
            totalAsignado += cantidad;
            tallasValidas++;
        }
    });
    
    const cantidadTotal = parseInt(document.getElementById('cantidad-total')?.value) || 1;
    
    const elAsignadas = document.getElementById('validacion-asignadas');
    const elTotal = document.getElementById('validacion-total');
    const elMensaje = document.getElementById('validacion-mensaje');
    const elValidacion = document.getElementById('validacion-variantes');
    
    if (elAsignadas) elAsignadas.textContent = totalAsignado;
    if (elTotal) elTotal.textContent = cantidadTotal;
    
    if (!elValidacion || !elMensaje) return;
    
    elValidacion.classList.remove('ok', 'error', 'pendiente');
    
    if (tallasValidas === 0) {
        elValidacion.classList.add('pendiente');
        elMensaje.textContent = '👉 Selecciona una talla y pon la cantidad';
    } else if (totalAsignado < cantidadTotal) {
        elValidacion.classList.add('pendiente');
        const faltan = cantidadTotal - totalAsignado;
        elMensaje.textContent = `⚠️ Te faltan ${faltan} pieza${faltan !== 1 ? 's' : ''} por asignar`;
    } else if (totalAsignado > cantidadTotal) {
        elValidacion.classList.add('error');
        const sobran = totalAsignado - cantidadTotal;
        elMensaje.textContent = `❌ Te sobran ${sobran} pieza${sobran !== 1 ? 's' : ''}. Reduce la cantidad.`;
    } else {
        elValidacion.classList.add('ok');
        elMensaje.textContent = '✅ ¡Perfecto! Las tallas coinciden con el total';
    }
}

function inicializarVariantes() {
    const lista = document.getElementById('lista-variantes');
    if (!lista) return;
    lista.innerHTML = '';
    varianteIdCounter = 0;
    
    const cantidadTotal = document.getElementById('cantidad-total');
    if (cantidadTotal) cantidadTotal.value = 1;
    
    añadirVariante();
    actualizarValidacionVariantes();
}

// ============================================
// 16. SOLICITAR PEDIDO
// ============================================
function solicitarPedido(producto) {
    const modalPedido = document.getElementById('modal-pedido');
    if (!modalPedido) {
        mostrarNotificacion(
            `Contáctanos para pedir "${producto}": ${NEGOCIO.email}`,
            'success'
        );
        return;
    }

    productoPedidoActual = producto;
    document.getElementById('modal-pedido-producto').textContent = `Producto: ${producto}`;
    
    const formPedido = document.getElementById('modal-pedido-form');
    const contenedorPedido = modalPedido.querySelector('.login-contenido');
    
    if (formPedido) formPedido.scrollTop = 0;
    if (contenedorPedido) contenedorPedido.scrollTop = 0;
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    
    modalPedido.className = 'login-visible';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        if (formPedido) formPedido.scrollTop = 0;
        if (contenedorPedido) contenedorPedido.scrollTop = 0;
    }, 50);
    
    inicializarVariantes();

    const cerrar = () => {
        modalPedido.className = 'login-oculto';
        document.body.style.overflow = 'auto';
        if (formPedido) formPedido.reset();
        productoPedidoActual = '';
        if (formPedido) formPedido.scrollTop = 0;
        if (contenedorPedido) contenedorPedido.scrollTop = 0;
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    };

    document.getElementById('modal-pedido-cerrar').onclick = cerrar;
    document.getElementById('modal-pedido-overlay').onclick = cerrar;

    document.getElementById('modal-pedido-form').onsubmit = (e) => {
        e.preventDefault();
    };

    document.querySelectorAll('input[name="tipo-entrega"]').forEach(radio => {
        radio.addEventListener('change', toggleCamposEntrega);
    });
    toggleCamposEntrega();
}

function toggleCamposEntrega() {
    const tipo = document.querySelector('input[name="tipo-entrega"]:checked')?.value;
    const camposDomicilio = document.getElementById('campos-domicilio');
    
    if (camposDomicilio) {
        camposDomicilio.style.display = (tipo === 'domicilio') ? 'block' : 'none';
    }
}

async function enviarPedidoPor(via) {
    const safeGet = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    const safeRadio = (name, fallback = '') => {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : fallback;
    };

    const nombre = safeGet('pedido-nombre');
    const telefono = safeGet('pedido-telefono');
    const email = safeGet('pedido-email');
    const tipoEntrega = safeRadio('tipo-entrega', 'domicilio');
    const direccion = safeGet('pedido-direccion');
    const referencia = safeGet('pedido-referencia');
    const municipio = safeGet('pedido-municipio');
    const notas = safeGet('pedido-notas');
    const metodoPago = safeRadio('metodo-pago', 'efectivo');
    const contactoPreferido = safeRadio('contacto-preferido', 'whatsapp');

    const variantesItems = document.querySelectorAll('.variante-item');
    const variantes = [];
    let cantidadAsignada = 0;

    variantesItems.forEach(item => {
        const esSinTallas = item.classList.contains('variante-sin-tallas');
        const tallaSelect = item.querySelector('.variante-talla-select');
        const talla = esSinTallas ? 'UNICA' : (tallaSelect?.value.trim() || '');
        const cantidad = parseInt(item.querySelector('.variante-cantidad')?.value) || 0;
        
        if (talla && cantidad > 0) {
            variantes.push({ talla: talla.toUpperCase(), cantidad });
            cantidadAsignada += cantidad;
        }
    });

    const cantidadTotal = parseInt(document.getElementById('cantidad-total')?.value) || 1;

    if (!nombre) {
        mostrarNotificacion('Por favor, escribe tu nombre', 'error');
        document.getElementById('pedido-nombre')?.focus();
        return;
    }
    if (!telefono) {
        mostrarNotificacion('Por favor, escribe tu teléfono', 'error');
        document.getElementById('pedido-telefono')?.focus();
        return;
    }
    if (tipoEntrega === 'domicilio') {
        if (!direccion) {
            mostrarNotificacion('Por favor, escribe tu dirección', 'error');
            document.getElementById('pedido-direccion')?.focus();
            return;
        }
        if (!municipio) {
            mostrarNotificacion('Por favor, escribe tu municipio', 'error');
            document.getElementById('pedido-municipio')?.focus();
            return;
        }
    }

    if (variantes.length === 0) {
        mostrarNotificacion('Debes asignar al menos una talla', 'error');
        document.getElementById('lista-variantes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const variantesSinTalla = !document.querySelector('.variante-sin-tallas') &&
        Array.from(variantesItems).some(item => {
            const sel = item.querySelector('.variante-talla-select');
            return sel && !sel.value;
        });

    if (variantesSinTalla) {
        mostrarNotificacion('Selecciona una talla en todas las variantes', 'error');
        return;
    }

    if (cantidadAsignada !== cantidadTotal) {
        mostrarNotificacion(
            `Las tallas suman ${cantidadAsignada} pero pediste ${cantidadTotal} piezas. Ajusta las cantidades.`,
            'error'
        );
        document.getElementById('validacion-variantes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const variantesTexto = variantes.map(v => 
        v.talla === 'UNICA' ? `${v.cantidad}x` : `${v.cantidad}x talla ${v.talla}`
    ).join(', ');

    const pedidoData = {
        producto: productoPedidoActual,
        nombre,
        telefono,
        email,
        tipoEntrega,
        direccion: tipoEntrega === 'domicilio' ? direccion : '',
        referencia: tipoEntrega === 'domicilio' ? referencia : '',
        municipio: tipoEntrega === 'domicilio' ? municipio : '',
        cantidad: cantidadTotal,
        variantes: variantes,
        tallasTexto: variantesTexto,
        notas,
        metodoPago,
        contactoPreferido,
        via
    };

    try {
        const respuesta = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedidoData)
        });

        if (respuesta.ok) {
            const data = await respuesta.json();
            console.log('✅ Pedido guardado en el servidor:', data.id);
        } else {
            console.warn('⚠️ No se pudo guardar el pedido');
        }
    } catch (error) {
        console.warn('⚠️ Error al guardar pedido:', error);
    }

    const mensaje = `¡Hola! Quiero hacer un pedido:\n\n` +
        `📦 Producto: ${productoPedidoActual}\n` +
        `👤 Nombre: ${nombre}\n` +
        `📞 Teléfono: ${telefono}\n` +
        (email ? `✉️ Gmail: ${email}\n` : '') +
        `🔢 Total: ${cantidadTotal} pieza${cantidadTotal !== 1 ? 's' : ''}\n` +
        `📏 Tallas: ${variantesTexto}\n` +
        `🚚 Entrega: ${tipoEntrega === 'domicilio' ? 'A domicilio' : 'Recoger en tienda'}\n` +
        (tipoEntrega === 'domicilio' ? 
            `📍 Dirección: ${direccion}\n` +
            (referencia ? `📌 Referencia: ${referencia}\n` : '') +
            `🏘️ Municipio: ${municipio}\n` 
            : '') +
        `💳 Pago: ${metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia'}\n` +
        `📱 Contacto preferido: ${contactoPreferido}\n` +
        (notas ? `📝 Notas: ${notas}\n` : '') +
        `\n¡Gracias!`;

    const mensajeEncoded = encodeURIComponent(mensaje);

    if (via === 'whatsapp') {
        const esMovil = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const url = esMovil 
            ? `https://wa.me/${NEGOCIO.whatsapp}?text=${mensajeEncoded}`
            : `https://web.whatsapp.com/send?phone=${NEGOCIO.whatsapp}&text=${mensajeEncoded}`;
        
        window.open(url, '_blank');
        mostrarNotificacion('Pedido enviado. Se abrirá WhatsApp.', 'success');
    } else if (via === 'email') {
        mostrarNotificacion('Pedido enviado. Te llegará confirmación por Gmail.', 'success');
    } else {
        mostrarNotificacion('¡Pedido enviado! Te contactaremos pronto.', 'success');
    }

    setTimeout(() => {
        const modalPedido = document.getElementById('modal-pedido');
        const formPedido = document.getElementById('modal-pedido-form');
        if (modalPedido) {
            modalPedido.className = 'login-oculto';
            if (formPedido) formPedido.scrollTop = 0;
            scrollModalAlTop(modalPedido);
        }
        document.body.style.overflow = 'auto';
        if (formPedido) formPedido.reset();
        productoPedidoActual = '';
    }, 2000);
}

// ============================================
// 17. MODAL DE AYUDA PARA PEDIDOS
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const btnAyuda = document.getElementById('btn-ayuda-pedido');
    const modalAyuda = document.getElementById('modal-ayuda-pedido');
    const cerrarAyuda = document.getElementById('modal-ayuda-pedido-cerrar');
    const overlayAyuda = document.getElementById('modal-ayuda-pedido-overlay');
    const btnVolver = document.getElementById('btn-volver-pedido');

    if (btnAyuda && modalAyuda) {
        const abrirAyuda = () => {
            modalAyuda.className = 'login-visible';
            scrollModalAlTop(modalAyuda);
        };
        const cerrarModalAyuda = () => {
            modalAyuda.className = 'login-oculto';
            setTimeout(() => scrollModalAlTop(modalAyuda), 50);
        };

        btnAyuda.addEventListener('click', abrirAyuda);
        cerrarAyuda.addEventListener('click', cerrarModalAyuda);
        overlayAyuda.addEventListener('click', cerrarModalAyuda);
        btnVolver.addEventListener('click', cerrarModalAyuda);
    }
});

// ============================================
// 18. PANEL DE ADMINISTRACIÓN
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
        scrollModalAlTop(loginModal);
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
    cargarPedidosAdmin();
    scrollModalAlTop(adminPanel);
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
            else if (tabName === 'pedidos') cargarPedidosAdmin();
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
            
            let tallasInfo = '';
            if (producto.tipoTallas === 'sin_tallas') {
                tallasInfo = '<span style="font-size:0.7rem;color:var(--color-gris);">Sin tallas</span>';
            } else if (producto.tallasDisponibles && producto.tallasDisponibles.length > 0) {
                tallasInfo = `<span style="font-size:0.7rem;color:var(--color-gris);">Tallas: ${producto.tallasDisponibles.join(', ')}</span>`;
            } else {
                tallasInfo = '<span style="font-size:0.7rem;color:#C0392B;">Sin tallas configuradas</span>';
            }

            html += `
                <div class="admin-producto-item" data-id="${id}" data-categoria="${categoria}">
                    <div class="info">
                        <img src="${producto.imagen}" alt="${producto.nombre}" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;">
                        <div class="info-texto">
                            <span class="nombre">${producto.nombre}</span>
                            <span class="descripcion">${descripcion.substring(0, 60)}${descripcion.length > 60 ? '...' : ''}</span>
                            <span class="id-producto">ID: ${id}</span>
                            ${tallasInfo}
                        </div>
                        <span class="precio">${producto.precio.toFixed(2)} CUP</span>
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

function cambiarTipoTallas(tipo) {
    const alfabeticas = document.getElementById('tallas-alfabeticas');
    const numericas = document.getElementById('tallas-numericas');
    const sinTallas = document.getElementById('tallas-sin');
    
    if (!alfabeticas || !numericas || !sinTallas) return;
    
    alfabeticas.style.display = 'none';
    numericas.style.display = 'none';
    sinTallas.style.display = 'none';
    
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    
    if (tipo === 'alfabeticas') {
        alfabeticas.style.display = 'flex';
    } else if (tipo === 'numericas') {
        numericas.style.display = 'flex';
    } else {
        sinTallas.style.display = 'flex';
    }
}

function cargarTallasProducto(producto) {
    document.querySelectorAll('input[name="tipo-tallas"]').forEach(r => r.checked = false);
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    
    const tipoTallas = producto.tipoTallas || 'alfabeticas';
    const tallasDisponibles = producto.tallasDisponibles || [];
    
    const radioTipo = document.querySelector(`input[name="tipo-tallas"][value="${tipoTallas}"]`);
    if (radioTipo) radioTipo.checked = true;
    
    cambiarTipoTallas(tipoTallas);
    
    if (tipoTallas !== 'sin_tallas') {
        document.querySelectorAll('.talla-checkbox').forEach(cb => {
            if (tallasDisponibles.includes(cb.value)) {
                cb.checked = true;
            }
        });
    }
}

function obtenerTallasSeleccionadas() {
    const tipoTallas = document.querySelector('input[name="tipo-tallas"]:checked')?.value || 'alfabeticas';
    
    if (tipoTallas === 'sin_tallas') {
        return {
            tipoTallas: 'sin_tallas',
            tallasDisponibles: []
        };
    }
    
    const tallas = [];
    document.querySelectorAll('.talla-checkbox:checked').forEach(cb => {
        tallas.push(cb.value);
    });
    
    return {
        tipoTallas: tipoTallas,
        tallasDisponibles: tallas
    };
}

function resetearTallasForm() {
    document.querySelectorAll('input[name="tipo-tallas"]').forEach(r => r.checked = false);
    const radioDefault = document.querySelector('input[name="tipo-tallas"][value="alfabeticas"]');
    if (radioDefault) radioDefault.checked = true;
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    cambiarTipoTallas('alfabeticas');
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

    cargarTallasProducto(producto);

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

    const { tipoTallas, tallasDisponibles } = obtenerTallasSeleccionadas();
    
    if (tipoTallas !== 'sin_tallas' && tallasDisponibles.length === 0) {
        mostrarNotificacion('Selecciona al menos una talla o marca "Sin tallas"', 'error');
        return;
    }

    if (!imagen) imagen = 'assets/img/placeholder.webp';

    const session = getSession();
    if (!session) { mostrarNotificacion('No hay sesión activa', 'error'); return; }

    try {
        const productoData = { 
            nombre, 
            precio, 
            imagen, 
            categoria, 
            descripcion,
            tipoTallas: tipoTallas,
            tallasDisponibles: tallasDisponibles
        };
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
        resetearTallasForm();

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
    resetearTallasForm();

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
    resetearTallasForm();

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
// 19. GESTIÓN DE PEDIDOS EN EL PANEL ADMIN
// ============================================
async function cargarPedidosAdmin() {
    const container = document.getElementById('lista-pedidos-admin');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando pedidos...</p>';

    try {
        const session = getSession();
        if (!session || !session.token) {
            container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No hay sesión activa.</p>';
            return;
        }

        const respuesta = await fetch(`${API_URL}/pedidos`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });

        if (!respuesta.ok) throw new Error('Error al cargar pedidos');

        const data = await respuesta.json();
        pedidosGlobales = data.pedidos || [];

        actualizarBadgePedidos();
        renderizarPedidosAdmin();
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Error al cargar pedidos.</p>';
    }
}

function actualizarBadgePedidos() {
    const badge = document.getElementById('pedidos-badge');
    if (!badge) return;

    const pendientes = pedidosGlobales.filter(p => p.estado === 'pendiente').length;
    
    if (pendientes > 0) {
        badge.textContent = pendientes;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderizarPedidosAdmin() {
    const container = document.getElementById('lista-pedidos-admin');
    if (!container) return;

    let pedidosFiltrados = pedidosGlobales;
    if (filtroPedidoActual !== 'todos') {
        pedidosFiltrados = pedidosGlobales.filter(p => p.estado === filtroPedidoActual);
    }

    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="pedidos-vacio">
                <span class="icono">📭</span>
                <p>No hay pedidos ${filtroPedidoActual !== 'todos' ? `en estado "${filtroPedidoActual}"` : 'todavía'}.</p>
            </div>
        `;
        return;
    }

    const viaTexto = {
        'whatsapp': { icono: '📱', nombre: 'WhatsApp' },
        'email': { icono: '✉️', nombre: 'Gmail' },
        'solo_aqui': { icono: '📝', nombre: 'Solo aquí' },
        'telegram': { icono: '💬', nombre: 'Telegram' }
    };

    const estadoTexto = {
        'pendiente': 'Pendiente',
        'atendido': 'Atendido',
        'completado': 'Completado',
        'cancelado': 'Cancelado'
    };

    let html = '';
    pedidosFiltrados.forEach(pedido => {
        const via = viaTexto[pedido.via] || { icono: '❓', nombre: pedido.via };
        const fecha = new Date(pedido.fecha);
        const fechaFormateada = fecha.toLocaleString('es-CU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let tallasHTML = '';
        if (pedido.variantes && pedido.variantes.length > 0) {
            tallasHTML = `
                <div class="pedido-dato" style="grid-column: 1 / -1;">
                    <strong>Tallas:</strong>
                    <span>${pedido.variantes.map(v => 
                        v.talla === 'UNICA' ? `${v.cantidad}x` : `${v.cantidad}x talla ${v.talla}`
                    ).join(' · ')}</span>
                </div>
            `;
        } else if (pedido.talla) {
            tallasHTML = `
                <div class="pedido-dato">
                    <strong>Talla:</strong>
                    <span>${pedido.talla}</span>
                </div>
            `;
        }

        html += `
            <div class="pedido-item estado-${pedido.estado}" data-id="${pedido.id}">
                <div class="pedido-header">
                    <div class="pedido-info-principal">
                        <span class="pedido-id">${pedido.id}</span>
                        <h3 class="pedido-producto">${pedido.producto}</h3>
                    </div>
                    <div class="pedido-badges">
                        <span class="badge-estado ${pedido.estado}">${estadoTexto[pedido.estado] || pedido.estado}</span>
                        <span class="badge-via ${pedido.via}">${via.icono} ${via.nombre}</span>
                    </div>
                </div>
                
                <div class="pedido-datos">
                    <div class="pedido-dato">
                        <strong>Cliente:</strong>
                        <span>${pedido.nombre}</span>
                    </div>
                    <div class="pedido-dato">
                        <strong>Teléfono:</strong>
                        <span>${pedido.telefono || pedido.contacto || 'N/A'}</span>
                    </div>
                    ${pedido.email ? `
                    <div class="pedido-dato">
                        <strong>Gmail:</strong>
                        <span>${pedido.email}</span>
                    </div>
                    ` : ''}
                    <div class="pedido-dato">
                        <strong>Cantidad:</strong>
                        <span>${pedido.cantidad}</span>
                    </div>
                    ${tallasHTML}
                    <div class="pedido-dato">
                        <strong>Entrega:</strong>
                        <span>${pedido.tipoEntrega === 'domicilio' ? '🏠 A domicilio' : '🏪 Recoger en tienda'}</span>
                    </div>
                    ${pedido.direccion ? `
                    <div class="pedido-dato">
                        <strong>Dirección:</strong>
                        <span>${pedido.direccion}</span>
                    </div>
                    ` : ''}
                    ${pedido.referencia ? `
                    <div class="pedido-dato">
                        <strong>Referencia:</strong>
                        <span>${pedido.referencia}</span>
                    </div>
                    ` : ''}
                    ${pedido.municipio ? `
                    <div class="pedido-dato">
                        <strong>Municipio:</strong>
                        <span>${pedido.municipio}</span>
                    </div>
                    ` : ''}
                    <div class="pedido-dato">
                        <strong>Pago:</strong>
                        <span>${pedido.metodoPago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}</span>
                    </div>
                    <div class="pedido-dato">
                        <strong>Contacto pref.:</strong>
                        <span>${pedido.contactoPreferido === 'whatsapp' ? '📱 WhatsApp' : pedido.contactoPreferido === 'llamada' ? '📞 Llamada' : '✉️ Gmail'}</span>
                    </div>
                    <div class="pedido-dato">
                        <strong>Fecha:</strong>
                        <span>${fechaFormateada}</span>
                    </div>
                </div>
                
                ${pedido.notas ? `<div class="pedido-notas">📝 ${pedido.notas}</div>` : ''}
                
                <div class="pedido-acciones">
                    ${pedido.estado === 'pendiente' ? `
                        <button class="btn-pedido btn-atender" onclick="cambiarEstadoPedido('${pedido.id}', 'atendido')">📞 Marcar atendido</button>
                    ` : ''}
                    ${pedido.estado === 'atendido' ? `
                        <button class="btn-pedido btn-completar" onclick="cambiarEstadoPedido('${pedido.id}', 'completado')">✅ Completar</button>
                    ` : ''}
                    ${pedido.estado !== 'cancelado' && pedido.estado !== 'completado' ? `
                        <button class="btn-pedido btn-cancelar" onclick="cambiarEstadoPedido('${pedido.id}', 'cancelado')">✕ Cancelar</button>
                    ` : ''}
                    ${pedido.estado === 'completado' ? `
                        <button class="btn-pedido btn-atender" onclick="cambiarEstadoPedido('${pedido.id}', 'pendiente')">↺ Reabrir</button>
                    ` : ''}
                    <button class="btn-pedido btn-eliminar" onclick="eliminarPedidoAdmin('${pedido.id}')">🗑 Eliminar</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function filtrarPorEstado(estado) {
    filtroPedidoActual = estado;
    
    document.querySelectorAll('.filtro-pedido').forEach(btn => {
        btn.classList.remove('activo');
        if (btn.dataset.filtro === estado) {
            btn.classList.add('activo');
        }
    });

    renderizarPedidosAdmin();
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        if (!respuesta.ok) throw new Error('Error al cambiar estado');

        mostrarNotificacion(`Pedido marcado como ${nuevoEstado}`, 'success');
        await cargarPedidosAdmin();
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        mostrarNotificacion('Error al cambiar estado del pedido', 'error');
    }
}

async function eliminarPedidoAdmin(pedidoId) {
    const confirmado = await confirmar({
        titulo: 'Eliminar pedido',
        mensaje: '¿Seguro que quieres eliminar este pedido? Esta acción no se puede deshacer.',
        tipo: 'peligro',
        textoAceptar: 'Eliminar',
        textoCancelar: 'Cancelar'
    });

    if (!confirmado) return;

    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.token}` }
        });

        if (!respuesta.ok) throw new Error('Error al eliminar');

        mostrarNotificacion('Pedido eliminado', 'success');
        await cargarPedidosAdmin();
    } catch (error) {
        console.error('Error al eliminar pedido:', error);
        mostrarNotificacion('Error al eliminar pedido', 'error');
    }
}

function filtrarPedidosAdmin(termino) {
    const items = document.querySelectorAll('#lista-pedidos-admin .pedido-item');
    termino = termino.toLowerCase().trim();
    
    items.forEach(item => {
        const nombre = item.querySelector('.pedido-dato:nth-child(1) span')?.textContent.toLowerCase() || '';
        const telefono = item.querySelector('.pedido-dato:nth-child(2) span')?.textContent.toLowerCase() || '';
        const producto = item.querySelector('.pedido-producto')?.textContent.toLowerCase() || '';
        
        const coincide = nombre.includes(termino) || telefono.includes(termino) || producto.includes(termino);
        item.style.display = coincide ? 'block' : 'none';
    });
}

// ============================================
// 20. GESTIÓN DE OFERTAS
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
                        <span class="oferta-card-precio-original">${producto.precio.toFixed(2)} CUP</span>
                        ${descuento > 0 ? `
                            <span class="oferta-card-precio-oferta">${precioOferta.toFixed(2)} CUP</span>
                        ` : ''}
                    </div>
                    
                    <div class="oferta-card-edicion">
                        <div class="campo">
                            <label>Tipo de oferta</label>
                            <select id="tipo-${id}" class="oferta-select" onchange="toggleDescuentoInput('${id}')">
                                <option value="descuento" ${tipoOferta === 'descuento' ? 'selected' : ''}>Descuento</option>
                                <option value="2x1" ${tipoOferta === '2x1' ? 'selected' : ''}>Lleva 2, paga 1</option>
                                <option value="3x2" ${tipoOferta === '3x2' ? 'selected' : ''}>Lleva 3, paga 2</option>
                                <option value="personalizado" ${tipoOferta === 'personalizado' ? 'selected' : ''}>Personalizado (descuento + texto)</option>
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
                                   placeholder="Ej: Envío gratis, Regalo sorpresa..."
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
        
        ofertas.forEach(producto => {
            const id = producto.id || producto._id;
            if (id) toggleDescuentoInput(id);
        });
    } catch (error) {
        console.error('Error al cargar ofertas:', error);
        container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Error al cargar ofertas.</p>';
    }
}

function toggleDescuentoInput(id) {
    const tipoEl = document.getElementById(`tipo-${id}`);
    const descuentoEl = document.getElementById(`descuento-${id}`);
    const promocionEl = document.getElementById(`promocion-${id}`);
    
    if (!tipoEl || !descuentoEl || !promocionEl) return;
    
    const tipo = tipoEl.value;
    
    if (tipo === 'descuento') {
        descuentoEl.disabled = false;
        descuentoEl.style.opacity = '1';
        descuentoEl.style.cursor = 'text';
        descuentoEl.placeholder = 'Ej: 15';
        promocionEl.disabled = true;
        promocionEl.style.opacity = '0.4';
        promocionEl.style.cursor = 'not-allowed';
        promocionEl.value = '';
        promocionEl.placeholder = 'No aplica para descuento simple';
    } else if (tipo === 'personalizado') {
        descuentoEl.disabled = false;
        descuentoEl.style.opacity = '1';
        descuentoEl.style.cursor = 'text';
        descuentoEl.placeholder = 'Ej: 20';
        promocionEl.disabled = false;
        promocionEl.style.opacity = '1';
        promocionEl.style.cursor = 'text';
        promocionEl.placeholder = 'Ej: Envío gratis, Regalo sorpresa...';
    } else {
        descuentoEl.disabled = true;
        descuentoEl.style.opacity = '0.4';
        descuentoEl.style.cursor = 'not-allowed';
        descuentoEl.value = 0;
        descuentoEl.placeholder = 'No aplica';
        promocionEl.disabled = true;
        promocionEl.style.opacity = '0.4';
        promocionEl.style.cursor = 'not-allowed';
        promocionEl.value = '';
        promocionEl.placeholder = 'No aplica';
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
    
    if (tipoOferta === 'personalizado') {
        if (descuento <= 0 || descuento > 100) {
            mostrarNotificacion('El descuento debe estar entre 1 y 100', 'error');
            return;
        }
        if (!promocion) {
            mostrarNotificacion('Escribe un texto para la promoción personalizada', 'error');
            return;
        }
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
// 21. GESTIÓN DE USUARIOS
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
            { id: 'email', label: 'Gmail', type: 'email', placeholder: 'usuario@gmail.com' },
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
// 22. FILTROS DE BÚSQUEDA
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
// 23. MODAL GENÉRICO
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

    camposContainer.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input[type="password"], input[type="text"]');
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            this.classList.toggle('visible');
        });
    });

    modal.className = 'login-visible';
    document.body.style.overflow = 'hidden';
    scrollModalAlTop(modal);

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
// 24. MODAL DE BIENVENIDA
// ============================================
function mostrarModalBienvenida() {
    const modal = document.getElementById('modal-bienvenida');
    if (!modal) return;
    modal.className = 'bienvenida-visible';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('bienvenida-abierta');
    scrollModalAlTop(modal);
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
            { id: 'email', label: 'Gmail', type: 'email', placeholder: 'tucorreo@gmail.com', required: true }
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
// 25. LOGIN/LOGOUT
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
            { id: 'email', label: 'Gmail', type: 'email', placeholder: 'tucorreo@gmail.com', required: true }
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
// 26. FORZAR CIERRE DE SESIÓN
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
// 27. OJITO PARA CONTRASEÑA
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
// 28. DROP ZONE PARA IMÁGENES
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
// 29. LISTENERS GENERALES
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('cantidad-total-sumar')?.addEventListener('click', () => cambiarCantidadTotal(1));
    document.getElementById('cantidad-total-restar')?.addEventListener('click', () => cambiarCantidadTotal(-1));
    document.getElementById('btn-añadir-variante')?.addEventListener('click', () => añadirVariante());
    
    console.log('🎯 Inicializando sistema de tallas...');
    
    const tipoTallasRadios = document.querySelectorAll('input[name="tipo-tallas"]');
    const tallasAlfabeticas = document.getElementById('tallas-alfabeticas');
    const tallasNumericas = document.getElementById('tallas-numericas');
    const tallasSin = document.getElementById('tallas-sin');
    
    console.log('Radios de tipo de tallas:', tipoTallasRadios.length);
    console.log('Contenedor alfabéticas:', tallasAlfabeticas ? 'OK' : 'FALTA');
    console.log('Contenedor numéricas:', tallasNumericas ? 'OK' : 'FALTA');
    console.log('Contenedor sin tallas:', tallasSin ? 'OK' : 'FALTA');
    
    if (tipoTallasRadios.length > 0) {
        cambiarTipoTallas('alfabeticas');
    }
});

// ============================================
// 30. INICIO
// ============================================
async function iniciar() {
    console.log('🚀 Cargando productos...');

    document.querySelectorAll('.grid-productos').forEach(grid => {
        if (grid.children.length === 0) {
            grid.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando productos...</p>';
        }
    });

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
// 31. EXPOSICIÓN GLOBAL
// ============================================
window.confirmar = confirmar;
window.guardarOferta = guardarOferta;
window.toggleDescuentoInput = toggleDescuentoInput;
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
window.enviarPedidoPor = enviarPedidoPor;
window.toggleCamposEntrega = toggleCamposEntrega;
window.cargarOfertasAdmin = cargarOfertasAdmin;
window.quitarOferta = quitarOferta;
window.filtrarProductosAdmin = filtrarProductosAdmin;
window.filtrarOfertasAdmin = filtrarOfertasAdmin;
window.filtrarUsuariosAdmin = filtrarUsuariosAdmin;
window.filtrarPedidosAdmin = filtrarPedidosAdmin;
window.filtrarPorEstado = filtrarPorEstado;
window.cambiarEstadoPedido = cambiarEstadoPedido;
window.eliminarPedidoAdmin = eliminarPedidoAdmin;
window.cargarPedidosAdmin = cargarPedidosAdmin;
window.abrirModalGenerico = abrirModalGenerico;
window.mostrarModalBienvenida = mostrarModalBienvenida;
window.cerrarModalBienvenida = cerrarModalBienvenida;
window.eliminarUsuario = eliminarUsuario;
window.abrirLightbox = abrirLightbox;
window.cerrarLightbox = cerrarLightbox;
window.añadirVariante = añadirVariante;
window.eliminarVariante = eliminarVariante;
window.cambiarCantidadVariante = cambiarCantidadVariante;
window.cambiarCantidadTotal = cambiarCantidadTotal;
window.actualizarValidacionVariantes = actualizarValidacionVariantes;
window.inicializarVariantes = inicializarVariantes;
window.cambiarTipoTallas = cambiarTipoTallas;
window.cargarTallasProducto = cargarTallasProducto;
window.obtenerTallasSeleccionadas = obtenerTallasSeleccionadas;

// ============================================
// 32. MENÚ HAMBURGUESA
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

async function recargarProductos() {
    const btn = document.getElementById('btn-recargar');
    if (!btn) return;

    btn.classList.add('spinning');
    btn.disabled = true;

    try {
        const datos = await cargarProductos();
        if (datos) {
            datosGlobales = datos;
            adminDatos = JSON.parse(JSON.stringify(datos));

            renderizarOfertas(datos.ofertas, datos);
            renderizarProductosConModal(datos.productos.hombre, '#ropa-hombre .grid-productos', datos);
            renderizarProductosConModal(datos.productos.mujer, '#ropa-mujer .grid-productos', datos);
            renderizarProductosConModal(datos.productos.telas, '#telas .grid-productos', datos);
            renderizarProductosConModal(datos.productos.objetos, '#otros .grid-productos', datos);

            mostrarNotificacion('Productos actualizados correctamente', 'success');
        }
    } catch (error) {
        console.error('Error al recargar:', error);
        mostrarNotificacion('Error al recargar productos', 'error');
    } finally {
        setTimeout(() => {
            btn.classList.remove('spinning');
            btn.disabled = false;
        }, 500);
    }
}

document.getElementById('btn-recargar')?.addEventListener('click', recargarProductos);
window.recargarProductos = recargarProductos;

// ============================================
// ANIMACIÓN DEL BANNER AL HACER SCROLL
// ============================================
let ultimoScroll = 0;
let posicionBanner = 0; // 0 = izquierda, 50 = derecha

function animarBannerScroll() {
    // Solo en móvil (pantallas <= 768px)
    if (window.innerWidth > 768) return;

    const hero = document.querySelector('.hero');
    if (!hero) return;

    const scrollActual = window.scrollY;
    const alturaPantalla = window.innerHeight;

    // Si el scroll ha bajado más de una pantalla completa
    if (scrollActual > ultimoScroll + alturaPantalla) {
        posicionBanner = posicionBanner === 0 ? 50 : 0;
        hero.style.setProperty('--banner-pos', `${posicionBanner}%`);
        ultimoScroll = scrollActual;
    }
    // Si el scroll ha subido más de una pantalla completa
    else if (scrollActual < ultimoScroll - alturaPantalla) {
        posicionBanner = posicionBanner === 0 ? 50 : 0;
        hero.style.setProperty('--banner-pos', `${posicionBanner}%`);
        ultimoScroll = scrollActual;
    }
}

window.addEventListener('scroll', animarBannerScroll);