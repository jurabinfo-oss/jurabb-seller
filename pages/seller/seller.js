// Seller Dashboard — real backend data only (no demo rows)

let sellerProfile = null;
let sellerOrders = [];
let sellerProducts = [];

const apiBase = () => (window.ThriftLoopAPI && window.ThriftLoopAPI.base) || '';

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function money(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
}

function dateText(value) {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function emptyRow(cols, message) {
    return `<tr><td colspan="${cols}" class="empty-note-cell">${esc(message)}</td></tr>`;
}

function requireSellerSession() {
    if (!localStorage.getItem('thriftloop_token')) {
        window.location.href = '../../index.html';
        return false;
    }
    return true;
}

async function apiGet(path) {
    if (!window.ThriftLoopAPI) throw new Error('API unavailable');
    return window.ThriftLoopAPI.request(path, { headers: window.ThriftLoopAPI.authHeaders() });
}

function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionName);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (event && event.target) {
        const nav = event.target.closest('.nav-item') || event.target;
        nav.classList.add('active');
    }
    const titles = {
        overview: 'Dashboard Overview', products: 'My Products', orders: 'Orders Management',
        earnings: 'Earnings & Analytics', shipping: 'Handover & Delivery', profile: 'Seller Profile'
    };
    setText('sectionTitle', titles[sectionName] || sectionName);
}

async function loadSellerData() {
    if (!requireSellerSession()) return;
    try {
        const data = await apiGet('/api/auth/me');
        const user = data.user || {};
        sellerProfile = user.seller_profile || {};
        const name = sellerProfile.full_name || user.name || 'Seller';
        setText('headerName', name);
        setText('headerId', 'ID: ' + (sellerProfile.seller_code || '-'));
        setText('headerAvatar', name.slice(0, 1).toUpperCase());
        setText('profilePageAvatar', name.slice(0, 1).toUpperCase());
        setText('profileSellerId', sellerProfile.seller_code || '-');
        setText('profileSellerEmail', user.email || '-');
        setText('profileSellerName', sellerProfile.full_name || '-');
        setText('profileSellerPhone', sellerProfile.phone || '-');
        setText('profileSellerCity', sellerProfile.city || '-');
        setText('profileSellerNationality', sellerProfile.nationality || '-');
        setText('profileSellerHandover', sellerProfile.handover_address || '-');
        setText('profileMemberSince', dateText(sellerProfile.created_at));
        const handover = document.getElementById('sellerHandoverDisplay');
        if (handover) handover.value = sellerProfile.handover_address || '';
    } catch (e) {
        alert('Could not load your profile. Please login again.');
    }
    loadProducts();
    loadOrders();
    loadRating();
}

async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    try {
        const data = await apiGet('/api/seller/products');
        sellerProducts = data.products || [];
        setText('statListings', sellerProducts.filter(p => p.status === 'active').length);
        tbody.innerHTML = sellerProducts.length
            ? sellerProducts.map(p => `
                <tr>
                    <td>
                        <div class="product-cell">
                            ${p.image_path ? `<img src="${esc(apiBase() + p.image_path)}" alt="${esc(p.name)}">` : ''}
                            <span>${esc(p.name)}</span>
                        </div>
                    </td>
                    <td><span class="category-tag">${esc(p.category)}</span></td>
                    <td>${money(p.price)}</td>
                    <td><span class="status-badge ${p.status === 'active' ? 'active' : 'inactive'}">${esc(p.status)}</span></td>
                    <td>
                        <button class="btn-small btn-secondary" onclick="setProductStatus(${p.id}, 'active')">Active</button>
                        <button class="btn-small" onclick="setProductStatus(${p.id}, 'sold')">Sold</button>
                        <button class="btn-small" onclick="setProductStatus(${p.id}, 'hidden')">Hide</button>
                    </td>
                </tr>`).join('')
            : emptyRow(5, 'No products listed yet. Add your first product.');
    } catch (e) {
        tbody.innerHTML = emptyRow(5, 'Could not load products.');
    }
}

async function setProductStatus(id, status) {
    try {
        await window.ThriftLoopAPI.request('/api/seller/products/' + id + '/status', {
            method: 'POST',
            headers: window.ThriftLoopAPI.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ status })
        });
        loadProducts();
    } catch (e) {
        alert('Could not update product: ' + (e.message || 'backend unavailable'));
    }
}

async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    try {
        const data = await apiGet('/api/orders');
        sellerOrders = data.orders || [];
        setText('ordersBadge', sellerOrders.length);
        setText('statOrders', sellerOrders.length);
        setText('statRevenue', money(sellerOrders.reduce((n, o) => n + Number(o.amount || 0), 0)));
        setText('earningsTotal', money(sellerOrders.reduce((n, o) => n + Number(o.amount || 0), 0)));
        setText('earningsOrders', sellerOrders.length);
        setText('earningsCompleted', sellerOrders.filter(o => o.status === 'delivered').length);

        tbody.innerHTML = sellerOrders.length
            ? sellerOrders.map(o => `
                <tr>
                    <td>#${esc(o.order_code)}</td>
                    <td>${esc(o.product_name || ('Product #' + o.product_id))}</td>
                    <td>${esc(o.buyer_name || 'Buyer')}</td>
                    <td>${money(o.amount)}</td>
                    <td><span class="status-badge pending">${esc(o.status)}</span></td>
                    <td>${esc(o.preferred_delivery_time || '-')}</td>
                    <td>
                        <button class="btn-small btn-primary" onclick="updateOrderStatus(${o.id}, 'handed_over')">Handed over</button>
                        <button class="btn-small" onclick="updateOrderStatus(${o.id}, 'delivered')">Delivered</button>
                    </td>
                </tr>`).join('')
            : emptyRow(7, 'No orders yet.');

        const recent = document.getElementById('recentOrdersList');
        if (recent) {
            recent.innerHTML = sellerOrders.length
                ? sellerOrders.slice(0, 3).map(o => `
                    <div class="order-item">
                        <div class="order-info">
                            <p class="order-id">#${esc(o.order_code)}</p>
                            <p class="order-product">${esc(o.product_name || 'Product')}</p>
                            <p class="order-customer">Buyer: ${esc(o.buyer_name || 'Buyer')}</p>
                        </div>
                        <div class="order-status">
                            <span class="status-badge pending">${esc(o.status)}</span>
                            <p class="order-amount">${money(o.amount)}</p>
                        </div>
                    </div>`).join('')
                : '<p class="empty-note">No orders yet.</p>';
        }

        const list = document.getElementById('transactionsList');
        if (list) {
            list.innerHTML = sellerOrders.length
                ? sellerOrders.map(o => `
                    <div class="transaction-item">
                        <div class="transaction-info">
                            <p class="transaction-id">#${esc(o.order_code)}</p>
                            <p class="transaction-desc">${esc(o.product_name || 'Product')}</p>
                        </div>
                        <div class="transaction-amount positive">${money(o.amount)}</div>
                        <div class="transaction-date">${dateText(o.created_at)}</div>
                    </div>`).join('')
                : '<p class="empty-note">No transactions yet.</p>';
        }

        const select = document.getElementById('shippingOrder');
        if (select) {
            select.innerHTML = '<option value="">Choose an order...</option>' + sellerOrders.map(o =>
                `<option value="${o.id}">#${esc(o.order_code)} - ${esc(o.product_name || 'Product')}</option>`).join('');
        }
    } catch (e) {
        tbody.innerHTML = emptyRow(7, 'Could not load orders.');
    }
}

async function loadRating() {
    if (!sellerProfile) return;
    try {
        const data = await apiGet('/api/sellers/' + sellerProfile.user_id + '/reviews');
        const reviews = data.reviews || [];
        const avg = reviews.length
            ? (reviews.reduce((n, r) => n + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
            : '-';
        setText('statRating', avg);
    } catch (e) {
        setText('statRating', '-');
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        await window.ThriftLoopAPI.request('/api/orders/' + orderId + '/status', {
            method: 'POST',
            headers: window.ThriftLoopAPI.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ status })
        });
        loadOrders();
    } catch (e) {
        alert('Could not update order: ' + (e.message || 'backend unavailable'));
    }
}

async function updateShipping() {
    const orderId = Number(document.getElementById('shippingOrder').value);
    if (!orderId) { alert('Please select an order.'); return; }
    const status = document.getElementById('handoverStatus').value;
    await updateOrderStatus(orderId, status);
}

function openAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) modal.classList.add('active');
}

function closeAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) modal.classList.remove('active');
}

async function addProduct(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', document.getElementById('productName').value.trim());
    fd.append('category', document.getElementById('productCategory').value);
    fd.append('price', document.getElementById('productPrice').value);
    fd.append('condition', document.getElementById('productCondition').value);
    fd.append('description', document.getElementById('productDescription').value.trim());
    const image = document.getElementById('productImage').files[0];
    if (image) fd.append('image', image);
    try {
        const res = await fetch(window.ThriftLoopAPI.base + '/api/seller/products', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('thriftloop_token') || '') },
            body: fd
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        closeAddProductModal();
        e.target.reset();
        loadProducts();
        alert('Product listed successfully.');
    } catch (err) {
        alert('Could not add product: ' + (err.message || 'backend unavailable'));
    }
}

document.addEventListener('DOMContentLoaded', loadSellerData);
