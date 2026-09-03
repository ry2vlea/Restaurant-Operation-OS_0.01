const receiveItem = document.getElementById("receiveItem");
const receiveLocation = document.getElementById("receiveLocation");
const orderedUnit = document.getElementById("orderedUnit");
const receiveQuantityFields = document.getElementById("receiveQuantityFields");
const receiveEquivalent = document.getElementById("receiveEquivalent");

function receiveUnits(item) {
  return [InventoryService.getPrimaryUnitId(item), item?.intermediateUnitId, item?.baseUnitId].filter((id, index, all) => id && all.indexOf(id) === index);
}

function loadReceiveOptions() {
  receiveItem.innerHTML = InventoryService.getItems().filter((item) => item.active !== false).map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  receiveLocation.innerHTML = InventoryService.getLocations().filter((location) => location.active !== false).map((location) => `<option value="${location.id}">${location.name}</option>`).join("");
  updateReceiveItemContext();
}

function updateReceiveItemContext() {
  const item = InventoryService.getItemById(receiveItem.value);
  if (!item) {
    receiveQuantityFields.innerHTML = `<div class="empty-state"><p>Add an inventory item first.</p></div>`;
    return;
  }
  receiveLocation.value = item.defaultLocationId || receiveLocation.value;
  const units = receiveUnits(item);
  orderedUnit.innerHTML = units.map((id) => `<option value="${id}">${InventoryService.getUnitById(id)?.abbreviation || id}</option>`).join("");
  receiveQuantityFields.innerHTML = units.map((id) => `<label><span>${InventoryService.getUnitById(id)?.name || id}</span><small>${InventoryService.getUnitById(id)?.abbreviation || id}</small><input type="number" min="0" step="0.01" inputmode="decimal" value="0" data-received-unit="${id}"></label>`).join("");
  receiveQuantityFields.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateEquivalent));
  updateEquivalent();
}

function getReceivedBreakdown() {
  return Object.fromEntries([...receiveQuantityFields.querySelectorAll("[data-received-unit]")].map((input) => [input.dataset.receivedUnit, Number(input.value || 0)]));
}

function updateEquivalent() {
  const item = InventoryService.getItemById(receiveItem.value);
  if (!item) return;
  try {
    const base = InventoryService.convertBreakdownToBaseUnit(item.id, getReceivedBreakdown());
    receiveEquivalent.innerHTML = `<span>Received total</span><strong>${InventoryService.formatStockBreakdown(item.id, base)}</strong><small>${base.toFixed(2).replace(/\.00$/, "")} ${InventoryService.getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId} equivalent</small>`;
  } catch (error) {
    receiveEquivalent.innerHTML = `<span>Received total</span><strong>Check unit setup</strong><small>${error.message}</small>`;
  }
}

receiveItem.addEventListener("change", updateReceiveItemContext);

document.getElementById("receivingForm").onsubmit = (event) => {
  event.preventDefault();
  const button = document.getElementById("completeReceivingButton");
  button.disabled = true;
  const values = Object.fromEntries(new FormData(event.target));
  try {
    const item = InventoryService.getItemById(values.itemId);
    if (!item) throw new Error("Select a valid inventory item.");
    const receivedBreakdown = getReceivedBreakdown();
    const receivedBase = InventoryService.convertBreakdownToBaseUnit(item.id, receivedBreakdown);
    if (!(receivedBase > 0)) throw new Error("Enter the quantity actually received.");
    const orderedBase = Number(values.orderedQuantity || 0) > 0 ? InventoryService.convertToBaseUnit(item.id, Number(values.orderedQuantity), values.orderedUnitId) : 0;
    const deliveryId = `DEL-${Date.now()}`;

    if (values.purchaseUnitCost !== "") {
      InventoryService.updateItem(item.id, { purchaseUnitCost: Number(values.purchaseUnitCost) });
    }
    const refreshedItem = InventoryService.getItemById(item.id);
    InventoryService.createInventoryMovement({
      itemId: item.id,
      locationId: values.locationId,
      quantityBreakdown: receivedBreakdown,
      movementType: "RECEIVE",
      reason: `Delivery ${deliveryId}`,
      source: { type: "DELIVERY", id: deliveryId },
      unitCostAtMovement: InventoryService.getBaseUnitCost(refreshedItem)
    });

    const discrepancy = orderedBase > 0 ? Math.abs(receivedBase - orderedBase) > 1e-9 : false;
    const deliveries = InventoryService.getDeliveries();
    deliveries.push({
      id: deliveryId,
      vendor: values.vendor || "",
      invoiceNumber: values.invoiceNumber || "",
      date: new Date().toISOString().slice(0, 10),
      receivedBy: localStorage.getItem("currentManager") || "Jordan Lee",
      status: discrepancy ? "COMPLETED_WITH_DISCREPANCY" : "COMPLETED",
      notes: values.notes || "",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      itemId: item.id,
      orderedBaseQuantity: orderedBase,
      receivedBaseQuantity: receivedBase,
      differenceBaseQuantity: receivedBase - orderedBase
    });
    localStorage.setItem("deliveries", JSON.stringify(deliveries));
    showToast(discrepancy ? "Delivery completed with quantity discrepancy." : "Delivery received and stock updated.");
    setTimeout(() => { location.href = "inventory.html"; }, 500);
  } catch (error) {
    showToast(error.message, "error");
    button.disabled = false;
  }
};

loadReceiveOptions();
