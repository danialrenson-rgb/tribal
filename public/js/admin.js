// VANATVA - Tribal Community Platform Admin Dashboard Logic

let currentAdmin = null;
let currentOrders = [];
let currentProducts = [];
let activeAdminTab = 'orders';
let activeOrderForModal = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
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

// Toggle password visibility
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// Helper to prefill default credentials requested by user
// danialrenson@gmail.com / danial
function prefillAdminLogin() {
  document.getElementById('adminLoginEmail').value = 'danialrenson@gmail.com';
  document.getElementById('adminLoginPassword').value = 'danial';
  showToast('Default credentials entered! Click Sign In.', 'info');
}

// Check admin authentication state
async function checkAdminAuth() {
  try {
    const res = await fetch('/api/admin/me');
    const data = await res.json();

    if (data.success && data.admin) {
      currentAdmin = data.admin;
      showAdminMainApp();
    } else {
      showAdminLoginView();
    }
  } catch (err) {
    showAdminLoginView();
  }
}

function showAdminLoginView() {
  document.getElementById('adminLoginView').classList.remove('hidden');
  document.getElementById('adminMainApp').classList.add('hidden');
}

function showAdminMainApp() {
  document.getElementById('adminLoginView').classList.add('hidden');
  document.getElementById('adminMainApp').classList.remove('hidden');
  document.getElementById('headerAdminEmail').textContent = currentAdmin.email;

  loadAdminStats();
  loadAdminOrders();
  loadAdminProducts();
}

// Handle Admin Login
async function handleAdminLogin(event) {
  event.preventDefault();
  const btn = document.getElementById('adminLoginBtn');
  const originalHtml = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

    const email = document.getElementById('adminLoginEmail').value.trim();
    const password = document.getElementById('adminLoginPassword').value;

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
      currentAdmin = data.admin;
      showToast('Welcome back, Admin!', 'success');
      showAdminMainApp();
    } else {
      showToast(data.message || 'Invalid email or password.', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Failed to connect to server.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Handle Admin Logout
async function handleAdminLogout() {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
    currentAdmin = null;
    showToast('Logged out of admin dashboard.', 'info');
    showAdminLoginView();
  } catch (err) {
    showToast('Logout failed.', 'error');
  }
}

// ==========================================
// CHANGE PASSWORD FUNCTIONALITY (CORE USER REQUIREMENT)
// Requirement:
// "at admin can change at any time using change password"
// ==========================================

function openChangePasswordModal() {
  document.getElementById('changePasswordForm').reset();
  const modal = document.getElementById('changePasswordModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function handleChangePasswordSubmit(event) {
  event.preventDefault();

  const currentPassword = document.getElementById('currentPasswordInput').value;
  const newPassword = document.getElementById('newPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;
  const submitBtn = document.getElementById('changePasswordSubmitBtn');

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  if (newPassword.length < 4) {
    showToast('New password must be at least 4 characters.', 'error');
    return;
  }

  const originalHtml = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating password...';

    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Admin password changed successfully! Your new password is now active.', 'success');
      closeChangePasswordModal();
    } else {
      showToast(data.message || 'Failed to update password. Check current password.', 'error');
    }
  } catch (err) {
    console.error('Change password error:', err);
    showToast('Failed to connect to server.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

// ==========================================
// DASHBOARD METRICS & STATS
// ==========================================

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();

    if (data.success && data.stats) {
      const s = data.stats;
      document.getElementById('statTotalOrders').textContent = s.totalOrders;
      document.getElementById('statPendingOrders').textContent = s.pendingOrders;
      document.getElementById('statTotalRevenue').textContent = `₹${Number(s.totalRevenue).toLocaleString('en-IN')}`;
      document.getElementById('statTotalProducts').textContent = s.totalProducts;
      document.getElementById('ordersTabBadge').textContent = s.pendingOrders > 0 ? `${s.pendingOrders} pending` : s.totalOrders;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Switch between Orders and Products tabs
function switchTab(tab) {
  activeAdminTab = tab;

  const tabOrders = document.getElementById('tabContentOrders');
  const tabProducts = document.getElementById('tabContentProducts');
  const btnOrders = document.getElementById('tabBtnOrders');
  const btnProducts = document.getElementById('tabBtnProducts');
  const actionBtn = document.getElementById('tabActionBtn');

  if (tab === 'orders') {
    tabOrders.classList.remove('hidden');
    tabProducts.classList.add('hidden');

    btnOrders.className = 'px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition bg-stone-900 text-white shadow-sm';
    btnProducts.className = 'px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition text-stone-600 hover:text-stone-900 hover:bg-stone-200';
    actionBtn.classList.add('hidden');

    loadAdminOrders();
  } else {
    tabOrders.classList.add('hidden');
    tabProducts.classList.remove('hidden');

    btnProducts.className = 'px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition bg-stone-900 text-white shadow-sm';
    btnOrders.className = 'px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition text-stone-600 hover:text-stone-900 hover:bg-stone-200';
    actionBtn.classList.remove('hidden');

    loadAdminProducts();
  }
}

// ==========================================
// CLIENT ORDERS / INQUIRIES MANAGEMENT
// Requirement:
// "when user click the product and click buy option 
// sent the clint details including name, number, product, details, id ,mail to the admin dashboard"
// ==========================================

async function loadAdminOrders() {
  try {
    const searchVal = document.getElementById('adminOrderSearch').value.trim();
    const statusVal = document.getElementById('adminStatusFilter').value;

    let url = '/api/admin/orders';
    const params = new URLSearchParams();

    if (statusVal && statusVal !== 'All') {
      params.append('status', statusVal);
    }
    if (searchVal) {
      params.append('search', searchVal);
    }
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      currentOrders = data.orders;
      renderOrdersTable(currentOrders);
    }
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

let orderSearchDebounce;
function handleOrderSearch(val) {
  clearTimeout(orderSearchDebounce);
  orderSearchDebounce = setTimeout(() => {
    loadAdminOrders();
  }, 350);
}

function handleStatusFilterChange(val) {
  loadAdminOrders();
}

function renderOrdersTable(orders = []) {
  const tbody = document.getElementById('ordersTableBody');
  const emptyState = document.getElementById('ordersEmptyState');

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  tbody.innerHTML = orders.map(order => {
    // Format Phone for direct WhatsApp link (clean digits)
    const cleanPhone = order.client_phone.replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waText = encodeURIComponent(
      `Hello ${order.client_name}! Greetings from VANATVA Tribal Community. We received your purchase inquiry for order ${order.order_code} (${order.product_title}).`
    );

    // Status Badge Color Class
    const statusClasses = {
      'Pending': 'badge-pending',
      'Contacted': 'badge-contacted',
      'Order Confirmed': 'badge-confirmed',
      'Dispatched': 'badge-dispatched',
      'Delivered': 'badge-delivered',
      'Cancelled': 'badge-cancelled'
    };
    const badgeClass = statusClasses[order.status] || 'badge-pending';

    const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <tr class="hover:bg-stone-50/80 transition">
        
        <!-- Order Code & Timestamp -->
        <td class="py-3.5 px-4 font-mono">
          <span class="font-bold text-amber-900 block">${order.order_code}</span>
          <span class="text-[11px] text-stone-400 block">${orderDate}</span>
          ${order.admin_notes ? `<span class="inline-block mt-1 text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-sans truncate max-w-[130px]" title="${order.admin_notes}">📌 Note: ${order.admin_notes}</span>` : ''}
        </td>

        <!-- Client Details: Name, Phone, Mail -->
        <td class="py-3.5 px-4">
          <div class="font-bold text-stone-900">${order.client_name}</div>
          <div class="flex items-center gap-2 mt-1 text-xs">
            <!-- Click-to-call link -->
            <a href="tel:${order.client_phone}" class="text-stone-700 hover:text-amber-800 font-medium flex items-center gap-1" title="Call Client">
              <i class="fa-solid fa-phone text-[10px] text-amber-700"></i> ${order.client_phone}
            </a>
            <!-- Direct WhatsApp link -->
            <a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" class="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="Chat on WhatsApp">
              <i class="fa-brands fa-whatsapp text-xs"></i> Chat
            </a>
          </div>
          <!-- Click-to-email link -->
          <a href="mailto:${order.client_email}?subject=Regarding Your Order ${order.order_code} - VANATVA Tribal Community" class="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 mt-0.5">
            <i class="fa-solid fa-envelope text-[10px]"></i> ${order.client_email}
          </a>
        </td>

        <!-- Product Details -->
        <td class="py-3.5 px-4 max-w-xs">
          <div class="font-semibold text-stone-900 truncate" title="${order.product_title}">
            ${order.product_title}
          </div>
          <div class="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
            <span>ID: <code class="font-mono text-stone-700 font-bold">#${order.product_id}</code></span>
            <span>•</span>
            <span>Qty: <strong class="text-stone-800">${order.quantity}</strong></span>
            <span>•</span>
            <span>₹${Number(order.product_price).toLocaleString('en-IN')} each</span>
          </div>
          <div class="text-[10px] text-amber-800 truncate mt-0.5">
            ${order.artisan_tribe || 'Tribal Community'}
          </div>
        </td>

        <!-- Total Amount -->
        <td class="py-3.5 px-4 font-extrabold text-stone-900 whitespace-nowrap text-sm">
          ₹${Number(order.total_amount).toLocaleString('en-IN')}
        </td>

        <!-- Status & Inline Update -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeClass}">
              ${order.status}
            </span>
            <select 
              onchange="quickUpdateOrderStatus(${order.id}, this.value)" 
              class="text-[11px] bg-stone-100 border border-stone-200 rounded-lg p-1 text-stone-700 focus:outline-none"
            >
              <option value="" disabled selected>Change Status...</option>
              <option value="Pending">Pending</option>
              <option value="Contacted">Contacted</option>
              <option value="Order Confirmed">Confirmed</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </td>

        <!-- Actions -->
        <td class="py-3.5 px-4 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <!-- Full details modal button -->
            <button 
              onclick="openOrderDetailsModal(${order.id})" 
              class="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1 transition"
              title="View full client shipping & instructions"
            >
              <i class="fa-solid fa-eye text-xs"></i>
              <span>Details</span>
            </button>

            <!-- Delete Order button -->
            <button 
              onclick="confirmDeleteOrder(${order.id})" 
              class="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Delete record"
            >
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>

      </tr>
    `;
  }).join('');
}

// Quick status change from dropdown
async function quickUpdateOrderStatus(orderId, newStatus) {
  if (!newStatus) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Status updated to "${newStatus}"!`, 'success');
      loadAdminOrders();
      loadAdminStats();
    } else {
      showToast(data.message || 'Status update failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to update status.', 'error');
  }
}

// Full Order Details Modal
function openOrderDetailsModal(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) return;

  activeOrderForModal = order;

  document.getElementById('modalOrderCode').textContent = order.order_code;
  document.getElementById('modalClientName').textContent = order.client_name;
  document.getElementById('modalClientPhone').textContent = order.client_phone;
  document.getElementById('modalClientEmail').textContent = order.client_email;

  // Complete address format
  let fullAddress = order.client_address;
  if (order.client_city) fullAddress += `, ${order.client_city}`;
  if (order.client_state) fullAddress += `, ${order.client_state}`;
  if (order.client_pincode) fullAddress += ` - ${order.client_pincode}`;
  document.getElementById('modalClientAddress').textContent = fullAddress;

  document.getElementById('modalClientNotes').textContent = order.client_notes || 'No special requests provided.';

  // Product info
  document.getElementById('modalProductTitle').textContent = order.product_title;
  document.getElementById('modalProductId').textContent = `#${order.product_id}`;
  document.getElementById('modalProductPrice').textContent = Number(order.product_price).toLocaleString('en-IN');
  document.getElementById('modalProductQty').textContent = order.quantity;
  document.getElementById('modalProductTotal').textContent = Number(order.total_amount).toLocaleString('en-IN');
  document.getElementById('modalProductImage').src = order.product_image || 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80';

  // Status & Note
  document.getElementById('modalStatusSelect').value = order.status;
  document.getElementById('modalAdminNote').value = order.admin_notes || '';

  // WhatsApp Button
  const cleanPhone = order.client_phone.replace(/\D/g, '');
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waText = encodeURIComponent(
    `Hello ${order.client_name}! Greetings from VANATVA Tribal Community. We are preparing your order ${order.order_code} for ${order.product_title}.`
  );
  document.getElementById('modalWhatsAppDirectBtn').onclick = () => {
    window.open(`https://wa.me/${waPhone}?text=${waText}`, '_blank');
  };

  const modal = document.getElementById('orderDetailsModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeOrderDetailsModal() {
  const modal = document.getElementById('orderDetailsModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function saveModalOrderChanges() {
  if (!activeOrderForModal) return;

  const newStatus = document.getElementById('modalStatusSelect').value;
  const newNote = document.getElementById('modalAdminNote').value.trim();

  try {
    // Update status
    await fetch(`/api/admin/orders/${activeOrderForModal.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    // Update internal note
    await fetch(`/api/admin/orders/${activeOrderForModal.id}/note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: newNote })
    });

    showToast('Order details and note saved successfully!', 'success');
    closeOrderDetailsModal();
    loadAdminOrders();
    loadAdminStats();
  } catch (err) {
    showToast('Failed to save changes.', 'error');
  }
}

async function confirmDeleteOrder(orderId) {
  if (!confirm('Are you sure you want to delete this client order record?')) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Order deleted.', 'info');
      loadAdminOrders();
      loadAdminStats();
    } else {
      showToast(data.message || 'Delete failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to delete order.', 'error');
  }
}

// ==========================================
// PRODUCTS MANAGEMENT
// ==========================================

async function loadAdminProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();

    if (data.success) {
      currentProducts = data.products;
      renderAdminProductsGrid(currentProducts);
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

function renderAdminProductsGrid(products = []) {
  const grid = document.getElementById('adminProductsGrid');
  if (!grid) return;

  grid.innerHTML = products.map(p => `
    <div class="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm flex flex-col">
      <div class="relative aspect-video bg-stone-100">
        <img src="${p.image_url}" alt="${p.title}" class="w-full h-full object-cover">
        <span class="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-stone-900/80 text-white backdrop-blur-sm">
          ${p.category}
        </span>
        <span class="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-800 text-white">
          Stock: ${p.stock}
        </span>
      </div>

      <div class="p-4 flex-1 flex flex-col">
        <div class="text-[11px] text-amber-800 font-bold mb-1 truncate">${p.artisan_tribe}</div>
        <h4 class="font-bold text-stone-900 text-sm leading-snug line-clamp-1 mb-1">${p.title}</h4>
        <p class="text-xs text-stone-500 line-clamp-2 leading-relaxed flex-1">${p.description}</p>
        
        <div class="pt-3 border-t border-stone-100 mt-3 flex items-center justify-between">
          <span class="text-base font-black text-amber-900">₹${Number(p.price).toLocaleString('en-IN')}</span>
          <div class="flex items-center gap-2">
            <button onclick="openEditProductModal(${p.id})" class="px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition">
              Edit
            </button>
            <button onclick="confirmDeleteProduct(${p.id})" class="p-1 text-stone-400 hover:text-rose-600 transition" title="Delete Product">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Add / Edit Product Modals
function openAddProductModal() {
  document.getElementById('productForm').reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('productModalHeading').textContent = 'Add New Tribal Product';
  const modal = document.getElementById('productModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function openEditProductModal(productId) {
  const p = currentProducts.find(item => item.id === productId);
  if (!p) return;

  document.getElementById('editProductId').value = p.id;
  document.getElementById('prodTitle').value = p.title;
  document.getElementById('prodCategory').value = p.category;
  document.getElementById('prodPrice').value = p.price;
  document.getElementById('prodStock').value = p.stock;
  document.getElementById('prodArtisanName').value = p.artisan_name;
  document.getElementById('prodTribe').value = p.artisan_tribe;
  document.getElementById('prodLocation').value = p.artisan_location;
  document.getElementById('prodImageUrl').value = p.image_url;
  document.getElementById('prodHeritage').value = p.craft_heritage || '';
  document.getElementById('prodDescription').value = p.description;
  document.getElementById('prodFeatured').checked = p.is_featured === 1;

  document.getElementById('productModalHeading').textContent = 'Edit Tribal Product';
  const modal = document.getElementById('productModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Handle Image File Upload via Multer
async function uploadProductImage(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  const formData = new FormData();
  formData.append('image', file);

  try {
    showToast('Uploading photo...', 'info');
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('prodImageUrl').value = data.fileUrl;
      showToast('Image uploaded successfully!', 'success');
    } else {
      showToast(data.message || 'Image upload failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to upload image file.', 'error');
  }
}

// Submit Add or Edit Product Form
async function handleProductFormSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('editProductId').value;
  const isEdit = Boolean(id);

  const payload = {
    title: document.getElementById('prodTitle').value.trim(),
    category: document.getElementById('prodCategory').value.trim(),
    price: parseFloat(document.getElementById('prodPrice').value) || 0,
    stock: parseInt(document.getElementById('prodStock').value) || 1,
    artisan_name: document.getElementById('prodArtisanName').value.trim(),
    artisan_tribe: document.getElementById('prodTribe').value.trim(),
    artisan_location: document.getElementById('prodLocation').value.trim(),
    image_url: document.getElementById('prodImageUrl').value.trim(),
    craft_heritage: document.getElementById('prodHeritage').value.trim(),
    description: document.getElementById('prodDescription').value.trim(),
    is_featured: document.getElementById('prodFeatured').checked ? 1 : 0
  };

  const url = isEdit ? `/api/admin/products/${id}` : '/api/admin/products';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      showToast(isEdit ? 'Product updated!' : 'Product added to catalog!', 'success');
      closeProductModal();
      loadAdminProducts();
      loadAdminStats();
    } else {
      showToast(data.message || 'Failed to save product.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server.', 'error');
  }
}

async function confirmDeleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product from the tribal store?')) return;

  try {
    const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showToast('Product deleted from store.', 'info');
      loadAdminProducts();
      loadAdminStats();
    } else {
      showToast(data.message || 'Failed to delete product.', 'error');
    }
  } catch (err) {
    showToast('Failed to delete product.', 'error');
  }
}

