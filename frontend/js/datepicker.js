(function () {
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function pad(n) { return String(n).padStart(2, "0"); }
  function toISO(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function formatDisplay(date) { return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`; }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function closeAllPanels() {
    document.querySelectorAll(".date-picker-panel.open").forEach((p) => p.classList.remove("open"));
  }
  document.addEventListener("click", closeAllPanels);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPanels();
  });

  function createDatePicker({ triggerId, labelId, panelId, defaultLabel, onChange }) {
    const trigger = document.getElementById(triggerId);
    const label = document.getElementById(labelId);
    const panel = document.getElementById(panelId);
    let value = null;
    let viewDate = new Date();

    function render() {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const firstWeekday = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();

      let html = `
        <div class="dp-header">
          <button type="button" class="dp-nav" data-nav="prev" aria-label="Previous month">‹</button>
          <span class="dp-title">${MONTH_NAMES[month]} ${year}</span>
          <button type="button" class="dp-nav" data-nav="next" aria-label="Next month">›</button>
        </div>
        <div class="dp-weekdays">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="dp-days">`;

      for (let i = 0; i < firstWeekday; i++) html += `<span class="dp-day dp-empty"></span>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(year, month, d);
        const classes = ["dp-day"];
        if (value && isSameDay(value, dayDate)) classes.push("selected");
        if (isSameDay(today, dayDate)) classes.push("today");
        html += `<button type="button" class="${classes.join(" ")}" data-day="${d}">${d}</button>`;
      }

      html += `</div>
        <div class="dp-footer">
          <button type="button" class="dp-clear">Clear</button>
          <button type="button" class="dp-today">Today</button>
        </div>`;

      panel.innerHTML = html;

      panel.querySelector('[data-nav="prev"]').addEventListener("click", (e) => {
        e.stopPropagation();
        viewDate = new Date(year, month - 1, 1);
        render();
      });
      panel.querySelector('[data-nav="next"]').addEventListener("click", (e) => {
        e.stopPropagation();
        viewDate = new Date(year, month + 1, 1);
        render();
      });
      panel.querySelectorAll(".dp-day:not(.dp-empty)").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          value = new Date(year, month, Number(btn.dataset.day));
          label.textContent = formatDisplay(value);
          trigger.classList.add("has-value");
          panel.classList.remove("open");
          onChange(toISO(value));
        });
      });
      panel.querySelector(".dp-clear").addEventListener("click", (e) => {
        e.stopPropagation();
        value = null;
        label.textContent = defaultLabel;
        trigger.classList.remove("has-value");
        panel.classList.remove("open");
        onChange("");
      });
      panel.querySelector(".dp-today").addEventListener("click", (e) => {
        e.stopPropagation();
        const t = new Date();
        value = t;
        viewDate = new Date(t.getFullYear(), t.getMonth(), 1);
        label.textContent = formatDisplay(value);
        trigger.classList.add("has-value");
        panel.classList.remove("open");
        onChange(toISO(value));
      });
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains("open");
      closeAllPanels();
      if (!isOpen) {
        panel.classList.add("open");
        render();
      }
    });

    return {
      getValue: () => (value ? toISO(value) : ""),
      clear: () => {
        value = null;
        label.textContent = defaultLabel;
        trigger.classList.remove("has-value");
      },
    };
  }

  window.createDatePicker = createDatePicker;
})();
