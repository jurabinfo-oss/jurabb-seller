// Customer Dashboard JavaScript
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
        'profile': 'My Profile',
        'orders': 'My Orders',
        'wishlist': 'My Wishlist',
        'addresses': 'Shipping Addresses'
    };
    
    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) {
        sectionTitle.textContent = titles[sectionName] || sectionName;
    }
}

function addToCartFromWishlist(productId) {
    alert('Product added to cart!');
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Customer Dashboard Loaded');
});
