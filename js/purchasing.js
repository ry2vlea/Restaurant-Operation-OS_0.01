const purchasingMetrics = document.getElementById("purchasingMetrics");
const suggestedList = document.getElementById("suggestedOrder");
const poList = document.getElementById("poList");
const createPoButton = document.getElementById("createSuggestedPo");

function renderPurchasing() {
  const orders = PurchasingService.getPurchaseOrders();
  const suggestions = PurchasingService.suggestedOrder();
  purchasingMetrics.innerHTML = [
    ["Open POs", orders.filter((order) => !["RECEIVED", "CANCELLED"].includes(order.status)).length],
    ["Due Today", orders.filter((order) => order.expectedDeliveryDate === new Date().toISOString().slice(0, 10)).length],
    ["Suggested Items", suggestions.length],
    ["Estimated Need", `$${suggestions.reduce((sum, row) => sum + row.estimatedCost, 0).toFixed(2)}`]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  suggestedList.innerHTML = suggestions.length ? suggestions.slice(0, 20).map((row) => `<div class="inventory-row"><strong>${row.item.name}<small>${row.item.sku || row.item.id}</small></strong><span>${InventoryService.formatStockBreakdown(row.item.id, row.suggestedBaseQuantity)}</span><span>${row.suggestedQuantity} ${InventoryService.getUnitById(row.unitId)?.abbreviation || row.unitId}</span><span>$${row.estimatedCost.toFixed(2)}</span></div>`).join("") : `<div class="empty-state"><p>No par replenishment suggested.</p></div>`;
  poList.innerHTML = orders.length ? orders.map((order) => `<button class="inventory-row" data-po-id="${order.id}"><strong>${order.id}<small>${order.vendorId || "No vendor"}</small></strong><span>${order.status}</span><span>${order.orderDate}</span><span>${order.expectedDeliveryDate || "No ETA"}</span><span>${PurchasingService.getPurchaseOrderLines(order.id).length} lines</span></button>`).join("") : `<div class="empty-state"><p>No purchase orders yet.</p></div>`;
  poList.querySelectorAll("[data-po-id]").forEach((row) => row.onclick = () => { PurchasingService.receivePurchaseOrder(row.dataset.poId); renderPurchasing(); showToast("Purchase order received."); });
}

createPoButton.onclick = () => {
  const suggestions = PurchasingService.suggestedOrder().slice(0, 8);
  if (!suggestions.length) return showToast("No suggested order lines.", "error");
  PurchasingService.createPurchaseOrder({ vendorId: "VEN-GENERAL", status: "ORDERED", expectedDeliveryDate: new Date().toISOString().slice(0, 10) }, suggestions.map((row) => ({ itemId: row.item.id, orderedQuantity: row.suggestedQuantity, unitId: row.unitId, estimatedUnitCost: InventoryService.getPurchaseUnitCost(row.item) })));
  renderPurchasing();
  showToast("Suggested purchase order created.");
};

renderPurchasing();
