// ============================================
// ORQUESTADOR PRINCIPAL E INICIALIZACIÓN
// ============================================
console.log('🚀 [main.js] Cargando orquestador...');

function actualizarBotonAcceder() {
    const session = getSession();
    const btnAcceder = document.getElementById('btn-acceder');
    if (btnAcceder) {
        if (session) { btnAcceder.textContent = 'Sesión activa'; btnAcceder.classList.add('activo'); }
        else { btnAcceder.textContent = 'Acceder a la cuenta'; btnAcceder.classList.remove('activo'); }
    }
    actualizarBotonCerrarSesion();
}

function actualizarBotonCerrarSesion() {
    const session = getSession();
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
    if (btnCerrarSesion) { if (session) btnCerrarSesion.classList.add('visible'); else btnCerrarSesion.classList.remove('visible'); }
}

// Función principal que se ejecuta cuando el DOM está listo
function inicializarApp() {
    try {
        console.log('✅ [DOM] Listo. Iniciando enlace de eventos...');

        // 1. MOSTRAR EL MODAL DE BIENVENIDA INMEDIATAMENTE
        if (typeof mostrarModalBienvenida === 'function' && !isLoggedIn()) {
            console.log('✅ [DOM] Mostrando modal de bienvenida...');
            mostrarModalBienvenida();
        }

        // 2. CARGAR PRODUCTOS EN PARALELO
        console.log('✅ [DOM] Iniciando carga de productos...');
        (async () => {
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
                    console.log('✅ [DOM] Productos renderizados correctamente');
                } else {
                    console.warn('⚠️ [DOM] No hay productos. La web funcionará sin catálogo.');
                }
            } catch (e) {
                console.error('❌ [Error] Fallo al cargar/renderizar productos:', e);
            }
        })();

        actualizarBotonAcceder();

        // 3. LISTENERS GLOBALES
        console.log('✅ [DOM] Enlazando botones...');
        
        // Botón Acceder
        const btnAcceder = document.getElementById('btn-acceder');
        if (btnAcceder) {
            btnAcceder.addEventListener('click', function(e) {
                e.preventDefault();
                const session = getSession();
                if (session) { if (isAdmin()) abrirAdmin(); else mostrarNotificacion('Sesión activa como: ' + session.username, 'info'); }
                else mostrarLogin();
            });
            console.log('  -> Botón "Acceder" enlazado.');
        }

        // Botón Cerrar Sesión
        const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
        if (btnCerrarSesion) {
            btnCerrarSesion.addEventListener('click', async function(e) {
                e.preventDefault();
                const confirmado = await confirmar({ titulo: '¿Cerrar sesión?', mensaje: 'Tendrás que volver a iniciar sesión para acceder al panel.', tipo: 'info', textoAceptar: 'Sí, cerrar sesión', textoCancelar: 'Cancelar' });
                if (confirmado) logout();
            });
            console.log('  -> Botón "Cerrar Sesión" enlazado.');
        }

        // Formulario de Login
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('login-user').value.trim();
                const password = document.getElementById('login-pass').value;
                const result = await login(username, password);
                if (result.success) {
                    cerrarLogin();
                    actualizarBotonAcceder();
                    if (isAdmin()) { mostrarNotificacion('Bienvenido administrador', 'success'); abrirAdmin(); }
                    else { mostrarNotificacion('Bienvenido ' + username, 'success'); }
                } else { mostrarNotificacion(result.message, 'error'); }
            });
            console.log('  -> Formulario de Login enlazado.');
        }

        // Menú Hamburguesa
        const hamburguesa = document.getElementById('menu-hamburguesa');
        const nav = document.getElementById('nav-principal');
        if (hamburguesa && nav) {
            hamburguesa.addEventListener('click', function(event) { event.stopPropagation(); this.classList.toggle('activo'); nav.classList.toggle('activo'); });
            nav.querySelectorAll('a').forEach(enlace => { enlace.addEventListener('click', () => { hamburguesa.classList.remove('activo'); nav.classList.remove('activo'); }); });
            document.addEventListener('click', function(event) { if (!nav.contains(event.target) && !hamburguesa.contains(event.target)) { hamburguesa.classList.remove('activo'); nav.classList.remove('activo'); } });
            console.log('  -> Menú Hamburguesa enlazado.');
        }

        // Botones de cerrar modales
        document.getElementById('modal-cerrar')?.addEventListener('click', cerrarModal);
        document.getElementById('modal-overlay')?.addEventListener('click', cerrarModal);
        document.getElementById('lightbox-cerrar')?.addEventListener('click', cerrarLightbox);
        document.getElementById('lightbox-overlay')?.addEventListener('click', cerrarLightbox);
        document.getElementById('login-cerrar')?.addEventListener('click', cerrarLogin);
        document.getElementById('login-overlay')?.addEventListener('click', cerrarLogin);
        console.log('  -> Botones de cierre de modales enlazados.');

        // Botón recargar productos
        document.getElementById('btn-recargar')?.addEventListener('click', async function() {
            this.classList.add('spinning');
            const datos = await cargarProductos();
            if (datos) {
                datosGlobales = datos; adminDatos = JSON.parse(JSON.stringify(datos));
                renderizarOfertas(datos.ofertas, datos);
                renderizarProductosConModal(datos.productos.hombre, '#ropa-hombre .grid-productos', datos);
                renderizarProductosConModal(datos.productos.mujer, '#ropa-mujer .grid-productos', datos);
                renderizarProductosConModal(datos.productos.telas, '#telas .grid-productos', datos);
                renderizarProductosConModal(datos.productos.objetos, '#otros .grid-productos', datos);
                mostrarNotificacion('Productos actualizados', 'success');
            }
            setTimeout(() => this.classList.remove('spinning'), 500);
        });
        console.log('  -> Botón Recargar enlazado.');

        // Dropzone para admin
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('prod-imagen-file');
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const prev = document.getElementById('drop-zone-preview'); const cont = document.getElementById('drop-zone-content'); const hidden = document.getElementById('prod-imagen');
                        if (prev && cont && hidden) { prev.src = ev.target.result; prev.style.display = 'block'; cont.style.display = 'none'; hidden.value = ev.target.result; }
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
            console.log('  -> Dropzone enlazado.');
        }

        console.log('✅ [DOM] Todos los eventos enlazados correctamente. Fin de inicialización.');

    } catch (error) {
        console.error('❌❌ [ERROR FATAL EN LA INICIALIZACIÓN] ❌❌');
        console.error(error);
        // Alerta visual para saber que hay un error
        mostrarNotificacion('Error interno al cargar la web. Revisa la consola (F12).', 'error');
    }
}

// Escuchar el evento DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarApp);
} else {
    // Si el DOM ya está cargado (porque el script se cargó tarde), ejecutar directamente
    inicializarApp();
}

// Ojito de contraseña
document.addEventListener('click', function(e) {
    if (e.target.closest('.toggle-password')) {
        const btn = e.target.closest('.toggle-password');
        const input = btn.parentElement.querySelector('input');
        if (input) { input.type = input.type === 'password' ? 'text' : 'password'; btn.classList.toggle('visible'); }
    }
});