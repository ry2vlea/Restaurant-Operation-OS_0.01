const perfForm = document.getElementById("performanceForm");
const perfDate = document.getElementById("performanceDate");
const perfMetrics = document.getElementById("performanceMetrics");
const perfHistory = document.getElementById("performanceHistory");
const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const pct = (value) => value == null ? "Not Available" : `${Number(value).toFixed(1)}%`;
let selectedRange = window.AppHeader?.getRange?.() || {};

perfDate.value = new Date().toISOString().slice(0, 10);
perfDate.addEventListener("input", syncForm);
perfForm.onsubmit = (event) => {
  event.preventDefault();
  BusinessPerformanceService.saveRecord(Object.fromEntries(new FormData(perfForm)));
  showToast("Business performance saved.");
  renderPerformance();
};

document.addEventListener("ros:datechange", (event) => {
  selectedRange = event.detail;
  renderPerformance();
});

function syncForm() {
  const record = BusinessPerformanceService.getByDate(perfDate.value);
  ["netSales", "transactions", "laborHours", "laborDollars", "notes"].forEach((name) => {
    perfForm.elements[name].value = record?.[name] ?? "";
  });
}

function renderPerformance() {
  const records = BusinessPerformanceService.recordsInRange(selectedRange.startDate, selectedRange.endDate);
  const totals = records.reduce((sum, item) => {
    sum.netSales += Number(item.netSales || 0);
    sum.transactions += Number(item.transactions || 0);
    sum.laborHours += Number(item.laborHours || 0);
    sum.laborDollars += Number(item.laborDollars || 0);
    return sum;
  }, { netSales: 0, transactions: 0, laborHours: 0, laborDollars: 0 });
  const food = FoodCostService.calculateRange(selectedRange.startDate, selectedRange.endDate);
  perfMetrics.innerHTML = [
    ["Net Sales", records.length ? money(totals.netSales) : "Not Available"],
    ["Transactions", records.length ? totals.transactions : "Not Available"],
    ["Avg Ticket", records.length && totals.transactions > 0 ? money(totals.netSales / totals.transactions) : "Not Available"],
    ["Labor %", records.length && totals.netSales > 0 ? pct(totals.laborDollars / totals.netSales * 100) : "Not Available"],
    ["Food Cost", pct(food.actualFoodCostPercent || food.theoreticalFoodCostPercent)],
    ["Waste", money(food.wasteCost)]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  perfHistory.innerHTML = records.length ? records.map((value) => {
    const derived = BusinessPerformanceService.derive(value);
    return `<div class="inventory-row"><strong>${value.date}<small>${value.enteredBy}</small></strong><span>${money(value.netSales)}</span><span>${value.transactions}</span><span>${money(derived.averageTicket || 0)}</span><span>${pct(derived.laborPercent)}</span></div>`;
  }).join("") : `<div class="empty-state"><p>No business performance has been entered for this period.</p></div>`;
}

syncForm();
renderPerformance();
