// VANATVA - Tribal Community Product Platform Frontend Logic

let allProducts = [];
let activeCategory = 'All';
let selectedProductForBuy = null;
let currentSuccessOrder = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  setupSearchInputs();
  checkLoggedInUser();
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

// Fetch products from backend
async function loadProducts(params = {}) {
  try {
    const grid = document.getElementById('productsGrid');
    const countText = document.getElementById('productsCountText');

    let url = '/api/products';
    const queryParams = new URLSearchParams();

    if (activeCategory && activeCategory !== 'All') {
      queryParams.append('category', activeCategory);
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim()) {
      queryParams.append('search', searchInput.value.trim());
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect && sortSelect.value) {
      queryParams.append('sort', sortSelect.value);
    }

    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      allProducts = data.products;
      renderCategories(data.categories);
      renderProducts(allProducts);

      if (countText) {
        countText.textContent = `Showing ${allProducts.length} authentic crafts`;
      }
    } else {
      showToast('Could not load products.', 'error');
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    showToast('Failed to connect to server.', 'error');
  }
}

// Render Category Filter Pills
function renderCategories(categories = []) {
  const container = document.getElementById('categoryContainer');
  if (!container || container.dataset.rendered === 'true') return;

  // Keep 'All' button and append unique categories
  const defaultHtml = `
    <button 
      onclick="filterCategory('All')" 
      class="category-btn ${activeCategory === 'All' ? 'bg-amber-800 text-white shadow-sm' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'} px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition"
      data-category="All"
    >
      All Handcrafts
    </button>
  `;

  const categoryButtons = categories.map(cat => `
    <button 
      onclick="filterCategory('${encodeURIComponent(cat)}')" 
      class="category-btn ${activeCategory === cat ? 'bg-amber-800 text-white shadow-sm' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'} px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition"
      data-category="${cat}"
    >
      ${cat}
    </button>
  `).join('');

  container.innerHTML = defaultHtml + categoryButtons;
  container.dataset.rendered = 'true';
}

// Category filter click handler
function filterCategory(cat) {
  activeCategory = decodeURIComponent(cat);

  // Update button active states
  const buttons = document.querySelectorAll('.category-btn');
  buttons.forEach(btn => {
    if (btn.dataset.category === activeCategory) {
      btn.className = 'category-btn bg-amber-800 text-white shadow-sm px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition';
    } else {
      btn.className = 'category-btn bg-white text-stone-700 hover:bg-stone-100 border border-stone-200 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition';
    }
  });

  loadProducts();
}

// Setup search inputs with debounce
function setupSearchInputs() {
  const desktopSearch = document.getElementById('searchInput');
  const mobileSearch = document.getElementById('searchInputMobile');

  let debounceTimer;
  const handleSearch = (val) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (desktopSearch) desktopSearch.value = val;
      if (mobileSearch) mobileSearch.value = val;
      loadProducts();
    }, 350);
  };

  if (desktopSearch) {
    desktopSearch.addEventListener('input', (e) => handleSearch(e.target.value));
  }
  if (mobileSearch) {
    mobileSearch.addEventListener('input', (e) => handleSearch(e.target.value));
  }
}

// Sort handler
function applySort(sortVal) {
  loadProducts();
}

// Reset filters
function resetFilters() {
  activeCategory = 'All';
  const desktopSearch = document.getElementById('searchInput');
  const mobileSearch = document.getElementById('searchInputMobile');
  if (desktopSearch) desktopSearch.value = '';
  if (mobileSearch) mobileSearch.value = '';
  filterCategory('All');
}

// Render Products Grid
function renderProducts(products = []) {
  const grid = document.getElementById('productsGrid');
  const emptyState = document.getElementById('emptyState');

  if (!products || products.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = products.map(product => `
    <div class="product-card bg-white rounded-2xl overflow-hidden border border-stone-200/90 flex flex-col shadow-sm">
      
      <!-- Product Image & Badges -->
      <div class="relative overflow-hidden aspect-square bg-stone-100 group">
        <img 
          src="${product.image_url}" 
          alt="${product.title}" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'"
        >
        
        <!-- Category & Tribe Badges -->
        <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-stone-900 shadow-sm backdrop-blur-sm">
            ${product.category}
          </span>
          <span class="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-amber-800 text-amber-50 shadow-sm">
            ${product.artisan_tribe}
          </span>
        </div>

        ${product.is_featured ? `
          <div class="absolute top-3 right-3">
            <span class="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shadow-md" title="Featured Heritage Craft">
              <i class="fa-solid fa-star"></i>
            </span>
          </div>
        ` : ''}

        <!-- Quick View Overlay on Image -->
        <button 
          onclick="openDetailModal(${product.id})"
          class="absolute inset-x-4 bottom-4 bg-stone-900/80 hover:bg-stone-900 text-white text-xs font-semibold py-2 px-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5 backdrop-blur-sm"
        >
          <i class="fa-regular fa-eye"></i> View Craft Story
        </button>
      </div>

      <!-- Card Content -->
      <div class="p-5 flex flex-col flex-1">
        <!-- Artisan info -->
        <div class="flex items-center gap-1.5 text-xs text-amber-800 font-medium mb-1.5">
          <i class="fa-solid fa-feather-pointed text-[11px]"></i>
          <span class="truncate">${product.artisan_name}</span>
          <span class="text-stone-300">•</span>
          <span class="text-stone-500 text-[11px] truncate">${product.artisan_location.split(',')[0]}</span>
        </div>

        <!-- Product Title -->
        <h3 class="font-bold text-stone-900 text-base leading-snug line-clamp-2 mb-2 font-serif" title="${product.title}">
          ${product.title}
        </h3>

        <!-- Description snippet -->
        <p class="text-xs text-stone-500 line-clamp-2 leading-relaxed mb-4 flex-1">
          ${product.description}
        </p>

        <!-- Price & Buy Button (Direct Artisan Flow) -->
        <div class="pt-3 border-t border-stone-100 mt-auto flex items-center justify-between gap-3">
          <div>
            <span class="text-[10px] text-stone-400 font-semibold block uppercase tracking-wider">Direct Price</span>
            <span class="text-xl font-extrabold text-amber-900">₹${Number(product.price).toLocaleString('en-IN')}</span>
          </div>

          <!-- BUY BUTTON -->
          <button 
            onclick="openBuyModal(${product.id})" 
            class="bg-amber-800 hover:bg-amber-900 text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl shadow-md shadow-amber-800/15 flex items-center gap-2 transition active:scale-95"
          >
            <i class="fa-solid fa-bag-shopping"></i>
            <span>Buy</span>
          </button>
        </div>

      </div>

    </div>
  `).join('');
}

// ==========================================
// BUY MODAL LOGIC (CORE FEATURE)
// Requirement:
// "when user click the product and click buy option 
// sent the clint details including name, number, product, details, id ,mail to the admin dashboard"
// ==========================================

function openBuyModal(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  selectedProductForBuy = product;

  // Populate Modal Fields
  document.getElementById('buyProductId').value = product.id;
  document.getElementById('buyModalImage').src = product.image_url;
  document.getElementById('buyModalTitle').textContent = product.title;
  document.getElementById('buyModalTribe').textContent = `${product.artisan_tribe} • ${product.artisan_location}`;
  document.getElementById('buyModalPrice').textContent = `₹${Number(product.price).toLocaleString('en-IN')}`;
  document.getElementById('buyQuantity').value = '1';

  updateBuyTotal();

  // If user profile is saved in session, pre-fill form
  if (window.currentUser) {
    if (window.currentUser.name) document.getElementById('clientName').value = window.currentUser.name;
    if (window.currentUser.phone) document.getElementById('clientPhone').value = window.currentUser.phone;
    if (window.currentUser.email) document.getElementById('clientEmail').value = window.currentUser.email;
    if (window.currentUser.address) document.getElementById('clientAddress').value = window.currentUser.address;
    if (window.currentUser.city) document.getElementById('clientCity').value = window.currentUser.city || '';
    if (window.currentUser.state) document.getElementById('clientState').value = window.currentUser.state || '';
    if (window.currentUser.pincode) document.getElementById('clientPincode').value = window.currentUser.pincode || '';
  }

  const modal = document.getElementById('buyModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
}

function closeBuyModal() {
  const modal = document.getElementById('buyModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}

function updateBuyTotal() {
  if (!selectedProductForBuy) return;
  const qty = parseInt(document.getElementById('buyQuantity').value) || 1;
  const total = selectedProductForBuy.price * qty;
  document.getElementById('buyModalTotal').textContent = `₹${Number(total).toLocaleString('en-IN')}`;
}

// Handle Buy Submission
async function handleBuySubmit(event) {
  event.preventDefault();

  const buySubmitBtn = document.getElementById('buySubmitBtn');
  const originalBtnHtml = buySubmitBtn.innerHTML;

  try {
    buySubmitBtn.disabled = true;
    buySubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting to Admin...';

    const payload = {
      product_id: parseInt(document.getElementById('buyProductId').value),
      quantity: parseInt(document.getElementById('buyQuantity').value) || 1,
      client_name: document.getElementById('clientName').value.trim(),
      client_phone: document.getElementById('clientPhone').value.trim(),
      client_email: document.getElementById('clientEmail').value.trim(),
      client_address: document.getElementById('clientAddress').value.trim(),
      client_city: document.getElementById('clientCity').value.trim(),
      client_state: document.getElementById('clientState').value.trim(),
      client_pincode: document.getElementById('clientPincode').value.trim(),
      client_notes: document.getElementById('clientNotes').value.trim()
    };

    const res = await fetch('/api/orders/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      closeBuyModal();
      document.getElementById('buyOrderForm').reset();
      currentSuccessOrder = data.order;
      showSuccessModal(data.order);
      showToast('Client details successfully sent to Admin Dashboard!', 'success');
    } else {
      showToast(data.message || 'Failed to submit buy order.', 'error');
    }
  } catch (err) {
    console.error('Buy submit error:', err);
    showToast('Failed to connect with server.', 'error');
  } finally {
    buySubmitBtn.disabled = false;
    buySubmitBtn.innerHTML = originalBtnHtml;
  }
}

// Show Order Success Modal
function showSuccessModal(order) {
  document.getElementById('successOrderCode').textContent = order.order_code;
  document.getElementById('successClientName').textContent = order.client_name;
  document.getElementById('successClientPhone').textContent = order.client_phone;
  document.getElementById('successProductTitle').textContent = `${order.product_title} (x${order.quantity})`;
  document.getElementById('successTotalAmount').textContent = `₹${Number(order.total_amount).toLocaleString('en-IN')}`;

  const modal = document.getElementById('orderSuccessModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
}

function closeSuccessModal() {
  const modal = document.getElementById('orderSuccessModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}

// Direct WhatsApp Inquiry link helper
function openWhatsAppInquiry() {
  if (!currentSuccessOrder) return;
  const phone = '919876543210'; // Community support helpline
  const text = encodeURIComponent(
    `Hello VANATVA Tribal Community! I placed a purchase inquiry for order ${currentSuccessOrder.order_code}.\n` +
    `Product: ${currentSuccessOrder.product_title} (Qty: ${currentSuccessOrder.quantity}, Total: Rs.${currentSuccessOrder.total_amount})\n` +
    `My Name: ${currentSuccessOrder.client_name}\n` +
    `Phone: ${currentSuccessOrder.client_phone}\n` +
    `Please confirm the delivery schedule.`
  );
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
}

// ==========================================
// PRODUCT STORY / DETAIL MODAL
// ==========================================

function openDetailModal(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('modalDetailImage').src = product.image_url;
  document.getElementById('modalDetailCategory').textContent = product.category;
  document.getElementById('modalDetailTribe').textContent = `${product.artisan_tribe} • ${product.artisan_location}`;
  document.getElementById('modalDetailTitle').textContent = product.title;
  document.getElementById('modalDetailPrice').textContent = `₹${Number(product.price).toLocaleString('en-IN')}`;
  document.getElementById('modalDetailStock').textContent = `${product.stock} items crafted in lot`;
  document.getElementById('modalDetailArtisan').textContent = product.artisan_name;
  document.getElementById('modalDetailLocation').textContent = product.artisan_location;
  document.getElementById('modalDetailHeritage').textContent = product.craft_heritage || 'Ancestral Tribal Handicraft';
  document.getElementById('modalDetailDescription').textContent = product.description;

  const buyBtn = document.getElementById('modalDetailBuyBtn');
  buyBtn.onclick = () => {
    closeDetailModal();
    openBuyModal(product.id);
  };

  const modal = document.getElementById('detailModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}

// ==========================================
// ORDER TRACKING PUBLIC MODAL
// ==========================================

function openTrackModal() {
  const modal = document.getElementById('trackModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
  document.getElementById('trackResultContainer').classList.add('hidden');
  document.getElementById('trackOrderCodeInput').focus();
}

function closeTrackModal() {
  const modal = document.getElementById('trackModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}

async function lookupOrderTracking() {
  const code = document.getElementById('trackOrderCodeInput').value.trim();
  const phone = document.getElementById('trackPhoneInput').value.trim();
  const container = document.getElementById('trackResultContainer');

  if (!code) {
    showToast('Please enter your Order Code (e.g. TRB-123456).', 'error');
    return;
  }

  try {
    let url = `/api/orders/track?code=${encodeURIComponent(code)}`;
    if (phone) url += `&phone=${encodeURIComponent(phone)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.success && data.order) {
      const o = data.order;
      container.classList.remove('hidden');

      const statusMap = {
        'Pending': { color: 'badge-pending', desc: 'Inquiry received in Admin Dashboard. Coordinator will verify shortly.' },
        'Contacted': { color: 'badge-contacted', desc: 'Coordinator has initiated contact with you via Phone/WhatsApp.' },
        'Order Confirmed': { color: 'badge-confirmed', desc: 'Delivery details confirmed with artisan guild.' },
        'Dispatched': { color: 'badge-dispatched', desc: 'Carefully packaged and handed over for postal dispatch.' },
        'Delivered': { color: 'badge-delivered', desc: 'Delivered safely to client address.' },
        'Cancelled': { color: 'badge-cancelled', desc: 'This inquiry was marked as cancelled.' }
      };

      const currentStatus = statusMap[o.status] || { color: 'badge-pending', desc: o.status };

      container.innerHTML = `
        <div class="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-stone-200">
            <span class="font-mono font-bold text-amber-800 text-sm">${o.order_code}</span>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${currentStatus.color}">${o.status}</span>
          </div>

          <div class="text-xs space-y-1.5 text-stone-600">
            <p><strong class="text-stone-800">Client:</strong> ${o.client_name} (${o.client_phone})</p>
            <p><strong class="text-stone-800">Product:</strong> ${o.product_title} (Qty: ${o.quantity})</p>
            <p><strong class="text-stone-800">Total:</strong> ₹${Number(o.total_amount).toLocaleString('en-IN')}</p>
            <p><strong class="text-stone-800">Delivery Address:</strong> ${o.client_address}${o.client_city ? ', ' + o.client_city : ''}</p>
          </div>

          <div class="bg-white p-3 rounded-xl border border-stone-200 text-xs text-stone-700">
            <strong class="text-stone-900 block mb-0.5">Current Status Note:</strong>
            ${currentStatus.desc}
            ${o.admin_notes ? `<div class="mt-2 text-amber-900 font-medium bg-amber-50 p-2 rounded border border-amber-100">📌 Coordinator Note: ${o.admin_notes}</div>` : ''}
          </div>
        </div>
      `;
    } else {
      showToast(data.message || 'No order found with that code.', 'error');
      container.classList.add('hidden');
    }
  } catch (err) {
    console.error('Tracking error:', err);
    showToast('Failed to check tracking.', 'error');
  }
}

// Check logged in user to update navbar and auto-fill
async function checkLoggedInUser() {
  try {
    const res = await fetch('/api/user/me');
    const data = await res.json();
    if (data.success && data.user) {
      window.currentUser = data.user;
      const navBtn = document.getElementById('userNavBtn');
      if (navBtn) {
        navBtn.innerHTML = `
          <div class="w-6 h-6 rounded-full bg-amber-700 text-white text-xs flex items-center justify-center font-bold">
            ${data.user.name.charAt(0).toUpperCase()}
          </div>
          <span class="hidden sm:inline font-semibold">${data.user.name.split(' ')[0]}'s Portal</span>
        `;
      }
    }
  } catch (err) {
    // Guest visitor
  }
}

