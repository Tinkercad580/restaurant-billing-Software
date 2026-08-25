const MenuManagement = (() => {
  let items = [];
  let editingId = null;

  function init() {
    bindEvents();
    reload();
  }

  function bindEvents() {
    document.getElementById("addItemBtn").addEventListener("click", () => openModal());
    document.getElementById("itemModalCancel").addEventListener("click", closeModal);
    document.getElementById("itemModalClose").addEventListener("click", closeModal);
    document.getElementById("itemModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "itemModalOverlay") closeModal();
    });
    document.getElementById("itemForm").addEventListener("submit", handleSubmit);
    document.getElementById("menuMgmtSearch").addEventListener("input", debounce(reload, 250));
    document.getElementById("menuMgmtCategory").addEventListener("change", reload);

    document.getElementById("itemImageBtn").addEventListener("click", () => {
      document.getElementById("itemImageFile").click();
    });
    document.getElementById("itemImageFile").addEventListener("change", handleImageFile);
    document.getElementById("itemImageRemove").addEventListener("click", () => {
      currentImageUrl = null;
      document.getElementById("itemImageFile").value = "";
      updateImagePreview(null);
    });

    document.getElementById("itemHasPortions").addEventListener("change", (e) => {
      togglePortionFields(e.target.checked);
    });

    setupCategoryCombo();
  }

  function togglePortionFields(hasPortions) {
    document.getElementById("singlePriceField").hidden = hasPortions;
    document.getElementById("portionPriceFields").hidden = !hasPortions;
    document.getElementById("itemPrice").required = !hasPortions;
    document.getElementById("itemHalfPrice").required = hasPortions;
    document.getElementById("itemFullPrice").required = hasPortions;
  }

  let currentImageUrl = null;
  let uploadingImage = false;

  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png"];

  async function handleImageFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast("Only JPG or PNG images are allowed", "error");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast("Image must be 2MB or smaller", "error");
      e.target.value = "";
      return;
    }

    // Show an instant local preview while the compressed file uploads in the background.
    const localPreviewUrl = URL.createObjectURL(file);
    updateImagePreview(localPreviewUrl, true);
    uploadingImage = true;
    updateSaveButtonState();

    try {
      const { url } = await Api.uploadImage(file);
      currentImageUrl = url;
      updateImagePreview(url);
    } catch (err) {
      showToast(err.message, "error");
      currentImageUrl = null;
      updateImagePreview(null);
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
      uploadingImage = false;
      updateSaveButtonState();
    }
  }

  function updateSaveButtonState() {
    const saveBtn = document.querySelector("#itemForm button[type='submit']");
    if (saveBtn) {
      saveBtn.disabled = uploadingImage;
      saveBtn.textContent = uploadingImage ? "Uploading photo…" : "Save Item";
    }
  }

  function updateImagePreview(src, isUploading = false) {
    const preview = document.getElementById("itemImagePreview");
    const removeBtn = document.getElementById("itemImageRemove");
    preview.innerHTML = src ? `<img src="${escapeHtml(src)}" alt="preview" />` : `<span class="photo-preview-icon">🖼️</span>`;
    preview.classList.toggle("uploading", isUploading);
    removeBtn.hidden = !src || isUploading;
  }

  let comboCategories = [];

  function setupCategoryCombo() {
    const input = document.getElementById("itemCategory");
    const toggle = document.getElementById("categoryComboToggle");
    const panel = document.getElementById("categoryComboPanel");
    const combo = document.getElementById("categoryCombo");

    function renderComboOptions(filterText = "") {
      const term = filterText.trim().toLowerCase();
      const matches = comboCategories.filter((c) => c.toLowerCase().includes(term));
      if (matches.length === 0) {
        panel.innerHTML = `<div class="combo-empty">No matching categories</div>`;
        return;
      }
      panel.innerHTML = matches
        .map((c) => `<button type="button" class="combo-option">${escapeHtml(c)}</button>`)
        .join("");
      panel.querySelectorAll(".combo-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          input.value = btn.textContent;
          closeCombo();
        });
      });
    }

    function openCombo() {
      document.querySelectorAll(".combo-panel.open").forEach((p) => p.classList.remove("open"));
      renderComboOptions(input.value);
      panel.classList.add("open");
    }
    function closeCombo() {
      panel.classList.remove("open");
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.classList.contains("open")) closeCombo();
      else openCombo();
    });
    input.addEventListener("focus", openCombo);
    input.addEventListener("input", () => renderComboOptions(input.value));
    document.addEventListener("click", (e) => {
      if (!combo.contains(e.target)) closeCombo();
    });
  }

  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  async function reload() {
    const search = document.getElementById("menuMgmtSearch").value.trim();
    const category = document.getElementById("menuMgmtCategory").value;
    try {
      items = await Api.getMenu({ search, category });
      renderTable();
      await refreshCategoryLists();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function refreshCategoryLists() {
    try {
      const categories = await Api.getCategories();
      comboCategories = categories;

      await Billing.loadCategoriesInto(document.getElementById("menuMgmtCategory"));
      await Billing.refreshCategoryPills();
    } catch (err) {
      // non-fatal
    }
  }

  function renderTable() {
    const tbody = document.getElementById("menuTableBody");
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td class="empty-row" colspan="6" style="text-align:center;color:var(--ink-soft)">No items found</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map(
        (item) => `
      <tr>
        <td class="cell-photo" data-label="">${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px" />` : `<div style="width:40px;height:40px;border-radius:6px;background:var(--cream);display:flex;align-items:center;justify-content:center;font-size:16px">🍽️</div>`}</td>
        <td data-label="Name">
          <span class="veg-dot ${item.isVeg ? "veg" : "nonveg"}" style="display:inline-block;vertical-align:middle;margin-right:6px" title="${item.isVeg ? "Veg" : "Non-Veg"}"></span>
          <strong>${escapeHtml(item.name)}</strong>${item.description ? `<br/><span style="color:var(--ink-soft);font-size:11.5px">${escapeHtml(item.description)}</span>` : ""}
        </td>
        <td data-label="Category">${escapeHtml(item.category)}</td>
        <td data-label="Price">${
          item.hasPortions
            ? `<span title="Half">H ${formatCurrency(item.halfPrice)}</span> / <span title="Full">F ${formatCurrency(item.fullPrice)}</span>`
            : formatCurrency(item.price)
        }</td>
        <td data-label="Status"><span class="badge ${item.available ? "badge-success" : "badge-danger"}">${item.available ? "Available" : "Unavailable"}</span></td>
        <td class="cell-actions" data-label="" style="white-space:nowrap">
          <button class="icon-btn" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="icon-btn danger" data-action="delete" data-id="${item.id}">Delete</button>
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-action='edit']").forEach((b) =>
      b.addEventListener("click", () => openModal(b.dataset.id))
    );
    tbody.querySelectorAll("[data-action='delete']").forEach((b) =>
      b.addEventListener("click", () => handleDelete(b.dataset.id))
    );
  }

  function openModal(id = null) {
    openModalWithItem(id ? items.find((i) => i.id === id) : null);
  }

  function openModalWithItem(item = null) {
    editingId = item ? item.id : null;
    document.getElementById("itemModalTitle").textContent = item ? "Edit Menu Item" : "Add Menu Item";
    document.getElementById("itemName").value = item ? item.name : "";
    document.getElementById("itemCategory").value = item ? item.category : "";
    document.getElementById("itemHasPortions").checked = item ? item.hasPortions : false;
    document.getElementById("itemPrice").value = item && !item.hasPortions ? item.price : "";
    document.getElementById("itemHalfPrice").value = item?.halfPrice ?? "";
    document.getElementById("itemFullPrice").value = item?.fullPrice ?? "";
    togglePortionFields(item ? item.hasPortions : false);
    document.getElementById("itemDescription").value = item?.description || "";
    document.getElementById("itemAvailable").checked = item ? item.available : true;
    document.getElementById("itemVegYes").checked = item ? item.isVeg : true;
    document.getElementById("itemVegNo").checked = item ? !item.isVeg : false;

    currentImageUrl = item?.imageUrl || null;
    document.getElementById("itemImageFile").value = "";
    updateImagePreview(currentImageUrl);

    document.getElementById("itemModalOverlay").classList.add("active");
    document.getElementById("itemName").focus();
  }

  function closeModal() {
    document.getElementById("itemModalOverlay").classList.remove("active");
    editingId = null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const hasPortions = document.getElementById("itemHasPortions").checked;
    const body = {
      name: document.getElementById("itemName").value.trim(),
      category: document.getElementById("itemCategory").value.trim(),
      description: document.getElementById("itemDescription").value.trim(),
      available: document.getElementById("itemAvailable").checked,
      isVeg: document.getElementById("itemVegYes").checked,
      imageUrl: currentImageUrl || "",
      hasPortions,
      ...(hasPortions
        ? {
            halfPrice: parseFloat(document.getElementById("itemHalfPrice").value),
            fullPrice: parseFloat(document.getElementById("itemFullPrice").value),
          }
        : { price: parseFloat(document.getElementById("itemPrice").value) }),
    };

    try {
      if (editingId) {
        await Api.updateMenuItem(editingId, body);
        showToast("Item updated", "success");
      } else {
        await Api.createMenuItem(body);
        showToast("Item added", "success");
      }
      closeModal();
      await reload();
      await Billing.loadMenu();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDelete(id) {
    const item = items.find((i) => i.id === id);
    if (!confirm(`Delete "${item?.name}" from the menu?`)) return;
    try {
      await Api.deleteMenuItem(id);
      showToast("Item deleted", "success");
      await reload();
      await Billing.loadMenu();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  return { init, reload, openModalWithItem };
})();
