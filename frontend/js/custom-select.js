(function () {
  function closeAll() {
    document.querySelectorAll(".cs-wrap.open").forEach((w) => w.classList.remove("open"));
  }

  function currentLabel(select) {
    const opt = select.options[select.selectedIndex];
    return opt ? opt.textContent : "";
  }

  function buildPanel(select, panel, labelEl) {
    panel.innerHTML = "";
    Array.from(select.options).forEach((opt, idx) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "cs-option" + (opt.selected ? " selected" : "");
      item.textContent = opt.textContent;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (select.selectedIndex !== idx) {
          select.selectedIndex = idx;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        labelEl.textContent = opt.textContent;
        closeAll();
      });
      panel.appendChild(item);
    });
  }

  function enhance(select) {
    if (select.dataset.csEnhanced) return;
    select.dataset.csEnhanced = "1";

    const wrap = document.createElement("div");
    wrap.className = "cs-wrap";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("cs-native");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cs-trigger";

    const labelEl = document.createElement("span");
    labelEl.className = "cs-label";
    labelEl.textContent = currentLabel(select);

    const chevron = document.createElement("span");
    chevron.className = "cs-chevron";
    chevron.textContent = "▾";

    trigger.appendChild(labelEl);
    trigger.appendChild(chevron);

    const panel = document.createElement("div");
    panel.className = "cs-panel";

    wrap.appendChild(trigger);
    wrap.appendChild(panel);

    buildPanel(select, panel, labelEl);

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains("open");
      closeAll();
      if (!isOpen) wrap.classList.add("open");
    });

    // Re-sync when options are replaced programmatically (e.g. category list reload)
    const observer = new MutationObserver(() => {
      labelEl.textContent = currentLabel(select);
      buildPanel(select, panel, labelEl);
    });
    observer.observe(select, { childList: true });

    select.addEventListener("change", () => {
      labelEl.textContent = currentLabel(select);
      buildPanel(select, panel, labelEl);
    });
  }

  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  function enhanceAll(root = document) {
    root.querySelectorAll("select").forEach(enhance);
  }

  document.addEventListener("DOMContentLoaded", () => enhanceAll());

  window.CustomSelect = { enhance, enhanceAll };
})();
