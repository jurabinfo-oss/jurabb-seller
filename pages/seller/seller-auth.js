// Load seller data from localStorage
function loadSellerData() {
    const currentUser = localStorage.getItem('thriftloop_current_user');
    if (currentUser) {
        const user = JSON.parse(currentUser);
        if (user.role === 'seller') {
            // Update sidebar/header with real data
            const sellerNameEl = document.querySelector('.seller-name');
            const sellerIdEl = document.querySelector('.seller-id');
            const sellerAvatarEl = document.querySelector('.seller-avatar');
            const headerSubtitle = document.querySelector('.header-subtitle');
            
            if (sellerNameEl) {
                sellerNameEl.textContent = user.displayName || user.fullName || 'Seller';
            }
            if (sellerIdEl) {
                sellerIdEl.textContent = 'ID: ' + user.id;
            }
            if (sellerAvatarEl) {
                if (user.pfpImage && user.pfpChoice === 'upload') {
                    sellerAvatarEl.innerHTML = `<img src="${user.pfpImage}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                } else {
                    sellerAvatarEl.textContent = (user.displayName || user.fullName || 'S').charAt(0).toUpperCase();
                }
            }
            if (headerSubtitle) {
                headerSubtitle.textContent = `Welcome back, ${user.fullName || user.displayName}! Keep the pre-loved love flowing 💕`;
            }
        }
    } else {
        // No user logged in, redirect to signup
        alert('Please create a seller account first.');
        window.location.href = 'seller-signup.html';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSellerData();
});
