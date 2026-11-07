const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { db, initDb } = require('./src/db');

// Initialize database & tables
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isServerless ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    // Read-only filesystem fallback
  }
}

// Multer storage configuration for product image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `tribal-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WEBP, GIF) are allowed.'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel serverless path normalizer (ensures /products or /api/products always resolve)
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && !req.url.includes('.')) {
    const apiRoots = ['products', 'orders', 'admin', 'user'];
    const firstSegment = req.url.split('?')[0].split('/')[1];
    if (apiRoots.includes(firstSegment)) {
      req.url = '/api' + req.url;
    }
  }
  next();
});

// Session management
app.use(
  session({
    secret: 'tribal-community-artisans-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Auth Middleware Helpers
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Admin authentication required.' });
}

function requireUser(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'User login required.' });
}

// ==========================================
// ADMIN AUTHENTICATION ROUTES
// ==========================================

// Admin Login
// Default: danialrenson@gmail.com / danial
app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(trimmedEmail);

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin email or password.' });
    }

    const isValid = bcrypt.compareSync(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid admin email or password.' });
    }

    req.session.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    };

    return res.json({
      success: true,
      message: 'Admin login successful.',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Admin Get Current Session
app.get('/api/admin/me', (req, res) => {
  if (req.session && req.session.admin) {
    const admin = db.prepare('SELECT id, email, name, role, updated_at FROM admins WHERE id = ?').get(req.session.admin.id);
    if (admin) {
      return res.json({ success: true, admin });
    }
  }
  return res.status(401).json({ success: false, message: 'Not logged in as admin.' });
});

// Admin Change Password
// Requirement: admin can change password at any time using change password
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const adminId = req.session.admin.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'New password must be at least 4 characters long.' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin record not found.' });
    }

    // Verify current password
    const matches = bcrypt.compareSync(currentPassword, admin.password_hash);
    if (!matches) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Hash and update
    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.prepare(`
      UPDATE admins 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newHash, adminId);

    return res.json({
      success: true,
      message: 'Admin password updated successfully! You can now use your new password.'
    });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  delete req.session.admin;
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// USER AUTHENTICATION & PROFILE ROUTES
// ==========================================

// User Register
app.post('/api/user/register', (req, res) => {
  try {
    const { name, email, phone, password, address, city, state, pincode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, address, city, state, pincode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), trimmedEmail, phone || '', hash, address || '', city || '', state || '', pincode || '');

    req.session.user = {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      email: trimmedEmail,
      phone: phone || ''
    };

    return res.json({
      success: true,
      message: 'Account created successfully!',
      user: req.session.user
    });
  } catch (err) {
    console.error('User register error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

// User Login
app.post('/api/user/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(trimmedEmail);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone
    };

    return res.json({
      success: true,
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode
      }
    });
  } catch (err) {
    console.error('User login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

// User Get Current Profile
app.get('/api/user/me', (req, res) => {
  if (req.session && req.session.user) {
    const user = db.prepare('SELECT id, name, email, phone, address, city, state, pincode, created_at FROM users WHERE id = ?').get(req.session.user.id);
    if (user) {
      return res.json({ success: true, user });
    }
  }
  return res.status(401).json({ success: false, message: 'Not logged in.' });
});

// User Update Profile
app.put('/api/user/profile', requireUser, (req, res) => {
  try {
    const { name, phone, address, city, state, pincode } = req.body;
    const userId = req.session.user.id;

    db.prepare(`
      UPDATE users 
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          state = COALESCE(?, state),
          pincode = COALESCE(?, pincode),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, phone, address, city, state, pincode, userId);

    req.session.user.name = name || req.session.user.name;
    req.session.user.phone = phone || req.session.user.phone;

    return res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// User Logout
app.post('/api/user/logout', (req, res) => {
  delete req.session.user;
  return res.json({ success: true, message: 'User logged out.' });
});

// ==========================================
// PRODUCTS API
// ==========================================

// Get All Products (with filters)
app.get('/api/products', (req, res) => {
  try {
    const { category, search, featured, sort } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (featured === '1' || featured === 'true') {
      query += ' AND is_featured = 1';
    }

    if (search && search.trim() !== '') {
      query += ' AND (title LIKE ? OR description LIKE ? OR artisan_name LIKE ? OR artisan_tribe LIKE ? OR artisan_location LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (sort === 'price_asc') {
      query += ' ORDER BY price ASC';
    } else if (sort === 'price_desc') {
      query += ' ORDER BY price DESC';
    } else {
      query += ' ORDER BY id DESC';
    }

    const products = db.prepare(query).all(...params);

    // Also get distinct categories
    const categories = db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all().map(c => c.category);

    return res.json({ success: true, products, categories });
  } catch (err) {
    console.error('Get products error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve products.' });
  }
});

// Get Single Product
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    return res.json({ success: true, product });
  } catch (err) {
    console.error('Get single product error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve product.' });
  }
});

// Admin Add Product
app.post('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const {
      title,
      category,
      price,
      stock,
      description,
      image_url,
      artisan_name,
      artisan_tribe,
      artisan_location,
      craft_heritage,
      is_featured
    } = req.body;

    if (!title || !category || !price || !description) {
      return res.status(400).json({ success: false, message: 'Title, category, price, and description are required.' });
    }

    const result = db.prepare(`
      INSERT INTO products (
        title, category, price, stock, description, image_url,
        artisan_name, artisan_tribe, artisan_location, craft_heritage, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      category.trim(),
      parseFloat(price) || 0,
      parseInt(stock) || 1,
      description.trim(),
      image_url || 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      artisan_name ? artisan_name.trim() : 'Tribal Artisan Collective',
      artisan_tribe ? artisan_tribe.trim() : 'Indigenous Community',
      artisan_location ? artisan_location.trim() : 'India',
      craft_heritage ? craft_heritage.trim() : 'Traditional Tribal Craft',
      is_featured ? 1 : 0
    );

    return res.json({
      success: true,
      message: 'Product added successfully to tribal catalog!',
      productId: Number(result.lastInsertRowid)
    });
  } catch (err) {
    console.error('Add product error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add product.' });
  }
});

// Admin Update Product
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      price,
      stock,
      description,
      image_url,
      artisan_name,
      artisan_tribe,
      artisan_location,
      craft_heritage,
      is_featured
    } = req.body;

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    db.prepare(`
      UPDATE products SET
        title = COALESCE(?, title),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        stock = COALESCE(?, stock),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        artisan_name = COALESCE(?, artisan_name),
        artisan_tribe = COALESCE(?, artisan_tribe),
        artisan_location = COALESCE(?, artisan_location),
        craft_heritage = COALESCE(?, craft_heritage),
        is_featured = COALESCE(?, is_featured),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title,
      category,
      price !== undefined ? parseFloat(price) : null,
      stock !== undefined ? parseInt(stock) : null,
      description,
      image_url,
      artisan_name,
      artisan_tribe,
      artisan_location,
      craft_heritage,
      is_featured !== undefined ? (is_featured ? 1 : 0) : null,
      id
    );

    return res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
});

// Admin Delete Product
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Product deleted from store catalog.' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
});

// Image Upload Endpoint (via Multer)
app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({ success: true, fileUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, message: err.message || 'File upload failed.' });
  }
});

// ==========================================
// BUY OPTION & ORDER MANAGEMENT (CORE FEATURE)
// Requirement:
// "without payment integration when user click the product and click buy option 
// sent the clint details including name, number, product, details, id ,mail to the admin dashboard"
// ==========================================

// Create Buy Order / Inquiry
app.post('/api/orders/buy', (req, res) => {
  try {
    const {
      product_id,
      quantity = 1,
      client_name,
      client_phone,
      client_email,
      client_address,
      client_city,
      client_state,
      client_pincode,
      client_notes
    } = req.body;

    // Validate required fields
    if (!product_id) {
      return res.status(400).json({ success: false, message: 'Product ID is missing.' });
    }
    if (!client_name || !client_name.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your full name.' });
    }
    if (!client_phone || !client_phone.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your contact phone/WhatsApp number.' });
    }
    if (!client_email || !client_email.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your email address.' });
    }
    if (!client_address || !client_address.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide your shipping/delivery address.' });
    }

    // Verify product exists and fetch details
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'The selected product was not found.' });
    }

    const qty = Math.max(1, parseInt(quantity) || 1);
    const totalAmount = product.price * qty;

    // Generate unique order code (e.g. TRB-748921)
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const orderCode = `TRB-${randomNum}`;

    // Associate with user if logged in
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // Insert order into database
    const insertStmt = db.prepare(`
      INSERT INTO orders (
        order_code, user_id, client_name, client_phone, client_email,
        client_address, client_city, client_state, client_pincode, client_notes,
        product_id, product_title, product_price, quantity, total_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `);

    const result = insertStmt.run(
      orderCode,
      userId,
      client_name.trim(),
      client_phone.trim(),
      client_email.trim().toLowerCase(),
      client_address.trim(),
      client_city ? client_city.trim() : '',
      client_state ? client_state.trim() : '',
      client_pincode ? client_pincode.trim() : '',
      client_notes ? client_notes.trim() : '',
      product.id,
      product.title,
      product.price,
      qty,
      totalAmount
    );

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);

    console.log(`📦 [NEW CLIENT ORDER INQUIRY] Code: ${orderCode} | Client: ${client_name} (${client_phone}, ${client_email}) | Product: "${product.title}" (Qty: ${qty}, Rs.${totalAmount})`);

    return res.json({
      success: true,
      message: 'Your purchase request has been submitted directly to the tribal community administration!',
      order: {
        id: createdOrder.id,
        order_code: createdOrder.order_code,
        client_name: createdOrder.client_name,
        client_phone: createdOrder.client_phone,
        client_email: createdOrder.client_email,
        client_address: createdOrder.client_address,
        client_city: createdOrder.client_city,
        client_state: createdOrder.client_state,
        client_pincode: createdOrder.client_pincode,
        product_id: product.id,
        product_title: product.title,
        product_price: product.price,
        product_image: product.image_url,
        artisan_tribe: product.artisan_tribe,
        artisan_name: product.artisan_name,
        quantity: qty,
        total_amount: totalAmount,
        status: createdOrder.status,
        created_at: createdOrder.created_at
      }
    });
  } catch (err) {
    console.error('Order creation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit buy order.' });
  }
});

// Track Order publicly with Order Code & Phone
app.get('/api/orders/track', (req, res) => {
  try {
    const { code, phone } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Order code is required.' });
    }

    let query = 'SELECT * FROM orders WHERE order_code = ?';
    const params = [code.trim().toUpperCase()];

    if (phone && phone.trim()) {
      query += ' AND (client_phone LIKE ? OR client_email LIKE ?)';
      params.push(`%${phone.trim()}%`, `%${phone.trim()}%`);
    }

    const order = db.prepare(query).get(...params);
    if (!order) {
      return res.status(404).json({ success: false, message: 'No matching order found. Please check your order code.' });
    }

    // Get product info
    const product = db.prepare('SELECT image_url, artisan_name, artisan_tribe, artisan_location FROM products WHERE id = ?').get(order.product_id);

    return res.json({
      success: true,
      order: {
        ...order,
        product_image: product ? product.image_url : null,
        artisan_name: product ? product.artisan_name : 'Tribal Artisan',
        artisan_tribe: product ? product.artisan_tribe : 'Indigenous Tribe'
      }
    });
  } catch (err) {
    console.error('Track order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to look up order.' });
  }
});

// User's own orders
app.get('/api/user/orders', requireUser, (req, res) => {
  try {
    const userId = req.session.user.id;
    const userEmail = req.session.user.email;

    // Fetch orders tied by user_id or matching email
    const orders = db.prepare(`
      SELECT o.*, p.image_url as product_image, p.artisan_name, p.artisan_tribe
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.user_id = ? OR o.client_email = ?
      ORDER BY o.id DESC
    `).all(userId, userEmail);

    return res.json({ success: true, orders });
  } catch (err) {
    console.error('User orders error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve your orders.' });
  }
});

// ==========================================
// ADMIN DASHBOARD ORDERS & STATS API
// ==========================================

// Get all client orders for Admin Dashboard
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT o.*, p.image_url as product_image, p.artisan_name, p.artisan_tribe, p.artisan_location
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (search && search.trim() !== '') {
      query += ' AND (o.order_code LIKE ? OR o.client_name LIKE ? OR o.client_email LIKE ? OR o.client_phone LIKE ? OR o.product_title LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    query += ' ORDER BY o.id DESC';

    const orders = db.prepare(query).all(...params);
    return res.json({ success: true, orders });
  } catch (err) {
    console.error('Admin get orders error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve orders.' });
  }
});

// Export Orders to CSV for Postal / Courier Dispatch
app.get('/api/admin/orders/export/csv', requireAdmin, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT 
        o.order_code, o.created_at, o.client_name, o.client_phone, o.client_email,
        o.client_address, o.client_city, o.client_state, o.client_pincode,
        o.product_id, o.product_title, o.product_price, o.quantity, o.total_amount,
        o.status, o.admin_notes
      FROM orders o
      ORDER BY o.id DESC
    `).all();

    const headers = [
      'Order Code', 'Date', 'Client Name', 'Client Phone', 'Client Email',
      'Delivery Address', 'City', 'State', 'Pincode',
      'Product ID', 'Product Title', 'Price (INR)', 'Quantity', 'Total (INR)',
      'Status', 'Admin Notes'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(',')];
    for (const o of orders) {
      csvRows.push([
        escapeCsv(o.order_code),
        escapeCsv(o.created_at),
        escapeCsv(o.client_name),
        escapeCsv(o.client_phone),
        escapeCsv(o.client_email),
        escapeCsv(o.client_address),
        escapeCsv(o.client_city),
        escapeCsv(o.client_state),
        escapeCsv(o.client_pincode),
        escapeCsv(o.product_id),
        escapeCsv(o.product_title),
        escapeCsv(o.product_price),
        escapeCsv(o.quantity),
        escapeCsv(o.total_amount),
        escapeCsv(o.status),
        escapeCsv(o.admin_notes)
      ].join(','));
    }

    const csvContent = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tribal-client-orders-${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    console.error('CSV Export error:', err);
    return res.status(500).send('Failed to export CSV.');
  }
});

// Admin Update Order Status
app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Contacted', 'Order Confirmed', 'Dispatched', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    db.prepare(`
      UPDATE orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, id);

    return res.json({ success: true, message: `Order status updated to "${status}".` });
  } catch (err) {
    console.error('Update order status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update order status.' });
  }
});

// Admin Add / Update Note on Order
app.put('/api/admin/orders/:id/note', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    db.prepare(`
      UPDATE orders 
      SET admin_notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(note || '', id);

    return res.json({ success: true, message: 'Internal order note updated.' });
  } catch (err) {
    console.error('Update order note error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save note.' });
  }
});

// Admin Delete Order
app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Order record deleted.' });
  } catch (err) {
    console.error('Delete order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete order.' });
  }
});

// Admin Dashboard Summary Metrics / Analytics
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'").get().count;
    const contactedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Contacted'").get().count;
    const confirmedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Order Confirmed'").get().count;
    const dispatchedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('Dispatched', 'Delivered')").get().count;
    
    const revenueRow = db.prepare("SELECT SUM(total_amount) as total FROM orders WHERE status != 'Cancelled'").get();
    const totalRevenue = revenueRow && revenueRow.total ? revenueRow.total : 0;

    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    const recentOrders = db.prepare(`
      SELECT o.id, o.order_code, o.client_name, o.client_phone, o.client_email, o.product_title, o.total_amount, o.status, o.created_at
      FROM orders o
      ORDER BY o.id DESC
      LIMIT 5
    `).all();

    return res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        contactedOrders,
        confirmedOrders,
        dispatchedOrders,
        totalRevenue,
        totalProducts,
        totalUsers,
        recentOrders
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch statistics.' });
  }
});

// Page Routing Helpers
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/user', '/user.html', '/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

// Start Server
if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🌿 Tribal Community Product Platform Running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🛡️ Admin Login: danialrenson@gmail.com / danial`);
    console.log(`====================================================`);
  });
}

module.exports = app;

