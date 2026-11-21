// ThriftLoop storefront — real backend data only (no generated/demo products)

const NO_IMAGE = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#f3e6ec"/><text x="50%" y="50%" fill="#b23a63" font-family="sans-serif" font-size="22" text-anchor="middle" dominant-baseline="middle">No image yet</text></svg>'
).replace(/'/g, '%27');

let products = [];
let cart = [];
let currentFilter = 'all';

const apiBase = () => (window.ThriftLoopAPI && window.ThriftLoopAPI.base) || '';

function imageUrl(path) {
    if (!path) return NO_IMAGE;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return apiBase() + path;
}

function money(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
}

function escapeAttr(value) {
    return String(value == null ? '' : value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', function () {
    setupMobileMenu();
    loadProducts();
});

async function loadProducts() {
    const grid = document.getElementById('productsGrid');
    if (grid) grid.innerHTML = '<p class="empty-products">Loading listings...</p>';
    try {
        const data = await ThriftLoopAPI.request('/api/products');
        products = data.products || [];
        if (grid) displayProducts();
    } catch (e) {
        products = [];
        if (grid) grid.innerHTML = '<p class="empty-products">Could not load products. Please try again later.</p>';
    }
}

function displayProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const list = currentFilter === 'all' ? products : products.filter(p => p.category === currentFilter);
    if (!list.length) {
        grid.innerHTML = '<p class="empty-products">No products listed yet. Check back soon.</p>';
        return;
    }

    grid.innerHTML = list.map(product => `
        <div class="product-card" style="cursor:pointer" onclick="viewProduct(${product.id})">
            <img src="${escapeAttr(imageUrl(product.image_path || product.image))}" alt="${escapeAttr(product.name)}" class="product-image" data-fallback="${NO_IMAGE}" onerror="this.onerror=null;this.src=this.dataset.fallback">
            <div class="product-info">
                <span class="product-category">${escapeAttr(product.category)}</span>
                <h3 class="product-name">${escapeAttr(product.name)}</h3>
                <p class="product-seller"><i class="fas fa-user"></i> ${escapeAttr((product.seller && product.seller.seller_code) || 'ThriftLoop Seller')}</p>
                <p class="product-price">${money(product.price)}</p>
                <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart(${product.id})">
                    <i class="fas fa-shopping-bag"></i> Add to Bag
                </button>
            </div>
        </div>`).join('');
}

function filterProducts(category) {
    currentFilter = category;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        const label = tab.textContent.trim().toLowerCase();
        tab.classList.toggle('active', category === 'all' ? label === 'all' : label.includes(category));
    });
    displayProducts();
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ ...product, quantity: 1 });
    updateCart();
    toggleCart();
}

function updateCart() {
    const items = document.getElementById('cartItems');
    const count = document.querySelector('.cart-count');
    const total = document.getElementById('cartTotal');
    if (!items) return;

    items.innerHTML = cart.length ? cart.map(item => `
        <div class="cart-item">
            <img src="${escapeAttr(imageUrl(item.image_path || item.image))}" alt="${escapeAttr(item.name)}" data-fallback="${NO_IMAGE}" onerror="this.onerror=null;this.src=this.dataset.fallback">
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeAttr(item.name)}</div>
                <div class="cart-item-price">${money(item.price)} x ${item.quantity}</div>
                <button class="remove-item" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i> Remove</button>
            </div>
        </div>`).join('') : '<p class="empty-note">Your bag is empty.</p>';

    if (count) count.textContent = cart.reduce((n, item) => n + item.quantity, 0);
    if (total) total.textContent = money(cart.reduce((n, item) => n + item.price * item.quantity, 0));
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

async function checkout() {
    if (!cart.length) {
        alert('Your bag is empty!');
        return;
    }
    if (!localStorage.getItem('thriftloop_token') || localStorage.getItem('thriftloop_user_type') !== 'customer') {
        alert('Please login as a buyer before placing an order.');
        openLoginModal();
        return;
    }

    const address = prompt('Delivery address:');
    if (!address) return;
    const phone = prompt('Phone number for delivery:');
    if (!phone) return;
    const time = prompt('Preferred delivery time (optional):') || '';

    try {
        for (const item of cart) {
            for (let i = 0; i < item.quantity; i++) {
                await ThriftLoopAPI.request('/api/orders', {
                    method: 'POST',
                    headers: ThriftLoopAPI.authHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        product_id: item.id,
                        buyer_delivery_address: address,
                        buyer_phone: phone,
                        preferred_delivery_time: time
                    })
                });
            }
        }
        alert('Order request sent. The seller will hand your item to ThriftLoop, and we will deliver it to your address.');
        cart = [];
        updateCart();
        toggleCart();
    } catch (e) {
        alert('Could not place order: ' + (e.message || 'backend unavailable'));
    }
}

function viewProduct(productId) {
    localStorage.setItem('thriftloop_view_product_id', String(productId));
    window.location.href = 'pages/product-detail.html';
}

function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
        if (hamburger) hamburger.classList.remove('active');
        if (navMenu) navMenu.classList.remove('active');
    }));
}

// ---------- Login ----------
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
}

function switchLoginTab(type) {
    const hidden = document.getElementById('loginType');
    if (hidden) hidden.value = type;
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.trim().toLowerCase() === type);
    });
    const hint = document.getElementById('signupHint');
    if (hint) hint.style.display = type === 'customer' ? 'block' : 'none';
}

function normalizeSellerUser(apiUser) {
    const sp = apiUser.seller_profile || {};
    const photo = sp.photo_path ? imageUrl(sp.photo_path) : null;
    return {
        id: sp.seller_code || ('SELL-' + apiUser.id),
        email: apiUser.email,
        fullName: sp.full_name || apiUser.name || '',
        displayName: sp.full_name || apiUser.name || 'Seller',
        phone: sp.phone || '',
        city: sp.city || '',
        nationality: sp.nationality || '',
        handoverAddress: sp.handover_address || '',
        pfpChoice: photo ? 'upload' : 'none',
        pfpImage: photo,
        role: 'seller',
        verificationStatus: sp.verification_status || 'pending',
        createdAt: sp.created_at || apiUser.created_at
    };
}

function storeApiSession(data) {
    if (data && data.token) localStorage.setItem('thriftloop_token', data.token);
    if (data && data.user) {
        const toStore = data.user.role === 'seller' ? normalizeSellerUser(data.user) : data.user;
        localStorage.setItem('thriftloop_current_user', JSON.stringify(toStore));
    }
}

function redirectAfterLogin(type) {
    if (type === 'seller') window.location.href = 'pages/seller/seller.html';
    else if (type === 'admin') window.location.href = 'pages/admin/admin.html';
    else window.location.href = 'pages/customer/customer.html';
}

async function handleLogin(e) {
    e.preventDefault();
    const type = document.getElementById('loginType').value;
    const emailInput = e.target.querySelector('input[type="email"]');
    const passwordInput = e.target.querySelector('input[type="password"]');
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!window.ThriftLoopAPI) {
        alert('Backend connection is not configured. Please try again later.');
        return;
    }

    try {
        const data = await ThriftLoopAPI.request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role: type })
        });
        closeLoginModal();
        storeApiSession(data);
        localStorage.setItem('thriftloop_user_type', type);
        redirectAfterLogin(type);
    } catch (err) {
        if (err.status) alert('Invalid ' + type + ' credentials. Check your email and password.');
        else alert('Backend unavailable. Please try again later.');
        openLoginModal();
        switchLoginTab(type);
        if (emailInput) emailInput.value = email;
    }
}

async function openCustomerSignup() {
    const email = prompt('Enter your email to create buyer account:');
    if (!email) return;
    const password = prompt('Create a password:');
    if (!password) return;
    const name = prompt('Your name:') || email.split('@')[0];

    try {
        await ThriftLoopAPI.request('/api/auth/register-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        alert('Buyer account created! You can now login with the Login tab.');
    } catch (err) {
        if (err.status) alert('Could not create account: ' + (err.message || 'email may already be used'));
        else alert('Backend unavailable. Please try again later.');
    }
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('loginModal');
    if (e.target === modal) closeLoginModal();
});
