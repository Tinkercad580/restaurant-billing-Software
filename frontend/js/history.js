const OrderHistory = (() => {
  let quickRange = "today"; // "today" | "all" | "custom"
  let fromPicker = null;
  let toPicker = null;

  function init() {
    fromPicker = createDatePicker({
      triggerId: "historyFromTrigger",
      labelId: "historyFromLabel",
      panelId: "historyFromPanel",
      defaultLabel: "From date",
      onChange: () => {
        quickRange = "custom";
        updateQuickButtons();
        reload();
      },
    });
    toPicker = createDatePicker({
      triggerId: "historyToTrigger",
      labelId: "historyToLabel",
      panelId: "historyToPanel",
      defaultLabel: "To date",
      onChange: () => {
        quickRange = "custom";
        updateQuickButtons();
        reload();
      },
    });

    bindEvents();
    reload();
  }

  function bindEvents() {
    document.getElementById("historySearch").addEventListener("input", debounce(reload, 250));
    document.getElementById("historyPayment").addEventListener("change", reload);
    document.getElementById("historyOrderType").addEventListener("change", reload);

    document.getElementById("historyTodayBtn").addEventListener("click", () => {
      quickRange = "today";
      clearDateInputs();
      updateQuickButtons();
      reload();
    });
    document.getElementById("historyAllBtn").addEventListener("click", () => {
      quickRange = "all";
      clearDateInputs();
      updateQuickButtons();
      reload();
    });
    document.getElementById("historyResetBtn").addEventListener("click", () => {
      quickRange = "today";
      document.getElementById("historySearch").value = "";
      document.getElementById("historyPayment").value = "all";
      document.getElementById("historyPayment").dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("historyOrderType").value = "all";
      document.getElementById("historyOrderType").dispatchEvent(new Event("change", { bubbles: true }));
      clearDateInputs();
      updateQuickButtons();
      reload();
    });
  }

  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function clearDateInputs() {
    fromPicker.clear();
    toPicker.clear();
  }

  function updateQuickButtons() {
    document.getElementById("historyTodayBtn").classList.toggle("active", quickRange === "today");
    document.getElementById("historyAllBtn").classList.toggle("active", quickRange === "all");
  }

  function buildParams() {
    const search = document.getElementById("historySearch").value.trim();
    const payment = document.getElementById("historyPayment").value;
    const orderType = document.getElementById("historyOrderType").value;
    const from = fromPicker.getValue();
    const to = toPicker.getValue();

    const params = {};
    if (search) params.search = search;
    if (payment && payment !== "all") params.payment = payment;
    if (orderType && orderType !== "all") params.orderType = orderType;
    if (from) params.from = from;
    if (to) params.to = to;
    if (quickRange === "today" && !from && !to) params.date = "today";
    return params;
  }

  async function reload() {
    try {
      const [orders, summary] = await Promise.all([
        Api.getOrders(buildParams()),
        Api.getTodaySummary(),
      ]);
      renderSummary(summary);
      renderTable(orders);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function renderSummary(summary) {
    document.getElementById("histTotalSales").textContent = formatCurrency(summary.totalSales);
    document.getElementById("histTotalOrders").textContent = summary.totalOrders;
    document.getElementById("histItemsSold").textContent = summary.totalItemsSold;
    document.getElementById("histAvgBill").textContent = formatCurrency(summary.averageBill);
  }

  function renderTable(orders) {
    const tbody = document.getElementById("ordersTableBody");
    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td class="empty-row" colspan="7" style="text-align:center;color:var(--ink-soft)">No orders found</td></tr>`;
      return;
    }
    tbody.innerHTML = orders
      .map((order) => {
        const itemsSummary = order.items.map((i) => `${i.name} x${i.quantity}`).join(", ");
        const time = new Date(order.createdAt).toLocaleString();
        const type = order.orderType || "dine-in";
        return `
        <tr>
          <td data-label="Bill #"><strong>#${order.billNumber}</strong></td>
          <td data-label="Time">${time}</td>
          <td data-label="Type" style="white-space:nowrap;text-transform:capitalize">${escapeHtml(type.replace("-", " "))}</td>
          <td data-label="Items" style="max-width:260px">${escapeHtml(itemsSummary)}</td>
          <td data-label="Total">${formatCurrency(order.total)}</td>
          <td data-label="Payment" style="text-transform:capitalize">${order.paymentMethod}</td>
          <td class="cell-actions" data-label=""><button class="icon-btn" data-action="print" data-bill="${order.billNumber}">Print</button></td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-action='print']").forEach((btn, idx) => {
      btn.addEventListener("click", () => Billing.printReceipt(orders[idx]));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  return { init, reload };
})();

window.OrderHistory = OrderHistory;
