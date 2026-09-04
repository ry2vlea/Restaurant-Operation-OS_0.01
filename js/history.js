const historyList = document.getElementById("historyList");
const historyDetail = document.getElementById("historyDetail");

function renderHistory() {
  const days = HistoryService.days();
  historyList.innerHTML = days.length ? days.map((day) => `<button class="inventory-row" data-date="${day.date}"><strong>${day.date}<small>${day.dailyReport ? day.dailyReport.status : "No Daily Report"}</small></strong><span>${day.shifts.filter((shift) => shift.status.startsWith("COMPLETED")).length} / 3 Shifts</span><span>${day.issues.length} Issues</span><span>${day.tasks.length} Tasks</span><span>$${day.wasteCost.toFixed(2)} Waste</span></button>`).join("") : `<div class="empty-state"><p>No operating history yet.</p></div>`;
  historyList.querySelectorAll("[data-date]").forEach((row) => row.onclick = () => renderDay(row.dataset.date));
  if (days[0]) renderDay(days[0].date);
}

function list(title, values, label) {
  return `<section class="recipe-panel"><h2>${title}</h2>${values.length ? values.map((value) => `<p>${label(value)}</p>`).join("") : "<p>None recorded.</p>"}</section>`;
}

function renderDay(date) {
  const day = HistoryService.summaryForDate(date);
  historyDetail.innerHTML = `
    <section class="report-hero"><div><p class="report-eyebrow">OPERATING ARCHIVE</p><h2>${date}</h2><p>Read-only daily operating record.</p></div></section>
    ${list("Operations", day.shifts, (shift) => `${shift.type}<strong>${shift.status}</strong>`)}
    ${list("Management", [...day.issues, ...day.tasks], (item) => `${item.title}<strong>${item.status}</strong>`)}
    ${list("Inventory", [...day.counts, ...day.deliveries, ...day.waste], (item) => `${item.id}<strong>${item.status || item.reason || ""}</strong>`)}
    ${list("Menu & Production", [...day.production, ...day.menuSales], (item) => `${item.id}<strong>${item.quantitySold || item.status || ""}</strong>`)}
    <section class="recipe-panel"><h2>Performance</h2><p>Business Performance<strong>${day.businessPerformance ? `$${Number(day.businessPerformance.netSales).toFixed(2)}` : "Not Available"}</strong></p><p>Daily Report<strong>${day.dailyReport ? day.dailyReport.status : "Not Available"}</strong></p></section>`;
}

renderHistory();
