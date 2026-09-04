const foodCostMetrics = document.getElementById("foodCostMetrics");
const foodCostSections = document.getElementById("foodCostSections");
const moneyValue = (value) => value == null ? "Insufficient Data" : `$${Number(value).toFixed(2)}`;
const percentValue = (value) => value == null ? "Insufficient Data" : `${Number(value).toFixed(1)}%`;

document.addEventListener("ros:datechange", (event) => {
  refreshFoodCost(event.detail.startDate, event.detail.endDate);
});

function refreshFoodCost(startDate, endDate) {
  const data = FoodCostService.calculateRange(startDate, endDate);
  foodCostMetrics.innerHTML = [
    ["Theoretical", percentValue(data.theoreticalFoodCostPercent)],
    ["Actual", percentValue(data.actualFoodCostPercent)],
    ["Target", `${data.targetFoodCostPercent.toFixed(1)}%`],
    ["Variance", data.foodCostVariancePoints == null ? "Insufficient Data" : `${data.foodCostVariancePoints >= 0 ? "+" : ""}${data.foodCostVariancePoints.toFixed(1)} pts`],
    ["Recorded Waste", moneyValue(data.wasteCost)],
    ["Purchases", moneyValue(data.purchases)]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  const menuWatch = MenuService.getMenuRows().filter(({ metric }) => Number(metric.foodCostPercent || 0) > data.targetFoodCostPercent).slice(0, 6);
  const variance = VarianceService.calculateLatest();
  foodCostSections.innerHTML = `
    <section class="recipe-panel"><h2>Cost Overview</h2><p>Net sales: ${moneyValue(data.netSales)} · Theoretical usage: ${moneyValue(data.theoreticalCost)} · Actual COGS: ${moneyValue(data.actualCost)}</p></section>
    <section class="recipe-panel"><h2>Top Inventory Exceptions</h2>${variance.rows.length ? variance.rows.slice(0, 6).map((row) => `<p>${row.item.name}<strong>${moneyValue(row.varianceValue)}</strong></p>`).join("") : "<p>Insufficient Data</p>"}</section>
    <section class="recipe-panel"><h2>Waste Impact</h2><p>${moneyValue(data.wasteCost)} recorded waste for the selected period.</p></section>
    <section class="recipe-panel"><h2>Menu Cost Watch</h2>${menuWatch.length ? menuWatch.map(({ item, metric }) => `<p>${item.name}<strong>${metric.foodCostPercent.toFixed(1)}%</strong></p>`).join("") : "<p>No menu items above target.</p>"}</section>`;
}

const range = window.AppHeader?.getRange?.() || {};
refreshFoodCost(range.startDate, range.endDate);
