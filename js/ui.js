// ============================================
// INTERFAZ DE USUARIO (UI) Y RENDERIZADO
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

function bloquearScrollBody(bloquear) {
    return;
}

function hayModalAbierto() {
    const modales = [
        'modal-detalle', 'admin-panel', 'login-modal', 'modal-generico',
        'modal-bienvenida', 'modal-pedido', 'modal-ayuda-pedido',
        'lightbox', 'modal-confirmar'
    ];
    
    for (const id of modales) {
        const el = document.getElementById(id);
        if (!el) continue;
        const clase = el.className || '';
        if (clase.includes('visible') || clase.includes('login-visible') || clase.includes('admin-visible') || clase.includes('confirmar-visible')) {
            return true;
        }
    }
    return false;
}

function restaurarScrollSiEsNecesario() {
    return;
}

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

        const cerrar = (resultado) => {
            modal.className = 'confirmar-oculto';
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

function obtenerTallasDelProductoActual() {
    const producto = obtenerProductoPorNombre(productoPedidoActual);
    return producto?.tallasDisponibles || [];
}

function obtenerTipoTallasDelProductoActual() {
    const producto = obtenerProductoPorNombre(productoPedidoActual);
    return producto?.tipoTallas || 'alfabeticas';
}

// RENDERIZADO
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
                        ?  `<span class="tachado">${producto.precio.toFixed(2)} CUP</span>
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

// MODAL DETALLE
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

    const modal = document.getElementById('modal-detalle');
    const modalBody = document.getElementById('modal-body');

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
    document.body.classList.add('modal-abierto');
    scrollModalAlTop(modal);

    // ✅ ENLAZAMOS EL BOTÓN DE CERRAR MODAL AQUÍ MISMO
    document.getElementById('modal-cerrar').onclick = cerrarModal;
    document.getElementById('modal-overlay').onclick = cerrarModal;
}

function cerrarModal() {
    const modal = document.getElementById('modal-detalle');
    if (modal) modal.className = 'modal-oculto';
    document.body.classList.remove('modal-abierto');
}

// LIGHTBOX
function abrirLightbox(src, alt) {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    const lightboxImg = document.getElementById('lightbox-img');
    lightboxImg.src = src;
    lightboxImg.alt = alt || 'Imagen ampliada';
    lightbox.className = 'lightbox-visible';
    document.body.classList.add('lightbox-abierto');
}

function cerrarLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.className = 'lightbox-oculto';
    document.body.classList.remove('lightbox-abierto');
}

// VARIANTES
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

// PEDIDOS
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
    
    setTimeout(() => {
        if (formPedido) formPedido.scrollTop = 0;
        if (contenedorPedido) contenedorPedido.scrollTop = 0;
    }, 50);
    
    inicializarVariantes();

    const cerrar = () => {
        modalPedido.className = 'login-oculto';
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
        if (formPedido) formPedido.reset();
        productoPedidoActual = '';
    }, 2000);
}

// MODALES BIENVENIDA Y GENÉRICO
function mostrarModalBienvenida() {
    const modal = document.getElementById('modal-bienvenida');
    if (!modal) return;
    void modal.offsetHeight;
    modal.className = 'bienvenida-visible';
    document.body.classList.add('bienvenida-abierta');
    scrollModalAlTop(modal);
}

function cerrarModalBienvenida() {
    const modal = document.getElementById('modal-bienvenida');
    if (!modal) return;
    modal.className = 'bienvenida-oculto';
    document.body.classList.remove('bienvenida-abierta');
}

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
    scrollModalAlTop(modal);

    const cerrarModal = () => {
        modal.className = 'login-oculto';
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

// EVENTOS DE AYUDA
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
});