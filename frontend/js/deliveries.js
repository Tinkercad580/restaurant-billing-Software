const Deliveries = (() => {
  let activeStatus = "all";

  const STATUS_LABELS = {
    pending: "Pending",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  const NEXT_STATUS = {
    pending: { status: "out_for_delivery", label: "Send Out for Delivery" },
    out_for_delivery: { status: "delivered", label: "Mark Delivered" },
  };

  function init() {
    bindEvents();
    reload();
  }

  function bindEvents() {
    document.getElementById("deliveryStatusFilter").addEventListener("click", (e) => {
      const btn = e.target.closest(".chip-btn");
      if (!btn) return;
      activeStatus = btn.dataset.status;
      document
        .querySelectorAll("#deliveryStatusFilter .chip-btn")
        .forEach((b) => b.classList.toggle("active", b === btn));
      reload();
    });
  }

  async function reload() {
    try {
      const params = { orderType: "delivery" };
      if (activeStatus !== "all") params.deliveryStatus = activeStatus;
      const orders = await Api.getOrders(params);
      renderTable(orders);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function statusBadgeClass(status) {
    if (status === "delivered") return "badge-success";
    if (status === "cancelled") return "badge-danger";
    return "badge-pending";
  }

  function renderTable(orders) {
    const tbody = document.getElementById("deliveriesTableBody");
    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-soft)">No delivery orders found</td></tr>`;
      return;
    }
    tbody.innerHTML = orders
      .map((order) => {
        const time = new Date(order.createdAt).toLocaleString();
        const status = order.deliveryStatus || "pending";
        const next = NEXT_STATUS[status];
        return `
        <tr>
          <td><strong>#${order.billNumber}</strong></td>
          <td>${time}</td>
          <td>${escapeHtml(order.customerName || "—")}</td>
          <td>${escapeHtml(order.phone || "—")}</td>
          <td style="max-width:220px">${escapeHtml(order.deliveryAddress || "—")}</td>
          <td>${formatCurrency(order.total)}</td>
          <td><span class="badge ${statusBadgeClass(status)}">${STATUS_LABELS[status] || status}</span></td>
          <td style="white-space:nowrap">
            ${next ? `<button class="icon-btn" data-action="advance" data-id="${order.id}" data-status="${next.status}">${next.label}</button>` : ""}
            ${status === "pending" || status === "out_for_delivery" ? `<button class="icon-btn danger" data-action="advance" data-id="${order.id}" data-status="cancelled">Cancel</button>` : ""}
            <button class="icon-btn" data-action="print" data-bill="${order.billNumber}">Print</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-action='print']").forEach((btn, idx) => {
      btn.addEventListener("click", () => Billing.printReceipt(orders[idx]));
    });
    tbody.querySelectorAll("[data-action='advance']").forEach((btn) => {
      btn.addEventListener("click", () => handleStatusChange(btn.dataset.id, btn.dataset.status));
    });
  }

  async function handleStatusChange(id, deliveryStatus) {
    try {
      await Api.updateDeliveryStatus(id, deliveryStatus);
      showToast(`Order marked as ${STATUS_LABELS[deliveryStatus] || deliveryStatus}`, "success");
      await reload();
      if (window.OrderHistory) window.OrderHistory.reload();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  return { init, reload };
})();

window.Deliveries = Deliveries;
