// ============================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================
const API_URL = 'https://textiles-madruga-api.eldani000219.workers.dev/api';
const SESSION_KEY = 'tm_session';

const NEGOCIO = {
    whatsapp: '+5354108544',
    email: 'textilesmadruga@gmail.com',
    telegram: ''
};

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