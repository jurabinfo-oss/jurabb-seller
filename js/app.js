// Product Data
const sellers = [];
const samplePfps = [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop',
    null
];
for (let i = 1; i <= 50; i++) {
    sellers.push({
        id: 'SELL-' + String(i).padStart(4, '0'),
        username: 'thrift_' + Math.random().toString(36).substr(2, 6),
        points: Math.floor(Math.random() * 5000) + 100,
        verified: true,
        pfp: samplePfps[Math.floor(Math.random() * samplePfps.length)],
        joined: '2024-' + String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
    });
}

const products = [];
const categories = ['kurtis', 'socks', 'panties', 'bra', 'suit', 'underwear'];
const productNames = {
    kurtis: ['Floral Kurti', 'Anarkali Kurti', 'Embroidered Kurti', 'Cotton Kurti', 'Silk Kurti'],
    socks: ['Lace Socks', 'Ankle Socks', 'Crew Socks', 'Knee High Socks'],
    panties: ['Cotton Panties', 'Lace Panties', 'Seamless Panties', 'Thong Panties', 'Bikini Panties'],
    bra: ['T-Shirt Bra', 'Lace Bra', 'Push Up Bra', 'Bralette'],
    suit: ['Three Piece Suit', 'Two Piece Suit', 'Salwar Suit', 'Business Suit'],
    underwear: ['Briefs', 'Boyshorts', 'Hipster', 'High Waist']
};

for (let i = 1; i <= 75; i++) {
    let category;
    if (i <= 25) {
        category = 'panties';
    } else {
        category = categories[Math.floor(Math.random() * categories.length)];
        if (category === 'panties') category = 'underwear';
    }
    
    const seller = sellers[Math.floor(Math.random() * sellers.length)];
    let productImage;
    if (category === 'panties' || category === 'underwear') {
        productImage = 'images/panties-ref.jpg';
    } else if (category === 'bra') {
        productImage = 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=400&h=400&fit=crop';
    } else if (category === 'socks') {
        productImage = 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop';
    } else if (category === 'suit') {
        productImage = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=400&fit=crop';
    } else {
        productImage = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop';
    }
    
    products.push({
        id: i,
        name: productNames[category][Math.floor(Math.random() * productNames[category].length)] + ' - Vintage',
        category: category,
        price: Math.floor(Math.random() * 600) + 150,
        image: productImage,
        seller: seller.username,
        sellerId: seller.id,
        sellerPoints: seller.points,
        sellerPfp: seller.pfp,
        condition: ['Like New', 'Excellent', 'Good'][Math.floor(Math.random() * 3)],
        deliveryType: ['Pickup & Delivery', 'Standard Delivery', 'Express Delivery'][Math.floor(Math.random() * 3)]
    });
}

let cart = [];
let currentFilter = 'all';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    displayProducts();
    setupMobileMenu();
});

// Display products
function displayProducts() {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    const filteredProducts = currentFilter === 'all' 
        ? products 
        : products.filter(p => p.category === currentFilter);
    
    productsGrid.innerHTML = '';
    
    filteredProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.style.cursor = 'pointer';
        productCard.onclick = (e) => {
            if (e.target.classList.contains('btn-add-cart')) return;
            viewProduct(product.id);
        };
        productCard.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/400x400?text=Product'">
            <div class="product-info">
                <span class="product-category">${product.category}</span>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-seller"><i class="fas fa-user"></i> ${product.seller} <span style="color: var(--baby-pink);">• ${product.sellerPoints} pts</span></p>
                <p class="product-price">₹${product.price}</p>
                <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart(${product.id})">
                    <i class="fas fa-shopping-bag"></i> Add to Bag
                </button>
            </div>
        `;
        productsGrid.appendChild(productCard);
    });
}

// Filter products
function filterProducts(category) {
    currentFilter = category;
    
    // Update active tab
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.classList.toggle('active', 
            tab.textContent.toLowerCase().includes(category) || 
            (category === 'all' && tab.textContent === 'All')
        );
    });
    
    displayProducts();
}

// Add to cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({...product, quantity: 1});
    }
    
    updateCart();
    toggleCart();
}

// Update cart display
function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.querySelector('.cart-count');
    const cartTotal = document.getElementById('cartTotal');
    
    if (!cartItems) return;
    
    cartItems.innerHTML = '';
    let total = 0;
    let count = 0;
    
    cart.forEach(item => {
        total += item.price * item.quantity;
        count += item.quantity;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">₹${item.price} x ${item.quantity}</div>
                <button class="remove-item" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });
    
    if (cartCount) cartCount.textContent = count;
    if (cartTotal) cartTotal.textContent = '₹' + total;
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

// Toggle cart sidebar
function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    
    if (cartSidebar) cartSidebar.classList.toggle('active');
    if (cartOverlay) cartOverlay.classList.toggle('active');
}

// Checkout
function checkout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    alert('Order placed successfully! Seller will be notified. Items are from individual seller stock.');
    cart = [];
    updateCart();
    toggleCart();
}

function viewProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    localStorage.setItem('thriftloop_view_product', JSON.stringify(product));
    window.location.href = 'pages/product-detail.html';
}

// Mobile menu
function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
    
    // Close menu when clicking on link
    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }));
}

// Login Modal
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
}

function switchLoginTab(type) {
    document.getElementById('loginType').value = type;
    
    const tabs = document.querySelectorAll('.login-tab');
    tabs.forEach(tab => {
        tab.classList.toggle('active', 
            tab.textContent.toLowerCase() === type
        );
    });
}

function normalizeSellerUser(apiUser) {
    const sp = apiUser.seller_profile || {};
    const apiBase = (window.ThriftLoopAPI && window.ThriftLoopAPI.base) || '';
    const photo = sp.photo_path
        ? (sp.photo_path.startsWith('http') ? sp.photo_path : apiBase + sp.photo_path)
        : null;
    return {
        id: sp.seller_code || ('SELL-' + apiUser.id),
        email: apiUser.email,
        fullName: sp.full_name || apiUser.name || '',
        displayName: sp.full_name || apiUser.name || 'Seller',
        phone: sp.phone || '',
        city: sp.city || '',
        nationality: sp.nationality || 'Indian',
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
        const toStore = data.user.role === 'seller'
            ? normalizeSellerUser(data.user)
            : data.user;
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
    const password = passwordInput ? passwordInput.value.trim() : '';

    // Try backend authentication first (real accounts)
    if (window.ThriftLoopAPI) {
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
            return;
        } catch (err) {
            if (type === 'customer' && err.status === 401) {
                // Auto-create buyer account on the backend for demo convenience
                try {
                    const data = await ThriftLoopAPI.request('/api/auth/register-customer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, name: email.split('@')[0] })
                    });
                    closeLoginModal();
                    storeApiSession(data);
                    localStorage.setItem('thriftloop_user_type', 'customer');
                    redirectAfterLogin('customer');
                    return;
                } catch (regErr) {
                    alert('Login failed: ' + (regErr.message || 'could not create account'));
                    openLoginModal();
                    switchLoginTab(type);
                    return;
                }
            }
            if (err.status) {
                alert('Invalid ' + type + ' credentials. Check your email and password.');
                openLoginModal();
                switchLoginTab(type);
                if (emailInput) emailInput.value = email;
                return;
            }
            // Network error: fall through to offline demo (localStorage) below
        }
    }

    closeLoginModal();

    if (type === 'seller') {
        const sellerKey = 'thriftloop_seller_' + email;
        const sellerData = localStorage.getItem(sellerKey);
        if (sellerData) {
            const seller = JSON.parse(sellerData);
            if (password && seller.password && password !== seller.password) {
                alert('Incorrect password. Please try again.');
                openLoginModal();
                switchLoginTab('seller');
                if (emailInput) emailInput.value = email;
                return;
            }
            localStorage.setItem('thriftloop_current_user', sellerData);
            localStorage.setItem('thriftloop_user_type', 'seller');
            window.location.href = 'pages/seller/seller.html';
            return;
        } else {
            alert('Seller account not found. Contact admin for your seller signup link.');
            return;
        }
    } else if (type === 'admin') {
        if (email === 'admin@thriftloop.com' && password === 'admin123') {
            localStorage.setItem('thriftloop_user_type', 'admin');
            window.location.href = 'pages/admin/admin.html';
        } else {
            alert('Invalid admin credentials. Use admin@thriftloop.com / admin123 for demo.');
            openLoginModal();
            switchLoginTab('admin');
        }
    } else if (type === 'customer') {
        const custKey = 'thriftloop_customer_' + email;
        const custData = localStorage.getItem(custKey);
        if (custData) {
            const customer = JSON.parse(custData);
            if (password && customer.password && password !== customer.password) {
                alert('Incorrect password.');
                openLoginModal(); switchLoginTab('customer');
                return;
            }
            localStorage.setItem('thriftloop_current_user', custData);
        } else {
            const user = { email, password, name: email.split('@')[0] || 'Buyer', role: 'customer' };
            localStorage.setItem(custKey, JSON.stringify(user));
            localStorage.setItem('thriftloop_current_user', JSON.stringify(user));
        }
        localStorage.setItem('thriftloop_user_type', 'customer');
        window.location.href = 'pages/customer/customer.html';
    }
}

async function openCustomerSignup() {
    const email = prompt('Enter your email to create buyer account:');
    if (!email) return;
    const password = prompt('Create a password:');
    if (!password) return;
    const name = prompt('Your name:') || 'Buyer';

    if (window.ThriftLoopAPI) {
        try {
            const data = await ThriftLoopAPI.request('/api/auth/register-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            storeApiSession(data);
            alert('Buyer account created! You can now login as customer.');
            return;
        } catch (err) {
            if (err.status) {
                alert('Could not create account: ' + (err.message || 'email may already be used'));
                return;
            }
            // network error -> local fallback
        }
    }

    const user = { email, password, name, role: 'customer' };
    localStorage.setItem('thriftloop_customer_' + email, JSON.stringify(user));
    alert('Buyer account created! You can now login as customer.');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('loginModal');
    if (e.target === modal) {
        closeLoginModal();
    }
});
