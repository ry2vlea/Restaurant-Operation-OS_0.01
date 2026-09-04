const perfForm = document.getElementById("performanceForm");
const perfDate = document.getElementById("performanceDate");
const perfMetrics = document.getElementById("performanceMetrics");
const perfHistory = document.getElementById("performanceHistory");
const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const pct = (value) => value == null ? "Not Available" : `${Number(value).toFixed(1)}%`;

perfDate.value = new Date().toISOString().slice(0, 10);
perfDate.addEventListener("input", syncForm);
perfForm.onsubmit = (event) => {
  event.preventDefault();
  BusinessPerformanceService.saveRecord(Object.fromEntries(new FormData(perfForm)));
  showToast("Business performance saved.");
  renderPerformance();
};

function syncForm() {
  const record = BusinessPerformanceService.getByDate(perfDate.value);
  ["netSales", "transactions", "laborHours", "laborDollars", "notes"].forEach((name) => {
    perfForm.elements[name].value = record?.[name] ?? "";
  });
}

function renderPerformance() {
  const record = BusinessPerformanceService.derive(BusinessPerformanceService.getByDate(perfDate.value));
  const food = FoodCostService.calculate(perfDate.value);
  perfMetrics.innerHTML = [
    ["Net Sales", record ? money(record.netSales) : "Not Available"],
    ["Transactions", record?.transactions ?? "Not Available"],
    ["Avg Ticket", record?.averageTicket == null ? "Not Available" : money(record.averageTicket)],
    ["Labor %", pct(record?.laborPercent)],
    ["Food Cost", pct(food.actualFoodCostPercent || food.theoreticalFoodCostPercent)],
    ["Waste", money(food.wasteCost)]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  perfHistory.innerHTML = BusinessPerformanceService.getRecords().length ? BusinessPerformanceService.getRecords().sort((a, b) => b.date.localeCompare(a.date)).map((value) => {
    const derived = BusinessPerformanceService.derive(value);
    return `<div class="inventory-row"><strong>${value.date}<small>${value.enteredBy}</small></strong><span>${money(value.netSales)}</span><span>${value.transactions}</span><span>${money(derived.averageTicket || 0)}</span><span>${pct(derived.laborPercent)}</span></div>`;
  }).join("") : `<div class="empty-state"><p>No business performance has been entered.</p></div>`;
}

syncForm();
renderPerformance();
