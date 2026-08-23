import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { asyncHandler } from "../asyncHandler";
import { MenuItem } from "../types";

const router = Router();

// In-memory cache: menu items are read on nearly every request but written
// rarely (admin editing the menu), so we keep the full list in memory and
// only round-trip to Postgres on writes. This makes browsing/searching the
// menu instant regardless of database latency.
let cache: MenuItem[] | null = null;

function mapRow(row: any): MenuItem {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    category: row.category,
    description: row.description ?? undefined,
    available: row.available,
    isVeg: row.is_veg,
    imageUrl: row.image_url ?? undefined,
    hasPortions: row.has_portions,
    halfPrice: row.half_price !== null ? Number(row.half_price) : undefined,
    fullPrice: row.full_price !== null ? Number(row.full_price) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function loadCache(): Promise<MenuItem[]> {
  if (cache) return cache;
  const { rows } = await pool.query("SELECT * FROM menu_items ORDER BY created_at ASC");
  cache = rows.map(mapRow);
  return cache;
}

function invalidateCache(): void {
  cache = null;
}

export async function getMenuItemById(id: string): Promise<MenuItem | undefined> {
  const items = await loadCache();
  return items.find((i) => i.id === id);
}

// GET /api/menu?category=Starters&search=paneer&veg=veg|nonveg|all
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { category, search, veg } = req.query;
  let items = await loadCache();

  if (category && typeof category === "string" && category !== "All") {
    items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }
  if (search && typeof search === "string") {
    const term = search.toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(term));
  }
  if (veg === "veg") {
    items = items.filter((i) => i.isVeg);
  } else if (veg === "nonveg") {
    items = items.filter((i) => !i.isVeg);
  }

  res.json(items);
}));

// GET /api/menu/categories
router.get("/categories", asyncHandler(async (_req: Request, res: Response) => {
  const items = await loadCache();
  const categories = Array.from(new Set(items.map((i) => i.category))).sort();
  res.json(categories);
}));

// POST /api/menu
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { name, price, category, description, available, isVeg, imageUrl, hasPortions, halfPrice, fullPrice } =
    req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Item name is required" });
  }
  if (!category || typeof category !== "string" || !category.trim()) {
    return res.status(400).json({ error: "Category is required" });
  }

  const usesPortions = hasPortions === true;
  let finalPrice: number;
  let finalHalfPrice: number | null = null;
  let finalFullPrice: number | null = null;

  if (usesPortions) {
    if (typeof halfPrice !== "number" || halfPrice < 0) {
      return res.status(400).json({ error: "Half price must be a non-negative number" });
    }
    if (typeof fullPrice !== "number" || fullPrice < 0) {
      return res.status(400).json({ error: "Full price must be a non-negative number" });
    }
    finalHalfPrice = halfPrice;
    finalFullPrice = fullPrice;
    finalPrice = fullPrice;
  } else {
    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ error: "Price must be a non-negative number" });
    }
    finalPrice = price;
  }

  const id = uuidv4();
  const { rows } = await pool.query(
    `INSERT INTO menu_items (id, name, price, category, description, available, is_veg, image_url, has_portions, half_price, full_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      id,
      name.trim(),
      finalPrice,
      category.trim(),
      typeof description === "string" && description.trim() ? description.trim() : null,
      available !== false,
      isVeg !== false,
      typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
      usesPortions,
      finalHalfPrice,
      finalFullPrice,
    ]
  );

  invalidateCache();
  res.status(201).json(mapRow(rows[0]));
}));

// PUT /api/menu/:id
router.put("/:id", asyncHandler(async (req: Request, res: Response) => {
  const existing = await pool.query("SELECT * FROM menu_items WHERE id = $1", [req.params.id]);
  if (existing.rowCount === 0) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  const item = mapRow(existing.rows[0]);

  const { name, price, category, description, available, isVeg, imageUrl, hasPortions, halfPrice, fullPrice } =
    req.body;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Item name must be a non-empty string" });
    }
    item.name = name.trim();
  }
  if (category !== undefined) {
    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ error: "Category must be a non-empty string" });
    }
    item.category = category.trim();
  }
  if (description !== undefined) {
    item.description = typeof description === "string" && description.trim() ? description.trim() : undefined;
  }
  if (available !== undefined) item.available = Boolean(available);
  if (isVeg !== undefined) item.isVeg = Boolean(isVeg);
  if (imageUrl !== undefined) {
    item.imageUrl = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : undefined;
  }

  if (hasPortions !== undefined) {
    const usesPortions = hasPortions === true;
    if (usesPortions) {
      const hp = halfPrice !== undefined ? halfPrice : item.halfPrice;
      const fp = fullPrice !== undefined ? fullPrice : item.fullPrice;
      if (typeof hp !== "number" || hp < 0) {
        return res.status(400).json({ error: "Half price must be a non-negative number" });
      }
      if (typeof fp !== "number" || fp < 0) {
        return res.status(400).json({ error: "Full price must be a non-negative number" });
      }
      item.hasPortions = true;
      item.halfPrice = hp;
      item.fullPrice = fp;
      item.price = fp;
    } else {
      item.hasPortions = false;
      item.halfPrice = undefined;
      item.fullPrice = undefined;
      if (price !== undefined) {
        if (typeof price !== "number" || price < 0) {
          return res.status(400).json({ error: "Price must be a non-negative number" });
        }
        item.price = price;
      }
    }
  } else if (item.hasPortions) {
    if (halfPrice !== undefined) {
      if (typeof halfPrice !== "number" || halfPrice < 0) {
        return res.status(400).json({ error: "Half price must be a non-negative number" });
      }
      item.halfPrice = halfPrice;
    }
    if (fullPrice !== undefined) {
      if (typeof fullPrice !== "number" || fullPrice < 0) {
        return res.status(400).json({ error: "Full price must be a non-negative number" });
      }
      item.fullPrice = fullPrice;
      item.price = fullPrice;
    }
  } else if (price !== undefined) {
    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ error: "Price must be a non-negative number" });
    }
    item.price = price;
  }

  const { rows } = await pool.query(
    `UPDATE menu_items SET
       name = $1, price = $2, category = $3, description = $4, available = $5, is_veg = $6,
       image_url = $7, has_portions = $8, half_price = $9, full_price = $10, updated_at = now()
     WHERE id = $11
     RETURNING *`,
    [
      item.name,
      item.price,
      item.category,
      item.description ?? null,
      item.available,
      item.isVeg,
      item.imageUrl ?? null,
      item.hasPortions,
      item.halfPrice ?? null,
      item.fullPrice ?? null,
      item.id,
    ]
  );

  invalidateCache();
  res.json(mapRow(rows[0]));
}));

// DELETE /api/menu/:id
router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query("DELETE FROM menu_items WHERE id = $1 RETURNING *", [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  invalidateCache();
  res.json(mapRow(rows[0]));
}));

export default router;
