/**
 * ========================================
 * SPEED MASTER MADRID - Sistema de Gestión v2
 * ========================================
 */

(function () {
    'use strict';

    // ==================== PRECIO OPTIONS PER AVERÍA ====================
    const AVERIA_PRICES = {
        'Cambio cámara de aire': ['6.00', '7.00', '8.00', '11.00', 'Otro'],
        'Rueda': ['30.00', '45.00', '60.00', '80.00', 'Otro'],
        'Display': ['25.00', '40.00', '60.00', '90.00', 'Otro'],
        'Cable': ['10.00', '15.00', '20.00', 'Otro'],
        'Cambio de frenos': ['20.00', '30.00', '40.00', 'Otro'],
        'Mano de obra': ['15.00', '20.00', '25.00', '30.00', 'Otro'],
    };

    // ==================== STATUS CONFIG ====================
    const STATUS_CONFIG = {
        'RECIBIDO': { badgeClass: 'badge badge-recibido', label: 'Recibido' },
        'PENDIENTE': { badgeClass: 'badge badge-pending', label: 'Pendiente' },
        'REPARANDO': { badgeClass: 'badge badge-process', label: 'Reparando' },
        'FINALIZADO': { badgeClass: 'badge badge-finished', label: 'Finalizado' },
        'PAGADO': { badgeClass: 'id-paid', label: 'PAGADO' }
    };

    // ==================== STATE ====================
    let state = {
        activeOTP: null,
        orders: [],
        averiaItems: [], // [{name, price, showCustom}]
        lastTicketNumber: parseInt(localStorage.getItem('repara_shisha_last_ticket')) || 2000,
        editingDocId: null,
        statusFilter: null
    };

    // ==================== UTILITIES ====================

    function sanitizeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatPrice(value) {
        const num = parseFloat(value) || 0;
        return num.toFixed(2) + ' €';
    }

    function validatePhone(phone) {
        return /^[0-9]{9}$/.test(phone);
    }

    function notify(message, type = 'info') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span> ${message}`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ==================== PAGE NAVIGATION ====================

    function showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

        const pageEl = document.getElementById(page === 'orden' ? 'pageOrden' : 'pageClientes');
        const tabEl = document.getElementById(page === 'orden' ? 'tabOrden' : 'tabClientes');
        if (pageEl) pageEl.classList.add('active');
        if (tabEl) tabEl.classList.add('active');
    }

    // ==================== AVERÍA MANAGEMENT ====================
    const DEFAULT_AVERIAS = ['Cambio cámara de aire', 'Rueda', 'Display', 'Cable', 'Cambio de frenos', 'Mano de obra'];

    function toggleAveria(name) {
        const idx = state.averiaItems.findIndex(i => i.name === name);
        if (idx >= 0) {
            // Si ya está seleccionado, al pulsar el texto lo deseleccionamos (toggle)
            state.averiaItems.splice(idx, 1);
        } else {
            // Select: Modo Manual (precio vacío al inicio)
            state.averiaItems.push({ name, price: '', showCustom: false });
        }
        syncPrecioField();
    }

    function addAveriaLibre() {
        const input = document.getElementById('averiaLibre');
        const name = input.value.trim();
        if (!name) { notify('Escribe una avería primero', 'error'); return; }
        if (state.averiaItems.find(i => i.name === name)) { notify('Ya está en la lista', 'error'); return; }
        state.averiaItems.push({ name, price: '', showCustom: false });
        input.value = '';
        syncPrecioField();
    }

    function removeAveriaItem(name) {
        const idx = state.averiaItems.findIndex(i => i.name === name);
        if (idx >= 0) {
            state.averiaItems.splice(idx, 1);
            syncPrecioField();
        }
    }

    function setPriceForItem(name, value) {
        const idx = state.averiaItems.findIndex(i => i.name === name);
        if (idx < 0) return;

        if (value === 'Otro') {
            state.averiaItems[idx].price = '';
            state.averiaItems[idx].showCustom = true;
        } else {
            state.averiaItems[idx].price = value;
            state.averiaItems[idx].showCustom = false;
        }
        syncPrecioField();
    }

    function setCustomPriceForItem(name, value) {
        const item = state.averiaItems.find(i => i.name === name);
        if (item) {
            item.price = value;
            calcRestante();
            // No refrescamos el UI aquí para no perder el foco del input
        }
    }

    function syncPrecioField() {
        const total = state.averiaItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        const precioInput = document.getElementById('precio');
        if (precioInput) {
            precioInput.value = total > 0 ? total.toFixed(2) : '';
        }
        calcRestante();
        updateAveriaButtonsUI();
    }

    function updateAveriaButtonsUI() {
        const grid = document.getElementById('averiaBtnGrid');
        if (!grid) return;

        // Lista de conceptos: Defaults + los que se hayan añadido manualmente
        const customAverias = state.averiaItems.filter(i => !DEFAULT_AVERIAS.includes(i.name)).map(i => i.name);
        const allAverias = [...DEFAULT_AVERIAS, ...customAverias];

        grid.innerHTML = allAverias.map(name => {
            const item = state.averiaItems.find(i => i.name === name);
            const isSelected = !!item;

            if (!isSelected) {
                return `<div class="averia-btn" onclick="ReparaApp.toggleAveria('${name}')">${name}</div>`;
            }

            // Si está seleccionado, mostrar controles dentro del botón
            const presets = AVERIA_PRICES[name] || ['10.00', '20.00', '30.00', '50.00', 'Otro'];
            let priceControl = '';

            if (item.showCustom) {
                priceControl = `<input class="select-averia-btn" type="number" placeholder="€ precio" value="${item.price}" 
                    onclick="event.stopPropagation()"
                    oninput="ReparaApp.setCustomPriceForItem('${name}', this.value)">`;
            } else {
                const options = presets.map(p =>
                    `<option value="${p}" ${item.price === p ? 'selected' : ''}>${p === 'Otro' ? 'Otro...' : p + ' €'}</option>`
                ).join('');
                priceControl = `<select class="select-averia-btn" onclick="event.stopPropagation()" onchange="ReparaApp.setPriceForItem('${name}', this.value)">
                    <option value="">-- Precio --</option>${options}
                </select>`;
            }

            return `
                <div class="averia-btn selected">
                    <button class="btn-deselect-averia" onclick="event.stopPropagation(); ReparaApp.removeAveriaItem('${name}')" title="Deseleccionar">✕</button>
                    <span class="averia-label" onclick="ReparaApp.toggleAveria('${name}')">${name}</span>
                    ${priceControl}
                </div>
            `;
        }).join('');
    }

    function renderAveriaItems() {
        // Obsoleto: Los items se gestionan en updateAveriaButtonsUI
    }

    // ==================== FINANCIAL ====================

    function calcRestante() {
        const pVal = document.getElementById('precio').value;
        const aVal = document.getElementById('adelanto').value;
        const p = parseFloat(pVal) || 0;
        const a = parseFloat(aVal) || 0;
        const averiaTotal = state.averiaItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

        const res = document.getElementById('restante');
        if (res) {
            if (pVal === '' && aVal !== '') {
                res.value = '';
            } else {
                const base = p > 0 ? p : averiaTotal;
                if (base > 0) {
                    const restante = Math.max(0, base - a);
                    res.value = restante.toFixed(2) + ' €';
                } else {
                    res.value = '';
                }
            }
        }
    }

    // ==================== SMS / OTP ====================

    function generateAndSendSMS() {
        const telefono = document.getElementById('telefono').value;
        if (!telefono || !validatePhone(telefono)) {
            notify('Teléfono inválido (9 dígitos)', 'error');
            return;
        }
        state.activeOTP = Math.floor(1000 + Math.random() * 9000);
        const msg = `SPEED MASTER: Código de firma ${state.activeOTP}`;
        const url = `https://wa.me/34${telefono}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        document.getElementById('otpInput').focus();
    }

    function verifyOTP() {
        const input = document.getElementById('otpInput').value;
        if (input == state.activeOTP && state.activeOTP) {
            document.getElementById('smsStatus').style.display = 'block';
            document.getElementById('smsVerifiedState').value = 'true';
            notify('Código verificado correctamente', 'success');
        } else {
            notify('Código incorrecto', 'error');
        }
    }

    // ==================== CLIENT MANAGEMENT (FIRESTORE) ====================

    /**
     * Sincroniza o registra la ficha de un cliente en Firestore usando el teléfono como ID.
     */
    async function syncClientToFirestore(clientData) {
        if (!clientData.telefono || !validatePhone(clientData.telefono)) return;

        try {
            // Colección 'clientes', ID es el número de teléfono
            const clientRef = db.collection('clientes').doc(clientData.telefono);
            const data = {
                nombre: clientData.nombre || '',
                dni: clientData.dni || '',
                direccion: clientData.direccion || '',
                telefono: clientData.telefono,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };

            await clientRef.set(data, { merge: true });
            console.log("Ficha de cliente sincronizada.");
        } catch (error) {
            console.warn("No se pudo sincronizar el cliente en Firestore (offline):", error);
        }
    }

    /**
     * Busca un cliente por teléfono y rellena el formulario si existe.
     */
    async function lookupClientByPhone(phone) {
        if (!phone || !validatePhone(phone)) return;

        try {
            const clientRef = db.collection('clientes').doc(phone);
            const doc = await clientRef.get();

            if (doc.exists) {
                const data = doc.data();
                if (data.nombre) document.getElementById('nombre').value = data.nombre;
                if (data.dni) document.getElementById('dni').value = data.dni || '';
                if (data.direccion) document.getElementById('direccion').value = data.direccion || '';

                notify(`Cliente cargado: ${data.nombre}`, 'success');
            }
        } catch (error) {
            console.warn("Fallo en lookupClientByPhone (offline):", error);
        }
    }

    // ==================== STORAGE ====================

    function getLocalOrders() {
        const data = localStorage.getItem('repara_shisha_orders');
        return data ? JSON.parse(data) : [];
    }

    function saveLocalOrders(orders) {
        localStorage.setItem('repara_shisha_orders', JSON.stringify(orders));
        state.orders = orders;
        renderOrders();
    }

    function subscribeToOrders() {
        state.orders = getLocalOrders();
        renderOrders();
    }

    function updateStatus(docId, newStatus) {
        const orders = getLocalOrders();
        const idx = orders.findIndex(o => o.docId === docId);
        if (idx >= 0) {
            orders[idx].status = newStatus;

            if (newStatus === 'PAGADO') {
                const ticketNumber = state.lastTicketNumber + 1;
                state.lastTicketNumber = ticketNumber;
                localStorage.setItem('repara_shisha_last_ticket', ticketNumber);

                orders[idx].isClosed = true;
                orders[idx].ticketNumber = ticketNumber;

                saveLocalOrders(orders);
                notify(`Estado: PAGADO. Generando Ticket Venta Nº ${ticketNumber}`, 'success');
                fillPrintArea(orders[idx], 'venta');
                setTimeout(() => window.print(), 500);
            } else {
                saveLocalOrders(orders);
                notify(`Estado actualizado a ${newStatus}`, 'success');
            }
        }
    }

    function markAsPaid(docId) {
        const confirmBtn = document.getElementById('confirmPaidBtn');
        if (!confirmBtn) return;
        confirmBtn.onclick = () => {
            document.getElementById('confirmModal').style.display = 'none';
            const orders = getLocalOrders();
            const idx = orders.findIndex(o => o.docId === docId);
            if (idx >= 0) {
                const ticketNumber = state.lastTicketNumber + 1;
                state.lastTicketNumber = ticketNumber;
                localStorage.setItem('repara_shisha_last_ticket', ticketNumber);

                orders[idx].status = 'PAGADO';
                orders[idx].isClosed = true;
                orders[idx].ticketNumber = ticketNumber;

                saveLocalOrders(orders);

                notify(`Pago registrado. Generando Ticket Venta Nº ${ticketNumber}`, 'success');
                fillPrintArea(orders[idx], 'venta');
                setTimeout(() => window.print(), 500);

                document.getElementById('successTitle').textContent = '✅ PAGO REGISTRADO';
                document.getElementById('successMessage').textContent = `La orden #${orders[idx].orderNumber} ha sido pagada y cerrada.`;
                document.getElementById('successModal').style.display = 'flex';
            }
        };
        document.getElementById('confirmModal').style.display = 'flex';
    }

    // ==================== RENDERING ====================

    function renderOrders(filter = '') {
        const tableBody = document.getElementById('historialBody');
        if (!tableBody) return;

        let orders = state.orders;

        if (state.statusFilter) {
            orders = orders.filter(o => o.status === state.statusFilter);
        }

        if (filter) {
            orders = orders.filter(o =>
                (o.nombre || '').toLowerCase().includes(filter.toLowerCase()) ||
                (o.orderNumber || '').toString().includes(filter) ||
                (o.modelo || '').toLowerCase().includes(filter.toLowerCase()) ||
                (o.telefono || '').includes(filter));
        }

        const fragment = document.createDocumentFragment();
        orders.forEach(order => {
            const tr = document.createElement('tr');
            tr.className = `row-${order.status || 'RECIBIDO'}`;
            const precio = parseFloat(order.precio) || 0;
            const averiaTotal = (order.averiaItems || []).reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
            const total = precio > 0 ? precio : averiaTotal;

            tr.innerHTML = `
                <td><a href="javascript:void(0)" class="id-link" onclick="ReparaApp.openModal('${order.docId}')">${order.orderNumber}</a></td>
                <td>${sanitizeHTML(order.date)}</td>
                <td>
                    <div style="font-weight: 600;">${sanitizeHTML(order.nombre)}</div>
                    <div style="font-size: 0.85em; color: #64748b; margin-top: 2px;">📞 ${sanitizeHTML(order.telefono || '-')}</div>
                </td>
                <td>${sanitizeHTML(order.modelo || '-')}</td>
                <td style="text-align:right; font-weight:600;">${total > 0 ? formatPrice(total) : '-'}</td>
                <td style="text-align:center">${getStatusBadge(order.status, total)}</td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center;">
                        ${renderActions(order)}
                    </div>
                </td>
            `;
            fragment.appendChild(tr);
        });

        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);
        updateStats();
        renderRecibidos();
    }

    function renderRecibidos() {
        const tbody = document.getElementById('recibidosBody');
        if (!tbody) return;

        // Mostrar todos los equipos que no estén pagados (en taller)
        const inShop = state.orders.filter(o => o.status !== 'PAGADO');

        if (inShop.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color:#94a3b8;">No hay equipos en el taller</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        inShop.forEach(order => {
            const tr = document.createElement('tr');

            // Botón avisar solo si está finalizado
            const avisarBtn = order.status === 'FINALIZADO'
                ? `<button class="btn-avisar-row" onclick="ReparaApp.notifyClient('${order.docId}')" title="Avisar por WhatsApp"><span>🔔</span> Avisar</button>`
                : '';

            tr.innerHTML = `
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                    <a href="javascript:void(0)" class="id-link-clickable" onclick="ReparaApp.loadOrderToFormById('${order.docId}')" title="Cargar orden para edición">
                        ${order.orderNumber}
                    </a>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                    <div style="font-weight: 600;">${sanitizeHTML(order.nombre)}</div>
                    <div style="font-size: 0.85em; color: #64748b; margin-top: 2px;">📞 ${sanitizeHTML(order.telefono || '-')}</div>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${sanitizeHTML(order.modelo || '-')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align:center; display: flex; align-items: center; justify-content: center; min-height: 45px;">
                    <select onchange="ReparaApp.updateStatus('${order.docId}', this.value)" style="padding: 4px; font-size: 0.9em; border-radius: 4px; border: 1px solid #cbd5e1; cursor: pointer;">
                        <option value="RECIBIDO"   ${order.status === 'RECIBIDO' ? 'selected' : ''}>Recibido</option>
                        <option value="PENDIENTE"  ${order.status === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
                        <option value="REPARANDO"  ${order.status === 'REPARANDO' ? 'selected' : ''}>Reparando</option>
                        <option value="FINALIZADO" ${order.status === 'FINALIZADO' ? 'selected' : ''}>Finalizado</option>
                        <option value="PAGADO"     ${order.status === 'PAGADO' ? 'selected' : ''}>Pagado</option>
                    </select>
                    ${avisarBtn}
                </td>
            `;
            fragment.appendChild(tr);
        });
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    function renderActions(order) {
        if (order.status === 'PAGADO') {
            let info = [];
            if (order.reparacion) info.push(sanitizeHTML(order.reparacion));
            let averiaNames = (order.averiaItems || []).map(i => i.name).filter(Boolean);
            if (averiaNames.length === 0 && order.averia) averiaNames.push(order.averia);
            if (averiaNames.length > 0) info.push(sanitizeHTML(averiaNames.join(', ')));

            return `<span style="font-size: 0.85em; color: #64748b; display: inline-block; line-height: 1.4;">${info.join(' | ') || '-'}</span>`;
        }
        if (order.status === 'FINALIZADO') {
            return `
                <button class="btn-small btn-verify" onclick="ReparaApp.markAsPaid('${order.docId}')">💰 PAGADO</button>
                <button class="btn-small btn-notify" onclick="ReparaApp.notifyClient('${order.docId}')">🔔 Avisar</button>
            `;
        }
        return `
            <select onchange="ReparaApp.updateStatus('${order.docId}', this.value)" class="status-select">
                <option value="RECIBIDO"   ${order.status === 'RECIBIDO' ? 'selected' : ''}>Recibido</option>
                <option value="PENDIENTE"  ${order.status === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
                <option value="REPARANDO"  ${order.status === 'REPARANDO' ? 'selected' : ''}>Reparando</option>
                <option value="FINALIZADO" ${order.status === 'FINALIZADO' ? 'selected' : ''}>Finalizado</option>
                <option value="PAGADO"     ${order.status === 'PAGADO' ? 'selected' : ''}>Pagado</option>
            </select>
        `;
    }

    function getStatusBadge(status, total = 0) {
        const config = STATUS_CONFIG[status];
        if (!config) return status;
        return `<span class="${config.badgeClass}">${config.label}</span>`;
    }

    function updateStats() {
        const stats = {
            'statTotal': { count: state.orders.length, filter: null },
            'statRecibidos': { count: state.orders.filter(o => o.status === 'RECIBIDO').length, filter: 'RECIBIDO' },
            'statPendientes': { count: state.orders.filter(o => o.status === 'PENDIENTE').length, filter: 'PENDIENTE' },
            'statReparando': { count: state.orders.filter(o => o.status === 'REPARANDO').length, filter: 'REPARANDO' },
            'statFinalizados': { count: state.orders.filter(o => o.status === 'FINALIZADO').length, filter: 'FINALIZADO' },
            'statPagados': { count: state.orders.filter(o => o.status === 'PAGADO').length, filter: 'PAGADO' }
        };

        Object.entries(stats).forEach(([id, data]) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = data.count;
                const parent = el.closest('.stat-item');
                if (parent) {
                    // Remover listeners antiguos (clonando el nodo si es necesario, o usando una flag)
                    if (!parent.dataset.listenerSet) {
                        parent.onclick = () => {
                            state.statusFilter = data.filter;
                            document.querySelectorAll('.stat-item').forEach(si => si.classList.remove('active-filter'));
                            parent.classList.add('active-filter');
                            renderOrders(document.getElementById('searchInput')?.value);
                        };
                        parent.dataset.listenerSet = 'true';
                    }
                }
            }
        });
    }

    function notifyClient(docId) {
        const order = state.orders.find(o => o.docId === docId);
        if (order) {
            const msg = `*SPEED MASTER MADRID:*\nHola ${order.nombre}, tu patinete ${order.modelo || ''} ya está listo, puedes pasar cuando puedas.`;
            window.open(`https://wa.me/34${order.telefono}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    }

    // ==================== FORM HANDLING ====================

    function buildAveriaString() {
        return state.averiaItems.map(i => i.name + (i.price ? ` (${i.price}€)` : '')).join(', ');
    }

    function saveOrder() {
        const nombre = (document.getElementById('nombre')?.value || '').trim();
        const telefono = (document.getElementById('telefono')?.value || '').trim();
        // if (!nombre || !telefono) { notify('Nombre y teléfono obligatorios', 'error'); return; }

        const orders = getLocalOrders();
        let order;
        let isUpdate = false;

        if (state.editingDocId) {
            const existing = orders.find(o => o.docId === state.editingDocId);
            if (existing) { order = existing; isUpdate = true; }
        }

        if (!order) {
            const nextOrderNumber = state.orders.length > 0
                ? Math.max(...state.orders.map(o => parseInt(o.orderNumber) || 0)) + 1
                : 1001;
            order = { docId: 'ord_' + Date.now(), orderNumber: nextOrderNumber, createdAt: Date.now() };
        }

        const isVerified = document.getElementById('smsVerifiedState').value === 'true';
        Object.assign(order, {
            date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
                new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            nombre, telefono,
            dni: document.getElementById('dni').value,
            direccion: document.getElementById('direccion').value,
            marca: document.getElementById('marca').value,
            modelo: document.getElementById('modelo').value,
            imei: document.getElementById('CHASIS').value,
            contrasena: document.getElementById('contrasena').value || '',
            averia: buildAveriaString(),
            averiaItems: JSON.parse(JSON.stringify(state.averiaItems)),
            reparacion: document.getElementById('reparacion').value,
            precio: document.getElementById('precio').value,
            adelanto: document.getElementById('adelanto').value,
            restante: document.getElementById('restante').value,
            status: isUpdate ? order.status : 'RECIBIDO',
            smsSignature: { verified: isVerified, code: isVerified ? document.getElementById('otpInput').value : null }
        });

        if (!isUpdate) orders.unshift(order);
        saveLocalOrders(orders);
        syncClientToFirestore(order); // Sincronizar ficha cliente
        notify(isUpdate ? `Orden #${order.orderNumber} actualizada` : `Orden #${order.orderNumber} registrada`, 'success');
        printDirectly(order);
        clearForm();
    }

    function saveAndPrintSale() {
        const nombre = (document.getElementById('nombre')?.value || '').trim();
        const telefono = (document.getElementById('telefono')?.value || '').trim();
        // if (!nombre || !telefono) { notify('Nombre y teléfono obligatorios', 'error'); return; }

        const orders = getLocalOrders();
        let order;
        let isUpdate = false;

        if (state.editingDocId) {
            const existing = orders.find(o => o.docId === state.editingDocId);
            if (existing) { order = existing; isUpdate = true; }
        }

        if (!order) {
            const nextOrderNumber = state.orders.length > 0
                ? Math.max(...state.orders.map(o => parseInt(o.orderNumber) || 0)) + 1
                : 1001;
            order = { docId: 'sale_' + Date.now(), orderNumber: nextOrderNumber, createdAt: Date.now() };
        }

        const ticketNumber = state.lastTicketNumber + 1;
        state.lastTicketNumber = ticketNumber;
        localStorage.setItem('repara_shisha_last_ticket', ticketNumber);

        Object.assign(order, {
            ticketNumber,
            date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
                new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            nombre, telefono,
            dni: document.getElementById('dni').value,
            direccion: document.getElementById('direccion').value,
            marca: document.getElementById('marca').value,
            modelo: document.getElementById('modelo').value,
            imei: document.getElementById('CHASIS').value,
            averia: buildAveriaString(),
            averiaItems: JSON.parse(JSON.stringify(state.averiaItems)),
            reparacion: document.getElementById('reparacion').value,
            precio: document.getElementById('precio').value,
            adelanto: document.getElementById('adelanto').value,
            status: 'PAGADO',
            isClosed: true,
            smsSignature: { verified: document.getElementById('smsVerifiedState').value === 'true', code: document.getElementById('otpInput').value }
        });

        if (!isUpdate) orders.unshift(order);
        saveLocalOrders(orders);
        syncClientToFirestore(order); // Sincronizar ficha cliente
        notify(`Venta Nº ${ticketNumber} registrada`, 'success');
        fillPrintArea(order, 'venta');
        setTimeout(() => window.print(), 400);
        clearForm();
    }

    function printDirectly(order) {
        fillPrintArea(order, 'reparacion');
        setTimeout(() => window.print(), 400);
    }

    function fillPrintArea(order, type = 'reparacion') {
        const setAll = (cls, val, isHtml = false) => {
            document.querySelectorAll('.' + cls).forEach(el => {
                if (isHtml) el.innerHTML = val;
                else el.textContent = val;
            });
        };

        const isVenta = type === 'venta';
        document.querySelectorAll('.p_ticket_number_line').forEach(el => el.style.display = isVenta ? 'block' : 'none');
        if (isVenta && order.ticketNumber) setAll('p_ticket_num', order.ticketNumber);

        document.querySelectorAll('.ticket-header-label').forEach((el, idx) => {
            if (isVenta) el.textContent = 'TICKET DE VENTA';
            else el.textContent = (idx === 0) ? 'COPIA CLIENTE' : 'COPIA ESTABLECIMIENTO';
        });

        document.querySelectorAll('.print-items-table').forEach(table => {
            const thead = table.querySelector('thead tr');
            if (thead) {
                // Siempre usamos 2 columnas: CONCEPTO y PRECIO
                thead.innerHTML = '<th style="text-align:left;">CONCEPTO</th><th style="text-align:right;">PRECIO</th>';
            }
        });

        setAll('p_orden', order.orderNumber);
        setAll('p_fecha', order.date);
        setAll('p_nombre', order.nombre || '-');
        setAll('p_telefono', order.telefono || '-');

        const setOptional = (cls, val) => {
            const hasValue = val && val.trim() !== '' && val !== '-';
            document.querySelectorAll('.' + cls).forEach(el => {
                el.textContent = hasValue ? val : '-';
                if (el.parentElement && el.parentElement.tagName === 'SPAN') {
                    el.parentElement.style.display = hasValue ? 'block' : 'none';
                }
            });
        };

        setOptional('p_dni', order.dni);
        setOptional('p_marca', order.marca);
        setOptional('p_modelo', order.modelo);
        setOptional('p_imei', order.imei);

        const deviceHasAny = (order.marca && order.marca.trim() !== '') ||
            (order.modelo && order.modelo.trim() !== '') ||
            (order.imei && order.imei.trim() !== '');
        document.querySelectorAll('.doc-device-row').forEach(row => {
            row.style.display = deviceHasAny ? 'block' : 'none';
        });

        const isDejaEquipo = (order.reparacion || '').toLowerCase().includes('deja equipo');
        const precio = parseFloat(order.precio) || 0;
        const adelanto = parseFloat(order.adelanto) || 0;
        const totalBase = precio > 0 ? precio : (order.averiaItems || []).reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

        // Si es Deja Equipo, ocultamos precios y totales
        if (isDejaEquipo) {
            ['p_precio_line', 'p_adelanto_line', 'p_restante_line', 'p_precio_line2', 'p_adelanto_line2', 'p_restante_line2'].forEach(id => {
                const el = document.getElementById(id); if (el) el.style.display = 'none';
            });
            document.querySelectorAll('.print-totals').forEach(el => el.style.display = 'none');
            setAll('p_total', '');
        } else if (isVenta) {
            document.querySelectorAll('.print-totals').forEach(el => el.style.display = 'block');
            ['p_precio_line', 'p_precio_line2', 'p_adelanto_line', 'p_adelanto_line2'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            ['p_restante_line', 'p_restante_line2'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.style.display = 'flex'; el.querySelector('span:first-child').textContent = 'TOTAL PAGADO:'; }
            });
            setAll('p_total', formatPrice(totalBase));
        } else {
            document.querySelectorAll('.print-totals').forEach(el => el.style.display = 'block');
            ['p_precio_line', 'p_precio_line2'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = precio > 0 ? 'flex' : 'none'; });
            ['p_adelanto_line', 'p_adelanto_line2'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = adelanto > 0 ? 'flex' : 'none'; });
            ['p_restante_line', 'p_restante_line2'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.style.display = 'flex'; el.querySelector('span:first-child').textContent = (totalBase - adelanto > 0) ? 'PENDIENTE:' : 'TOTAL:'; }
            });
            setAll('p_precio', formatPrice(precio));
            setAll('p_adelanto', formatPrice(adelanto));
            setAll('p_total', formatPrice(Math.max(0, totalBase - adelanto) || totalBase));
        }

        let items = (order.averiaItems && order.averiaItems.length > 0) ? JSON.parse(JSON.stringify(order.averiaItems)) : [];
        if (items.length === 0 && order.averia) {
            items.push({ name: order.averia, price: '' });
        }

        // Si no hay averías pero hay texto en reparación (ej: "Deja equipo"), lo agregamos como item
        if (items.length === 0 && order.reparacion) {
            items.push({ name: order.reparacion, price: '' });
        }

        const rowsHTML = items.map((item, idx) => {
            // Combinamos nombre de avería y texto de reparación si existe
            let concepto = sanitizeHTML(item.name || '');

            // Si es la primera fila y hay notas adicionales (reparacion), las añadimos al concepto
            if (idx === 0 && order.reparacion && !concepto.toLowerCase().includes(order.reparacion.toLowerCase())) {
                if (concepto && !concepto.toLowerCase().includes('deja equipo')) {
                    concepto += ` <br><span style="font-size:0.9em; font-weight:normal; font-style:italic;">(${sanitizeHTML(order.reparacion)})</span>`;
                } else if (!concepto) {
                    concepto = sanitizeHTML(order.reparacion);
                }
            }

            return `
                <tr>
                    <td>${concepto}</td>
                    <td style="text-align:right; font-weight:700;">${(item.price && !isDejaEquipo) ? parseFloat(item.price).toFixed(2) + ' €' : '-'}</td>
                </tr>
            `;
        }).join('');
        document.querySelectorAll('.p_items_body').forEach(tbody => tbody.innerHTML = rowsHTML);

        let firmaContent = '_________________';
        if (order.smsSignature?.verified) firmaContent = `<div class="digital-stamp">FIRMADO DIGITALMENTE<br>CÓDIGO: ${order.smsSignature.code}</div>`;
        setAll('p_firma_cliente_area', firmaContent, true);
    }

    function openModal(docId) {
        const order = state.orders.find(o => o.docId === docId);
        if (!order) return;

        document.getElementById('m_title').textContent = `Orden #${order.orderNumber} - ${order.date}`;
        document.getElementById('m_nombre').textContent = order.nombre;
        document.getElementById('m_telefono').textContent = order.telefono;
        document.getElementById('m_dni').textContent = order.dni || '-';
        document.getElementById('m_direccion').textContent = order.direccion || '-';
        document.getElementById('m_equipo').textContent = `${order.marca || ''} ${order.modelo || ''}`;
        document.getElementById('m_imei').textContent = order.imei || '-';
        document.getElementById('m_contrasena').textContent = order.contrasena || '-';
        document.getElementById('m_averia').textContent = order.averia || 'Sin detalles';

        document.getElementById('m_firma_status').innerHTML = order.smsSignature?.verified ? '<span style="color:green">✅ Firmado (SMS)</span>' : '<span style="color:orange">Sin firma digital</span>';

        const precio = parseFloat(order.precio) || 0;
        const adelanto = parseFloat(order.adelanto) || 0;
        const total = precio > 0 ? precio : (order.averiaItems || []).reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
        const financial = document.getElementById('m_financial');

        if (order.status === 'PAGADO') {
            if (financial) financial.innerHTML = `<div style="text-align:center; padding: 20px 0;"><span class="id-paid" style="font-size:1.6em; padding: 10px 24px;">✅ PAGADO</span></div>`;
        } else {
            if (financial) financial.innerHTML = `
                <div class="fin-row" id="m_precio_row"><span>Precio Estimado:</span><span id="m_precio"></span></div>
                <div class="fin-row" style="color:#059669" id="m_adelanto_row"><span>Adelanto (Pagado):</span><span id="m_adelanto_val"></span></div>
                <div class="fin-row fin-total" id="m_restante_row"><span>Pendiente:</span><span id="m_restante_val"></span></div>`;
            const pEl = document.getElementById('m_precio_row'), aEl = document.getElementById('m_adelanto_row'), rEl = document.getElementById('m_restante_row');
            if (pEl) pEl.style.display = precio > 0 ? 'flex' : 'none';
            if (aEl) aEl.style.display = adelanto > 0 ? 'flex' : 'none';
            if (rEl) rEl.style.display = total > 0 ? 'flex' : 'none';
            document.getElementById('m_precio').textContent = formatPrice(precio);
            document.getElementById('m_adelanto_val').textContent = formatPrice(adelanto);
            document.getElementById('m_restante_val').textContent = formatPrice(total - adelanto);
        }

        const modalPrintBtn = document.getElementById('modalPrintBtn');
        if (modalPrintBtn) modalPrintBtn.onclick = () => printExisting(docId);
        document.getElementById('viewModal').style.display = 'flex';
    }

    function printExisting(docId) {
        const order = state.orders.find(o => o.docId === docId);
        if (order) { fillPrintArea(order); window.print(); }
    }

    function clearForm() {
        document.getElementById('orderForm').reset();
        document.getElementById('smsStatus').style.display = 'none';
        document.getElementById('smsVerifiedState').value = 'false';
        document.getElementById('restante').value = '';
        document.getElementById('otpInput').value = '';
        state.editingDocId = null;
        state.averiaItems = [];
        updateAveriaButtonsUI();
    }

    function promptSearchOrder() {
        const num = prompt('Ingrese el Nº de Orden a buscar:');
        if (num) {
            const order = state.orders.find(o => o.orderNumber.toString() === num.trim());
            if (order) loadOrderToForm(order);
            else notify('Orden no encontrada', 'error');
        }
    }

    function loadOrderToForm(order) {
        clearForm();
        const fields = { nombre: order.nombre, telefono: order.telefono, dni: order.dni, direccion: order.direccion, marca: order.marca, modelo: order.modelo, CHASIS: order.imei, contrasena: order.contrasena, precio: order.precio, adelanto: order.adelanto, reparacion: order.reparacion };
        for (const [id, val] of Object.entries(fields)) { const el = document.getElementById(id); if (el) el.value = val || ''; }
        state.averiaItems = JSON.parse(JSON.stringify(order.averiaItems || []));
        syncPrecioField();
        if (order.smsSignature?.verified) { document.getElementById('smsStatus').style.display = 'block'; document.getElementById('smsVerifiedState').value = 'true'; document.getElementById('otpInput').value = order.smsSignature.code || ''; }
        showPage('orden');
        state.editingDocId = order.docId;
        notify(`Orden #${order.orderNumber} cargada`, 'success');
    }

    function init() {
        if (!document.getElementById('toastContainer')) { const el = document.createElement('div'); el.id = 'toastContainer'; el.className = 'toast-container'; document.body.appendChild(el); }
        subscribeToOrders();
        updateAveriaButtonsUI();

        // Buscador de Clientes
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderOrders(e.target.value);
            });
        }

        // Escuchar input de teléfono para autocompletado
        const telefonoInput = document.getElementById('telefono');
        if (telefonoInput) {
            telefonoInput.addEventListener('input', (e) => {
                const phone = e.target.value.trim();
                if (phone.length === 9) {
                    lookupClientByPhone(phone);
                }
            });
        }

        document.addEventListener('DOMContentLoaded', updateAveriaButtonsUI);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.ReparaApp = {
        showPage, promptSearchOrder, saveOrder, saveAndPrintSale, updateStatus, markAsPaid, openModal, notifyClient, printExisting, clearForm,
        generateAndSendSMS, verifyOTP, toggleAveria, addAveriaLibre, removeAveriaItem, setPriceForItem, setCustomPriceForItem,
        loadOrderToFormById: (docId) => {
            const order = state.orders.find(o => o.docId === docId);
            if (order) loadOrderToForm(order);
        },
        closeModal: () => document.getElementById('viewModal').style.display = 'none',
        closeConfirmModal: () => document.getElementById('confirmModal').style.display = 'none',
        closeSuccessModal: () => document.getElementById('successModal').style.display = 'none',
        calcRestante
    };

})();
