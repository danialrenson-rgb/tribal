const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Database path
const dbPath = path.join(__dirname, '..', 'tribal_store.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance & concurrency
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  console.warn('PRAGMA notice:', e.message);
}

// Initialize tables
function initDb() {
  // Admins table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT 'Admin',
      role TEXT DEFAULT 'superadmin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Users table
  db.exec(`
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
  `);

  // Products table
  db.exec(`
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
  `);

  // Orders / Buy Requests table
  db.exec(`
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // Seed default Admin if not exists
  // Default credentials:
  // Email: danialrenson@gmail.com
  // Password: danial
  const findAdmin = db.prepare('SELECT * FROM admins WHERE email = ?');
  const existingAdmin = findAdmin.get('danialrenson@gmail.com');

  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('danial', salt);
    db.prepare(`
      INSERT INTO admins (email, password_hash, name, role)
      VALUES (?, ?, ?, ?)
    `).run('danialrenson@gmail.com', passwordHash, 'Danial Renson', 'superadmin');
    console.log('✔ Default Admin seeded: danialrenson@gmail.com / danial');
  }

  // Check if products exist; if not, seed realistic tribal community products
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
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

  const insert = db.prepare(`
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
  db,
  initDb
};

