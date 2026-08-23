(function () {
  function setupNav() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        navItems.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
        document.getElementById(`view-${btn.dataset.view}`).classList.add("active");

        if (btn.dataset.view === "history") {
          OrderHistory.reload();
        }
        if (btn.dataset.view === "menu") {
          MenuManagement.reload();
        }
        if (btn.dataset.view === "deliveries") {
          Deliveries.reload();
        }
      });
    });
  }

  function setupClock() {
    function tick() {
      const now = new Date();
      document.getElementById("clock").textContent = now.toLocaleTimeString();
      document.getElementById("dateLabel").textContent = now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setupNav();
    setupClock();
    await Billing.init();
    MenuManagement.init();
    OrderHistory.init();
    Deliveries.init();
  });
})();
