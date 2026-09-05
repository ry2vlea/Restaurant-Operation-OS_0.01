const analysisMetrics = document.getElementById("analysisMetrics");
const analysisList = document.getElementById("analysisList");
const targetInput = document.getElementById("targetFoodCost");
const analysisDate = document.getElementById("analysisDate");
const salesPerformance = document.getElementById("salesPerformance");
analysisDate.value = new Date().toLocaleDateString("en-CA");
const usageList = document.getElementById("usageList");
const savedTarget = Number(localStorage.getItem("targetFoodCostPercent") || 30);
targetInput.value = savedTarget;

function menuRows() {
  return MenuService.getMenuRows().filter(({ item }) => item.active !== false);
}

function renderAnalysis() {
  performance.mark?.("menu-analysis-render:start");
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
    ${rows.map(({ item, metric }) => `<div class="inventory-row menu-analysis-row"><strong>${item.name}<small>${RecipeService.getRecipeById(item.recipeId)?.name || "No recipe"}</small></strong><span>$${item.sellingPrice.toFixed(2)}</span><span>$${metric.cost?.toFixed(2) ?? "—"}</span><span class="${metric.foodCostPercent > target ? "cost-attention" : "cost-good"}">${metric.foodCostPercent?.toFixed(1) || "-"}%<small>${metric.foodCostPercent > target ? "Above target" : "Within target"}</small></span><span>$${metric.contribution?.toFixed(2) ?? "—"}</span><span class="status-badge ${metric.status.toLowerCase()}">${metric.status.replaceAll("_", " ")}</span></div>`).join("")}` : `<div class="empty-state"><h3>No Menu Items</h3><p>Create Menu Items to begin cost analysis.</p></div>`;
  performance.mark?.("menu-analysis-render:end");
  performance.measure?.("menu-analysis-render", "menu-analysis-render:start", "menu-analysis-render:end");
}

function renderSalesPerformance() {
  const mix = SalesService.getMenuMix(analysisDate.value);
  const metrics = SalesService.calculateMetrics(analysisDate.value);
  analysisMetrics.innerHTML += [
    ["Units Sold", metrics.unitsSold], ["Net Sales", `$${metrics.netSales.toFixed(2)}`],
    ["Theoretical COGS", `$${metrics.theoreticalCOGS.toFixed(2)}`],
    ["Total Contribution", `$${(metrics.netSales - metrics.theoreticalCOGS).toFixed(2)}`]
    ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  salesPerformance.innerHTML = mix.length ? `
    <div class="inventory-table-head menu-analysis-head"><span>MENU ITEM</span><span>QTY SOLD</span><span>TOTAL SALES</span><span>SALES MIX</span><span>THEORETICAL COGS</span><span>CONTRIBUTION</span></div>
    ${mix.map((entry) => `<div class="inventory-row menu-analysis-row"><strong>${entry.item?.name || entry.sale.menuItemId}</strong><span>${entry.quantity}</span><span>$${entry.salesAmount.toFixed(2)}</span><span>${entry.salesMixPercent.toFixed(1)}%</span><span>$${entry.theoreticalCost.toFixed(2)}</span><span>$${entry.contribution.toFixed(2)}</span></div>`).join("")}`
    : `<div class="empty-state"><p>No sales recorded for this business date.</p></div>`;
}

function renderUsage() {
  const usage = TheoreticalUsageService.calculateForDate(analysisDate.value);
  usageList.innerHTML = usage.length ? usage.map((entry) => `<div class="movement-row"><strong>${entry.item?.name || entry.itemId}</strong><span>${entry.item ? InventoryService.formatStockBreakdown(entry.item.id, entry.baseQuantity) : entry.baseQuantity}</span><small>${entry.baseQuantity.toFixed(2)} ${entry.item ? InventoryService.getUnitById(entry.item.baseUnitId)?.abbreviation || entry.item.baseUnitId : "base units"} theoretical</small></div>`).join("") : `<div class="empty-state"><p>No sales recorded for this business date.</p></div>`;
}

function refreshAnalysis() {
  renderAnalysis();
  renderSalesPerformance();
  try { renderUsage(); }
  catch (error) { usageList.textContent = `Unable to calculate theoretical usage: ${error.message}`; }
}

targetInput.addEventListener("input", () => {
  localStorage.setItem("targetFoodCostPercent", String(Number(targetInput.value || 30)));
  refreshAnalysis();
});
analysisDate.addEventListener("change", refreshAnalysis);
window.addEventListener("sales:changed", refreshAnalysis);
window.addEventListener("menu-sales:changed", refreshAnalysis);
window.addEventListener("storage", refreshAnalysis);
refreshAnalysis();
