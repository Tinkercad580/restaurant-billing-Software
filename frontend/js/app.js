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

  document.addEventListener("DOMContentLoaded", async () => {
    setupNav();
    await Billing.init();
    MenuManagement.init();
    OrderHistory.init();
    Deliveries.init();
  });
})();
