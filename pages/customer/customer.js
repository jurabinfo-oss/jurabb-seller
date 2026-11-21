// Customer Dashboard — real backend data only

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

function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionName);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (event && event.target) {
        const nav = event.target.closest('.nav-item') || event.target;
        nav.classList.add('active');
    }
    setText('sectionTitle', sectionName === 'orders' ? 'My Orders' : 'My Profile');
}

async function apiGet(path) {
    if (!window.ThriftLoopAPI) throw new Error('API unavailable');
    return window.ThriftLoopAPI.request(path, { headers: window.ThriftLoopAPI.authHeaders() });
}

document.addEventListener('DOMContentLoaded', async function () {
    if (!localStorage.getItem('thriftloop_token')) {
        window.location.href = '../../index.html';
        return;
    }
    try {
        const data = await apiGet('/api/auth/me');
        const user = data.user || {};
        const name = user.name || (user.email && user.email.split('@')[0]) || 'Buyer';
        setText('headerName', name);
        setText('headerEmail', user.email || '-');
        setText('headerAvatar', name.slice(0, 1).toUpperCase());
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profileEmail');
        if (nameInput) nameInput.value = name;
        if (emailInput) emailInput.value = user.email || '';
    } catch (e) {
        // still show orders if profile call fails
    }

    const list = document.getElementById('ordersList');
    try {
        const data = await apiGet('/api/orders');
        const orders = data.orders || [];
        setText('ordersBadge', orders.length);
        list.innerHTML = orders.length
            ? orders.map(o => `
                <div class="order-card">
                    <div class="order-card-header">
                        <div class="order-basic-info">
                            <h4>Order #${esc(o.order_code)}</h4>
                            <p class="order-date">Placed on ${dateText(o.created_at)}</p>
                        </div>
                        <span class="status-badge pending">${esc(o.status)}</span>
                    </div>
                    <div class="order-card-body">
                        <div class="order-product-info">
                            <div class="product-details">
                                <h5>${esc(o.product_name || ('Product #' + o.product_id))}</h5>
                                <p class="product-price">${money(o.amount)}</p>
                            </div>
                        </div>
                        <div class="order-tracking">
                            <p><strong>Delivery to:</strong> ${esc(o.buyer_delivery_address)}</p>
                            <p><strong>Preferred time:</strong> ${esc(o.preferred_delivery_time || 'Any')}</p>
                            <p><strong>Seller:</strong> ${esc(o.seller_code || 'ThriftLoop Seller')}</p>
                        </div>
                    </div>
                </div>`).join('')
            : '<p class="empty-note">No orders yet. Start shopping to place your first order.</p>';
    } catch (e) {
        list.innerHTML = '<p class="empty-note">Could not load orders. Please try again later.</p>';
    }
});
