const menuList = document.getElementById("menuList");

function renderMenu() {
  performance.mark?.("menu-page-render:start");
  const rows = MenuService.getMenuRows();
  const items = rows.map(({ item }) => item);
  const metrics = rows.map(({ metric }) => metric);
  document.getElementById("menuMetrics").innerHTML = [
    ["Active Items", items.filter((item) => item.active !== false).length],
    ["Available", metrics.filter((metric) => metric.status === "AVAILABLE").length],
    ["Limited", metrics.filter((metric) => metric.status === "LIMITED").length],
    ["Unavailable", metrics.filter((metric) => metric.status.includes("UNAVAILABLE")).length],
    ["Avg Food Cost", metrics.length ? `${(metrics.reduce((sum, metric) => sum + Number(metric.foodCostPercent || 0), 0) / metrics.length).toFixed(1)}%` : "0%"]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");

  menuList.innerHTML = rows.length ? rows.map(({ item, metric }) => {
    return `<article class="menu-card"><div><p class="eyebrow">${item.categoryId.replace("MCAT-", "")}</p><h2>${item.name}</h2><p>${metric.servings} servings available${metric.limitingIngredient ? ` · Limiting: ${metric.limitingIngredient.name}` : ""}</p></div><div class="menu-financials"><strong>$${item.sellingPrice.toFixed(2)}</strong><span>Cost $${metric.cost.toFixed(2)} · Food Cost ${metric.foodCostPercent?.toFixed(1) || "-"}%</span><span>Contribution $${metric.contribution.toFixed(2)}</span><span class="status-badge ${metric.status.toLowerCase()}">${metric.status.replaceAll("_", " ")}</span></div></article>`;
  }).join("") : `<div class="empty-state"><h3>Build Your Menu</h3><p>Add menu items and connect them to recipes to begin tracking cost and availability.</p><div class="empty-actions"><button class="primary-button" id="emptyMenuItem">Add Menu Item</button><button class="secondary-button" onclick="location.href='recipes.html'">Create Recipe</button></div></div>`;
  document.getElementById("emptyMenuItem")?.addEventListener("click", openMenuForm);
  performance.mark?.("menu-page-render:end");
  performance.measure?.("menu-page-render", "menu-page-render:start", "menu-page-render:end");
}

function openMenuForm() {
  const recipes = RecipeService.getRecipes().filter((recipe) => recipe.recipeType === "MENU" && recipe.active !== false);
  if (!recipes.length) {
    showToast("Create a Menu Recipe before adding a Menu Item.", "error");
    return;
  }
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><p class="eyebrow">MENU MANAGEMENT</p><h2>Add Menu Item</h2></div><button class="icon-button" data-close aria-label="Close">×</button></div><form id="menuItemForm"><div class="form-grid"><label>Menu Item Name<input name="name" required></label><label>SKU<input name="sku"></label><label>Category<select name="categoryId"><option value="MCAT-SANDWICHES">Sandwiches</option><option value="MCAT-COMBOS">Combos</option><option value="MCAT-CHICKEN">Chicken</option><option value="MCAT-SIDES">Sides</option><option value="MCAT-DESSERTS">Desserts</option><option value="MCAT-BEVERAGES">Beverages</option><option value="MCAT-SAUCES">Sauces</option><option value="MCAT-OTHER">Other</option></select></label><label>Recipe<select name="recipeId" required>${recipes.map((recipe) => `<option value="${recipe.id}">${recipe.name}</option>`).join("")}</select></label><label>Selling Price<input name="sellingPrice" type="number" min="0.01" step="0.01" required></label><label>Limited Threshold<input name="limitedThreshold" type="number" min="0" value="10"></label><label class="full-width">Description<textarea name="description" rows="3"></textarea></label></div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button">Create Menu Item</button></div></form></div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach((button) => button.onclick = () => modal.remove());
  modal.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    try {
      MenuService.createMenuItem(Object.fromEntries(new FormData(event.target)));
      modal.remove();
      renderMenu();
      showToast("Menu item created.");
    } catch (error) { showToast(error.message, "error"); }
  };
}

document.getElementById("newMenuItem").onclick = openMenuForm;
window.addEventListener("menu:changed", renderMenu);
window.addEventListener("inventory:changed", renderMenu);
window.addEventListener("recipes:changed", renderMenu);
renderMenu();
