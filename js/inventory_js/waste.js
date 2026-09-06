const wasteItem = document.getElementById("wasteItem");
const wasteLocation = document.getElementById("wasteLocation");
const wasteQuantityFields = document.getElementById("wasteQuantityFields");
const wasteEquivalent = document.getElementById("wasteEquivalent");
let selectedRange = window.AppHeader?.getRange?.() || {};

document.addEventListener("ros:datechange", (event) => {
  selectedRange = event.detail;
  renderWaste();
});

function wasteUnits(item) {
  return [InventoryService.getPrimaryUnitId(item), item?.intermediateUnitId, item?.baseUnitId].filter((id, index, all) => id && all.indexOf(id) === index);
}

function loadWasteOptions() {
  wasteItem.innerHTML = InventoryService.getItems().filter((item) => item.active !== false).map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  wasteLocation.innerHTML = InventoryService.getLocations().filter((location) => location.active !== false).map((location) => `<option value="${location.id}">${location.name}</option>`).join("");
  updateWasteItem();
}

function updateWasteItem() {
  const item = InventoryService.getItemById(wasteItem.value);
  if (!item) return;
  wasteLocation.value = item.defaultLocationId || wasteLocation.value;
  wasteQuantityFields.innerHTML = wasteUnits(item).map((id) => `<label><span>${InventoryService.getUnitById(id)?.name || id}</span><small>${InventoryService.getUnitById(id)?.abbreviation || id}</small><input type="number" min="0" step="0.01" inputmode="decimal" value="0" data-waste-unit="${id}"></label>`).join("");
  wasteQuantityFields.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateWasteEquivalent));
  updateWasteEquivalent();
}

function wasteBreakdown() {
  return Object.fromEntries([...wasteQuantityFields.querySelectorAll("[data-waste-unit]")].map((input) => [input.dataset.wasteUnit, Number(input.value || 0)]));
}

function updateWasteEquivalent() {
  const item = InventoryService.getItemById(wasteItem.value);
  if (!item) return;
  try {
    const base = InventoryService.convertBreakdownToBaseUnit(item.id, wasteBreakdown());
    const cost = base * InventoryService.getBaseUnitCost(item);
    wasteEquivalent.innerHTML = `<span>Waste total</span><strong>${InventoryService.formatStockBreakdown(item.id, base)}</strong><small>${base.toFixed(2).replace(/\.00$/, "")} ${InventoryService.getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId} equivalent · $${cost.toFixed(2)} estimated cost</small>`;
  } catch (error) {
    wasteEquivalent.innerHTML = `<span>Waste total</span><strong>Check unit setup</strong><small>${error.message}</small>`;
  }
}

function renderWaste() {
  const records = InventoryService.getWasteRecords().filter((record) => {
    const date = record.createdAt?.slice(0, 10);
    return (!selectedRange.startDate || date >= selectedRange.startDate) && (!selectedRange.endDate || date <= selectedRange.endDate);
  }).reverse();
  document.getElementById("wasteTotal").textContent = `$${records.reduce((total, record) => total + Number(record.wasteCost || 0), 0).toFixed(2)} estimated cost`;
  document.getElementById("wasteList").innerHTML = records.length ? records.map((record) => {
    const item = InventoryService.getItemById(record.itemId);
    return `<div class="movement-row"><strong>${item?.name || record.itemId}<small>${record.reason.replaceAll("_", " ")}</small></strong><span>−${item ? InventoryService.formatStockBreakdown(item.id, record.baseQuantity) : record.baseQuantity}</span><span>$${Number(record.wasteCost || 0).toFixed(2)}</span><small>${record.manager} · ${new Date(record.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div>`;
  }).join("") : `<div class="empty-state"><p>No waste recorded for this period.</p></div>`;
}

wasteItem.addEventListener("change", updateWasteItem);
document.getElementById("wasteForm").onsubmit = (event) => {
  event.preventDefault();
  const button = document.getElementById("saveWasteButton");
  button.disabled = true;
  const values = Object.fromEntries(new FormData(event.target));
  try {
    InventoryService.createWaste({ ...values, quantityBreakdown: wasteBreakdown() });
    showToast("Waste recorded and inventory updated.");
    event.target.querySelector('[name="notes"]').value = "";
    wasteQuantityFields.querySelectorAll("input").forEach((input) => { input.value = 0; });
    updateWasteEquivalent();
    renderWaste();
  } catch (error) { showToast(error.message, "error"); }
  button.disabled = false;
};

loadWasteOptions();
renderWaste();
