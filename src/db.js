const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Determine writable database path (on Vercel/serverless only /tmp is writable)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbDir = isServerless ? '/tmp' : path.join(__dirname, '..');
const dbPath = path.join(dbDir, 'tribal_store.db');
const jsonBackupPath = path.join(dbDir, 'tribal_store_data.json');

let dbInstance = null;
let isFallbackMode = false;

// Attempt to load native node:sqlite
try {
  const { DatabaseSync } = require('node:sqlite');
  dbInstance = new DatabaseSync(dbPath);
  try {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
  } catch (e) {
    // Some serverless environments restrict PRAGMA WAL
  }
  console.log(`✔ Using SQLite engine at: ${dbPath}`);
} catch (sqliteErr) {
  console.warn('⚠️ Native node:sqlite not available or restricted. Activating robust in-memory JSON store.');
  isFallbackMode = true;
  dbInstance = createFallbackDatabase(jsonBackupPath);
}

// ========================================================
// FALLBACK MEMORY + JSON ENGINE (Guarantees zero crashes on Vercel)
// ========================================================
function createFallbackDatabase(persistenceFile) {
  let memoryData = {
    admins: [],
    users: [],
    products: [],
    orders: [],
    nextId: { admins: 1, users: 1, products: 1, orders: 1 }
  };

  // Load persisted state if exists
  try {
    if (fs.existsSync(persistenceFile)) {
      const raw = fs.readFileSync(persistenceFile, 'utf8');
      memoryData = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read JSON backup, using fresh state.');
  }

  function persist() {
    try {
      fs.writeFileSync(persistenceFile, JSON.stringify(memoryData, null, 2), 'utf8');
    } catch (e) {
      // Ignored if /tmp is ephemeral
    }
  }

  return {
    exec(sql) {
      // DDL statements are handled implicitly
      return true;
    },
    prepare(sql) {
      const cleanSql = sql.trim();

      return {
        run(...params) {
          // INSERT INTO admins
          if (/INSERT INTO admins/i.test(cleanSql)) {
            const id = memoryData.nextId.admins++;
            const [email, password_hash, name, role] = params;
            const newAdmin = {
              id,
              email: (email || '').toLowerCase().trim(),
              password_hash,
              name: name || 'Admin',
              role: role || 'superadmin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            memoryData.admins.push(newAdmin);
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }

          // UPDATE admins
          if (/UPDATE admins/i.test(cleanSql)) {
            const [password_hash, adminId] = params;
            const admin = memoryData.admins.find(a => a.id === Number(adminId) || a.email === String(adminId));
            if (admin) {
              admin.password_hash = password_hash;
              admin.updated_at = new Date().toISOString();
              persist();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // INSERT INTO users
          if (/INSERT INTO users/i.test(cleanSql)) {
            const id = memoryData.nextId.users++;
            const [name, email, phone, password_hash, address, city, state, pincode] = params;
            const newUser = {
              id,
              name,
              email: (email || '').toLowerCase().trim(),
              phone: phone || '',
              password_hash,
              address: address || '',
              city: city || '',
              state: state || '',
              pincode: pincode || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            memoryData.users.push(newUser);
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }

          // UPDATE users
          if (/UPDATE users/i.test(cleanSql)) {
            const [name, phone, address, city, state, pincode, userId] = params;
            const user = memoryData.users.find(u => u.id === Number(userId));
            if (user) {
              if (name) user.name = name;
              if (phone) user.phone = phone;
              if (address) user.address = address;
              if (city) user.city = city;
              if (state) user.state = state;
              if (pincode) user.pincode = pincode;
              user.updated_at = new Date().toISOString();
              persist();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // INSERT INTO products
          if (/INSERT INTO products/i.test(cleanSql)) {
            const id = memoryData.nextId.products++;
            const [
              title, category, price, stock, description, image_url,
              artisan_name, artisan_tribe, artisan_location, craft_heritage, is_featured
            ] = params;
            const newProd = {
              id,
              title,
              category,
              price: parseFloat(price) || 0,
              stock: parseInt(stock) || 1,
              description,
              image_url,
              artisan_name,
              artisan_tribe,
              artisan_location,
              craft_heritage: craft_heritage || '',
              is_featured: is_featured ? 1 : 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            memoryData.products.push(newProd);
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }

          // UPDATE products
          if (/UPDATE products/i.test(cleanSql)) {
            const id = Number(params[params.length - 1]);
            const prod = memoryData.products.find(p => p.id === id);
            if (prod) {
              const [
                title, category, price, stock, description, image_url,
                artisan_name, artisan_tribe, artisan_location, craft_heritage, is_featured
              ] = params;
              if (title !== null && title !== undefined) prod.title = title;
              if (category !== null && category !== undefined) prod.category = category;
              if (price !== null && price !== undefined) prod.price = parseFloat(price);
              if (stock !== null && stock !== undefined) prod.stock = parseInt(stock);
              if (description !== null && description !== undefined) prod.description = description;
              if (image_url !== null && image_url !== undefined) prod.image_url = image_url;
              if (artisan_name !== null && artisan_name !== undefined) prod.artisan_name = artisan_name;
              if (artisan_tribe !== null && artisan_tribe !== undefined) prod.artisan_tribe = artisan_tribe;
              if (artisan_location !== null && artisan_location !== undefined) prod.artisan_location = artisan_location;
              if (craft_heritage !== null && craft_heritage !== undefined) prod.craft_heritage = craft_heritage;
              if (is_featured !== null && is_featured !== undefined) prod.is_featured = is_featured ? 1 : 0;
              prod.updated_at = new Date().toISOString();
              persist();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // DELETE FROM products
          if (/DELETE FROM products/i.test(cleanSql)) {
            const id = Number(params[0]);
            const prevLen = memoryData.products.length;
            memoryData.products = memoryData.products.filter(p => p.id !== id);
            persist();
            return { changes: prevLen - memoryData.products.length };
          }

          // INSERT INTO orders
          if (/INSERT INTO orders/i.test(cleanSql)) {
            const id = memoryData.nextId.orders++;
            const [
              order_code, user_id, client_name, client_phone, client_email,
              client_address, client_city, client_state, client_pincode, client_notes,
              product_id, product_title, product_price, quantity, total_amount, status
            ] = params;
            const newOrder = {
              id,
              order_code,
              user_id: user_id ? Number(user_id) : null,
              client_name,
              client_phone,
              client_email: (client_email || '').toLowerCase().trim(),
              client_address,
              client_city: client_city || '',
              client_state: client_state || '',
              client_pincode: client_pincode || '',
              client_notes: client_notes || '',
              product_id: Number(product_id),
              product_title,
              product_price: parseFloat(product_price),
              quantity: parseInt(quantity) || 1,
              total_amount: parseFloat(total_amount),
              status: status || 'Pending',
              admin_notes: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            memoryData.orders.unshift(newOrder);
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }

          // UPDATE orders status
          if (/UPDATE orders\s+SET status =/i.test(cleanSql)) {
            const [status, orderId] = params;
            const order = memoryData.orders.find(o => o.id === Number(orderId));
            if (order) {
              order.status = status;
              order.updated_at = new Date().toISOString();
              persist();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // UPDATE orders note
          if (/UPDATE orders\s+SET admin_notes =/i.test(cleanSql)) {
            const [note, orderId] = params;
            const order = memoryData.orders.find(o => o.id === Number(orderId));
            if (order) {
              order.admin_notes = note;
              order.updated_at = new Date().toISOString();
              persist();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // DELETE FROM orders
          if (/DELETE FROM orders/i.test(cleanSql)) {
            const id = Number(params[0]);
            const prevLen = memoryData.orders.length;
            memoryData.orders = memoryData.orders.filter(o => o.id !== id);
            persist();
            return { changes: prevLen - memoryData.orders.length };
          }

          return { changes: 0 };
        },

        get(...params) {
          // SELECT COUNT(*) FROM products
          if (/SELECT COUNT\(\*\) as count FROM products/i.test(cleanSql)) {
            return { count: memoryData.products.length };
          }

          // SELECT COUNT(*) FROM orders WHERE status = ?
          if (/SELECT COUNT\(\*\) as count FROM orders WHERE status =/i.test(cleanSql)) {
            const statusMatch = cleanSql.match(/status\s*=\s*'([^']+)'/i);
            const status = statusMatch ? statusMatch[1] : params[0];
            const c = memoryData.orders.filter(o => o.status === status).length;
            return { count: c };
          }

          // SELECT COUNT(*) FROM orders WHERE status IN ('Dispatched', 'Delivered')
          if (/status IN \('Dispatched', 'Delivered'\)/i.test(cleanSql)) {
            const c = memoryData.orders.filter(o => o.status === 'Dispatched' || o.status === 'Delivered').length;
            return { count: c };
          }

          // SELECT COUNT(*) FROM orders
          if (/SELECT COUNT\(\*\) as count FROM orders/i.test(cleanSql)) {
            return { count: memoryData.orders.length };
          }

          // SELECT SUM(total_amount) FROM orders
          if (/SELECT SUM\(total_amount\) as total FROM orders/i.test(cleanSql)) {
            const sum = memoryData.orders
              .filter(o => o.status !== 'Cancelled')
              .reduce((acc, o) => acc + (parseFloat(o.total_amount) || 0), 0);
            return { total: sum };
          }

          // SELECT COUNT(*) FROM users
          if (/SELECT COUNT\(\*\) as count FROM users/i.test(cleanSql)) {
            return { count: memoryData.users.length };
          }

          // SELECT from admins WHERE email = ?
          if (/SELECT .* FROM admins WHERE email = \?/i.test(cleanSql)) {
            const email = String(params[0] || '').toLowerCase().trim();
            return memoryData.admins.find(a => a.email.toLowerCase() === email) || null;
          }

          // SELECT from admins WHERE id = ?
          if (/SELECT .* FROM admins WHERE id = \?/i.test(cleanSql)) {
            const id = Number(params[0]);
            return memoryData.admins.find(a => a.id === id) || null;
          }

          // SELECT id FROM users WHERE email = ?
          if (/SELECT id FROM users WHERE email = \?/i.test(cleanSql)) {
            const email = String(params[0] || '').toLowerCase().trim();
            const u = memoryData.users.find(u => u.email.toLowerCase() === email);
            return u ? { id: u.id } : null;
          }

          // SELECT * FROM users WHERE email = ?
          if (/SELECT \* FROM users WHERE email = \?/i.test(cleanSql)) {
            const email = String(params[0] || '').toLowerCase().trim();
            return memoryData.users.find(u => u.email.toLowerCase() === email) || null;
          }

          // SELECT * FROM users WHERE id = ?
          if (/SELECT .* FROM users WHERE id = \?/i.test(cleanSql)) {
            const id = Number(params[0]);
            return memoryData.users.find(u => u.id === id) || null;
          }

          // SELECT * FROM products WHERE id = ?
          if (/SELECT \* FROM products WHERE id = \?/i.test(cleanSql)) {
            const id = Number(params[0]);
            return memoryData.products.find(p => p.id === id) || null;
          }

          // SELECT * FROM orders WHERE id = ?
          if (/SELECT \* FROM orders WHERE id = \?/i.test(cleanSql)) {
            const id = Number(params[0]);
            return memoryData.orders.find(o => o.id === id) || null;
          }

          // SELECT * FROM orders WHERE order_code = ?
          if (/SELECT \* FROM orders WHERE order_code = \?/i.test(cleanSql)) {
            const code = String(params[0] || '').trim().toUpperCase();
            const order = memoryData.orders.find(o => o.order_code.toUpperCase() === code);
            if (!order) return null;
            if (params.length > 1) {
              const phoneTerm = String(params[1] || '').trim();
              if (phoneTerm && !order.client_phone.includes(phoneTerm) && !order.client_email.includes(phoneTerm)) {
                return null;
              }
            }
            return order;
          }

          return null;
        },

        all(...params) {
          // SELECT DISTINCT category FROM products
          if (/SELECT DISTINCT category FROM products/i.test(cleanSql)) {
            const cats = Array.from(new Set(memoryData.products.map(p => p.category))).sort();
            return cats.map(c => ({ category: c }));
          }

          // SELECT * FROM products WHERE 1=1 ...
          if (/SELECT \* FROM products/i.test(cleanSql)) {
            let list = [...memoryData.products];
            // Filter by category if param provided
            if (cleanSql.includes('AND category = ?') && params.length > 0) {
              const cat = params[0];
              list = list.filter(p => p.category === cat);
            }
            // Filter featured
            if (cleanSql.includes('AND is_featured = 1')) {
              list = list.filter(p => p.is_featured === 1);
            }
            // Search
            if (cleanSql.includes('title LIKE ?')) {
              const searchParam = params.find(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
              if (searchParam) {
                const term = searchParam.replace(/%/g, '').toLowerCase();
                list = list.filter(p =>
                  (p.title && p.title.toLowerCase().includes(term)) ||
                  (p.description && p.description.toLowerCase().includes(term)) ||
                  (p.artisan_name && p.artisan_name.toLowerCase().includes(term)) ||
                  (p.artisan_tribe && p.artisan_tribe.toLowerCase().includes(term)) ||
                  (p.artisan_location && p.artisan_location.toLowerCase().includes(term))
                );
              }
            }
            // Sort
            if (cleanSql.includes('ORDER BY price ASC')) {
              list.sort((a, b) => a.price - b.price);
            } else if (cleanSql.includes('ORDER BY price DESC')) {
              list.sort((a, b) => b.price - a.price);
            } else {
              list.sort((a, b) => b.id - a.id);
            }
            return list;
          }

          // SELECT orders for user
          if (/WHERE o\.user_id = \? OR o\.client_email = \?/i.test(cleanSql)) {
            const [userId, userEmail] = params;
            const userOrders = memoryData.orders.filter(o =>
              (userId && o.user_id === Number(userId)) ||
              (userEmail && o.client_email.toLowerCase() === String(userEmail).toLowerCase())
            );
            return userOrders.map(o => {
              const prod = memoryData.products.find(p => p.id === o.product_id);
              return {
                ...o,
                product_image: prod ? prod.image_url : null,
                artisan_name: prod ? prod.artisan_name : 'Tribal Artisan',
                artisan_tribe: prod ? prod.artisan_tribe : 'Indigenous Tribe'
              };
            });
          }

          // SELECT orders for admin
          if (/SELECT o\.\*.*FROM orders o/i.test(cleanSql)) {
            let list = [...memoryData.orders];
            if (cleanSql.includes('AND o.status = ?')) {
              const status = params[0];
              list = list.filter(o => o.status === status);
            }
            if (cleanSql.includes('o.order_code LIKE ?')) {
              const searchParam = params.find(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
              if (searchParam) {
                const term = searchParam.replace(/%/g, '').toLowerCase();
                list = list.filter(o =>
                  (o.order_code && o.order_code.toLowerCase().includes(term)) ||
                  (o.client_name && o.client_name.toLowerCase().includes(term)) ||
                  (o.client_phone && o.client_phone.toLowerCase().includes(term)) ||
                  (o.client_email && o.client_email.toLowerCase().includes(term)) ||
                  (o.product_title && o.product_title.toLowerCase().includes(term))
                );
              }
            }
            list.sort((a, b) => b.id - a.id);
            if (cleanSql.includes('LIMIT 5')) {
              list = list.slice(0, 5);
            }
            return list.map(o => {
              const prod = memoryData.products.find(p => p.id === o.product_id);
              return {
                ...o,
                product_image: prod ? prod.image_url : null,
                artisan_name: prod ? prod.artisan_name : 'Tribal Artisan',
                artisan_tribe: prod ? prod.artisan_tribe : 'Indigenous Tribe',
                artisan_location: prod ? prod.artisan_location : 'India'
              };
            });
          }

          // Fallback return empty array
          return [];
        }
      };
    }
  };
}

// Initialize tables and pre-seed
function initDb() {
  if (!isFallbackMode && dbInstance) {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT DEFAULT 'Admin',
        role TEXT DEFAULT 'superadmin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        address TEXT,
        city TEXT,
        state TEXT,
        pincode TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 10,
        description TEXT NOT NULL,
        image_url TEXT NOT NULL,
        artisan_name TEXT NOT NULL,
        artisan_tribe TEXT NOT NULL,
        artisan_location TEXT NOT NULL,
        craft_heritage TEXT,
        is_featured INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_address TEXT NOT NULL,
        client_city TEXT,
        client_state TEXT,
        client_pincode TEXT,
        client_notes TEXT,
        product_id INTEGER NOT NULL,
        product_title TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER DEFAULT 1,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'Pending',
        admin_notes TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Seed default Admin if not exists
  const existingAdmin = dbInstance.prepare('SELECT * FROM admins WHERE email = ?').get('danialrenson@gmail.com');
  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('danial', salt);
    dbInstance.prepare(`
      INSERT INTO admins (email, password_hash, name, role)
      VALUES (?, ?, ?, ?)
    `).run('danialrenson@gmail.com', passwordHash, 'Danial Renson', 'superadmin');
    console.log('✔ Default Admin seeded: danialrenson@gmail.com / danial');
  }

  // Seed products if catalog empty
  const countRow = dbInstance.prepare('SELECT COUNT(*) as count FROM products').get();
  if (!countRow || countRow.count === 0) {
    seedTribalProducts();
  }
}

function seedTribalProducts() {
  const seedItems = [
    {
      title: 'Bastar Lost-Wax Dhokra Brass Royal Elephant',
      category: 'Metal Handicrafts',
      price: 2850,
      stock: 8,
      description: 'Handcrafted using the ancient 4,000-year-old lost-wax (cire perdue) metal casting technique. Each piece is individually hand-molded with beeswax cords, making every creation completely one-of-a-kind. Symbolizes royal strength, heritage, and auspicious prosperity.',
      image_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Mangal Ram Baghel',
      artisan_tribe: 'Ghadwa Artisan Community',
      artisan_location: 'Kondagaon, Bastar, Chhattisgarh',
      craft_heritage: '4,000-Year Ancient Lost-Wax Casting Heritage',
      is_featured: 1
    },
    {
      title: 'Original Warli Canvas: Tarpa Dance & Harvest Harmony',
      category: 'Tribal Paintings',
      price: 3400,
      stock: 5,
      description: 'Authentic canvas artwork created using crushed rice paste, water, and gum on mud-treated canvas. Features the revered Tarpa dance in spiral circles, celebrating harvest gratitude and nature worship without depiction of religious deities.',
      image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Jivya Soma Vangad',
      artisan_tribe: 'Warli Indigenous Tribe',
      artisan_location: 'Dahanu, Palghar, Maharashtra',
      craft_heritage: 'Geometric Folk Art passed across millennia',
      is_featured: 1
    },
    {
      title: 'Pure Wild Rock Bee Forest Honey (500g Glass Jar)',
      category: 'Forest & Natural Produce',
      price: 650,
      stock: 25,
      description: 'Raw, unpasteurized and unheated multifloral wild honey collected sustainably by indigenous Kurumba cliff-climbers from wild Apis dorsata bee colonies in the deep Nilgiri rainforest biosphere. Packed with raw enzymes, antioxidants, and forest pollen.',
      image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Raman K.',
      artisan_tribe: 'Kurumba Forest Gatherers Collective',
      artisan_location: 'Nilgiri Biosphere, Tamil Nadu',
      craft_heritage: 'Ethical Non-Violent Wild Honey Gathering',
      is_featured: 1
    },
    {
      title: 'Hand-Embroidered Toda Tribal Shawl (Poothkuli)',
      category: 'Textiles & Handloom',
      price: 4200,
      stock: 6,
      description: 'Traditional heavy cotton mantle with signature reversible geometric black and red embroidery called pugur. Handwoven on traditional looms by Toda women elders in the high Nilgiri grasslands. Certified with Geographical Indication (GI) tag.',
      image_url: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Devaki Toda',
      artisan_tribe: 'Toda Pastoral Tribe',
      artisan_location: 'Udhagamandalam, Nilgiris',
      craft_heritage: 'GI-Tagged High Mountain Traditional Embroidery',
      is_featured: 1
    },
    {
      title: 'Gond Vibrant Folk Painting: Sacred Mahua Tree',
      category: 'Tribal Paintings',
      price: 2950,
      stock: 7,
      description: 'Intricately patterned acrylic on handmade paper, hand-rendered with hundreds of signature Gond dots and fine rhythmic lines. The Mahua tree is honored as the giver of food, beverage, and shelter in tribal lore.',
      image_url: 'https://images.unsplash.com/photo-1582561143890-410a56aa13f4?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Bhajju Shyam',
      artisan_tribe: 'Pardhan Gond Community',
      artisan_location: 'Patangarh, Dindori, Madhya Pradesh',
      craft_heritage: 'Lyrical Narrative Tribal Dot Painting',
      is_featured: 0
    },
    {
      title: 'Traditional Bastar Hand-Forged Wrought Iron Deer Lamp',
      category: 'Metal Handicrafts',
      price: 1850,
      stock: 12,
      description: 'Loha Shilp (blacksmith craft) created without molds or modern welding. Scrap iron is heated in charcoal furnaces and hammered rhythmically on stone anvils by indigenous artisans into sleek, minimalist tribal silhouettes.',
      image_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Phool Singh Vishwakarma',
      artisan_tribe: 'Ghotul Blacksmith Guild',
      artisan_location: 'Jagdalpur, Bastar, Chhattisgarh',
      craft_heritage: 'Ancient Charcoal-Forged Wrought Iron Art',
      is_featured: 0
    },
    {
      title: 'Naga Heritage Multi-Strand Glass & Carnelian Bead Necklace',
      category: 'Tribal Jewelry',
      price: 1450,
      stock: 15,
      description: 'Handcrafted ceremonial beadwork featuring radiant orange-red glass trade beads, brass bells, and carnelian stones strung on durable waxed threads. Celebrates bravery, status, and harmony with the mountain ranges.',
      image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Aronba Ao',
      artisan_tribe: 'Ao & Konyak Naga Artisans',
      artisan_location: 'Mokokchung, Nagaland',
      craft_heritage: 'Ancestral Bead Weaving & Ornamentation',
      is_featured: 0
    },
    {
      title: 'Majuli Hand-Split River Bamboo Tea & Spice Caddy Set',
      category: 'Bamboo & Eco Crafts',
      price: 890,
      stock: 20,
      description: 'Crafted from sustainable mature Bhaluka bamboo from the riverbanks of Majuli. Naturally smoke-cured to resist moisture and pests without any chemical varnishes. Ideal for storing tea leaves, wild herbs, or spices.',
      image_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80',
      artisan_name: 'Biren Saikia',
      artisan_tribe: 'Mising River Community',
      artisan_location: 'Majuli Island, Brahmaputra, Assam',
      craft_heritage: 'Eco-Friendly Smoke-Treated Cane & Bamboo Weave',
      is_featured: 1
    }
  ];

  const insert = dbInstance.prepare(`
    INSERT INTO products (
      title, category, price, stock, description, image_url,
      artisan_name, artisan_tribe, artisan_location, craft_heritage, is_featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of seedItems) {
    insert.run(
      item.title,
      item.category,
      item.price,
      item.stock,
      item.description,
      item.image_url,
      item.artisan_name,
      item.artisan_tribe,
      item.artisan_location,
      item.craft_heritage,
      item.is_featured
    );
  }
  console.log(`✔ Seeded ${seedItems.length} authentic tribal community products`);
}

module.exports = {
  db: dbInstance,
  initDb
};
