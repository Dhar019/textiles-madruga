// ============================================
// LÓGICA DEL PANEL DE ADMINISTRACIÓN
// ============================================

// ============================================
// SISTEMA DE SESIÓN (ÚNICO PUNTO DE VERIFICACIÓN)
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
                console.log('🔒 Sesión reemplazada o inválida. Cerrando sesión.');
                detenerVerificadorSesion();
                mostrarNotificacion('Tu sesión fue cerrada. Inicia sesión de nuevo.', 'warning');
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
// TEMPORIZADORES DE INACTIVIDAD
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
            mostrarNotificacion(`⏰ Tu sesión expirará en ${minutos}m ${segundos}s por inactividad`, 'warning');
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

// ============================================
// APERTURA / CIERRE DE MODALES
// ============================================
function mostrarLogin() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) { 
        loginModal.className = 'login-visible'; 
        scrollModalAlTop(loginModal); 
    }
}

function cerrarLogin() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) { 
        loginModal.className = 'login-oculto'; 
    }
}

function abrirAdmin() {
    if (!protegerAdmin()) return;
    const adminPanel = document.getElementById('admin-panel');
    adminPanel.className = 'admin-visible';
    
    // ✅ FORZAR bloqueo del scroll en html y body desde JS
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.top = '0';
    document.documentElement.style.left = '0';
    document.documentElement.classList.add('admin-abierto-html');
    
    document.body.style.overflow = 'hidden';
    document.body.classList.add('admin-abierto');
    
    cargarAdminProductos();
    reiniciarTemporizadorInactividad();
    iniciarVerificadorSesion();
    cargarPedidosAdmin();
    scrollModalAlTop(adminPanel);
    document.getElementById('admin-cerrar').onclick = cerrarAdmin;
    document.getElementById('admin-overlay').onclick = cerrarAdmin;
}

function cerrarAdmin() {
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.className = 'admin-oculto';
    
    // ✅ LIBERAR el scroll de html y body
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.documentElement.style.position = '';
    document.documentElement.style.width = '';
    document.documentElement.style.top = '';
    document.documentElement.style.left = '';
    document.documentElement.classList.remove('admin-abierto-html');
    
    document.body.style.overflow = '';
    document.body.classList.remove('admin-abierto');
    
    const formProducto = document.getElementById('form-producto');
    if (formProducto) formProducto.className = 'form-oculto';
    detenerVerificadorSesion();
    detenerTemporizadorInactividad();
    detenerTemporizadorAviso();
}

// ============================================
// CARGA Y RENDERIZADO DE PRODUCTOS EN ADMIN
// ============================================
function cargarAdminProductos() {
    if (!datosGlobales) return;
    adminDatos = JSON.parse(JSON.stringify(datosGlobales));
    renderizarAdminProductos();
    cargarOfertasAdmin();
    renderizarUsuariosAdmin();
}

function renderizarAdminProductos() {
    if (!adminDatos) return;
    const adminProductosLista = document.getElementById('admin-productos-lista');
    if (!adminProductosLista) return;
    
    const termino = document.getElementById('buscador-productos')?.value.toLowerCase().trim() || '';
    const categoriaNombres = { 'hombre': 'Hombre', 'mujer': 'Mujer', 'telas': 'Telas', 'objetos': 'Otros' };
    
    let html = '';
    
    for (const categoria of ['hombre', 'mujer', 'telas', 'objetos']) {
        let productos = adminDatos.productos[categoria] || [];
        if (productos.length === 0) continue;
        
        if (termino) {
            productos = productos.filter(p => 
                (p.nombre || '').toLowerCase().includes(termino) || 
                (String(p.id || p._id || '')).toLowerCase().includes(termino)
            );
        }
        
        if (productos.length === 0) continue;
        
        html += `
            <div class="admin-categoria-grupo" style="margin-top: 20px;">
                <h3 class="admin-categoria-titulo" style="font-family: var(--font-serif); font-size: 1.2rem; color: var(--color-naranja); padding-bottom: 8px; border-bottom: 2px solid #EDE8E1; margin-bottom: 12px;">
                    ${categoriaNombres[categoria]} <span style="font-size: 0.8rem; color: var(--color-gris);">(${productos.length})</span>
                </h3>
        `;
        
        productos.forEach(producto => {
            const enOferta = producto.enOferta || false;
            const id = producto.id || producto._id || 'sin-id';
            const descripcion = producto.descripcion || 'Sin descripción';
            let tallasInfo = '';
            if (producto.tipoTallas === 'sin_tallas') tallasInfo = '<span style="font-size:0.7rem;color:var(--color-gris);">Sin tallas</span>';
            else if (producto.tallasDisponibles && producto.tallasDisponibles.length > 0) tallasInfo = `<span style="font-size:0.7rem;color:var(--color-gris);">Tallas: ${producto.tallasDisponibles.join(', ')}</span>`;
            else tallasInfo = '<span style="font-size:0.7rem;color:#C0392B;">Sin tallas configuradas</span>';
            
            html += `<div class="admin-producto-item" data-id="${id}" data-categoria="${categoria}"><div class="info"><img src="${producto.imagen}" alt="${producto.nombre}" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;"><div class="info-texto"><span class="nombre">${producto.nombre}</span><span class="descripcion">${descripcion.substring(0, 60)}${descripcion.length > 60 ? '...' : ''}</span><span class="id-producto">ID: ${id}</span>${tallasInfo}</div><span class="precio">${producto.precio.toFixed(2)} CUP</span><span class="categoria-tag">${categoriaNombres[categoria]}</span>${enOferta ? '<span style="background:#E87A20;color:white;padding:2px 12px;border-radius:50px;font-size:0.7rem;font-weight:600;">OFERTA</span>' : ''}</div><div class="acciones"><button class="btn-oferta ${enOferta ? 'activo' : ''}" onclick="toggleOfertaAdmin('${id}')">${enOferta ? 'Quitar oferta' : 'Oferta'}</button><button class="btn-editar" onclick="editarProductoAdmin('${id}')">Editar</button><button class="btn-eliminar" onclick="eliminarProductoAdmin('${id}')">Eliminar</button></div></div>`;
        });
        
        html += `</div>`;
    }
    
    if (!html) {
        html = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No se encontraron productos.</p>';
    }
    
    adminProductosLista.innerHTML = html;
}

// ============================================
// ACCIONES DE PRODUCTO
// ============================================
async function toggleOfertaAdmin(id) {
    if (!adminDatos) return;
    const producto = obtenerProductoPorId(id, adminDatos);
    if (!producto) return;
    const nuevaOferta = !producto.enOferta;
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/offers/toggle/${id}`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, 
            body: JSON.stringify({ enOferta: nuevaOferta, tipoOferta: producto.tipoOferta || 'descuento', descuento: producto.descuento || 15, promocion: producto.promocion || '' }) 
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
            renderizarTelasYOtros(datosActualizados);
            renderizarSeccionesDinamicas(datosActualizados);
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
            headers: { 'Authorization': `Bearer ${session.token}`, 'Content-Type': 'application/json' } 
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
            renderizarTelasYOtros(datosActualizados);
            renderizarSeccionesDinamicas(datosActualizados);
        }
    } catch (error) { 
        console.error('Error al eliminar:', error); 
        mostrarNotificacion(`Error al eliminar: ${error.message}`, 'error'); 
    }
}

// ============================================
// SISTEMA DE TALLAS EN ADMIN
// ============================================
function cambiarTipoTallas(tipo) {
    const alfabeticas = document.getElementById('tallas-alfabeticas');
    const numericas = document.getElementById('tallas-numericas');
    const sinTallas = document.getElementById('tallas-sin');
    if (!alfabeticas || !numericas || !sinTallas) return;
    
    // ✅ Guardar el scroll de TODOS los contenedores antes del cambio
    const contenedor = document.querySelector('.admin-contenido');
    const tabContent = document.querySelector('.admin-tab-content.active');
    const scrollContenedor = contenedor ? contenedor.scrollTop : 0;
    const scrollTab = tabContent ? tabContent.scrollTop : 0;
    const scrollWindow = window.scrollY;
    
    // ✅ Quitar el foco del radio (evita que el navegador haga scroll al foco)
    if (document.activeElement) document.activeElement.blur();
    
    // Hacer el cambio de UI
    alfabeticas.style.display = 'none'; 
    numericas.style.display = 'none'; 
    sinTallas.style.display = 'none';
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    
    if (tipo === 'alfabeticas') alfabeticas.style.display = 'flex';
    else if (tipo === 'numericas') numericas.style.display = 'flex';
    else sinTallas.style.display = 'flex';
    
    // ✅ Restaurar TODOS los scrolls en el siguiente frame
    requestAnimationFrame(() => {
        window.scrollTo(0, scrollWindow);
        if (contenedor) contenedor.scrollTop = scrollContenedor;
        if (tabContent) tabContent.scrollTop = scrollTab;
    });
}

function cargarTallasProducto(producto) {
    document.querySelectorAll('input[name="tipo-tallas"]').forEach(r => r.checked = false);
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    const tipoTallas = producto.tipoTallas || 'alfabeticas';
    const tallasDisponibles = producto.tallasDisponibles || [];
    const radioTipo = document.querySelector(`input[name="tipo-tallas"][value="${tipoTallas}"]`);
    if (radioTipo) radioTipo.checked = true;
    cambiarTipoTallas(tipoTallas);
    if (tipoTallas !== 'sin_tallas') document.querySelectorAll('.talla-checkbox').forEach(cb => { if (tallasDisponibles.includes(cb.value)) cb.checked = true; });
}

function obtenerTallasSeleccionadas() {
    const tipoTallas = document.querySelector('input[name="tipo-tallas"]:checked')?.value || 'alfabeticas';
    if (tipoTallas === 'sin_tallas') return { tipoTallas: 'sin_tallas', tallasDisponibles: [] };
    const tallas = [];
    document.querySelectorAll('.talla-checkbox:checked').forEach(cb => tallas.push(cb.value));
    return { tipoTallas, tallasDisponibles: tallas };
}

function resetearTallasForm() {
    document.querySelectorAll('input[name="tipo-tallas"]').forEach(r => r.checked = false);
    const radioDefault = document.querySelector('input[name="tipo-tallas"][value="alfabeticas"]');
    if (radioDefault) radioDefault.checked = true;
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    cambiarTipoTallas('alfabeticas');
}

// ============================================
// EDITAR PRODUCTO
// ============================================
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
    
    for (const cat of ['hombre', 'mujer', 'telas', 'objetos']) { 
        if (adminDatos.productos[cat]?.some(x => String(x._id) === String(id) || String(x.id) === String(id))) { 
            document.getElementById('prod-categoria').value = cat; 
            break; 
        } 
    }
    
    cargarTallasProducto(producto);
    actualizarSubcategoriasForm();
    document.getElementById('prod-subcategoria').value = producto.subcategoria || '';
    
    const prev = document.getElementById('drop-zone-preview'); 
    const cont = document.getElementById('drop-zone-content');
    if (producto.imagen && prev && cont) { 
        prev.src = producto.imagen; 
        prev.style.display = 'block'; 
        cont.style.display = 'none'; 
    } else if (prev && cont) { 
        prev.style.display = 'none'; 
        prev.src = ''; 
        cont.style.display = 'flex'; 
    }
    
    const form = document.getElementById('form-producto');
    form.className = 'form-visible';
    document.querySelector('#producto-form button[type="submit"]').textContent = 'Actualizar';
    document.getElementById('form-title').textContent = 'Editar Producto';
    
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================
// PEDIDOS EN ADMIN
// ============================================
async function cargarPedidosAdmin() {
    const container = document.getElementById('lista-pedidos-admin');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando pedidos...</p>';
    try {
        const session = getSession();
        if (!session || !session.token) { 
            container.innerHTML = '<p>No hay sesión activa.</p>'; 
            return; 
        }
        const respuesta = await fetch(`${API_URL}/pedidos`, { headers: { 'Authorization': `Bearer ${session.token}` } });
        if (!respuesta.ok) throw new Error('Error al cargar pedidos');
        const data = await respuesta.json();
        pedidosGlobales = data.pedidos || [];
        actualizarBadgePedidos();
        renderizarPedidosAdmin();
    } catch (error) { 
        console.error('Error al cargar pedidos:', error); 
        container.innerHTML = '<p>Error al cargar pedidos.</p>'; 
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
    if (filtroPedidoActual !== 'todos') pedidosFiltrados = pedidosGlobales.filter(p => p.estado === filtroPedidoActual);
    if (pedidosFiltrados.length === 0) { 
        container.innerHTML = `<div class="pedidos-vacio"><span class="icono">📭</span><p>No hay pedidos ${filtroPedidoActual !== 'todos' ? `en estado "${filtroPedidoActual}"` : 'todavía'}.</p></div>`; 
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
        const fecha = new Date(pedido.fecha).toLocaleString('es-CU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        let tallasHTML = '';
        if (pedido.variantes && pedido.variantes.length > 0) {
            tallasHTML = `<div class="pedido-dato" style="grid-column: 1 / -1;"><strong>Tallas:</strong> <span>${pedido.variantes.map(v => v.talla === 'UNICA' ? `${v.cantidad}x` : `${v.cantidad}x talla ${v.talla}`).join(' · ')}</span></div>`;
        } else if (pedido.talla) {
            tallasHTML = `<div class="pedido-dato"><strong>Talla:</strong> <span>${pedido.talla}</span></div>`;
        }
        html += `<div class="pedido-item estado-${pedido.estado}" data-id="${pedido.id}"><div class="pedido-header"><div class="pedido-info-principal"><span class="pedido-id">${pedido.id}</span><h3 class="pedido-producto">${pedido.producto}</h3></div><div class="pedido-badges"><span class="badge-estado ${pedido.estado}">${estadoTexto[pedido.estado] || pedido.estado}</span><span class="badge-via ${pedido.via}">${via.icono} ${via.nombre}</span></div></div><div class="pedido-datos"><div class="pedido-dato"><strong>Cliente:</strong> <span>${pedido.nombre}</span></div><div class="pedido-dato"><strong>Teléfono:</strong> <span>${pedido.telefono || pedido.contacto || 'N/A'}</span></div>${pedido.email ? `<div class="pedido-dato"><strong>Gmail:</strong> <span>${pedido.email}</span></div>` : ''}<div class="pedido-dato"><strong>Cantidad:</strong> <span>${pedido.cantidad}</span></div>${tallasHTML}<div class="pedido-dato"><strong>Entrega:</strong> <span>${pedido.tipoEntrega === 'domicilio' ? '🏠 A domicilio' : '🏪 Recoger en tienda'}</span></div>${pedido.direccion ? `<div class="pedido-dato"><strong>Dirección:</strong> <span>${pedido.direccion}</span></div>` : ''}${pedido.referencia ? `<div class="pedido-dato"><strong>Referencia:</strong> <span>${pedido.referencia}</span></div>` : ''}${pedido.municipio ? `<div class="pedido-dato"><strong>Municipio:</strong> <span>${pedido.municipio}</span></div>` : ''}<div class="pedido-dato"><strong>Pago:</strong> <span>${pedido.metodoPago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}</span></div><div class="pedido-dato"><strong>Contacto pref.:</strong> <span>${pedido.contactoPreferido === 'whatsapp' ? '📱 WhatsApp' : pedido.contactoPreferido === 'llamada' ? '📞 Llamada' : '✉️ Gmail'}</span></div><div class="pedido-dato"><strong>Fecha:</strong> <span>${fecha}</span></div></div>${pedido.notas ? `<div class="pedido-notas">📝 ${pedido.notas}</div>` : ''}<div class="pedido-acciones">${pedido.estado === 'pendiente' ? `<button class="btn-pedido btn-atender" onclick="cambiarEstadoPedido('${pedido.id}', 'atendido')">📞 Marcar atendido</button>` : ''}${pedido.estado === 'atendido' ? `<button class="btn-pedido btn-completar" onclick="cambiarEstadoPedido('${pedido.id}', 'completado')">✅ Completar</button>` : ''}${pedido.estado !== 'cancelado' && pedido.estado !== 'completado' ? `<button class="btn-pedido btn-cancelar" onclick="cambiarEstadoPedido('${pedido.id}', 'cancelado')">✕ Cancelar</button>` : ''}${pedido.estado === 'completado' ? `<button class="btn-pedido btn-atender" onclick="cambiarEstadoPedido('${pedido.id}', 'pendiente')">↺ Reabrir</button>` : ''}<button class="btn-pedido btn-eliminar" onclick="eliminarPedidoAdmin('${pedido.id}')">🗑 Eliminar</button></div></div>`;
    });
    container.innerHTML = html;
}

function filtrarPorEstado(estado) {
    filtroPedidoActual = estado;
    document.querySelectorAll('.filtro-pedido').forEach(btn => { 
        btn.classList.remove('activo'); 
        if (btn.dataset.filtro === estado) btn.classList.add('activo'); 
    });
    renderizarPedidosAdmin();
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, 
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
// OFERTAS EN ADMIN
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
            const precioOferta = descuento > 0 ? producto.precio * (1 - descuento / 100) : producto.precio;
            const imagen = producto.imagen || 'assets/img/placeholder.webp';
            const descripcion = producto.descripcion || 'Sin descripción';
            const id = producto.id || producto._id || 'sin-id';
            const categoria = producto.categoria || 'sin categoría';
            html += `<div class="oferta-editar-item" data-id="${id}"><div class="oferta-card-producto"><img src="${imagen}" alt="${producto.nombre}" class="oferta-card-img" onerror="this.src='assets/img/placeholder.webp'; this.onerror=null;"><div class="oferta-card-info"><span class="oferta-card-nombre">${producto.nombre}</span><span class="oferta-card-descripcion">${descripcion.substring(0, 80)}${descripcion.length > 80 ? '...' : ''}</span><span class="oferta-card-categoria">${categoria}</span><span class="oferta-card-id">ID: ${id}</span></div></div><div class="oferta-card-precios"><span class="oferta-card-precio-original">${producto.precio.toFixed(2)} CUP</span>${descuento > 0 ? `<span class="oferta-card-precio-oferta">${precioOferta.toFixed(2)} CUP</span>` : ''}</div><div class="oferta-card-edicion"><div class="campo"><label>Tipo de oferta</label><select id="tipo-${id}" class="oferta-select" onchange="toggleDescuentoInput('${id}')"><option value="descuento" ${tipoOferta === 'descuento' ? 'selected' : ''}>Descuento</option><option value="2x1" ${tipoOferta === '2x1' ? 'selected' : ''}>Lleva 2, paga 1</option><option value="3x2" ${tipoOferta === '3x2' ? 'selected' : ''}>Lleva 3, paga 2</option><option value="personalizado" ${tipoOferta === 'personalizado' ? 'selected' : ''}>Personalizado (descuento + texto)</option></select></div><div class="campo"><label>Descuento (%)</label><input type="number" id="descuento-${id}" value="${descuento}" min="0" max="100" onkeydown="if(event.key==='Enter'){event.preventDefault();guardarOferta('${id}');}"></div><div class="campo"><label>Promoción (texto)</label><input type="text" id="promocion-${id}" value="${promocion}" placeholder="Ej: Envío gratis, Regalo sorpresa..." onkeydown="if(event.key==='Enter'){event.preventDefault();guardarOferta('${id}');}"></div><button class="btn-admin btn-primario btn-guardar-oferta" onclick="guardarOferta('${id}')">💾 Guardar</button><button class="btn-admin btn-peligro" onclick="quitarOferta('${id}')">🗑 Quitar</button></div></div>`;
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
        descuentoEl.disabled = false; descuentoEl.style.opacity = '1'; descuentoEl.style.cursor = 'text'; descuentoEl.placeholder = 'Ej: 15';
        promocionEl.disabled = true; promocionEl.style.opacity = '0.4'; promocionEl.style.cursor = 'not-allowed'; promocionEl.value = ''; promocionEl.placeholder = 'No aplica para descuento simple';
    } else if (tipo === 'personalizado') {
        descuentoEl.disabled = false; descuentoEl.style.opacity = '1'; descuentoEl.style.cursor = 'text'; descuentoEl.placeholder = 'Ej: 20';
        promocionEl.disabled = false; promocionEl.style.opacity = '1'; promocionEl.style.cursor = 'text'; promocionEl.placeholder = 'Ej: Envío gratis, Regalo sorpresa...';
    } else {
        descuentoEl.disabled = true; descuentoEl.style.opacity = '0.4'; descuentoEl.style.cursor = 'not-allowed'; descuentoEl.value = 0; descuentoEl.placeholder = 'No aplica';
        promocionEl.disabled = true; promocionEl.style.opacity = '0.4'; promocionEl.style.cursor = 'not-allowed'; promocionEl.value = ''; promocionEl.placeholder = 'No aplica';
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, 
            body: JSON.stringify({ enOferta: true, tipoOferta, descuento, promocion }) 
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
        const respuesta = await fetch(`${API_URL}/offers/toggle/${productoId}`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, 
            body: JSON.stringify({ enOferta: false }) 
        });
        if (!respuesta.ok) throw new Error('Error al quitar oferta');
        mostrarNotificacion('Oferta eliminada', 'success'); 
        cargarOfertasAdmin();
    } catch (error) { 
        mostrarNotificacion('Error al quitar oferta', 'error'); 
    }
}

// ============================================
// USUARIOS EN ADMIN
// ============================================
async function renderizarUsuariosAdmin() {
    const container = document.getElementById('admin-usuarios-lista');
    if (!container) return;
    if (!isSuperAdmin()) { 
        container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--color-gris);background:white;border-radius:12px;border:1px dashed #EDE8E1;"><p style="font-weight:600;color:var(--color-negro);">Acceso restringido</p><p style="font-size:0.85rem;">Solo el SuperAdministrador puede gestionar usuarios</p></div>`; 
        return; 
    }
    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando usuarios...</p>';
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${session.token}` } });
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
            const emailTexto = user.email ? `<span style="font-size:0.75rem;color:var(--color-gris);">${user.email}</span>` : '<span style="font-size:0.75rem;color:var(--color-gris);font-style:italic;">Sin correo</span>';
            
            html += `<div class="usuario-item">
                <div class="info">
                    <span class="nombre">${user.username}</span>
                    <span class="rol-tag ${rolClase}">${rolTexto}</span>
                    ${emailTexto}
                </div>
                <div class="acciones">${user.username !== 'Texmadmin' ? `${user.role !== 'admin' ? `<button class="btn-hacer-admin" onclick="cambiarRolUsuario('${user._id}', 'admin')">Hacer admin</button>` : `<button class="btn-quitar-admin" onclick="cambiarRolUsuario('${user._id}', 'user')">Quitar admin</button>`}<button class="btn-eliminar-usuario" onclick="eliminarUsuario('${user._id}')">Eliminar</button>` : '<span style="color:var(--color-gris);font-size:0.75rem;font-weight:500;">Protegido</span>'}</div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (error) { 
        container.innerHTML = '<p style="text-align:center;padding:30px;color:var(--color-gris);">Error al cargar usuarios. <button onclick="renderizarUsuariosAdmin()" class="btn-admin btn-secundario" style="margin-top:10px;">Reintentar</button></p>'; 
    }
}

async function cambiarRolUsuario(userId, nuevoRol) {
    if (!isSuperAdmin()) { 
        mostrarNotificacion('Solo el SuperAdmin', 'error'); 
        return; 
    }
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/users/${userId}/role`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` }, 
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
    if (!isSuperAdmin()) { 
        mostrarNotificacion('Solo el SuperAdmin', 'error'); 
        return; 
    }
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
        const respuesta = await fetch(`${API_URL}/users/${userId}`, { 
            method: 'DELETE', 
            headers: { 'Authorization': `Bearer ${session.token}` } 
        });
        if (!respuesta.ok) throw new Error('Error al eliminar');
        mostrarNotificacion('Usuario eliminado', 'success');
        renderizarUsuariosAdmin();
    } catch (error) { 
        mostrarNotificacion('Error al eliminar usuario', 'error'); 
    }
}

// ============================================
// SUBCATEGORÍAS
// ============================================
async function cargarSubcategoriasAdmin() {
    const container = document.getElementById('admin-subcategorias-lista');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center;padding:20px;">Cargando subcategorías...</p>';
    subcategoriasGlobales = await obtenerSubcategorias();
    
    if (subcategoriasGlobales.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--color-gris);">No hay subcategorías creadas.</p>';
        return;
    }
    
    const termino = document.getElementById('buscador-subcategorias')?.value.toLowerCase().trim() || '';
    const catNombres = { 'hombre': 'Hombre', 'mujer': 'Mujer', 'telas': 'Telas', 'objetos': 'Otros' };
    
    let html = '';
    
    for (const catId of ['hombre', 'mujer', 'telas', 'objetos']) {
        let subs = subcategoriasGlobales.filter(s => s.categoriaPadre === catId);
        if (subs.length === 0) continue;
        
        if (termino) {
            subs = subs.filter(s => (s.nombre || '').toLowerCase().includes(termino));
        }
        
        if (subs.length === 0) continue;
        
        html += `
            <div class="admin-categoria-grupo" style="margin-top: 20px;">
                <h3 class="admin-categoria-titulo" style="font-family: var(--font-serif); font-size: 1.2rem; color: var(--color-naranja); padding-bottom: 8px; border-bottom: 2px solid #EDE8E1; margin-bottom: 12px;">
                    ${catNombres[catId]} <span style="font-size: 0.8rem; color: var(--color-gris);">(${subs.length})</span>
                </h3>
        `;
        
        subs.forEach(sub => {
            html += `
                <div class="admin-producto-item">
                    <div class="info">
                        <div class="info-texto">
                            <span class="nombre">${sub.nombre}</span>
                            <span class="id-producto">ID: ${sub.id}</span>
                        </div>
                    </div>
                    <div class="acciones">
                        <button class="btn-editar" onclick="editarSubcategoriaAdmin('${sub.id}', '${sub.nombre}', '${sub.categoriaPadre}')">Editar</button>
                        <button class="btn-eliminar" onclick="eliminarSubcategoria('${sub.id}')">Eliminar</button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    if (!html) {
        html = '<p style="text-align:center;padding:40px;color:var(--color-gris);">No se encontraron subcategorías.</p>';
    }
    
    container.innerHTML = html;
}

function editarSubcategoriaAdmin(id, nombre, catPadre) {
    document.getElementById('sub-edit-id').value = id;
    document.getElementById('sub-nombre').value = nombre;
    document.getElementById('sub-categoria-padre').value = catPadre;
    document.getElementById('form-sub-title').textContent = 'Editar Subcategoría';
    document.getElementById('form-subcategoria').className = 'form-visible';
}

async function eliminarSubcategoria(id) {
    if (!await confirmar({ 
        titulo: 'Eliminar Subcategoría', 
        mensaje: '¿Seguro? Los productos asociados quedarán sin subcategoría.', 
        tipo: 'peligro', 
        textoAceptar: 'Eliminar' 
    })) return;
    
    try {
        const session = getSession();
        const respuesta = await fetch(`${API_URL}/subcategorias/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        if (!respuesta.ok) throw new Error('Error al eliminar');
        mostrarNotificacion('Subcategoría eliminada', 'success');
        cargarSubcategoriasAdmin();
    } catch (e) { 
        mostrarNotificacion('Error al eliminar', 'error'); 
    }
}

function actualizarSubcategoriasForm() {
    const cat = document.getElementById('prod-categoria').value;
    const selectSub = document.getElementById('prod-subcategoria');
    if (!selectSub) return;
    
    selectSub.innerHTML = '<option value="">-- Sin subcategoría --</option>';
    const filtradas = subcategoriasGlobales.filter(s => s.categoriaPadre === cat);
    
    filtradas.forEach(sub => {
        selectSub.innerHTML += `<option value="${sub.id}">${sub.nombre}</option>`;
    });
}

// ============================================
// FILTROS DE BÚSQUEDA
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
// FIX: el .admin-contenido NUNCA debe scrollear
// ============================================
document.addEventListener('scroll', function(e) {
    const contenedor = document.querySelector('.admin-contenido');
    if (contenedor && contenedor.scrollTop !== 0) {
        contenedor.scrollTop = 0;
    }
}, true);