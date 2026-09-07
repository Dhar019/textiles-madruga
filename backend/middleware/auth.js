// ============================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ============================================
// Middleware: Verificar token de autenticación
// ============================================
const authMiddleware = async (req, res, next) => {
    try {
        // 1. Obtener el token del header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'No autorizado. Token no proporcionado o formato inválido.' 
            });
        }

        const token = authHeader.split(' ')[1];

        // 2. Verificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Buscar el usuario en la base de datos
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado.' });
        }

        // 4. Adjuntar el usuario y el token al objeto req
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        console.error('❌ Error de autenticación:', error.message);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado.' });
        }
        res.status(401).json({ error: 'Error de autenticación.' });
    }
};

// ============================================
// Middleware: Verificar que el usuario es SuperAdmin
// ============================================
const superAdminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'No autenticado.' });
    }
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ 
            error: 'Acceso denegado. Se requieren permisos de SuperAdministrador.' 
        });
    }
    next();
};

// ============================================
// Middleware: Verificar que el usuario es Admin o SuperAdmin
// ============================================
const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'No autenticado.' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ 
            error: 'Acceso denegado. Se requieren permisos de administrador.' 
        });
    }
    next();
};

// ============================================
// EXPORTAR MIDDLEWARES
// ============================================
module.exports = {
    authMiddleware,
    superAdminMiddleware,
    adminMiddleware
};