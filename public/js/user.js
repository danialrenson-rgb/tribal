// VANATVA - User Portal & Dashboard Logic

let currentUser = null;
let userOrders = [];

document.addEventListener('DOMContentLoaded', () => {
  checkUserAuth();
});

// Toast notification helper
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast) return;

  toast.className = `show toast-${type}`;
  toastMessage.textContent = message;

  if (type === 'success') {
    toastIcon.className = 'fa-solid fa-circle-check';
  } else if (type === 'error') {
    toastIcon.className = 'fa-solid fa-triangle-exclamation';
  } else {
    toastIcon.className = 'fa-solid fa-circle-info';
  }

  setTimeout(() => {
    toast.className = '';
  }, 4000);
}

// Toggle between Sign In and Register forms
function toggleAuthMode(mode) {
  const formLogin = document.getElementById('userLoginForm');
  const formRegister = document.getElementById('userRegisterForm');
  const btnSignIn = document.getElementById('tabBtnSignIn');
  const btnSignUp = document.getElementById('tabBtnSignUp');
  const heading = document.getElementById('authHeading');

  if (mode === 'login') {
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
    btnSignIn.className = 'flex-1 py-2 rounded-lg bg-white text-stone-900 shadow-sm transition';
    btnSignUp.className = 'flex-1 py-2 rounded-lg text-stone-500 hover:text-stone-900 transition';
    heading.textContent = 'Welcome Back, Supporter';
  } else {
    formLogin.classList.add('hidden');
    formRegister.classList.remove('hidden');
    btnSignUp.className = 'flex-1 py-2 rounded-lg bg-white text-stone-900 shadow-sm transition';
    btnSignIn.className = 'flex-1 py-2 rounded-lg text-stone-500 hover:text-stone-900 transition';
    heading.textContent = 'Join the Tribal Collective';
  }
}

// Check session
async function checkUserAuth() {
  try {
    const res = await fetch('/api/user/me');
    const data = await res.json();

    if (data.success && data.user) {
      currentUser = data.user;
      showUserDashboard();
    } else {
      showUserAuthSection();
    }
  } catch (err) {
    showUserAuthSection();
  }
}

function showUserAuthSection() {
  document.getElementById('userAuthSection').classList.remove('hidden');
  document.getElementById('userDashboardView').classList.add('hidden');
  document.getElementById('userHeaderActions').classList.add('hidden');
}

function showUserDashboard() {
  document.getElementById('userAuthSection').classList.add('hidden');
  document.getElementById('userDashboardView').classList.remove('hidden');
  document.getElementById('userHeaderActions').classList.remove('hidden');

  document.getElementById('userDisplayName').textContent = currentUser.name;

  // Populate profile fields
  document.getElementById('profName').value = currentUser.name || '';
  document.getElementById('profEmail').value = currentUser.email || '';
  document.getElementById('profPhone').value = currentUser.phone || '';
  document.getElementById('profAddress').value = currentUser.address || '';
  document.getElementById('profCity').value = currentUser.city || '';
  document.getElementById('profState').value = currentUser.state || '';
  document.getElementById('profPincode').value = currentUser.pincode || '';

  loadUserOrders();
}

// User Login
async function handleUserLogin(event) {
  event.preventDefault();
  const btn = document.getElementById('loginSubmitBtn');
  const originalHtml = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const res = await fetch('/api/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      showToast(`Welcome back, ${currentUser.name}!`, 'success');
      showUserDashboard();
    } else {
      showToast(data.message || 'Invalid email or password.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// User Register
async function handleUserRegister(event) {
  event.preventDefault();
  const btn = document.getElementById('regSubmitBtn');
  const originalHtml = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';

    const payload = {
      name: document.getElementById('regName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      password: document.getElementById('regPassword').value,
      address: document.getElementById('regAddress').value.trim(),
      city: document.getElementById('regCity').value.trim(),
      state: document.getElementById('regState').value.trim(),
      pincode: document.getElementById('regPincode').value.trim()
    };

    const res = await fetch('/api/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      showToast('Account created successfully! Welcome to VANATVA.', 'success');
      showUserDashboard();
    } else {
      showToast(data.message || 'Registration failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// User Logout
async function handleUserLogout() {
  try {
    await fetch('/api/user/logout', { method: 'POST' });
    currentUser = null;
    showToast('You have been logged out.', 'info');
    showUserAuthSection();
  } catch (err) {
    showToast('Logout error.', 'error');
  }
}

// Tab Switch
function switchUserTab(tab) {
  const containerOrders = document.getElementById('userOrdersContainer');
  const containerProfile = document.getElementById('userProfileContainer');
  const btnOrders = document.getElementById('userTabBtnOrders');
  const btnProfile = document.getElementById('userTabBtnProfile');

  if (tab === 'orders') {
    containerOrders.classList.remove('hidden');
    containerProfile.classList.add('hidden');
    btnOrders.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-stone-900 text-white shadow-sm flex items-center gap-2 transition';
    btnProfile.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200 flex items-center gap-2 transition';
  } else {
    containerOrders.classList.add('hidden');
    containerProfile.classList.remove('hidden');
    btnProfile.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-stone-900 text-white shadow-sm flex items-center gap-2 transition';
    btnOrders.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200 flex items-center gap-2 transition';
  }
}

// Load User's Orders
async function loadUserOrders() {
  try {
    const res = await fetch('/api/user/orders');
    const data = await res.json();

    if (data.success) {
      userOrders = data.orders;
      document.getElementById('userOrdersCount').textContent = userOrders.length;
      renderUserOrders(userOrders);
    }
  } catch (err) {
    console.error('Error fetching user orders:', err);
  }
}

function renderUserOrders(orders = []) {
  const list = document.getElementById('userOrdersList');
  const empty = document.getElementById('userEmptyOrders');

  if (!orders || orders.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const statusClasses = {
    'Pending': 'badge-pending',
    'Contacted': 'badge-contacted',
    'Order Confirmed': 'badge-confirmed',
    'Dispatched': 'badge-dispatched',
    'Delivered': 'badge-delivered',
    'Cancelled': 'badge-cancelled'
  };

  list.innerHTML = orders.map(order => {
    const badgeClass = statusClasses[order.status] || 'badge-pending';
    const dateStr = new Date(order.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return `
      <div class="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
        
        <div class="flex gap-4 items-center flex-1 min-w-0">
          <img 
            src="${order.product_image || 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'}" 
            alt="${order.product_title}" 
            class="w-20 h-20 rounded-xl object-cover border border-stone-200 shrink-0"
          >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-mono font-bold text-amber-900 text-xs">${order.order_code}</span>
              <span class="text-[11px] text-stone-400">• Placed on ${dateStr}</span>
            </div>
            <h4 class="font-bold text-stone-900 text-base leading-snug truncate">${order.product_title}</h4>
            <div class="text-xs text-stone-500 mt-0.5">
              <span>Qty: <strong class="text-stone-800">${order.quantity}</strong></span>
              <span class="mx-1.5">•</span>
              <span>Total: <strong class="text-stone-900">₹${Number(order.total_amount).toLocaleString('en-IN')}</strong></span>
              <span class="mx-1.5">•</span>
              <span class="text-amber-800">${order.artisan_tribe || 'Tribal Community'}</span>
            </div>
            ${order.admin_notes ? `
              <div class="mt-2 text-[11px] bg-amber-50 text-amber-900 p-2 rounded-lg border border-amber-200 font-medium">
                <i class="fa-solid fa-circle-info mr-1 text-amber-700"></i> Coordinator Note: ${order.admin_notes}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-100">
          <span class="px-3 py-1 rounded-full text-xs font-bold ${badgeClass}">
            ${order.status}
          </span>
          <span class="text-[11px] text-stone-500 text-right">
            Shipped to: ${order.client_city || 'Registered Address'}
          </span>
        </div>

      </div>
    `;
  }).join('');
}

// Save Profile Updates
async function handleUpdateProfile(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('profName').value.trim(),
    phone: document.getElementById('profPhone').value.trim(),
    address: document.getElementById('profAddress').value.trim(),
    city: document.getElementById('profCity').value.trim(),
    state: document.getElementById('profState').value.trim(),
    pincode: document.getElementById('profPincode').value.trim()
  };

  try {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast('Profile and shipping details updated!', 'success');
      currentUser.name = payload.name;
      document.getElementById('userDisplayName').textContent = payload.name;
    } else {
      showToast(data.message || 'Update failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to update profile.', 'error');
  }
}

