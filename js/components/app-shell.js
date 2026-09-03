(function () {
  const routes = {
    Dashboard: "index.html",
    Shifts: "opening.html",
    Tasks: "tasks.html",
    Issues: "issues.html",
    Inventory: "inventory.html",
    Receiving: "receiving.html",
    Waste: "waste.html",
    Recipes: "recipes.html",
    Menu: "menu.html",
    "Daily Report": "daily-report.html"
  };
  document.querySelectorAll(".nav-item").forEach((item) => {
    const label = item.textContent.trim();
    if (routes[label]) item.onclick = () => { window.location.href = routes[label]; };
  });
})();
