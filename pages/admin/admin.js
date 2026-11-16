// Admin Dashboard JavaScript
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
        const nav = event.target.closest('.nav-item') || event.target;
        nav.classList.add('active');
    }
    
    // Update section title
    const titles = {
        'overview': 'Admin Overview',
        'users': 'User Management',
        'sellers': 'Seller Management',
        'invites': 'Seller Invites',
        'products': 'Product Management',
        'orders': 'Order Management',
        'reports': 'Reports & Flags',
        'settings': 'Platform Settings'
    };
    
    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) {
        sectionTitle.textContent = titles[sectionName] || sectionName;
    }

    if (sectionName === 'invites') {
        renderSellerInvites();
    }
}

// ----- Seller invite management (backend-first, localStorage fallback) -----

function getLocalInvites() {
    return JSON.parse(localStorage.getItem('thriftloop_seller_invites') || '[]');
}

function saveLocalInvites(invites) {
    localStorage.setItem('thriftloop_seller_invites', JSON.stringify(invites));
}

async function backendAvailable() {
    if (typeof ThriftLoopAPI === 'undefined') return false;
    try {
        await ThriftLoopAPI.request('/api/health');
        return true;
    } catch (e) {
        return false;
    }
}

function normalizeServerInvite(inv) {
    return {
        token: inv.token,
        status: inv.status || 'active',
        createdAt: inv.created_at || inv.createdAt || new Date().toISOString(),
        usedBy: inv.used_by_user_id || '-'
    };
}

function normalizeLocalInvite(inv) {
    return {
        token: inv.token,
        status: inv.used ? 'used' : 'active',
        createdAt: inv.createdAt,
        usedBy: inv.usedBy || '-'
    };
}

async function generateSellerInvite() {
    const backend = await backendAvailable();
    if (backend) {
        if (!localStorage.getItem('thriftloop_token')) {
            alert('Please login as Admin from the homepage first.');
            return;
        }
        try {
            await ThriftLoopAPI.request('/api/admin/invites', {
                method: 'POST',
                headers: ThriftLoopAPI.authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({})
            });
            await renderSellerInvites();
            return;
        } catch (e) {
            if (e.status) {
                alert(e.status === 401 || e.status === 403
                    ? 'Admin session invalid. Logout and login again as Admin.'
                    : ('Could not create invite: ' + e.message));
                return;
            }
            // network error -> fall back to local demo
        }
    }

    // Local demo fallback (backend offline)
    const invites = getLocalInvites();
    const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    invites.unshift({
        token,
        createdAt: new Date().toISOString(),
        used: false,
        usedBy: null,
        usedAt: null
    });
    saveLocalInvites(invites);
    await renderSellerInvites();
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-gray);">No invites yet. Generate one to share with a seller.</td></tr>';
        return;
    }
    tbody.innerHTML = invites.map(inv => {
        const link = getSellerInviteLink(inv.token);
        const created = new Date(inv.createdAt).toLocaleString();
        const status = inv.status === 'active'
            ? '<span class="status-badge active">Active</span>'
            : '<span class="status-badge inactive">' + (inv.status.charAt(0).toUpperCase() + inv.status.slice(1)) + '</span>';
        const usedBy = inv.usedBy || '-';
        return `
            <tr>
                <td>${created}</td>
                <td>${status}</td>
                <td><input type="text" readonly value="${link}" style="width:100%; min-width:260px; padding:0.4rem 0.6rem; border-radius:8px; border:1px solid var(--border-color); background:var(--surface-soft); color:var(--text-light);" onclick="this.select()"></td>
                <td>${usedBy}</td>
                <td><button class="btn-small btn-secondary" onclick="copyInviteLink('${inv.token}')"><i class="fas fa-copy"></i> Copy</button></td>
            </tr>
        `;
    }).join('');
}

async function renderSellerInvites() {
    const tbody = document.getElementById('invitesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-gray);">Loading invites...</td></tr>';

    const backend = await backendAvailable();
    if (backend) {
        if (!localStorage.getItem('thriftloop_token')) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-gray);">Please login as Admin from the homepage to manage seller invites.</td></tr>';
            return;
        }
        try {
            const data = await ThriftLoopAPI.request('/api/admin/invites', {
                headers: ThriftLoopAPI.authHeaders()
            });
            renderInviteRows((data.invites || []).map(normalizeServerInvite));
            return;
        } catch (e) {
            if (e.status === 401 || e.status === 403) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-gray);">Admin session expired. Logout and login again as Admin.</td></tr>';
                return;
            }
            // network error -> fall back
        }
    }

    renderInviteRows(getLocalInvites().map(normalizeLocalInvite));
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Dashboard Loaded');
    renderSellerInvites();
});
