# Saffron Table — Restaurant Billing / POS

A full billing & point-of-sale system for restaurants: menu management, order billing with tax & discount, receipt printing, and order history/sales reporting.

## Stack

- **Backend:** Node.js + Express + TypeScript, JSON-file datastore (`backend/src/data/db.json`, auto-created and seeded on first run — no external DB setup needed).
- **Frontend:** Vanilla HTML/CSS/JS (no build step), served statically by the backend. Classic maroon-and-gold restaurant theme, responsive layout.

## Features

- **Menu management** — add / edit / delete items (name, price, category, description, availability), search & filter by category.
- **Billing screen** — tap items to add to the cart, adjust quantity inline, live subtotal/tax/discount/total calculation.
- **Tax & discount** — configurable tax % per bill, discount as percent or flat amount.
- **Receipt printing** — "Place Order & Print Bill" generates the order and opens the browser print dialog with a formatted receipt.
- **Order history** — full order list, today-only filter, void an order, and a live "Today's Sales" dashboard (total sales, order count, items sold, average bill).

## Getting started

```bash
cd backend
npm install
npm run dev       # starts the API + frontend at http://localhost:4000
```

Open http://localhost:4000 in your browser.

### Production build

```bash
cd backend
npm run build
npm start
```

## Project structure

```
backend/
  src/
    index.ts          # Express app entrypoint, serves frontend + API
    db.ts             # JSON-file datastore (read/write + seed data)
    types.ts          # Shared TypeScript types
    routes/
      menu.ts          # Menu CRUD + category/search endpoints
      orders.ts        # Order creation, history, today's summary, void
frontend/
  index.html
  css/styles.css
  js/
    api.js              # fetch wrapper for the backend API
    billing.js           # billing screen logic (cart, totals, printing)
    menu-management.js   # menu CRUD UI
    history.js           # order history + sales summary UI
    app.js                # navigation + clock bootstrap
```

## API overview

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/menu?search=&category= | List menu items |
| GET | /api/menu/categories | List distinct categories |
| POST | /api/menu | Create menu item |
| PUT | /api/menu/:id | Update menu item |
| DELETE | /api/menu/:id | Delete menu item |
| GET | /api/orders?date=today | List orders |
| GET | /api/orders/summary/today | Today's sales summary |
| GET | /api/orders/:id | Get single order |
| POST | /api/orders | Create order (calculates tax/discount/total) |
| POST | /api/orders/:id/void | Void an order |
