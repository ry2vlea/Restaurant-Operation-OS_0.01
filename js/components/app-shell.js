(function () {
  const routes = {
    Dashboard: "index.html",
    Shifts: "opening.html",
    Tasks: "tasks.html",
    Issues: "issues.html",
    History: "history.html",
    Inventory: "inventory.html",
    Counts: "inventory-count.html",
    Receiving: "receiving.html",
    Purchasing: "purchasing.html",
    Waste: "waste.html",
    Variance: "inventory-variance.html",
    Recipes: "recipes.html",
    Menu: "menu.html",
    Production: "production.html", 
    "Cost Analysis": "menu-analysis.html",
    Sales: "sales.html", 
    "Business Performance": "business-performance.html", 
    "Food Cost": "food-cost.html", 
    "Daily Report": "daily-report.html",
    Equipment: "equipment.html",
    Team: "team.html",
    "SOP Library": "sops.html",
    "Activity Log": "activity.html",
    Settings: "settings.html"
  };
  document.querySelectorAll(".nav-item").forEach((item) => {
    const label = item.textContent.trim();
    if (routes[label]) item.onclick = () => { window.location.href = routes[label]; };
  });
})();
