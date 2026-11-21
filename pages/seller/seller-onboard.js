// Seller onboarding — invite-gated, backend only (no localStorage accounts/invites)

let sellerInviteToken = null;

async function validateInvite(token) {
    try {
        const data = await ThriftLoopAPI.request('/api/invites/validate?token=' + encodeURIComponent(token));
        return !!data.valid;
    } catch (e) {
        return false;
    }
}

async function gateSellerSignup() {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get('invite') || '').trim();
    const gate = document.getElementById('inviteGateMessage');
    const content = document.getElementById('sellerSignupContent');

    if (!token || !(await validateInvite(token))) {
        sellerInviteToken = null;
        if (gate) gate.style.display = 'block';
        if (content) content.style.display = 'none';
        return false;
    }

    sellerInviteToken = token;
    if (gate) gate.style.display = 'none';
    if (content) content.style.display = 'block';
    return true;
}

document.addEventListener('DOMContentLoaded', gateSellerSignup);

function nextStep(current) {
    if (current === 1) {
        const required = ['sellerFullName', 'sellerPhone', 'sellerEmail', 'sellerPassword', 'sellerCity', 'sellerNationality', 'sellerHandoverAddress'];
        for (const id of required) {
            const el = document.getElementById(id);
            if (!el || !el.value.trim()) {
                alert('Please fill all required details.');
                return;
            }
        }
        if (document.getElementById('sellerNationality').value.trim().toLowerCase() !== 'indian') {
            alert('Nationality must be Indian.');
            return;
        }
    }

    document.getElementById(`step-${current}`).classList.remove('active');
    document.querySelector(`.step[data-step="${current}"]`).classList.remove('active');
    const next = current + 1;
    document.getElementById(`step-${next}`).classList.add('active');
    document.querySelector(`.step[data-step="${next}"]`).classList.add('active');
    document.querySelector('.signup-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prevStep(current) {
    document.getElementById(`step-${current}`).classList.remove('active');
    document.querySelector(`.step[data-step="${current}"]`).classList.remove('active');
    const prev = current - 1;
    document.getElementById(`step-${prev}`).classList.add('active');
    document.querySelector(`.step[data-step="${prev}"]`).classList.add('active');
    document.querySelector('.signup-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function previewPfp(event) {
    const file = event.target.files[0];
    if (!file) return;
    const preview = document.getElementById('uploadPreview');
    const reader = new FileReader();
    reader.onload = function (e) {
        preview.innerHTML = `<img src="${e.target.result}" alt="Profile preview">`;
        preview.classList.add('has-image');
    };
    reader.readAsDataURL(file);
    document.getElementById('pfpUpload').checked = true;
}

function normalizeSellerUserFromApi(apiUser) {
    const sp = apiUser.seller_profile || {};
    const apiBase = (window.ThriftLoopAPI && window.ThriftLoopAPI.base) || '';
    const photo = sp.photo_path ? (sp.photo_path.startsWith('http') ? sp.photo_path : apiBase + sp.photo_path) : null;
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

async function completeSignup() {
    const file = document.getElementById('pfpFile').files[0];
    if (!file) {
        alert('Please upload your real photo to continue.');
        return;
    }
    if (!sellerInviteToken) {
        alert('Invite link is missing. Please open the signup link sent by admin.');
        gateSellerSignup();
        return;
    }

    const fd = new FormData();
    fd.append('invite_token', sellerInviteToken);
    fd.append('full_name', document.getElementById('sellerFullName').value.trim());
    fd.append('email', document.getElementById('sellerEmail').value.trim());
    fd.append('phone', document.getElementById('sellerPhone').value.trim());
    fd.append('password', document.getElementById('sellerPassword').value.trim());
    fd.append('city', document.getElementById('sellerCity').value.trim());
    fd.append('nationality', document.getElementById('sellerNationality').value.trim());
    fd.append('handover_address', document.getElementById('sellerHandoverAddress').value.trim());
    fd.append('photo', file);

    try {
        const res = await fetch(ThriftLoopAPI.base + '/api/seller/signup', { method: 'POST', body: fd });
        let data = {};
        try { data = await res.json(); } catch (e) { /* ignore */ }
        if (!res.ok) {
            alert('Signup failed: ' + (data.error || ('HTTP ' + res.status)));
            if (res.status === 400 && /invite/i.test(data.error || '')) gateSellerSignup();
            return;
        }
        localStorage.setItem('thriftloop_token', data.token);
        localStorage.setItem('thriftloop_current_user', JSON.stringify(normalizeSellerUserFromApi(data.user)));
        localStorage.setItem('thriftloop_user_type', 'seller');
        alert('Seller account created successfully!\nYou will hand over orders at your nearby handover address. ThriftLoop will deliver to customers.\nRedirecting to Seller Dashboard...');
        window.location.href = 'seller.html';
    } catch (e) {
        alert('Could not reach the backend. Please try again once it is reachable.');
    }
}
