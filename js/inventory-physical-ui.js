function refreshPhysicalInventoryDisplay() {
  const context = InventoryService.getCalculationContext();
  document.querySelectorAll(".inventory-row[data-item-id]").forEach((row) => {
    const item = context.itemById.get(row.dataset.itemId);
    if (!item) return;
    const quantity = context.balances.byItem.get(item.id) || 0;
    const quantityCell = row.children[2];
    if (quantityCell) quantityCell.innerHTML = `${InventoryService.formatStockBreakdown(item.id, quantity)}<small>${quantity} ${InventoryService.getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId} total · Min ${item.minimumLevel} · Par ${item.parLevel}</small>`;
  });
}
const physicalDisplayObserver = new MutationObserver(() => refreshPhysicalInventoryDisplay());
physicalDisplayObserver.observe(document.getElementById("inventoryTable"), { childList: true, subtree: true });
refreshPhysicalInventoryDisplay();
document.addEventListener("click", (event) => {
  if (!event.target.closest(".inventory-row, .inventory-alert")) return;
  window.setTimeout(() => {
    const itemId = event.target.closest("[data-item-id]")?.dataset.itemId;
    const context = InventoryService.getCalculationContext();
    const item = itemId && context.itemById.get(itemId);
    const quantity = item ? context.balances.byItem.get(item.id) || 0 : null;
    const detailValue = document.querySelector(".item-detail-hero strong");
    if (detailValue && item) detailValue.textContent = InventoryService.formatStockBreakdown(item.id, quantity);
  }, 0);
});
