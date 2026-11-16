let sellerInviteToken = null;
let signupUseBackend = false;

function getInvites() {
    return JSON.parse(localStorage.getItem('thriftloop_seller_invites') || '[]');
}

function saveInvites(invites) {
    localStorage.setItem('thriftloop_seller_invites', JSON.stringify(invites));
}

function getValidInvite(token) {
    if (!token) return null;
    const invites = getInvites();
    let invite = invites.find(i => i.token === token);

    // Offline demo fallback: accept a shared token on first open and track it
    // locally as a one-time invite.
    if (!invite) {
        invite = {
            token,
            createdAt: new Date().toISOString(),
            used: false,
            usedBy: null,
            usedAt: null,
            source: 'shared-link'
        };
        invites.unshift(invite);
        saveInvites(invites);
    }

    return invite.used ? null : invite;
}

function markInviteUsed(token, usedBy) {
    if (!token) return;
    const invites = getInvites();
    let idx = invites.findIndex(i => i.token === token);
    if (idx === -1) {
        invites.unshift({ token, createdAt: new Date().toISOString(), used: false, usedBy: null, usedAt: null, source: 'shared-link' });
        idx = 0;
    }
    invites[idx].used = true;
    invites[idx].usedBy = usedBy || null;
    invites[idx].usedAt = new Date().toISOString();
    saveInvites(invites);
}

async function validateInviteOnBackend(token) {
    try {
        const data = await ThriftLoopAPI.request('/api/invites/validate?token=' + encodeURIComponent(token));
        return { backend: true, valid: !!data.valid };
    } catch (e) {
        if (e.status) return { backend: true, valid: false };
        return { backend: false, valid: null };
    }
}

async function gateSellerSignup() {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get('invite') || '').trim();
    const gate = document.getElementById('inviteGateMessage');
    const content = document.getElementById('sellerSignupContent');

    if (!token) {
        sellerInviteToken = null;
        if (gate) gate.style.display = 'block';
        if (content) content.style.display = 'none';
        return false;
    }

    let valid = false;
    if (window.ThriftLoopAPI) {
        const result = await validateInviteOnBackend(token);
        if (result.backend) {
            signupUseBackend = true;
            valid = result.valid;
        } else {
            signupUseBackend = false;
            valid = !!getValidInvite(token);
        }
    } else {
        signupUseBackend = false;
        valid = !!getValidInvite(token);
    }

    if (!valid) {
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
    // Validate step 1 (seller details)
    if (current === 1) {
        const name = document.getElementById('sellerFullName').value.trim();
        const phone = document.getElementById('sellerPhone').value.trim();
        const email = document.getElementById('sellerEmail').value.trim();
        const pass = document.getElementById('sellerPassword').value.trim();
        const city = document.getElementById('sellerCity').value.trim();
        const nationality = (document.getElementById('sellerNationality')?.value || '').trim();
        const handover = document.getElementById('sellerHandoverAddress').value.trim();

        if (!name || !phone || !email || !pass || !city || !nationality || !handover) {
            alert('Please fill all required details.');
            return;
        }
        if (nationality.toLowerCase() !== 'indian') {
            alert('Nationality must be Indian.');
            return;
        }
    }

    // Hide current step
    document.getElementById(`step-${current}`).classList.remove('active');
    document.querySelector(`.step[data-step="${current}"]`).classList.remove('active');

    // Show next step
    const next = current + 1;
    document.getElementById(`step-${next}`).classList.add('active');
    document.querySelector(`.step[data-step="${next}"]`).classList.add('active');

    // Scroll to top of card
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

    const payload = {
        invite_token: sellerInviteToken,
        full_name: document.getElementById('sellerFullName').value.trim(),
        email: document.getElementById('sellerEmail').value.trim(),
        phone: document.getElementById('sellerPhone').value.trim(),
        password: document.getElementById('sellerPassword').value.trim(),
        city: document.getElementById('sellerCity').value.trim(),
        nationality: (document.getElementById('sellerNationality').value || 'Indian').trim(),
        handover_address: document.getElementById('sellerHandoverAddress').value.trim()
    };

    if (!payload.full_name || !payload.email || !payload.phone || !payload.password ||
        !payload.city || !payload.handover_address) {
        alert('Please fill all required details.');
        return;
    }
    if (payload.nationality.toLowerCase() !== 'indian') {
        alert('Nationality must be Indian.');
        return;
    }

    // Backend signup (real account + server-side invite validation)
    if (signupUseBackend && window.ThriftLoopAPI) {
        const fd = new FormData();
        Object.keys(payload).forEach(k => fd.append(k, payload[k]));
        fd.append('photo', file);

        try {
            const res = await fetch(ThriftLoopAPI.base + '/api/seller/signup', {
                method: 'POST',
                body: fd
            });
            let data = {};
            try { data = await res.json(); } catch (e) {}
            if (!res.ok) {
                alert('Signup failed: ' + (data.error || ('HTTP ' + res.status)));
                if (res.status === 400 && /invite/i.test(data.error || '')) {
                    gateSellerSignup();
                }
                return;
            }
            localStorage.setItem('thriftloop_token', data.token);
            localStorage.setItem('thriftloop_current_user', JSON.stringify(normalizeSellerUserFromApi(data.user)));
            localStorage.setItem('thriftloop_user_type', 'seller');
            alert('Seller account created successfully!\nYou will hand over orders at your nearby handover address. ThriftLoop will deliver to customers.\nRedirecting to Seller Dashboard...');
            window.location.href = 'seller.html';
            return;
        } catch (e) {
            alert('Could not reach the backend. Please try again once it is reachable.');
            return;
        }
    }

    // Offline demo fallback (localStorage only)
    if (!getValidInvite(sellerInviteToken)) {
        alert('This invite link is invalid or has already been used. Please contact admin for a new link.');
        gateSellerSignup();
        return;
    }

    const sellerData = {
        id: 'SELL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        fullName: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        city: payload.city,
        nationality: payload.nationality,
        handoverAddress: payload.handover_address,
        displayName: payload.full_name || 'Seller',
        pfpChoice: 'upload',
        pfpImage: null,
        role: 'seller',
        createdAt: new Date().toISOString()
    };

    const reader = new FileReader();
    reader.onload = function (e) {
        sellerData.pfpImage = e.target.result;
        localStorage.setItem('thriftloop_seller_' + sellerData.email, JSON.stringify(sellerData));
        localStorage.setItem('thriftloop_current_user', JSON.stringify(sellerData));
        markInviteUsed(sellerInviteToken, sellerData.email);
        alert('Seller account created successfully!\nYou will hand over orders at your nearby handover address. ThriftLoop will deliver to customers.\nRedirecting to Seller Dashboard...');
        window.location.href = 'seller.html';
    };
    reader.readAsDataURL(file);
}
