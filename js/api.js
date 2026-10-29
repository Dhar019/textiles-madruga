// ============================================
// COMUNICACIÓN CON EL WORKER (API)
// ============================================

// ============================================
// 1. FUNCIONES DE PRODUCTOS (DEFINIDAS PRIMERO)
// ============================================

async function cargarProductos(intentos = 3) {
    console.log(`🔄 Cargando productos... (Intento ${4 - intentos}/3)`);
    
    if (intentos === 3) {
        document.querySelectorAll('.grid-productos').forEach(grid => {
            if (grid.children.length === 0) {
                grid.innerHTML = `
                    <div class="loader-container">
                        <div class="loader-dots">
                            <span></span><span></span><span></span>
                        </div>
                        <p>Cargando productos...</p>
                    </div>
                `;
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
// 2. FUNCIONES DE AUTENTICACIÓN
// ============================================

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

// ============================================
// 3. FUNCIONES DE SUBCATEGORÍAS
// ============================================

async function obtenerSubcategorias() {
    try {
        const respuesta = await fetch(`${API_URL}/subcategorias`);
        if (!respuesta.ok) return [];
        return await respuesta.json();
    } catch (e) {
        console.warn('No se pudieron cargar las subcategorías', e);
        return [];
    }
}

async function guardarSubcategoria(subcat) {
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/subcategorias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
            body: JSON.stringify(subcat)
        });
        return respuesta.ok;
    } catch (e) { return false; }
}

// ============================================
// 4. LOGOUT (AL FINAL, PORQUE USA OTRAS FUNCIONES)
// ============================================

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