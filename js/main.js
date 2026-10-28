// ============================================
// ORQUESTADOR PRINCIPAL E INICIALIZACIÓN
// ============================================

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

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicación...');

    // 1. MOSTRAR EL MODAL DE BIENVENIDA INMEDIATAMENTE
    if (!isLoggedIn()) {
        mostrarModalBienvenida();
    }

    // 2. CARGAR PRODUCTOS EN PARALELO
    (async () => {
        const datos = await cargarProductos();
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
    })();

    actualizarBotonAcceder();

    // 3. LISTENERS GLOBALES (AQUÍ ESTABA EL PROBLEMA, SE PERDÍAN LOS BOTONES)
    document.getElementById('btn-acceder')?.addEventListener('click', function(e) {
        e.preventDefault();
        const session = getSession();
        if (session) { if (isAdmin()) abrirAdmin(); else mostrarNotificacion('Sesión activa como: ' + session.username, 'info'); }
        else mostrarLogin();
    });

    document.getElementById('btn-cerrar-sesion')?.addEventListener('click', async function(e) {
        e.preventDefault();
        const confirmado = await confirmar({ titulo: '¿Cerrar sesión?', mensaje: 'Tendrás que volver a iniciar sesión para acceder al panel.', tipo: 'info', textoAceptar: 'Sí, cerrar sesión', textoCancelar: 'Cancelar' });
        if (confirmado) logout();
    });

    document.getElementById('login-form')?.addEventListener('submit', async function(e) {
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

    document.getElementById('login-registro-link')?.addEventListener('click', function(e) {
        e.preventDefault();
        cerrarLogin();
        abrirModalGenerico({
            titulo: 'Crear Cuenta', subtitulo: 'Es rápido, gratis y seguro',
            campos: [{ id: 'username', label: 'Usuario', type: 'text', required: true }, { id: 'password', label: 'Contraseña', type: 'password', required: true }, { id: 'email', label: 'Gmail', type: 'email', required: true }],
            onSubmit: async (datos) => {
                const result = await registerUser(datos.username, datos.password, datos.email, datos.username);
                if (result.success) { actualizarBotonAcceder(); mostrarNotificacion('Usuario creado. Sesión iniciada.', 'success'); }
                else { mostrarNotificacion(result.message, 'error'); return false; }
            }
        });
    });

    document.getElementById('forzar-cierre-link')?.addEventListener('click', function(e) {
        e.preventDefault();
        cerrarLogin();
        abrirModalGenerico({
            titulo: 'Forzar cierre de sesión', subtitulo: 'Introduce tus credenciales para desbloquear tu cuenta',
            campos: [{ id: 'username', label: 'Usuario', type: 'text', required: true }, { id: 'password', label: 'Contraseña', type: 'password', required: true }],
            onSubmit: async (datos) => {
                if (!datos.username || !datos.password) { mostrarNotificacion('Completa ambos campos', 'error'); return false; }
                try {
                    const respuesta = await fetch(`${API_URL}/auth/force-logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: datos.username, password: datos.password }) });
                    const data = await respuesta.json();
                    if (respuesta.ok) { mostrarNotificacion('Sesión cerrada. Ya puedes iniciar sesión.', 'success'); localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('tm_pestana_activa'); setTimeout(() => mostrarLogin(), 800); }
                    else { mostrarNotificacion(data.error || 'Error al forzar cierre', 'error'); return false; }
                } catch (error) { mostrarNotificacion('Error de conexión', 'error'); return false; }
            }
        });
    });

    // Menú Hamburguesa
    const hamburguesa = document.getElementById('menu-hamburguesa');
    const nav = document.getElementById('nav-principal');
    if (hamburguesa && nav) {
        hamburguesa.addEventListener('click', function(event) { event.stopPropagation(); this.classList.toggle('activo'); nav.classList.toggle('activo'); });
        nav.querySelectorAll('a').forEach(enlace => { enlace.addEventListener('click', () => { hamburguesa.classList.remove('activo'); nav.classList.remove('activo'); }); });
        document.addEventListener('click', function(event) { if (!nav.contains(event.target) && !hamburguesa.contains(event.target)) { hamburguesa.classList.remove('activo'); nav.classList.remove('activo'); } });
    }

    // Modales de detalle y lightbox
    document.getElementById('modal-cerrar')?.addEventListener('click', cerrarModal);
    document.getElementById('modal-overlay')?.addEventListener('click', cerrarModal);
    document.getElementById('lightbox-cerrar')?.addEventListener('click', cerrarLightbox);
    document.getElementById('lightbox-overlay')?.addEventListener('click', cerrarLightbox);

    // Variantes de pedido
    document.getElementById('cantidad-total-sumar')?.addEventListener('click', () => cambiarCantidadTotal(1));
    document.getElementById('cantidad-total-restar')?.addEventListener('click', () => cambiarCantidadTotal(-1));
    document.getElementById('btn-añadir-variante')?.addEventListener('click', () => añadirVariante());

    // Recargar Productos
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
    }
});

// Ojito de contraseña
document.addEventListener('click', function(e) {
    if (e.target.closest('.toggle-password')) {
        const btn = e.target.closest('.toggle-password');
        const input = btn.parentElement.querySelector('input');
        if (input) { input.type = input.type === 'password' ? 'text' : 'password'; btn.classList.toggle('visible'); }
    }
});