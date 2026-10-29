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

    // 3. LISTENERS GLOBALES
    document.getElementById('btn-acceder')?.addEventListener('click', function(e) {
        e.preventDefault();
        const session = getSession();
        if (session) { if (isAdmin()) abrirAdmin(); else mostrarNotificacion('Sesión activa como: ' + session.username, 'info'); }
        else mostrarLogin();
    });

    // ✅ CIERRE DEL LOGIN CON DELEGACIÓN DE EVENTOS (a prueba de balas)
    document.addEventListener('click', function(e) {
        if (e.target.closest('#login-cerrar') || e.target.closest('#login-overlay')) {
            console.log('🔒 Cerrando login (delegación)');
            cerrarLogin();
        }
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
        } else { 
            mostrarNotificacion(result.message, 'error'); 
        }
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

    // ✅ LISTENERS DE UI (Movidos desde ui.js)
    const btnAyuda = document.getElementById('btn-ayuda-pedido');
    const modalAyuda = document.getElementById('modal-ayuda-pedido');
    const cerrarAyuda = document.getElementById('modal-ayuda-pedido-cerrar');
    const overlayAyuda = document.getElementById('modal-ayuda-pedido-overlay');
    const btnVolver = document.getElementById('btn-volver-pedido');

    if (btnAyuda && modalAyuda) {
        const abrirAyuda = () => {
            modalAyuda.className = 'login-visible';
            // ✅ FORZAR SCROLL ARRIBA
            const contenido = modalAyuda.querySelector('.ayuda-contenido');
            if (contenido) contenido.scrollTop = 0;
            scrollModalAlTop(modalAyuda);
        };
        const cerrarModalAyuda = () => {
            modalAyuda.className = 'login-oculto';
            setTimeout(() => {
                const contenido = modalAyuda.querySelector('.ayuda-contenido');
                if (contenido) contenido.scrollTop = 0;
                scrollModalAlTop(modalAyuda);
            }, 50);
        };

        btnAyuda.addEventListener('click', abrirAyuda);
        cerrarAyuda.addEventListener('click', cerrarModalAyuda);
        overlayAyuda.addEventListener('click', cerrarModalAyuda);
        btnVolver.addEventListener('click', cerrarModalAyuda);
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

    // ✅ LISTENERS DE ADMIN (Movidos desde admin.js)
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
            else if (tabName === 'subcategorias') cargarSubcategoriasAdmin(); // ✅ NUEVO
        });
    });

    document.getElementById('producto-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nombre = document.getElementById('prod-nombre').value.trim();
        const precio = parseFloat(document.getElementById('prod-precio').value);
        let imagen = document.getElementById('prod-imagen').value.trim();
        const categoria = document.getElementById('prod-categoria').value;
        const subcategoria = document.getElementById('prod-subcategoria').value; // ✅ NUEVO
        const descripcion = document.getElementById('prod-descripcion').value.trim();
        let idEditable = document.getElementById('prod-id').value.trim();
        if (idEditable === 'sin-id') idEditable = '';
        if (!nombre || !precio) { mostrarNotificacion('Completa nombre y precio', 'error'); return; }
        const { tipoTallas, tallasDisponibles } = obtenerTallasSeleccionadas();
        if (tipoTallas !== 'sin_tallas' && tallasDisponibles.length === 0) { mostrarNotificacion('Selecciona al menos una talla o marca "Sin tallas"', 'error'); return; }
        if (!imagen) imagen = 'assets/img/placeholder.webp';
        const session = getSession();
        if (!session) { mostrarNotificacion('No hay sesión activa', 'error'); return; }
        try {
            // ✅ AÑADIMOS LA SUBCATEGORÍA AL OBJETO DEL PRODUCTO
            const productoData = { nombre, precio, imagen, categoria, subcategoria, descripcion, tipoTallas, tallasDisponibles };
            if (idEditable && !modoEdicion) productoData.id = idEditable;
            let respuesta;
            if (modoEdicion) respuesta = await fetch(`${API_URL}/products/${modoEdicion}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, body: JSON.stringify(productoData) });
            else respuesta = await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, body: JSON.stringify(productoData) });
            if (!respuesta.ok) { const errorData = await respuesta.json().catch(() => ({})); throw new Error(errorData.error || 'Error al guardar'); }
            modoEdicion = null;
            const formProducto = document.getElementById('form-producto');
            formProducto.className = 'form-oculto';
            this.reset();
            resetearTallasForm();
            const preview = document.getElementById('drop-zone-preview');
            const content = document.getElementById('drop-zone-content');
            if (preview && content) { preview.style.display = 'none'; preview.src = ''; content.style.display = 'flex'; }
            document.getElementById('prod-id').value = '';
            document.querySelector('#producto-form button[type="submit"]').textContent = 'Crear';
            document.getElementById('form-title').textContent = 'Nuevo Producto';
            mostrarNotificacion('Producto guardado', 'success');
            const datosActualizados = await cargarProductos();
            if (datosActualizados) { datosGlobales = datosActualizados; adminDatos = JSON.parse(JSON.stringify(datosActualizados)); renderizarAdminProductos(); renderizarOfertas(datosActualizados.ofertas, datosActualizados); cargarOfertasAdmin(); }
        } catch (error) { console.error('Error guardar:', error); mostrarNotificacion(error.message || 'Error al guardar producto', 'error'); }
    });

    document.getElementById('btn-cancelar-form')?.addEventListener('click', function() {
        const formProducto = document.getElementById('form-producto');
        formProducto.className = 'form-oculto';
        modoEdicion = null;
        document.getElementById('producto-form').reset();
        resetearTallasForm();
        const preview = document.getElementById('drop-zone-preview');
        const content = document.getElementById('drop-zone-content');
        if (preview && content) { preview.style.display = 'none'; preview.src = ''; content.style.display = 'flex'; }
    });

    document.getElementById('btn-nuevo-producto')?.addEventListener('click', function() {
        modoEdicion = null;
        document.getElementById('producto-form').reset();
        document.getElementById('prod-id').value = '';
        resetearTallasForm();
        const preview = document.getElementById('drop-zone-preview');
        const content = document.getElementById('drop-zone-content');
        if (preview && content) { preview.style.display = 'none'; preview.src = ''; content.style.display = 'flex'; }
        const formProducto = document.getElementById('form-producto');
        formProducto.className = 'form-visible';
        document.querySelector('#producto-form button[type="submit"]').textContent = 'Crear';
        document.getElementById('form-title').textContent = 'Nuevo Producto';
        
        // ✅ Actualizar subcategorías al abrir formulario
        actualizarSubcategoriasForm();
    });

    document.getElementById('admin-cerrar')?.addEventListener('click', cerrarAdmin);
    document.getElementById('admin-overlay')?.addEventListener('click', cerrarAdmin);

    document.getElementById('btn-nuevo-usuario')?.addEventListener('click', function() {
        if (!isSuperAdmin()) { mostrarNotificacion('Solo el SuperAdministrador puede crear usuarios', 'error'); return; }
        abrirModalGenerico({
            titulo: 'Nuevo Usuario', subtitulo: 'Crea una cuenta con rol de admin o usuario',
            campos: [
                { id: 'username', label: 'Usuario', type: 'text', placeholder: 'Nombre de usuario', required: true },
                { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 6 caracteres', required: true },
                { id: 'email', label: 'Gmail', type: 'email', placeholder: 'usuario@gmail.com' },
                { id: 'role', label: 'Rol', type: 'select', opciones: [{ value: 'user', label: 'Usuario' }, { value: 'admin', label: 'Administrador' }] }
            ],
            onSubmit: async (datos) => {
                if (!datos.username || datos.username.length < 3) { mostrarNotificacion('Nombre inválido (mínimo 3 caracteres)', 'error'); return false; }
                if (!datos.password || datos.password.length < 6) { mostrarNotificacion('Contraseña inválida (mínimo 6 caracteres)', 'error'); return false; }
                try {
                    const session = getSession();
                    const respuesta = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, body: JSON.stringify({ username: datos.username, password: datos.password, role: datos.role, email: datos.email || '', name: datos.username }) });
                    if (!respuesta.ok) { const data = await respuesta.json(); throw new Error(data.error || 'Error al crear usuario'); }
                    mostrarNotificacion(`Usuario "${datos.username}" creado`, 'success');
                    renderizarUsuariosAdmin();
                } catch (error) { mostrarNotificacion(error.message, 'error'); return false; }
            }
        });
    });

    // ✅ LISTENERS DE SUBCATEGORÍAS
    document.getElementById('btn-nueva-subcategoria')?.addEventListener('click', () => {
        document.getElementById('form-subcategoria').className = 'form-visible';
    });
    
    document.getElementById('btn-cancelar-sub')?.addEventListener('click', () => {
        document.getElementById('form-subcategoria').className = 'form-oculto';
        document.getElementById('subcategoria-form').reset();
    });

    document.getElementById('subcategoria-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('sub-nombre').value.trim();
        const catPadre = document.getElementById('sub-categoria-padre').value;
        
        if (!nombre) return;
        
        const id = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const exito = await guardarSubcategoria({ id, nombre, categoriaPadre: catPadre });
        
        if (exito) {
            mostrarNotificacion('Subcategoría creada', 'success');
            document.getElementById('form-subcategoria').className = 'form-oculto';
            document.getElementById('subcategoria-form').reset();
            cargarSubcategoriasAdmin();
        } else {
            mostrarNotificacion('Error al crear', 'error');
        }
    });
    
    // Al cambiar la categoría en el formulario, actualizar las subcategorías
    document.getElementById('prod-categoria')?.addEventListener('change', actualizarSubcategoriasForm);

});

// Ojito de contraseña
document.addEventListener('click', function(e) {
    if (e.target.closest('.toggle-password')) {
        const btn = e.target.closest('.toggle-password');
        const input = btn.parentElement.querySelector('input');
        if (input) { input.type = input.type === 'password' ? 'text' : 'password'; btn.classList.toggle('visible'); }
    }
});