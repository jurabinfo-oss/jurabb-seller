// Seller Dashboard JavaScript
function loadSellerData() {
    const currentUser = localStorage.getItem('thriftloop_current_user');
    if (currentUser) {
        const seller = JSON.parse(currentUser);
        
        // Update header
        const sellerName = document.querySelector('.seller-name');
        const sellerId = document.querySelector('.seller-id');
        const sellerAvatar = document.querySelector('.seller-avatar');
        const headerSubtitle = document.querySelector('.header-subtitle');
        
        if (sellerName) sellerName.textContent = seller.displayName || 'Anonymous Seller';
        if (sellerId) sellerId.textContent = 'ID: ' + seller.id;
        if (headerSubtitle) headerSubtitle.textContent = `Welcome back, ${seller.fullName}! Keep the pre-loved love flowing 💕`;
        
        if (sellerAvatar) {
            if (seller.pfpChoice === 'upload' && seller.pfpImage) {
                sellerAvatar.innerHTML = `<img src="${seller.pfpImage}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                sellerAvatar.textContent = seller.displayName ? seller.displayName.charAt(0).toUpperCase() : (seller.fullName ? seller.fullName.charAt(0).toUpperCase() : 'S');
            }
        }
        
        // Update profile page
        const profileAvatar = document.getElementById('profilePageAvatar');
        const profileSellerId = document.getElementById('profileSellerId');
        const profileSellerEmail = document.getElementById('profileSellerEmail');
        const profileSellerName = document.getElementById('profileSellerName');
        const profileSellerCity = document.getElementById('profileSellerCity');
        const profileMemberSince = document.getElementById('profileMemberSince');
        
        if (profileAvatar) {
            if (seller.pfpChoice === 'upload' && seller.pfpImage) {
                profileAvatar.innerHTML = `<img src="${seller.pfpImage}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                profileAvatar.textContent = seller.displayName ? seller.displayName.charAt(0).toUpperCase() : (seller.fullName ? seller.fullName.charAt(0).toUpperCase() : 'S');
            }
        }
        if (profileSellerId) profileSellerId.textContent = seller.id;
        if (profileSellerEmail) profileSellerEmail.textContent = seller.email;
        if (profileSellerName) profileSellerName.textContent = seller.fullName;
        if (profileSellerCity) profileSellerCity.textContent = seller.city || '-';
        const profileNat = document.getElementById('profileSellerNationality');
        const profileHandover = document.getElementById('profileSellerHandover');
        const handoverDisplay = document.getElementById('sellerHandoverDisplay');
        if (profileNat) profileNat.textContent = seller.nationality || 'Indian';
        if (profileHandover) profileHandover.textContent = seller.handoverAddress || '-';
        if (handoverDisplay) handoverDisplay.value = seller.handoverAddress || '';
        if (profileMemberSince && seller.createdAt) {
            const date = new Date(seller.createdAt);
            profileMemberSince.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    }
}

function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Find and activate the clicked nav item
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Update section title
    const titles = {
        'overview': 'Dashboard Overview',
        'products': 'My Products',
        'orders': 'Orders Management',
        'earnings': 'Earnings & Analytics',
        'shipping': 'Handover & Delivery',
        'profile': 'Seller Profile'
    };
    
    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) {
        sectionTitle.textContent = titles[sectionName] || sectionName;
    }
}

// Add Product Modal
function openAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function addProduct(e) {
    e.preventDefault();
    alert('Product added successfully! It will be visible after review.');
    closeAddProductModal();
    e.target.reset();
}

// Update Order Status
function updateOrderStatus(orderId, status) {
    alert(`Order #ORD-${orderId} status updated to ${status}!`);
}

// Update Handover Status
function updateShipping() {
    const order = document.getElementById('shippingOrder')?.value;
    const status = document.getElementById('handoverStatus')?.value;
    
    if (!order) {
        alert('Please select an order.');
        return;
    }
    
    const statusText = {
        ready: 'Ready for handover',
        scheduled: 'Handover scheduled with ThriftLoop team',
        handed: 'Handed over to ThriftLoop team'
    }[status] || status;

    alert(`Order #ORD-${order} updated: ${statusText}.\nThriftLoop will collect from your nearby handover address and deliver to the customer.`);
    if (document.getElementById('shippingOrder')) document.getElementById('shippingOrder').value = '';
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('addProductModal');
    if (e.target === modal) {
        closeAddProductModal();
    }
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadSellerData();
    console.log('Seller Dashboard Loaded');
});
