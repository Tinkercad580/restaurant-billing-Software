const Billing = (() => {
  let menuItems = [];
  let cart = []; // { menuItemId, name, price, quantity }
  let activeCategory = "All";
  let activeVeg = "all";
  let orderType = "dine-in";

  const CATEGORY_ICONS = {
    "starters": "🥗",
    "main course": "🍛",
    "rice & biryani": "🍚",
    "breads": "🫓",
    "desserts": "🍮",
    "beverages": "🥤",
  };

  async function init() {
    bindEvents();
    applyOrderTypeVisibility();
    await loadMenu();
    await refreshCategoryPills();
    await refreshTodayStats();
  }

  function bindEvents() {
    document.getElementById("searchInput").addEventListener("input", debounce(loadMenu, 250));
    document.getElementById("clearCartBtn").addEventListener("click", () => {
      cart = [];
      renderCart();
    });
    document.getElementById("taxRate").addEventListener("input", renderCart);
    document.getElementById("discountType").addEventListener("change", renderCart);
    document.getElementById("discountValue").addEventListener("input", renderCart);
    document.getElementById("placeOrderBtn").addEventListener("click", placeOrder);

    document.getElementById("vegToggle").addEventListener("click", (e) => {
      const btn = e.target.closest(".veg-btn");
      if (!btn) return;
      activeVeg = btn.dataset.veg;
      document.querySelectorAll("#vegToggle .veg-btn").forEach((b) => b.classList.toggle("active", b === btn));
      loadMenu();
    });

    document.getElementById("orderTypeToggle").addEventListener("click", (e) => {
      const btn = e.target.closest(".order-type-btn");
      if (!btn) return;
      orderType = btn.dataset.type;
      document.querySelectorAll(".order-type-btn").forEach((b) => b.classList.toggle("active", b === btn));
      applyOrderTypeVisibility();
      renderCart();
    });
    document.getElementById("deliveryCharge").addEventListener("input", renderCart);
  }

  function applyOrderTypeVisibility() {
    const isDelivery = orderType === "delivery";
    document.getElementById("tableNumber").style.display = orderType === "dine-in" ? "" : "none";
    document.getElementById("deliveryFields").hidden = !isDelivery;
    document.getElementById("deliveryChargeRow").hidden = !isDelivery;
  }

  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  async function loadMenu() {
    const search = document.getElementById("searchInput").value.trim();
    try {
      menuItems = await Api.getMenu({ search, category: activeCategory, veg: activeVeg });
      renderMenuGrid();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function loadCategoriesInto(selectEl, includeAllLabel = "All Categories") {
    try {
      const categories = await Api.getCategories();
      const current = selectEl.value;
      selectEl.innerHTML = `<option value="All">${includeAllLabel}</option>` +
        categories.map((c) => `<option value="${c}">${c}</option>`).join("");
      if (categories.includes(current)) selectEl.value = current;
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function refreshCategoryPills() {
    try {
      const categories = await Api.getCategories();
      const container = document.getElementById("categoryList_pills");
      const pills = [
        `<button class="category-pill ${activeCategory === "All" ? "active" : ""}" data-category="All">All Items</button>`,
        ...categories.map(
          (c) =>
            `<button class="category-pill ${activeCategory === c ? "active" : ""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`
        ),
      ];
      container.innerHTML = pills.join("");
      container.querySelectorAll(".category-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeCategory = btn.dataset.category;
          container.querySelectorAll(".category-pill").forEach((b) => b.classList.toggle("active", b === btn));
          loadMenu();
        });
      });
    } catch (err) {
      // non-fatal
    }
  }

  function lineKey(menuItemId, portion) {
    return `${menuItemId}::${portion || "single"}`;
  }

  function renderMenuGrid() {
    const grid = document.getElementById("menuGrid");
    if (menuItems.length === 0) {
      grid.innerHTML = `<div class="empty-cart">No menu items match your search</div>`;
      return;
    }
    grid.innerHTML = menuItems
      .map((item) => {
        const icon = CATEGORY_ICONS[item.category.toLowerCase()] || "🍽️";
        const image = item.imageUrl
          ? `<div class="menu-card-image-frame"><img class="menu-card-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" /></div>`
          : `<div class="menu-card-image-placeholder">${icon}</div>`;

        const priceBlock = item.hasPortions
          ? `<div class="menu-card-portions">
               <button type="button" class="portion-btn" data-id="${item.id}" data-portion="half" ${item.available ? "" : "disabled"}>
                 <span>Half</span><span>${formatCurrency(item.halfPrice)}</span>
               </button>
               <button type="button" class="portion-btn" data-id="${item.id}" data-portion="full" ${item.available ? "" : "disabled"}>
                 <span>Full</span><span>${formatCurrency(item.fullPrice)}</span>
               </button>
             </div>`
          : `<span class="menu-card-price">${formatCurrency(item.price)}</span>`;

        const cardAttrs = item.hasPortions
          ? ""
          : `data-id="${item.id}" role="button" tabindex="0"`;

        return `
      <div class="menu-card ${item.available ? "" : "menu-card-unavailable"}" ${cardAttrs}>
        <button type="button" class="menu-card-edit-btn" data-edit-id="${item.id}" title="Edit item" aria-label="Edit ${escapeHtml(item.name)}">
          <svg viewBox="0 0 20 20" width="13" height="13" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.6 2.4a1.5 1.5 0 0 1 2.12 0l1.88 1.88a1.5 1.5 0 0 1 0 2.12L7.4 16.6l-4.2.8.8-4.2L13.6 2.4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
        </button>
        ${image}
        <div class="menu-card-body">
          <div class="menu-card-top">
            <span class="menu-card-name">${escapeHtml(item.name)}</span>
            <span class="veg-dot ${item.isVeg ? "veg" : "nonveg"}" title="${item.isVeg ? "Veg" : "Non-Veg"}"></span>
          </div>
          <span class="menu-card-category">${escapeHtml(item.category)}</span>
          ${priceBlock}
        </div>
      </div>`;
      })
      .join("");

    grid.querySelectorAll(".menu-card[data-id]").forEach((card) => {
      card.addEventListener("click", () => addToCart(card.dataset.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          addToCart(card.dataset.id);
        }
      });
    });
    grid.querySelectorAll(".portion-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(btn.dataset.id, btn.dataset.portion);
      });
    });
    grid.querySelectorAll(".menu-card-edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = menuItems.find((m) => m.id === btn.dataset.editId);
        if (item) MenuManagement.openModalWithItem(item);
      });
    });
  }

  function addToCart(menuItemId, portion) {
    const item = menuItems.find((m) => m.id === menuItemId);
    if (!item || !item.available) return;

    const price = portion === "half" ? item.halfPrice : portion === "full" ? item.fullPrice : item.price;
    const name = portion ? `${item.name} (${portion === "half" ? "Half" : "Full"})` : item.name;
    const key = lineKey(menuItemId, portion);

    const existing = cart.find((c) => c.key === key);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ key, menuItemId: item.id, portion, name, price, quantity: 1 });
    }
    renderCart();
  }

  function changeQty(key, delta) {
    const line = cart.find((c) => c.key === key);
    if (!line) return;
    line.quantity += delta;
    if (line.quantity <= 0) {
      cart = cart.filter((c) => c.key !== key);
    }
    renderCart();
  }

  function removeLine(key) {
    cart = cart.filter((c) => c.key !== key);
    renderCart();
  }

  function computeTotals() {
    const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
    const taxRate = parseFloat(document.getElementById("taxRate").value) || 0;
    const discountType = document.getElementById("discountType").value;
    const discountValue = parseFloat(document.getElementById("discountValue").value) || 0;
    const deliveryCharge = orderType === "delivery" ? parseFloat(document.getElementById("deliveryCharge").value) || 0 : 0;

    let discountAmount = 0;
    if (discountType === "percent") {
      discountAmount = (subtotal * discountValue) / 100;
    } else if (discountType === "flat") {
      discountAmount = Math.min(discountValue, subtotal);
    }
    const discountedSubtotal = subtotal - discountAmount;
    const taxAmount = (discountedSubtotal * taxRate) / 100;
    const total = discountedSubtotal + taxAmount + deliveryCharge;

    return { subtotal, taxRate, discountType, discountValue, discountAmount, deliveryCharge, taxAmount, total };
  }

  function renderCart() {
    const container = document.getElementById("cartItems");
    if (cart.length === 0) {
      container.innerHTML = `<div class="empty-cart">No items added yet</div>`;
    } else {
      container.innerHTML = cart
        .map(
          (c) => `
        <div class="cart-line">
          <div style="flex:1">
            <div class="cart-line-name">${escapeHtml(c.name)}</div>
            <div class="cart-line-price">${formatCurrency(c.price)} each</div>
          </div>
          <div class="qty-control">
            <button data-action="dec" data-key="${c.key}">−</button>
            <span>${c.quantity}</span>
            <button data-action="inc" data-key="${c.key}">+</button>
          </div>
          <div class="cart-line-total">${formatCurrency(c.price * c.quantity)}</div>
          <button class="remove-line" data-action="remove" data-key="${c.key}">✕</button>
        </div>`
        )
        .join("");

      container.querySelectorAll("[data-action='inc']").forEach((b) =>
        b.addEventListener("click", () => changeQty(b.dataset.key, 1))
      );
      container.querySelectorAll("[data-action='dec']").forEach((b) =>
        b.addEventListener("click", () => changeQty(b.dataset.key, -1))
      );
      container.querySelectorAll("[data-action='remove']").forEach((b) =>
        b.addEventListener("click", () => removeLine(b.dataset.key))
      );
    }

    const totals = computeTotals();
    document.getElementById("sumSubtotal").textContent = formatCurrency(totals.subtotal);
    document.getElementById("sumDiscount").textContent = `−${formatCurrency(totals.discountAmount)}`;
    document.getElementById("sumTax").textContent = `+${formatCurrency(totals.taxAmount)}`;
    document.getElementById("sumTotal").textContent = formatCurrency(totals.total);
    document.getElementById("placeOrderBtn").disabled = cart.length === 0;
  }

  async function placeOrder() {
    if (cart.length === 0) return;

    if (orderType === "delivery") {
      const phone = document.getElementById("deliveryPhone").value.trim();
      const address = document.getElementById("deliveryAddress").value.trim();
      if (!phone) {
        showToast("Phone number is required for delivery orders", "error");
        return;
      }
      if (!address) {
        showToast("Delivery address is required for delivery orders", "error");
        return;
      }
    }

    const totals = computeTotals();
    const payload = {
      items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, portion: c.portion })),
      taxRate: totals.taxRate,
      discountType: totals.discountType,
      discountValue: totals.discountValue,
      deliveryCharge: totals.deliveryCharge,
      customerName: document.getElementById("customerName").value.trim(),
      tableNumber: document.getElementById("tableNumber").value.trim(),
      orderType,
      phone: orderType === "delivery" ? document.getElementById("deliveryPhone").value.trim() : undefined,
      deliveryAddress: orderType === "delivery" ? document.getElementById("deliveryAddress").value.trim() : undefined,
      paymentMethod: document.getElementById("paymentMethod").value,
    };

    const btn = document.getElementById("placeOrderBtn");
    btn.disabled = true;
    btn.textContent = "Placing order…";

    try {
      const order = await Api.createOrder(payload);
      showToast(`Bill #${order.billNumber} placed successfully`, "success");
      printReceipt(order);
      cart = [];
      document.getElementById("customerName").value = "";
      document.getElementById("tableNumber").value = "";
      document.getElementById("deliveryPhone").value = "";
      document.getElementById("deliveryAddress").value = "";
      document.getElementById("deliveryCharge").value = "0";
      renderCart();
      await refreshTodayStats();
      if (window.OrderHistory) window.OrderHistory.reload();
      if (window.Deliveries) window.Deliveries.reload();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.textContent = "Place Order & Print Bill";
      btn.disabled = cart.length === 0;
    }
  }

  function printReceipt(order) {
    const el = document.getElementById("receipt");
    const dt = new Date(order.createdAt);

    const orderTypeLabel = { "dine-in": "Dine-in", takeaway: "Takeaway", delivery: "Delivery" }[order.orderType] || "Dine-in";

    const metaRows = [
      ["Bill No.", `#${order.billNumber}`],
      ["Date", dt.toLocaleDateString()],
      ["Time", dt.toLocaleTimeString()],
      ["Order Type", orderTypeLabel],
    ];
    if (order.tableNumber) metaRows.push(["Table", order.tableNumber]);
    if (order.customerName) metaRows.push(["Customer", order.customerName]);
    if (order.orderType === "delivery") {
      if (order.phone) metaRows.push(["Phone", order.phone]);
      if (order.deliveryAddress) metaRows.push(["Address", order.deliveryAddress]);
    }

    el.innerHTML = `
      <div class="r-brand">Saffron Table</div>
      <div class="r-tagline">Restaurant &amp; Dining</div>

      <div class="r-meta">
        ${metaRows
          .map(([label, value]) => `<div class="r-meta-row"><span>${label}</span><span>${escapeHtml(String(value))}</span></div>`)
          .join("")}
      </div>

      <table class="r-items">
        <thead>
          <tr><th>Item</th><th class="r-num">Qty</th><th class="r-num">Amount</th></tr>
        </thead>
        <tbody>
          ${order.items
            .map(
              (i) => `
            <tr>
              <td>${escapeHtml(i.name)}</td>
              <td class="r-num">${i.quantity}</td>
              <td class="r-num">${formatCurrency(i.lineTotal)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <div class="r-totals">
        <div class="r-row"><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></div>
        <div class="r-row"><span>Discount</span><span>−${formatCurrency(order.discountAmount)}</span></div>
        <div class="r-row"><span>Tax (${order.taxRate}%)</span><span>+${formatCurrency(order.taxAmount)}</span></div>
        ${order.deliveryCharge > 0 ? `<div class="r-row"><span>Delivery Charge</span><span>+${formatCurrency(order.deliveryCharge)}</span></div>` : ""}
        <div class="r-row r-grand"><span>Total</span><span>${formatCurrency(order.total)}</span></div>
      </div>

      <div class="r-payment">Paid via ${order.paymentMethod.toUpperCase()}</div>
      <div class="r-footer">Thank you for dining with us!<br/>Please visit again.</div>
    `;
    window.print();
  }

  async function refreshTodayStats() {
    try {
      const summary = await Api.getTodaySummary();
      document.getElementById("statSales").textContent = formatCurrency(summary.totalSales);
      document.getElementById("statOrders").textContent = summary.totalOrders;
    } catch (err) {
      // non-fatal
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  return { init, loadMenu, loadCategoriesInto, refreshCategoryPills, refreshTodayStats };
})();
