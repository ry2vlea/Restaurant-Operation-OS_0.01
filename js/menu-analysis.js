const analysisMetrics = document.getElementById("analysisMetrics");
const analysisList = document.getElementById("analysisList");
const targetInput = document.getElementById("targetFoodCost");
const salesMenuItem = document.getElementById("salesMenuItem");
const salesQuantity = document.getElementById("salesQuantity");
const usageList = document.getElementById("usageList");
const savedTarget = Number(localStorage.getItem("targetFoodCostPercent") || 30);
targetInput.value = savedTarget;

function menuRows() {
  return MenuService.getMenuItems().filter((item) => item.active !== false).map((item) => ({ item, metric: MenuService.calculateMenuMetrics(item) }));
}

function renderAnalysis() {
  const rows = menuRows();
  const percentages = rows.map(({ metric }) => metric.foodCostPercent).filter((value) => Number.isFinite(value));
  const average = percentages.length ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0;
  const highest = percentages.length ? Math.max(...percentages) : 0;
  const lowest = percentages.length ? Math.min(...percentages) : 0;
  const target = Number(targetInput.value || 30);

  analysisMetrics.innerHTML = [
    ["Menu Items", rows.length],
    ["Average Food Cost", `${average.toFixed(1)}%`],
    ["Highest Food Cost", `${highest.toFixed(1)}%`],
    ["Lowest Food Cost", `${lowest.toFixed(1)}%`],
    ["Above Target", rows.filter(({ metric }) => Number(metric.foodCostPercent || 0) > target).length]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");

  analysisList.innerHTML = rows.length ? `
    <div class="inventory-table-head menu-analysis-head"><span>MENU ITEM</span><span>PRICE</span><span>COST</span><span>FOOD COST</span><span>CONTRIBUTION</span><span>AVAILABILITY</span></div>
    ${rows.map(({ item, metric }) => `<div class="inventory-row menu-analysis-row"><strong>${item.name}<small>${RecipeService.getRecipeById(item.recipeId)?.name || "No recipe"}</small></strong><span>$${item.sellingPrice.toFixed(2)}</span><span>$${metric.cost.toFixed(2)}</span><span class="${metric.foodCostPercent > target ? "cost-attention" : "cost-good"}">${metric.foodCostPercent?.toFixed(1) || "-"}%<small>${metric.foodCostPercent > target ? "Above target" : "Within target"}</small></span><span>$${metric.contribution.toFixed(2)}</span><span class="status-badge ${metric.status.toLowerCase()}">${metric.status.replaceAll("_", " ")}</span></div>`).join("")}` : `<div class="empty-state"><h3>No Menu Items</h3><p>Create Menu Items to begin cost analysis.</p></div>`;
}

function loadSalesOptions() {
  const items = MenuService.getMenuItems().filter((item) => item.active !== false);
  salesMenuItem.innerHTML = items.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
}

function renderUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = TheoreticalUsageService.calculateTheoreticalUsage(today);
  usageList.innerHTML = usage.length ? usage.map((entry) => `<div class="movement-row"><strong>${entry.item?.name || entry.itemId}</strong><span>${entry.item ? InventoryService.formatStockBreakdown(entry.item.id, entry.baseQuantity) : entry.baseQuantity}</span><small>${entry.baseQuantity.toFixed(2)} ${entry.item ? InventoryService.getUnitById(entry.item.baseUnitId)?.abbreviation || entry.item.baseUnitId : "base units"} theoretical</small></div>`).join("") : `<div class="empty-state"><p>No menu sales entered for today.</p></div>`;
}

targetInput.addEventListener("input", () => {
  localStorage.setItem("targetFoodCostPercent", String(Number(targetInput.value || 30)));
  renderAnalysis();
});

document.getElementById("saveSale").onclick = (event) => {
  event.preventDefault();
  try {
    TheoreticalUsageService.saveSale({ menuItemId: salesMenuItem.value, quantitySold: Number(salesQuantity.value || 0) });
    salesQuantity.value = 0;
    renderUsage();
    showToast("Menu sales saved for theoretical usage.");
  } catch (error) { showToast(error.message, "error"); }
};

loadSalesOptions();
renderAnalysis();
renderUsage();
