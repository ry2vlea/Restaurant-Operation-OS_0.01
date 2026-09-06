let inventoryCount = InventoryService.getCounts().find((count) => count.status === "IN_PROGRESS") || InventoryService.createCount({ type: "FULL" });
let countItems = InventoryService.getItems().filter((item) => item.active !== false);

function countLine(item) {
  return InventoryService.getCountLines().find((line) => line.countId === inventoryCount.id && line.itemId === item.id);
}

function countUnits(item) {
  return [
    InventoryService.getPrimaryUnitId(item),
    item.intermediateUnitId,
    item.baseUnitId
  ].filter((id, index, all) => id && all.indexOf(id) === index);
}

function renderCount() {
  const lines = countItems.map((item) => countLine(item));
  const counted = lines.filter(Boolean).length;
  document.getElementById("countProgress").textContent = `${counted} / ${countItems.length} items counted`;
  document.getElementById("countBar").style.width = `${countItems.length ? counted / countItems.length * 100 : 0}%`;

  if (!countItems.length) {
    document.getElementById("countForm").innerHTML = `<div class="empty-state"><h3>No Inventory Items</h3><p>Add inventory items before starting a physical count.</p><button class="primary-button" onclick="location.href='inventory.html'">Return to Inventory</button></div>`;
    return;
  }

  document.getElementById("countForm").innerHTML = `
    <section class="count-list">
      ${countItems.map((item) => {
        const line = countLine(item);
        const physical = Number(line?.physicalQuantity || 0);
        return `<article class="physical-count-card">
          <header>
            <div><strong>${item.name}</strong><small>${InventoryService.getLocationById(item.defaultLocationId)?.name || "Default location"}</small></div>
            <span>${line ? "Counted" : "Not counted"}</span>
          </header>
          <div class="count-unit-grid">
            ${countUnits(item).map((unitId) => `<label>${InventoryService.getUnitById(unitId)?.name || unitId}<small>${InventoryService.getUnitById(unitId)?.abbreviation || unitId}</small><div class="stepper"><button type="button" data-step="-1" data-unit="${unitId}" data-item="${item.id}">−</button><input type="number" min="0" step="0.01" inputmode="decimal" data-count-part="${unitId}" data-item="${item.id}" value="${line?.physicalBreakdown?.[unitId] ?? 0}"><button type="button" data-step="1" data-unit="${unitId}" data-item="${item.id}">+</button></div></label>`).join("")}
          </div>
          <div class="physical-equivalent"><span>Physical count</span><strong>${InventoryService.formatStockBreakdown(item.id, physical)}</strong><small>${physical.toFixed(2).replace(/\.00$/, "")} ${InventoryService.getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId} equivalent</small></div>
        </article>`;
      }).join("")}
      <div class="count-footer"><p>Expected stock remains hidden until variance review.</p><button class="primary-button" id="completeCount">Review Variance</button></div>
    </section>`;

  document.querySelectorAll("[data-count-part]").forEach((input) => input.onchange = () => savePhysicalPart(input));
  document.querySelectorAll("[data-step]").forEach((button) => button.onclick = () => {
    const input = document.querySelector(`[data-count-part="${button.dataset.unit}"][data-item="${button.dataset.item}"]`);
    input.value = Math.max(0, Number(input.value || 0) + Number(button.dataset.step));
    savePhysicalPart(input);
  });
  document.getElementById("completeCount").onclick = completeCount;
}

function savePhysicalPart(input) {
  const item = InventoryService.getItemById(input.dataset.item);
  const existing = countLine(item) || {
    id: `COUNTLINE-${inventoryCount.id}-${item.id}`,
    countId: inventoryCount.id,
    itemId: item.id,
    locationId: item.defaultLocationId,
    systemQuantity: null,
    physicalQuantity: 0,
    physicalBreakdown: {},
    varianceQuantity: 0,
    unitCostAtCount: InventoryService.getBaseUnitCost(item),
    varianceValue: 0,
    correctionCreated: false
  };
  const breakdown = { ...(existing.physicalBreakdown || {}), [input.dataset.countPart]: Math.max(0, Number(input.value) || 0) };
  let physicalQuantity = 0;
  try {
    physicalQuantity = InventoryService.convertBreakdownToBaseUnit(item.id, breakdown);
  } catch (error) {
    showToast(error.message, "error");
    return;
  }
  InventoryService.updateCountLine({ ...existing, physicalBreakdown: breakdown, physicalQuantity });
  renderCount();
}

function completeCount() {
  if (countItems.some((item) => !countLine(item))) {
    showToast("Count every item, including zero quantities, before review.", "error");
    return;
  }
  try {
    inventoryCount = InventoryService.completeCount(inventoryCount.id);
    const variances = InventoryService.getVariances().filter((variance) => variance.countId === inventoryCount.id);
    document.getElementById("countForm").hidden = true;
    document.getElementById("countReview").hidden = false;
    const negative = variances.filter((v) => v.varianceValue < 0).reduce((sum, v) => sum + v.varianceValue, 0);
    const positive = variances.filter((v) => v.varianceValue > 0).reduce((sum, v) => sum + v.varianceValue, 0);
    document.getElementById("countReview").innerHTML = `
      <section class="report-section count-review-panel">
        <p class="eyebrow">COUNT REVIEW</p>
        <h2>${variances.length} variance${variances.length === 1 ? "" : "s"} found</h2>
        <div class="count-review-metrics"><div><span>Negative</span><strong>−$${Math.abs(negative).toFixed(2)}</strong></div><div><span>Positive</span><strong>+$${positive.toFixed(2)}</strong></div><div><span>Net</span><strong>${negative + positive < 0 ? "−" : "+"}$${Math.abs(negative + positive).toFixed(2)}</strong></div></div>
        <div class="variance-list">
          ${variances.map((variance) => {
            const item = InventoryService.getItemById(variance.itemId);
            return `<div class="variance-row"><div><strong>${item?.name || variance.itemId}</strong><small>${InventoryService.getLocationById(variance.locationId)?.name || "Location"}</small></div><span>Expected <b>${InventoryService.formatStockBreakdown(item.id, variance.expectedQuantity)}</b><small>Physical ${InventoryService.formatStockBreakdown(item.id, variance.physicalQuantity)}</small></span><b class="${variance.varianceQuantity < 0 ? "movement-out" : "movement-in"}">${variance.varianceQuantity > 0 ? "+" : "−"}${InventoryService.formatStockBreakdown(item.id, Math.abs(variance.varianceQuantity))}<small>${variance.varianceValue < 0 ? "−" : "+"}$${Math.abs(variance.varianceValue).toFixed(2)}</small></b><button class="secondary-button" data-correct-variance="${variance.id}">Adjust System to Physical</button></div>`;
          }).join("") || `<div class="attention-empty"><strong>No Variance</strong><span>Physical inventory matches expected stock.</span></div>`}
        </div>
        <div class="modal-actions"><button class="primary-button" onclick="location.href='inventory.html'">Return to Inventory</button></div>
      </section>`;
    document.querySelectorAll("[data-correct-variance]").forEach((button) => button.onclick = () => {
      try {
        InventoryService.correctVariance(button.dataset.correctVariance);
        button.disabled = true;
        button.textContent = "Adjusted";
        showToast("Count correction movement created.");
      } catch (error) { showToast(error.message, "error"); }
    });
  } catch (error) { showToast(error.message, "error"); }
}

renderCount();
