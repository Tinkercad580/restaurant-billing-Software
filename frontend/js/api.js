const API_BASE = "/api";

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed: ${res.status}`);
  }
  return data;
}

const Api = {
  getMenu: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/menu${qs ? `?${qs}` : ""}`);
  },
  getCategories: () => apiRequest("/menu/categories"),
  createMenuItem: (body) => apiRequest("/menu", { method: "POST", body: JSON.stringify(body) }),
  updateMenuItem: (id, body) => apiRequest(`/menu/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteMenuItem: (id) => apiRequest(`/menu/${id}`, { method: "DELETE" }),

  getOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/orders${qs ? `?${qs}` : ""}`);
  },
  getTodaySummary: () => apiRequest("/orders/summary/today"),
  createOrder: (body) => apiRequest("/orders", { method: "POST", body: JSON.stringify(body) }),
  updateDeliveryStatus: (id, deliveryStatus) =>
    apiRequest(`/orders/${id}/delivery-status`, { method: "PATCH", body: JSON.stringify({ deliveryStatus }) }),

  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data && data.error) || `Upload failed: ${res.status}`);
    }
    return data;
  },
};

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function formatCurrency(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}
