import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { asyncHandler } from "../asyncHandler";
import { getMenuItemById } from "./menu";
import { DeliveryStatus, DiscountType, Order, OrderLineItem, OrderType, Portion } from "../types";

const DELIVERY_STATUSES: DeliveryStatus[] = ["pending", "out_for_delivery", "delivered", "cancelled"];

const router = Router();

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function mapRow(row: any): Order {
  return {
    id: row.id,
    billNumber: row.bill_number,
    items: row.items,
    subtotal: Number(row.subtotal),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    deliveryCharge: Number(row.delivery_charge),
    total: Number(row.total),
    customerName: row.customer_name ?? undefined,
    tableNumber: row.table_number ?? undefined,
    orderType: row.order_type,
    phone: row.phone ?? undefined,
    deliveryAddress: row.delivery_address ?? undefined,
    deliveryStatus: row.delivery_status ?? undefined,
    paymentMethod: row.payment_method,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// GET /api/orders?date=today&from=2026-08-01&to=2026-08-22&payment=cash&search=1001
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { date, from, to, payment, search, orderType, deliveryStatus } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];

  if (date === "today") {
    conditions.push(`created_at >= date_trunc('day', now()) AND created_at < date_trunc('day', now()) + interval '1 day'`);
  }
  if (from && typeof from === "string") {
    params.push(from);
    conditions.push(`created_at >= $${params.length}::date`);
  }
  if (to && typeof to === "string") {
    params.push(to);
    conditions.push(`created_at < $${params.length}::date + interval '1 day'`);
  }
  if (payment && typeof payment === "string" && payment !== "all") {
    params.push(payment);
    conditions.push(`payment_method = $${params.length}`);
  }
  if (orderType && typeof orderType === "string" && orderType !== "all") {
    params.push(orderType);
    conditions.push(`order_type = $${params.length}`);
  }
  if (deliveryStatus && typeof deliveryStatus === "string" && deliveryStatus !== "all") {
    params.push(deliveryStatus);
    conditions.push(`delivery_status = $${params.length}`);
  }
  if (search && typeof search === "string" && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(bill_number::text ILIKE ${p} OR LOWER(COALESCE(customer_name,'')) ILIKE ${p} OR LOWER(COALESCE(table_number,'')) ILIKE ${p} OR LOWER(COALESCE(phone,'')) ILIKE ${p} OR LOWER(COALESCE(delivery_address,'')) ILIKE ${p} OR items::text ILIKE ${p})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);
  res.json(rows.map(mapRow));
}));

// GET /api/orders/summary/today
router.get("/summary/today", asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT total, items FROM orders
     WHERE created_at >= date_trunc('day', now()) AND created_at < date_trunc('day', now()) + interval '1 day'`
  );

  const totalSales = round2(rows.reduce((sum, r) => sum + Number(r.total), 0));
  const totalOrders = rows.length;
  const totalItemsSold = rows.reduce(
    (sum, r) => sum + (r.items as OrderLineItem[]).reduce((s, i) => s + i.quantity, 0),
    0
  );
  const averageBill = totalOrders > 0 ? round2(totalSales / totalOrders) : 0;

  res.json({ totalSales, totalOrders, totalItemsSold, averageBill });
}));

// GET /api/orders/:id
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json(mapRow(rows[0]));
}));

// POST /api/orders
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const {
    items,
    taxRate,
    discountType,
    discountValue,
    deliveryCharge,
    customerName,
    tableNumber,
    orderType,
    phone,
    deliveryAddress,
    paymentMethod,
  } = req.body as {
    items: Array<{ menuItemId: string; quantity: number; portion?: Portion }>;
    taxRate?: number;
    discountType?: DiscountType;
    discountValue?: number;
    deliveryCharge?: number;
    customerName?: string;
    tableNumber?: string;
    orderType?: OrderType;
    phone?: string;
    deliveryAddress?: string;
    paymentMethod?: Order["paymentMethod"];
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order must contain at least one item" });
  }

  const effectiveOrderType: OrderType = orderType === "delivery" ? "delivery" : "dine-in";

  if (effectiveOrderType === "delivery") {
    if (typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ error: "Phone number is required for delivery orders" });
    }
    if (typeof deliveryAddress !== "string" || !deliveryAddress.trim()) {
      return res.status(400).json({ error: "Delivery address is required for delivery orders" });
    }
  }

  const lineItems: OrderLineItem[] = [];

  for (const line of items) {
    const menuItem = await getMenuItemById(line.menuItemId);
    if (!menuItem) {
      return res.status(400).json({ error: `Menu item not found: ${line.menuItemId}` });
    }
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: `Invalid quantity for ${menuItem.name}` });
    }

    let price = menuItem.price;
    let portion: Portion | undefined;

    if (menuItem.hasPortions) {
      if (line.portion !== "half" && line.portion !== "full") {
        return res.status(400).json({ error: `Select a portion (half/full) for ${menuItem.name}` });
      }
      portion = line.portion;
      price = portion === "half" ? (menuItem.halfPrice as number) : (menuItem.fullPrice as number);
    }

    lineItems.push({
      menuItemId: menuItem.id,
      name: portion ? `${menuItem.name} (${portion === "half" ? "Half" : "Full"})` : menuItem.name,
      portion,
      price,
      quantity,
      lineTotal: round2(price * quantity),
    });
  }

  const subtotal = round2(lineItems.reduce((sum, i) => sum + i.lineTotal, 0));

  const effectiveTaxRate = typeof taxRate === "number" && taxRate >= 0 ? taxRate : 0;
  const effectiveDiscountType: DiscountType =
    discountType === "percent" || discountType === "flat" ? discountType : "none";
  const effectiveDiscountValue =
    typeof discountValue === "number" && discountValue >= 0 ? discountValue : 0;

  let discountAmount = 0;
  if (effectiveDiscountType === "percent") {
    discountAmount = round2((subtotal * effectiveDiscountValue) / 100);
  } else if (effectiveDiscountType === "flat") {
    discountAmount = round2(Math.min(effectiveDiscountValue, subtotal));
  }

  const effectiveDeliveryCharge =
    effectiveOrderType === "delivery" && typeof deliveryCharge === "number" && deliveryCharge >= 0
      ? deliveryCharge
      : 0;

  const discountedSubtotal = round2(subtotal - discountAmount);
  const taxAmount = round2((discountedSubtotal * effectiveTaxRate) / 100);
  const total = round2(discountedSubtotal + taxAmount + effectiveDeliveryCharge);

  const id = uuidv4();
  const billNumberResult = await pool.query("SELECT nextval('bill_number_seq') AS n");
  const billNumber = Number(billNumberResult.rows[0].n);

  const { rows } = await pool.query(
    `INSERT INTO orders
      (id, bill_number, items, subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
       delivery_charge, total, customer_name, table_number, order_type, phone, delivery_address, delivery_status,
       payment_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      id,
      billNumber,
      JSON.stringify(lineItems),
      subtotal,
      effectiveTaxRate,
      taxAmount,
      effectiveDiscountType,
      effectiveDiscountValue,
      discountAmount,
      effectiveDeliveryCharge,
      total,
      typeof customerName === "string" && customerName.trim() ? customerName.trim() : null,
      effectiveOrderType === "dine-in" && typeof tableNumber === "string" && tableNumber.trim()
        ? tableNumber.trim()
        : null,
      effectiveOrderType,
      effectiveOrderType === "delivery" ? (phone as string).trim() : null,
      effectiveOrderType === "delivery" ? (deliveryAddress as string).trim() : null,
      effectiveOrderType === "delivery" ? "pending" : null,
      paymentMethod ?? "cash",
    ]
  );

  res.status(201).json(mapRow(rows[0]));
}));

// PATCH /api/orders/:id/delivery-status
router.patch("/:id/delivery-status", asyncHandler(async (req: Request, res: Response) => {
  const { rows: existingRows } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (existingRows[0].order_type !== "delivery") {
    return res.status(400).json({ error: "This order is not a delivery order" });
  }

  const { deliveryStatus } = req.body as { deliveryStatus?: DeliveryStatus };
  if (!deliveryStatus || !DELIVERY_STATUSES.includes(deliveryStatus)) {
    return res.status(400).json({ error: `deliveryStatus must be one of: ${DELIVERY_STATUSES.join(", ")}` });
  }

  const { rows } = await pool.query(
    "UPDATE orders SET delivery_status = $1 WHERE id = $2 RETURNING *",
    [deliveryStatus, req.params.id]
  );
  res.json(mapRow(rows[0]));
}));

export default router;
