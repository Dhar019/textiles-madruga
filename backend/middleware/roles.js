// ============================================
// MIDDLEWARE DE ROLES
// ============================================

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
// Middleware: Verificar que el usuario tiene un rol específico
// ============================================
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: `Acceso denegado. Se requieren uno de los siguientes roles: ${allowedRoles.join(', ')}` 
            });
        }
        next();
    };
};

// ============================================
// EXPORTAR MIDDLEWARES
// ============================================
module.exports = {
    superAdminMiddleware,
    adminMiddleware,
    roleMiddleware
};