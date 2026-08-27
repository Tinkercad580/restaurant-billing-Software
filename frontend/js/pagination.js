function createPaginator({ pageSize = 10 } = {}) {
  let page = 1;

  function reset() {
    page = 1;
  }

  function slice(items) {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }

  function render(containerEl, total, onChange) {
    if (!containerEl) return;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;

    if (total === 0) {
      containerEl.innerHTML = "";
      return;
    }

    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    containerEl.innerHTML = `
      <span class="page-info">${start}–${end} of ${total}</span>
      <div class="page-controls">
        <button type="button" class="page-btn" data-page="prev" ${page <= 1 ? "disabled" : ""}>&laquo; Prev</button>
        <span class="page-current">Page ${page} of ${totalPages}</span>
        <button type="button" class="page-btn" data-page="next" ${page >= totalPages ? "disabled" : ""}>Next &raquo;</button>
      </div>
    `;

    const prevBtn = containerEl.querySelector('[data-page="prev"]');
    const nextBtn = containerEl.querySelector('[data-page="next"]');
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (page > 1) {
          page -= 1;
          onChange();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (page < totalPages) {
          page += 1;
          onChange();
        }
      });
    }
  }

  return {
    get page() {
      return page;
    },
    reset,
    slice,
    render,
  };
}

window.createPaginator = createPaginator;
