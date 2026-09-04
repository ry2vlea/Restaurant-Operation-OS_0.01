const varianceApp = document.getElementById("varianceApp");
const money = (value) => value == null ? "Insufficient Data" : `$${Number(value).toFixed(2)}`;

function renderVariance() {
  const result = VarianceService.calculateLatest();
  const totals = result.totals;
  document.getElementById("varianceMetrics").innerHTML = [
    ["Net Variance", result.status === "OK" ? money(totals.netVariance) : "Insufficient Data"],
    ["Items With Variance", totals.itemsWithVariance],
    ["Significant Exceptions", totals.significantExceptions],
    ["Explained", totals.explained],
    ["Under Review", totals.underReview]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  document.getElementById("variancePeriod").textContent = result.status === "OK" ? `${result.start.date} - ${result.end.date}` : "Requires two completed counts";
  varianceApp.innerHTML = result.rows.length ? `
    <div class="inventory-table-head"><span>ITEM</span><span>EXPECTED</span><span>PHYSICAL</span><span>VARIANCE</span><span>$ IMPACT</span><span>STATUS</span></div>
    ${result.rows.map((row) => `<button class="inventory-row" data-variance-id="${row.id}"><strong>${row.item.name}<small>${row.item.id}</small></strong><span>${InventoryService.formatStockBreakdown(row.item.id, row.expectedEndingQuantity)}</span><span>${InventoryService.formatStockBreakdown(row.item.id, row.physicalEndingQuantity)}</span><span>${InventoryService.formatStockBreakdown(row.item.id, row.varianceQuantity)}</span><span class="${row.varianceValue < 0 ? "cost-attention" : "cost-good"}">${money(row.varianceValue)}</span><span class="status-badge ${row.status.toLowerCase()}">${row.status.replaceAll("_", " ")}</span></button>`).join("")}` :
    `<div class="empty-state"><h3>Insufficient Data</h3><p>Complete two inventory counts to calculate variance across physical boundaries.</p></div>`;
  varianceApp.querySelectorAll("[data-variance-id]").forEach((row) => {
    row.onclick = () => {
      const id = row.dataset.varianceId;
      VarianceService.reviewVariance(id, { status: "INVESTIGATING", reason: "Unknown", notes: "Marked for review." });
      renderVariance();
    };
  });
}

renderVariance();
