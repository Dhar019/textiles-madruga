// ============================================
// LÓGICA DEL PANEL DE ADMINISTRACIÓN
// ============================================

function iniciarVerificadorSesion() {
    detenerVerificadorSesion();
    const s = getSession();
    if (!s || !s.token) return;

    verificadorSesion = setInterval(async () => {
        const sa = getSession();
        if (!sa) {
            detenerVerificadorSesion();
            return;
        }
        try {
            const r = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${sa.token}` } });
            if (r.status === 401 || r.status === 403) {
                detenerVerificadorSesion();
                mostrarNotificacion('Sesión cerrada en otro dispositivo', 'warning');
                logout();
            }
        } catch (e) {
            console.warn('⚠️ Error verificando sesión:', e.message);
        }
    }, 60000);
}

function detenerVerificadorSesion() {
    if (verificadorSesion) {
        clearInterval(verificadorSesion);
        verificadorSesion = null;
    }
}

function reiniciarTemporizadorInactividad() {
    if (!isLoggedIn()) return;
    actualizarActividad();
    const p = obtenerPoliticaSeguridad();
    detenerTemporizadorInactividad();
    detenerTemporizadorAviso();

    const tAviso = p.inactividadMs - p.avisoPrevioMs;
    if (tAviso > 0) {
        temporizadorAviso = setTimeout(() => {
            const segs = Math.floor(p.avisoPrevioMs / 1000);
            mostrarNotificacion(`Tu sesión expirará en ${Math.floor(segs / 60)}m ${segs % 60}s`, 'warning');
        }, tAviso);
    }

    temporizadorInactividad = setTimeout(() => {
        mostrarNotificacion('Sesión cerrada por inactividad', 'info');
        logout();
    }, p.inactividadMs);
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

// --- CONTROL DE VISTAS DEL ADMIN ---
function mostrarLogin() {
    const m = document.getElementById('login-modal');
    if (m) {
        m.className = 'login-visible';
        scrollModalAlTop(m);
    }
}

function cerrarLogin() {
    const m = document.getElementById('login-modal');
    if (m) m.className = 'login-oculto';
}

function abrirAdmin() {
    if (!protegerAdmin()) return;
    const p = document.getElementById('admin-panel');
    p.className = 'admin-visible';
    document.body.classList.add('admin-abierto');
    cargarAdminProductos();
    reiniciarTemporizadorInactividad();
    iniciarVerificadorSesion();
    cargarPedidosAdmin();
    scrollModalAlTop(p);
}

function cerrarAdmin() {
    const p = document.getElementById('admin-panel');
    p.className = 'admin-oculto';
    document.body.classList.remove('admin-abierto');
    const f = document.getElementById('form-producto');
    if (f) f.className = 'form-oculto';
}

function cargarAdminProductos() {
    if (!datosGlobales) return;
    adminDatos = JSON.parse(JSON.stringify(datosGlobales));
    renderizarAdminProductos();
    cargarOfertasAdmin();
    renderizarUsuariosAdmin();
}

// --- RENDERIZADO DE PRODUCTOS EN ADMIN ---
function renderizarAdminProductos() {
    if (!adminDatos) return;
    const lista = document.getElementById('admin-productos-lista');
    if (!lista) return;

    let html = '';
    const catNombres = { 'hombre': 'Hombre', 'mujer': 'Mujer', 'telas': 'Telas', 'objetos': 'Otros' };

    for (const cat of ['hombre', 'mujer', 'telas', 'objetos']) {
        const prods = adminDatos.productos[cat] || [];
        prods.forEach(p => {
            const enOferta = p.enOferta || false;
            const id = p.id || p._id || 'sin-id';
            const desc = p.descripcion || 'Sin descripción';
            let tallasInfo = p.tipoTallas === 'sin_tallas' ? '<span style="font-size:0.7rem;color:var(--color-gris);">Sin tallas</span>' : 
                (p.tallasDisponibles?.length > 0 ? `<span style="font-size:0.7rem;color:var(--color-gris);">Tallas: ${p.tallasDisponibles.join(', ')}</span>` : '<span style="font-size:0.7rem;color:#C0392B;">Sin tallas config.</span>');

            html += `
                <div class="admin-producto-item" data-id="${id}" data-categoria="${cat}">
                    <div class="info">
                        <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='assets/img/placeholder.webp';">
                        <div class="info-texto">
                            <span class="nombre">${p.nombre}</span>
                            <span class="descripcion">${desc.substring(0, 60)}${desc.length > 60 ? '...' : ''}</span>
                            <span class="id-producto">ID: ${id}</span>
                            ${tallasInfo}
                        </div>
                        <span class="precio">${p.precio.toFixed(2)} CUP</span>
                        <span class="categoria-tag">${catNombres[cat]}</span>
                        ${enOferta ? '<span style="background:#E87A20;color:white;padding:2px 12px;border-radius:50px;font-size:0.7rem;font-weight:600;">OFERTA</span>' : ''}
                    </div>
                    <div class="acciones">
                        <button class="btn-oferta ${enOferta ? 'activo' : ''}" onclick="toggleOfertaAdmin('${id}')">${enOferta ? 'Quitar oferta' : 'Oferta'}</button>
                        <button class="btn-editar" onclick="editarProductoAdmin('${id}')">Editar</button>
                        <button class="btn-eliminar" onclick="eliminarProductoAdmin('${id}')">Eliminar</button>
                    </div>
                </div>
            `;
        });
    }
    lista.innerHTML = html;
}

async function toggleOfertaAdmin(id) {
    const p = obtenerProductoPorId(id, adminDatos); 
    if (!p) return;
    try {
        const s = getSession();
        const r = await fetch(`${API_URL}/offers/toggle/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.token}` },
            body: JSON.stringify({ enOferta: !p.enOferta, tipoOferta: p.tipoOferta || 'descuento', descuento: p.descuento || 15, promocion: p.promocion || '' })
        });
        if (!r.ok) throw new Error();
        mostrarNotificacion(!p.enOferta ? 'Añadido a ofertas' : 'Quitado de ofertas', 'success');
        const datos = await cargarProductos();
        if (datos) { 
            datosGlobales = datos; 
            adminDatos = JSON.parse(JSON.stringify(datos)); 
            renderizarAdminProductos(); 
            cargarOfertasAdmin();
            renderizarOfertas(datos.ofertas, datos); 
        }
    } catch { mostrarNotificacion('Error al actualizar oferta', 'error'); }
}

async function eliminarProductoAdmin(id) {
    if (!await confirmar({ titulo: 'Eliminar producto', mensaje: '¿Seguro que quieres eliminarlo?', tipo: 'peligro', textoAceptar: 'Eliminar' })) return;
    try {
        const s = getSession();
        const r = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${s.token}` } });
        if (!r.ok) throw new Error();
        mostrarNotificacion('Producto eliminado', 'success');
        const datos = await cargarProductos();
        if (datos) { 
            datosGlobales = datos; 
            adminDatos = JSON.parse(JSON.stringify(datos)); 
            renderizarAdminProductos(); 
            cargarOfertasAdmin();
            renderizarOfertas(datos.ofertas, datos); 
        }
    } catch { mostrarNotificacion('Error al eliminar', 'error'); }
}

function cambiarTipoTallas(tipo) {
    const alfa = document.getElementById('tallas-alfabeticas'); 
    const num = document.getElementById('tallas-numericas'); 
    const sin = document.getElementById('tallas-sin');
    if (!alfa || !num || !sin) return;
    
    alfa.style.display = 'none'; num.style.display = 'none'; sin.style.display = 'none';
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    
    if (tipo === 'alfabeticas') alfa.style.display = 'flex'; 
    else if (tipo === 'numericas') num.style.display = 'flex'; 
    else sin.style.display = 'flex';
}

function cargarTallasProducto(p) {
    document.querySelectorAll('input[name="tipo-tallas"]').forEach(r => r.checked = false);
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    
    const tipo = p.tipoTallas || 'alfabeticas'; 
    const disp = p.tallasDisponibles || [];
    const radio = document.querySelector(`input[name="tipo-tallas"][value="${tipo}"]`); 
    if (radio) radio.checked = true;
    
    cambiarTipoTallas(tipo);
    if (tipo !== 'sin_tallas') {
        document.querySelectorAll('.talla-checkbox').forEach(cb => { 
            if (disp.includes(cb.value)) cb.checked = true; 
        });
    }
}

function obtenerTallasSeleccionadas() {
    const tipo = document.querySelector('input[name="tipo-tallas"]:checked')?.value || 'alfabeticas';
    if (tipo === 'sin_tallas') return { tipoTallas: 'sin_tallas', tallasDisponibles: [] };
    const tallas = []; 
    document.querySelectorAll('.talla-checkbox:checked').forEach(cb => tallas.push(cb.value));
    return { tipoTallas: tipo, tallasDisponibles: tallas };
}

function resetearTallasForm() {
    document.querySelectorAll('input[name="tipo-tallas"]').forEach(r => r.checked = false);
    const def = document.querySelector('input[name="tipo-tallas"][value="alfabeticas"]'); 
    if (def) def.checked = true;
    document.querySelectorAll('.talla-checkbox').forEach(cb => cb.checked = false);
    cambiarTipoTallas('alfabeticas');
}

function editarProductoAdmin(id) {
    modoEdicion = id;
    const p = obtenerProductoPorId(id, adminDatos);
    if (!p) { mostrarNotificacion('Producto no encontrado', 'error'); return; }
    
    document.getElementById('prod-nombre').value = p.nombre || '';
    document.getElementById('prod-precio').value = p.precio || '';
    document.getElementById('prod-imagen').value = p.imagen || '';
    document.getElementById('prod-descripcion').value = p.descripcion || '';
    document.getElementById('prod-id').value = p.id || p._id || 'sin-id';
    
    for (const cat of ['hombre', 'mujer', 'telas', 'objetos']) { 
        if (adminDatos.productos[cat]?.some(x => String(x._id) === String(id) || String(x.id) === String(id))) { 
            document.getElementById('prod-categoria').value = cat; break; 
        } 
    }
    cargarTallasProducto(p);
    
    const prev = document.getElementById('drop-zone-preview'); 
    const cont = document.getElementById('drop-zone-content');
    if (p.imagen && prev && cont) { 
        prev.src = p.imagen; prev.style.display = 'block'; cont.style.display = 'none'; 
    } else if (prev && cont) { 
        prev.style.display = 'none'; prev.src = ''; cont.style.display = 'flex'; 
    }
    
    const form = document.getElementById('form-producto');
    form.className = 'form-visible';
    document.querySelector('#producto-form button[type="submit"]').textContent = 'Actualizar';
    document.getElementById('form-title').textContent = 'Editar Producto';
    form.scrollIntoView({ behavior: 'smooth' });
}

// --- GESTIÓN DE PEDIDOS ---
async function cargarPedidosAdmin() {
    const cont = document.getElementById('lista-pedidos-admin'); 
    if (!cont) return;
    cont.innerHTML = '<p style="text-align:center;padding:40px;">Cargando pedidos...</p>';
    
    try {
        const s = getSession(); 
        if (!s) return;
        const r = await fetch(`${API_URL}/pedidos`, { headers: { 'Authorization': `Bearer ${s.token}` } });
        if (!r.ok) throw new Error();
        const data = await r.json();
        pedidosGlobales = data.pedidos || [];
        actualizarBadgePedidos(); 
        renderizarPedidosAdmin();
    } catch { 
        cont.innerHTML = '<p style="text-align:center;padding:40px;">Error al cargar pedidos.</p>'; 
    }
}

function actualizarBadgePedidos() {
    const badge = document.getElementById('pedidos-badge'); 
    if (!badge) return;
    const pend = pedidosGlobales.filter(p => p.estado === 'pendiente').length;
    if (pend > 0) { badge.textContent = pend; badge.style.display = 'inline-block'; } 
    else badge.style.display = 'none';
}

function renderizarPedidosAdmin() {
    const cont = document.getElementById('lista-pedidos-admin'); 
    if (!cont) return;
    
    let filtrados = pedidosGlobales;
    if (filtroPedidoActual !== 'todos') filtrados = pedidosGlobales.filter(p => p.estado === filtroPedidoActual);
    
    if (filtrados.length === 0) { 
        cont.innerHTML = '<div class="pedidos-vacio"><span class="icono">📭</span><p>No hay pedidos.</p></div>'; 
        return; 
    }

    const viaTexto = { 'whatsapp': { icono: '📱', nombre: 'WhatsApp' }, 'email': { icono: '✉️', nombre: 'Gmail' }, 'solo_aqui': { icono: '📝', nombre: 'Solo aquí' } };
    const estadoTexto = { 'pendiente': 'Pendiente', 'atendido': 'Atendido', 'completado': 'Completado', 'cancelado': 'Cancelado' };

    let html = '';
    filtrados.forEach(pedido => {
        const via = viaTexto[pedido.via] || { icono: '❓', nombre: pedido.via };
        const fecha = new Date(pedido.fecha).toLocaleString('es-CU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        let tallasHTML = '';
        if (pedido.variantes?.length > 0) {
            tallasHTML = `<div class="pedido-dato" style="grid-column: 1 / -1;"><strong>Tallas:</strong> <span>${pedido.variantes.map(v => v.talla === 'UNICA' ? `${v.cantidad}x` : `${v.cantidad}x talla ${v.talla}`).join(' · ')}</span></div>`;
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
                    <div class="pedido-dato"><strong>Cliente:</strong> <span>${pedido.nombre}</span></div>
                    <div class="pedido-dato"><strong>Teléfono:</strong> <span>${pedido.telefono || pedido.contacto || 'N/A'}</span></div>
                    ${pedido.email ? `<div class="pedido-dato"><strong>Gmail:</strong> <span>${pedido.email}</span></div>` : ''}
                    <div class="pedido-dato"><strong>Cantidad:</strong> <span>${pedido.cantidad}</span></div>
                    ${tallasHTML}
                    <div class="pedido-dato"><strong>Entrega:</strong> <span>${pedido.tipoEntrega === 'domicilio' ? '🏠 A domicilio' : '🏪 Recoger en tienda'}</span></div>
                    ${pedido.direccion ? `<div class="pedido-dato"><strong>Dirección:</strong> <span>${pedido.direccion}</span></div>` : ''}
                    ${pedido.municipio ? `<div class="pedido-dato"><strong>Municipio:</strong> <span>${pedido.municipio}</span></div>` : ''}
                    <div class="pedido-dato"><strong>Pago:</strong> <span>${pedido.metodoPago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}</span></div>
                    <div class="pedido-dato"><strong>Fecha:</strong> <span>${fecha}</span></div>
                </div>
                ${pedido.notas ? `<div class="pedido-notas">📝 ${pedido.notas}</div>` : ''}
                <div class="pedido-acciones">
                    ${pedido.estado === 'pendiente' ? `<button class="btn-pedido btn-atender" onclick="cambiarEstadoPedido('${pedido.id}', 'atendido')">📞 Marcar atendido</button>` : ''}
                    ${pedido.estado === 'atendido' ? `<button class="btn-pedido btn-completar" onclick="cambiarEstadoPedido('${pedido.id}', 'completado')">✅ Completar</button>` : ''}
                    ${pedido.estado !== 'cancelado' && pedido.estado !== 'completado' ? `<button class="btn-pedido btn-cancelar" onclick="cambiarEstadoPedido('${pedido.id}', 'cancelado')">✕ Cancelar</button>` : ''}
                    ${pedido.estado === 'completado' ? `<button class="btn-pedido btn-atender" onclick="cambiarEstadoPedido('${pedido.id}', 'pendiente')">↺ Reabrir</button>` : ''}
                    <button class="btn-pedido btn-eliminar" onclick="eliminarPedidoAdmin('${pedido.id}')">🗑 Eliminar</button>
                </div>
            </div>
        `;
    });
    cont.innerHTML = html;
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
        const s = getSession();
        const r = await fetch(`${API_URL}/pedidos/${pedidoId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.token}` },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        if (!r.ok) throw new Error();
        mostrarNotificacion(`Pedido marcado como ${nuevoEstado}`, 'success');
        await cargarPedidosAdmin();
    } catch { mostrarNotificacion('Error al cambiar estado', 'error'); }
}

async function eliminarPedidoAdmin(pedidoId) {
    if (!await confirmar({ titulo: 'Eliminar pedido', mensaje: '¿Seguro?', tipo: 'peligro', textoAceptar: 'Eliminar' })) return;
    try {
        const s = getSession();
        const r = await fetch(`${API_URL}/pedidos/${pedidoId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${s.token}` } });
        if (!r.ok) throw new Error();
        mostrarNotificacion('Pedido eliminado', 'success');
        await cargarPedidosAdmin();
    } catch { mostrarNotificacion('Error al eliminar pedido', 'error'); }
}

function filtrarPedidosAdmin(termino) {
    termino = termino.toLowerCase().trim();
    document.querySelectorAll('#lista-pedidos-admin .pedido-item').forEach(item => {
        const nombre = item.querySelector('.pedido-dato:nth-child(1) span')?.textContent.toLowerCase() || '';
        const tel = item.querySelector('.pedido-dato:nth-child(2) span')?.textContent.toLowerCase() || '';
        const prod = item.querySelector('.pedido-producto')?.textContent.toLowerCase() || '';
        item.style.display = (nombre.includes(termino) || tel.includes(termino) || prod.includes(termino)) ? 'block' : 'none';
    });
}

// --- GESTIÓN DE OFERTAS ---
async function cargarOfertasAdmin() {
    const container = document.getElementById('lista-ofertas-admin');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando ofertas...</p>';

    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        if (!respuesta.ok) throw new Error('Error');
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

            html += `
                <div class="oferta-editar-item" data-id="${id}">
                    <div class="oferta-card-producto">
                        <img src="${imagen}" alt="${producto.nombre}" class="oferta-card-img" onerror="this.src='assets/img/placeholder.webp';">
                        <div class="oferta-card-info">
                            <span class="oferta-card-nombre">${producto.nombre}</span>
                            <span class="oferta-card-descripcion">${descripcion.substring(0, 80)}${descripcion.length > 80 ? '...' : ''}</span>
                            <span class="oferta-card-categoria">${categoria}</span>
                            <span class="oferta-card-id">ID: ${id}</span>
                        </div>
                    </div>
                    <div class="oferta-card-precios">
                        <span class="oferta-card-precio-original">${producto.precio.toFixed(2)} CUP</span>
                        ${descuento > 0 ? `<span class="oferta-card-precio-oferta">${precioOferta.toFixed(2)} CUP</span>` : ''}
                    </div>
                    <div class="oferta-card-edicion">
                        <div class="campo">
                            <label>Tipo de oferta</label>
                            <select id="tipo-${id}" class="oferta-select" onchange="toggleDescuentoInput('${id}')">
                                <option value="descuento" ${tipoOferta === 'descuento' ? 'selected' : ''}>Descuento</option>
                                <option value="2x1" ${tipoOferta === '2x1' ? 'selected' : ''}>Lleva 2, paga 1</option>
                                <option value="3x2" ${tipoOferta === '3x2' ? 'selected' : ''}>Lleva 3, paga 2</option>
                                <option value="personalizado" ${tipoOferta === 'personalizado' ? 'selected' : ''}>Personalizado</option>
                            </select>
                        </div>
                        <div class="campo">
                            <label>Descuento (%)</label>
                            <input type="number" id="descuento-${id}" value="${descuento}" min="0" max="100" onkeydown="if(event.key==='Enter'){event.preventDefault();guardarOferta('${id}');}">
                        </div>
                        <div class="campo">
                            <label>Promoción (texto)</label>
                            <input type="text" id="promocion-${id}" value="${promocion}" placeholder="Ej: Envío gratis..." onkeydown="if(event.key==='Enter'){event.preventDefault();guardarOferta('${id}');}">
                        </div>
                        <button class="btn-admin btn-primario btn-guardar-oferta" onclick="guardarOferta('${id}')">💾 Guardar</button>
                        <button class="btn-admin btn-peligro" onclick="quitarOferta('${id}')">🗑 Quitar</button>
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
        descuentoEl.disabled = false; descuentoEl.style.opacity = '1'; descuentoEl.style.cursor = 'text';
        promocionEl.disabled = true; promocionEl.style.opacity = '0.4'; promocionEl.style.cursor = 'not-allowed'; promocionEl.value = '';
    } else if (tipo === 'personalizado') {
        descuentoEl.disabled = false; descuentoEl.style.opacity = '1'; descuentoEl.style.cursor = 'text';
        promocionEl.disabled = false; promocionEl.style.opacity = '1'; promocionEl.style.cursor = 'text';
    } else {
        descuentoEl.disabled = true; descuentoEl.style.opacity = '0.4'; descuentoEl.style.cursor = 'not-allowed'; descuentoEl.value = 0;
        promocionEl.disabled = true; promocionEl.style.opacity = '0.4'; promocionEl.style.cursor = 'not-allowed'; promocionEl.value = '';
    }
}

async function guardarOferta(id) {
    const tipo = document.getElementById(`tipo-${id}`).value;
    const desc = parseInt(document.getElementById(`descuento-${id}`).value) || 0;
    const promo = document.getElementById(`promocion-${id}`).value.trim();

    if (tipo === 'descuento' && (desc <= 0 || desc > 100)) { mostrarNotificacion('Descuento entre 1 y 100', 'error'); return; }
    if (tipo === 'personalizado' && (!desc || !promo)) { mostrarNotificacion('Completa descuento y texto', 'error'); return; }

    try {
        const s = getSession();
        const r = await fetch(`${API_URL}/offers/toggle/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.token}` },
            body: JSON.stringify({ enOferta: true, tipoOferta: tipo, descuento: desc, promocion: promo })
        });
        if (!r.ok) throw new Error();
        mostrarNotificacion('Oferta guardada', 'success');
        const datos = await cargarProductos();
        if (datos) { 
            datosGlobales = datos; adminDatos = JSON.parse(JSON.stringify(datos)); 
            renderizarAdminProductos(); cargarOfertasAdmin(); renderizarOfertas(datos.ofertas, datos); 
        }
    } catch { mostrarNotificacion('Error al guardar oferta', 'error'); }
}

async function quitarOferta(productoId) {
    if (!await confirmar({ titulo: 'Quitar oferta', mensaje: 'El producto dejará de estar en oferta.', tipo: 'info', textoAceptar: 'Quitar' })) return;
    try {
        const s = getSession();
        await fetch(`${API_URL}/offers/toggle/${productoId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.token}` },
            body: JSON.stringify({ enOferta: false })
        });
        mostrarNotificacion('Oferta eliminada', 'success');
        cargarOfertasAdmin();
    } catch { mostrarNotificacion('Error al quitar oferta', 'error'); }
}

// --- GESTIÓN DE USUARIOS ---
async function renderizarUsuariosAdmin() {
    const container = document.getElementById('admin-usuarios-lista');
    if (!container) return;
    if (!isSuperAdmin()) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--color-gris);background:white;border-radius:12px;"><p style="font-weight:600;">Acceso restringido</p><p>Solo el SuperAdmin puede gestionar usuarios.</p></div>';
        return;
    }
    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-gris);">Cargando usuarios...</p>';

    try {
        const s = getSession();
        const r = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${s.token}` } });
        if (!r.ok) throw new Error();
        const users = await r.json();

        if (users.length === 0) { container.innerHTML = '<p style="text-align:center;padding:30px;">No hay usuarios.</p>'; return; }

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
                            ${user.role !== 'admin' ? `<button class="btn-hacer-admin" onclick="cambiarRolUsuario('${user._id}', 'admin')">Hacer admin</button>` : `<button class="btn-quitar-admin" onclick="cambiarRolUsuario('${user._id}', 'user')">Quitar admin</button>`}
                            <button class="btn-eliminar-usuario" onclick="eliminarUsuario('${user._id}')">Eliminar</button>
                        ` : '<span style="color:var(--color-gris);font-size:0.75rem;font-weight:500;">Protegido</span>'}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch { container.innerHTML = '<p style="text-align:center;padding:30px;">Error al cargar usuarios.</p>'; }
}

async function cambiarRolUsuario(userId, nuevoRol) {
    if (!isSuperAdmin()) return;
    try {
        const s = getSession();
        const r = await fetch(`${API_URL}/users/${userId}/role`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.token}` },
            body: JSON.stringify({ role: nuevoRol })
        });
        if (!r.ok) throw new Error();
        mostrarNotificacion('Rol actualizado', 'success');
        renderizarUsuariosAdmin();
    } catch { mostrarNotificacion('Error al actualizar rol', 'error'); }
}

async function eliminarUsuario(userId) {
    if (!isSuperAdmin()) return;
    if (!await confirmar({ titulo: 'Eliminar usuario', mensaje: '¿Seguro? Perderá acceso inmediatamente.', tipo: 'peligro', textoAceptar: 'Eliminar' })) return;
    try {
        const s = getSession();
        await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${s.token}` } });
        mostrarNotificacion('Usuario eliminado', 'success');
        renderizarUsuariosAdmin();
    } catch { mostrarNotificacion('Error al eliminar usuario', 'error'); }
}

// --- FILTROS DE BÚSQUEDA DEL ADMIN ---
function filtrarProductosAdmin(termino) {
    termino = termino.toLowerCase();
    document.querySelectorAll('#admin-productos-lista .admin-producto-item').forEach(item => {
        const nombre = item.querySelector('.nombre')?.textContent.toLowerCase() || '';
        item.style.display = nombre.includes(termino) ? 'flex' : 'none';
    });
}

function filtrarOfertasAdmin(termino) {
    termino = termino.toLowerCase();
    document.querySelectorAll('#lista-ofertas-admin .oferta-editar-item').forEach(item => {
        const nombre = item.querySelector('.oferta-card-nombre')?.textContent.toLowerCase() || '';
        item.style.display = nombre.includes(termino) ? 'flex' : 'none';
    });
}

function filtrarUsuariosAdmin(termino) {
    termino = termino.toLowerCase();
    document.querySelectorAll('#admin-usuarios-lista .usuario-item').forEach(item => {
        const nombre = item.querySelector('.nombre')?.textContent.toLowerCase() || '';
        item.style.display = nombre.includes(termino) ? 'flex' : 'none';
    });
}

// --- LISTENERS ESPECÍFICOS DEL ADMIN ---
document.addEventListener('DOMContentLoaded', function() {
    // Tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const content = document.getElementById(`tab-${tabName}`);
            if (content) content.classList.add('active');
            
            if (tabName === 'ofertas') cargarOfertasAdmin();
            else if (tabName === 'seguridad') renderizarUsuariosAdmin();
            else if (tabName === 'productos') renderizarAdminProductos();
            else if (tabName === 'pedidos') cargarPedidosAdmin();
        });
    });

    // Formulario Producto (Submit)
    document.getElementById('producto-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nombre = document.getElementById('prod-nombre').value.trim();
        const precio = parseFloat(document.getElementById('prod-precio').value);
        let imagen = document.getElementById('prod-imagen').value.trim();
        const categoria = document.getElementById('prod-categoria').value;
        const descripcion = document.getElementById('prod-descripcion').value.trim();
        let idEditable = document.getElementById('prod-id').value.trim();
        if (idEditable === 'sin-id') idEditable = '';

        if (!nombre || !precio) { mostrarNotificacion('Completa nombre y precio', 'error'); return; }
        const { tipoTallas, tallasDisponibles } = obtenerTallasSeleccionadas();
        if (tipoTallas !== 'sin_tallas' && tallasDisponibles.length === 0) { mostrarNotificacion('Selecciona al menos una talla o "Sin tallas"', 'error'); return; }
        if (!imagen) imagen = 'assets/img/placeholder.webp';

        const s = getSession();
        if (!s) return;

        try {
            const data = { nombre, precio, imagen, categoria, descripcion, tipoTallas, tallasDisponibles };
            if (idEditable && !modoEdicion) data.id = idEditable;

            const url = modoEdicion ? `${API_URL}/products/${modoEdicion}` : `${API_URL}/products`;
            const method = modoEdicion ? 'PUT' : 'POST';
            const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.token}` }, body: JSON.stringify(data) });
            if (!r.ok) throw new Error();

            modoEdicion = null;
            document.getElementById('form-producto').className = 'form-oculto';
            this.reset(); resetearTallasForm();
            document.getElementById('prod-id').value = '';
            document.querySelector('#producto-form button[type="submit"]').textContent = 'Crear';
            document.getElementById('form-title').textContent = 'Nuevo Producto';
            
            mostrarNotificacion('Producto guardado', 'success');
            const datos = await cargarProductos();
            if (datos) { 
                datosGlobales = datos; adminDatos = JSON.parse(JSON.stringify(datos)); 
                cargarAdminProductos(); renderizarOfertas(datos.ofertas, datos); 
            }
        } catch { mostrarNotificacion('Error al guardar producto', 'error'); }
    });

    // Botones de Formulario
    document.getElementById('btn-cancelar-form')?.addEventListener('click', function() {
        document.getElementById('form-producto').className = 'form-oculto';
        modoEdicion = null;
        document.getElementById('producto-form').reset();
        resetearTallasForm();
        const p = document.getElementById('drop-zone-preview'); const c = document.getElementById('drop-zone-content');
        if (p && c) { p.style.display = 'none'; p.src = ''; c.style.display = 'flex'; }
    });

    document.getElementById('btn-nuevo-producto')?.addEventListener('click', function() {
        modoEdicion = null;
        document.getElementById('producto-form').reset();
        document.getElementById('prod-id').value = '';
        resetearTallasForm();
        const p = document.getElementById('drop-zone-preview'); const c = document.getElementById('drop-zone-content');
        if (p && c) { p.style.display = 'none'; p.src = ''; c.style.display = 'flex'; }
        document.getElementById('form-producto').className = 'form-visible';
        document.querySelector('#producto-form button[type="submit"]').textContent = 'Crear';
        document.getElementById('form-title').textContent = 'Nuevo Producto';
    });

    // Cierre del Admin
    document.getElementById('admin-cerrar')?.addEventListener('click', cerrarAdmin);
    document.getElementById('admin-overlay')?.addEventListener('click', cerrarAdmin);

    // Botón Nuevo Usuario
    document.getElementById('btn-nuevo-usuario')?.addEventListener('click', function() {
        if (!isSuperAdmin()) return;
        abrirModalGenerico({
            titulo: 'Nuevo Usuario', subtitulo: 'Crea una cuenta',
            campos: [
                { id: 'username', label: 'Usuario', type: 'text', required: true },
                { id: 'password', label: 'Contraseña', type: 'password', required: true },
                { id: 'email', label: 'Gmail', type: 'email' },
                { id: 'role', label: 'Rol', type: 'select', opciones: [{ value: 'user', label: 'Usuario' }, { value: 'admin', label: 'Administrador' }] }
            ],
            onSubmit: async (datos) => {
                if (datos.username.length < 3 || datos.password.length < 6) { mostrarNotificacion('Datos inválidos', 'error'); return false; }
                try {
                    const s = getSession();
                    const r = await fetch(`${API_URL}/auth/register`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.token}` },
                        body: JSON.stringify({ ...datos, name: datos.username })
                    });
                    if (!r.ok) throw new Error();
                    mostrarNotificacion(`Usuario "${datos.username}" creado`, 'success');
                    renderizarUsuariosAdmin();
                } catch { mostrarNotificacion('Error al crear usuario', 'error'); return false; }
            }
        });
    });
});