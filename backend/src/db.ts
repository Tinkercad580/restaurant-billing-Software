import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { uploadBuffer } from "./cloudinary";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const LEGACY_JSON_PATH = path.join(__dirname, "data", "db.json");

// Legacy records stored photos as inline base64 data URLs, or as local
// /uploads/*.jpg file paths from an earlier local-disk storage scheme.
// Convert both to Cloudinary during the one-time migration so nothing is
// lost on a host with an ephemeral filesystem (e.g. Render).
async function migrateInlineImageToFile(imageUrl: string | null | undefined): Promise<string | null> {
  if (!imageUrl) return null;

  let buffer: Buffer;
  if (imageUrl.startsWith("data:image/")) {
    buffer = Buffer.from(imageUrl.split(",")[1], "base64");
  } else if (imageUrl.startsWith("/uploads/")) {
    const localPath = path.join(__dirname, "..", imageUrl);
    if (!fs.existsSync(localPath)) return null;
    buffer = fs.readFileSync(localPath);
  } else {
    return imageUrl; // already a full URL (e.g. Cloudinary) — leave as-is
  }

  try {
    return await uploadBuffer(buffer);
  } catch {
    return null; // corrupt/unreachable — drop it rather than fail the migration
  }
}

async function createSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      available BOOLEAN NOT NULL DEFAULT true,
      is_veg BOOLEAN NOT NULL DEFAULT true,
      image_url TEXT,
      has_portions BOOLEAN NOT NULL DEFAULT false,
      half_price NUMERIC(10,2),
      full_price NUMERIC(10,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      bill_number INTEGER NOT NULL UNIQUE,
      items JSONB NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'none',
      discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL,
      customer_name TEXT,
      table_number TEXT,
      order_type TEXT NOT NULL DEFAULT 'dine-in',
      phone TEXT,
      delivery_address TEXT,
      delivery_status TEXT,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders (order_type);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items (category);

    CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1001;
  `);
}

async function migrateLegacyJsonIfPresent(): Promise<void> {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM menu_items");
  if (rows[0].count > 0) return; // already has data, never overwrite
  if (!fs.existsSync(LEGACY_JSON_PATH)) return;

  const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, "utf-8"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const item of legacy.menuItems ?? []) {
      const imageUrl = await migrateInlineImageToFile(item.imageUrl);
      await client.query(
        `INSERT INTO menu_items
          (id, name, price, category, description, available, is_veg, image_url, has_portions, half_price, full_price, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.name,
          item.price,
          item.category,
          item.description ?? null,
          item.available !== false,
          item.isVeg !== false,
          imageUrl,
          Boolean(item.hasPortions),
          item.halfPrice ?? null,
          item.fullPrice ?? null,
          item.createdAt ?? new Date().toISOString(),
          item.updatedAt ?? new Date().toISOString(),
        ]
      );
    }

    for (const order of legacy.orders ?? []) {
      await client.query(
        `INSERT INTO orders
          (id, bill_number, items, subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
           delivery_charge, total, customer_name, table_number, order_type, phone, delivery_address, delivery_status,
           payment_method, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (id) DO NOTHING`,
        [
          order.id,
          order.billNumber,
          JSON.stringify(order.items ?? []),
          order.subtotal ?? 0,
          order.taxRate ?? 0,
          order.taxAmount ?? 0,
          order.discountType ?? "none",
          order.discountValue ?? 0,
          order.discountAmount ?? 0,
          order.deliveryCharge ?? 0,
          order.total ?? 0,
          order.customerName ?? null,
          order.tableNumber ?? null,
          order.orderType ?? "dine-in",
          order.phone ?? null,
          order.deliveryAddress ?? null,
          order.deliveryStatus ?? null,
          order.paymentMethod ?? "cash",
          order.createdAt ?? new Date().toISOString(),
        ]
      );
    }

    const nextBillNumber = legacy.nextBillNumber ?? 1001;
    await client.query("SELECT setval('bill_number_seq', $1, false)", [nextBillNumber]);

    await client.query("COMMIT");
    console.log(
      `Migrated ${legacy.menuItems?.length ?? 0} menu items and ${legacy.orders?.length ?? 0} orders from legacy JSON into Postgres.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const FALLBACK_SEED: Array<[string, number, string, boolean, number?, number?]> = [
  ["Paneer Butter Masala", 220, "Main Course", true],
  ["Butter Chicken", 260, "Main Course", false],
  ["Dal Makhani", 180, "Main Course", true],
  ["Veg Biryani", 190, "Rice & Biryani", true, 120, 190],
  ["Chicken Biryani", 240, "Rice & Biryani", false, 150, 240],
  ["Tandoori Roti", 25, "Breads", true],
  ["Butter Naan", 40, "Breads", true],
  ["Veg Spring Roll", 150, "Starters", true],
  ["Chicken Tikka", 260, "Starters", false],
  ["Paneer Tikka", 220, "Starters", true],
  ["Masala Papad", 60, "Starters", true],
  ["Gulab Jamun", 90, "Desserts", true],
  ["Ice Cream", 80, "Desserts", true],
  ["Masala Chaas", 50, "Beverages", true],
  ["Cold Coffee", 110, "Beverages", true],
  ["Mineral Water", 20, "Beverages", true],
];

async function seedIfEmpty(): Promise<void> {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM menu_items");
  if (rows[0].count > 0) return;

  for (let i = 0; i < FALLBACK_SEED.length; i++) {
    const [name, price, category, isVeg, halfPrice, fullPrice] = FALLBACK_SEED[i];
    await pool.query(
      `INSERT INTO menu_items (id, name, price, category, is_veg, has_portions, half_price, full_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [`seed-${i + 1}`, name, halfPrice ? fullPrice : price, category, isVeg, Boolean(halfPrice), halfPrice ?? null, fullPrice ?? null]
    );
  }
  console.log("Seeded default menu items into Postgres.");
}

export async function initDb(): Promise<void> {
  await createSchema();
  await migrateLegacyJsonIfPresent();
  await seedIfEmpty();
}
