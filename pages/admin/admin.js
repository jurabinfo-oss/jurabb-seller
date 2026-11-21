// Admin Dashboard JavaScript — real backend data only (no demo fallbacks)

const ADMIN_API = () => (window.ThriftLoopAPI || null);

function escapeHtml(value) {
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

function emptyRow(cols, message) {
    return `<tr><td colspan="${cols}" class="empty-note-cell">${escapeHtml(message)}</td></tr>`;
}

function requireAdminSession() {
    if (!localStorage.getItem('thriftloop_token')) {
        window.location.href = '../../index.html';
        return false;
    }
    return true;
}

async function apiGet(path) {
    if (!ADMIN_API()) throw new Error('API unavailable');
    return ADMIN_API().request(path, { headers: ADMIN_API().authHeaders() });
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
        overview: 'Admin Overview', users: 'User Management', sellers: 'Seller Management',
        invites: 'Seller Invites', products: 'Product Management', orders: 'Order Management'
    };
    const title = document.getElementById('sectionTitle');
    if (title) title.textContent = titles[sectionName] || sectionName;

    if (sectionName === 'invites') renderSellerInvites();
    if (sectionName === 'users') renderUsers();
    if (sectionName === 'sellers') renderSellers();
    if (sectionName === 'products') renderProducts();
    if (sectionName === 'orders') renderOrders();
}

// ---------- Overview ----------
async function renderOverview() {
    try {
        const data = await apiGet('/api/admin/summary');
        const s = data.summary || {};
        const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
        set('statUsers', s.customers || 0);
        set('statSellers', s.sellers || 0);
        set('statProducts', s.active_products || 0);
        set('statRevenue', money(s.order_value));

        const orders = data.recent_orders || [];
        const orderList = document.getElementById('recentOrdersList');
        if (orderList) {
            orderList.innerHTML = orders.length
                ? orders.map(o => `
                    <div class="order-item">
                        <div class="order-info">
                            <p class="order-id">#${escapeHtml(o.order_code)}</p>
                            <p class="order-product">${escapeHtml(o.product_name || 'Product')}</p>
                            <p class="order-details">Buyer: ${escapeHtml(o.buyer_name || 'Guest')}</p>
                        </div>
                        <div class="order-status">
                            <span class="status-badge pending">${escapeHtml(o.status)}</span>
                            <p class="order-amount">${money(o.amount)}</p>
                        </div>
                    </div>`).join('')
                : '<p class="empty-note">No orders yet.</p>';
        }

        const sellers = data.new_sellers || [];
        const sellerList = document.getElementById('newSellersList');
        if (sellerList) {
            sellerList.innerHTML = sellers.length
                ? sellers.map(sp => `
                    <div class="seller-item">
                        <div class="seller-avatar-small">${escapeHtml((sp.full_name || 'S').slice(0, 2).toUpperCase())}</div>
                        <div class="seller-info-small">
                            <p class="seller-name-small">${escapeHtml(sp.full_name || 'Seller')}</p>
                            <p class="seller-email-small">${escapeHtml(sp.seller_code || '')} · Joined ${dateText(sp.created_at)}</p>
                        </div>
                        <span class="status-badge ${sp.verification_status === 'approved' ? 'active' : 'pending'}">${escapeHtml(sp.verification_status)}</span>
                    </div>`).join('')
                : '<p class="empty-note">No sellers registered yet.</p>';
        }
    } catch (e) {
        const orderList = document.getElementById('recentOrdersList');
        const sellerList = document.getElementById('newSellersList');
        if (orderList) orderList.innerHTML = '<p class="empty-note">Could not load orders. Check backend connection.</p>';
        if (sellerList) sellerList.innerHTML = '<p class="empty-note">Could not load sellers. Check backend connection.</p>';
    }
}

// ---------- Users ----------
async function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    try {
        const data = await apiGet('/api/admin/users');
        const users = data.users || [];
        tbody.innerHTML = users.length
            ? users.map(u => `
                <tr>
                    <td>#${u.id}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td><span class="role-badge ${escapeHtml(u.role)}">${escapeHtml(u.role)}</span></td>
                    <td>${dateText(u.created_at)}</td>
                    <td><span class="status-badge active">Active</span></td>
                </tr>`).join('')
            : emptyRow(5, 'No users yet.');
    } catch (e) {
        tbody.innerHTML = emptyRow(5, 'Could not load users. Check backend connection.');
    }
}

// ---------- Sellers ----------
async function renderSellers() {
    const tbody = document.getElementById('sellersTableBody');
    if (!tbody) return;
    try {
        const data = await apiGet('/api/admin/sellers');
        const sellers = data.sellers || [];
        tbody.innerHTML = sellers.length
            ? sellers.map(s => `
                <tr>
                    <td>${escapeHtml(s.seller_code || ('#' + s.id))}</td>
                    <td>${escapeHtml(s.full_name || '-')}</td>
                    <td>${escapeHtml(s.city || '-')}</td>
                    <td>${s.product_count || 0}</td>
                    <td>${s.order_count || 0}</td>
                    <td><span class="status-badge ${s.verification_status === 'approved' ? 'active' : 'pending'}">${escapeHtml(s.verification_status || 'pending')}</span></td>
                </tr>`).join('')
            : emptyRow(6, 'No sellers registered yet.');
    } catch (e) {
        tbody.innerHTML = emptyRow(6, 'Could not load sellers. Check backend connection.');
    }
}

// ---------- Products ----------
async function renderProducts() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    try {
        const data = await apiGet('/api/admin/products');
        const products = data.products || [];
        tbody.innerHTML = products.length
            ? products.map(p => `
                <tr>
                    <td>#${p.id}</td>
                    <td>${escapeHtml(p.name)}</td>
                    <td>${escapeHtml(p.seller_code || '-')}</td>
                    <td><span class="category-tag">${escapeHtml(p.category)}</span></td>
                    <td>${money(p.price)}</td>
                    <td><span class="status-badge ${p.status === 'active' ? 'active' : 'inactive'}">${escapeHtml(p.status)}</span></td>
                </tr>`).join('')
            : emptyRow(6, 'No products listed yet.');
    } catch (e) {
        tbody.innerHTML = emptyRow(6, 'Could not load products. Check backend connection.');
    }
}

// ---------- Orders ----------
async function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    try {
        const data = await apiGet('/api/orders');
        const orders = data.orders || [];
        tbody.innerHTML = orders.length
            ? orders.map(o => `
                <tr>
                    <td>#${escapeHtml(o.order_code)}</td>
                    <td>${escapeHtml(o.product_name || ('Product #' + o.product_id))}</td>
                    <td>${escapeHtml(o.seller_code || '-')}</td>
                    <td>${escapeHtml(o.buyer_name || 'Guest')}</td>
                    <td>${money(o.amount)}</td>
                    <td><span class="status-badge pending">${escapeHtml(o.status)}</span></td>
                    <td>${dateText(o.created_at)}</td>
                </tr>`).join('')
            : emptyRow(7, 'No orders yet.');
    } catch (e) {
        tbody.innerHTML = emptyRow(7, 'Could not load orders. Check backend connection.');
    }
}

// ---------- Seller invites ----------
function normalizeServerInvite(inv) {
    return {
        token: inv.token,
        status: inv.status || 'active',
        createdAt: inv.created_at,
        usedBy: inv.used_by_user_id || '-'
    };
}

async function generateSellerInvite() {
    if (!requireAdminSession()) return;
    try {
        await ADMIN_API().request('/api/admin/invites', {
            method: 'POST',
            headers: ADMIN_API().authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({})
        });
        await renderSellerInvites();
    } catch (e) {
        if (e.status === 401 || e.status === 403) alert('Admin session invalid. Logout and login again as Admin.');
        else alert('Could not create invite: ' + (e.message || 'backend unavailable'));
    }
}

function getSellerInviteLink(token) {
    return new URL('../seller/seller-signup.html?invite=' + encodeURIComponent(token), window.location.href).toString();
}

async function copyInviteLink(token) {
    const link = getSellerInviteLink(token);
    try {
        await navigator.clipboard.writeText(link);
        alert('Invite link copied. Share it directly with the seller.');
    } catch (e) {
        prompt('Copy this invite link:', link);
    }
}

function renderInviteRows(invites) {
    const tbody = document.getElementById('invitesTableBody');
    if (!tbody) return;
    if (!invites.length) {
        tbody.innerHTML = emptyRow(5, 'No invites yet. Generate one to share with a seller.');
        return;
    }
    tbody.innerHTML = invites.map(inv => {
        const link = getSellerInviteLink(inv.token);
        const status = inv.status === 'active'
            ? '<span class="status-badge active">Active</span>'
            : `<span class="status-badge inactive">${escapeHtml(inv.status)}</span>`;
        return `
            <tr>
                <td>${dateText(inv.createdAt)}</td>
                <td>${status}</td>
                <td><input type="text" readonly value="${escapeHtml(link)}" class="invite-link-input" onclick="this.select()"></td>
                <td>${escapeHtml(inv.usedBy)}</td>
                <td><button class="btn-small btn-secondary" onclick="copyInviteLink('${escapeHtml(inv.token)}')"><i class="fas fa-copy"></i> Copy</button></td>
            </tr>`;
    }).join('');
}

async function renderSellerInvites() {
    const tbody = document.getElementById('invitesTableBody');
    if (!tbody) return;
    if (!requireAdminSession()) return;
    try {
        const data = await apiGet('/api/admin/invites');
        renderInviteRows((data.invites || []).map(normalizeServerInvite));
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            tbody.innerHTML = emptyRow(5, 'Admin session expired. Logout and login again as Admin.');
        } else {
            tbody.innerHTML = emptyRow(5, 'Could not load invites. Check backend connection.');
        }
    }
}

// Initialize dashboard with real data
document.addEventListener('DOMContentLoaded', async function () {
    if (!requireAdminSession()) return;
    try {
        const data = await apiGet('/api/auth/me');
        const name = document.getElementById('adminName');
        if (name && data.user) name.textContent = data.user.name || data.user.email || 'Admin';
    } catch (e) { /* keep default label */ }
    renderOverview();
    renderSellerInvites();
});
