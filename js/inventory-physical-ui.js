function refreshPhysicalInventoryDisplay() {
  document.querySelectorAll(".inventory-row[data-item-id]").forEach((row) => {
    const item = InventoryService.getItemById(row.dataset.itemId);
    if (!item) return;
    const balance = InventoryService.getAllInventoryBalances().find((value) => value.item.id === item.id);
    const quantityCell = row.children[2];
    if (quantityCell && balance) quantityCell.innerHTML = `${InventoryService.formatStockBreakdown(item.id, balance.quantity)}<small>${balance.quantity} ${InventoryService.getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId} total · Min ${item.minimumLevel} · Par ${item.parLevel}</small>`;
  });
}
const physicalDisplayObserver = new MutationObserver(() => refreshPhysicalInventoryDisplay());
physicalDisplayObserver.observe(document.getElementById("inventoryTable"), { childList: true, subtree: true });
refreshPhysicalInventoryDisplay();
document.addEventListener("click", (event) => {
  if (!event.target.closest(".inventory-row, .inventory-alert")) return;
  window.setTimeout(() => {
    const itemId = event.target.closest("[data-item-id]")?.dataset.itemId;
    const item = itemId && InventoryService.getItemById(itemId);
    const balance = item && InventoryService.getAllInventoryBalances().find((value) => value.item.id === item.id);
    const detailValue = document.querySelector(".item-detail-hero strong");
    if (detailValue && balance) detailValue.textContent = InventoryService.formatStockBreakdown(item.id, balance.quantity);
  }, 0);
});
