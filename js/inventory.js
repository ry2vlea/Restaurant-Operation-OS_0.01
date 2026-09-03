const inventory = { modal: null };
const inventoryLabel = (value) => (value || "Not provided").replaceAll("_", " ");
const inventoryUnit = (id) => InventoryService.getUnitById(id)?.abbreviation || id;
const inventoryCategory = (id) => InventoryService.getCategories().find((category) => category.id === id)?.name || "Other";
const inventoryLocation = (id) => InventoryService.getLocations().find((location) => location.id === id)?.name || "Unknown location";
const stockBreakdown = (item, quantity) => InventoryService.formatStockBreakdown(item.id, quantity);

function closeInventoryModal() {
  inventory.modal?.remove();
  inventory.modal = null;
}

function openInventoryModal(title, content, submit, { submitLabel = "Save", showSubmit = true } = {}) {
  closeInventoryModal();
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal inventory-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <div><p class="eyebrow">INVENTORY CONTROL</p><h2>${title}</h2></div>
        <button class="icon-button" data-close aria-label="Close">×</button>
      </div>
      <form id="inventoryForm">
        ${content}
        ${showSubmit ? `<div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button" type="submit">${submitLabel}</button></div>` : ""}
      </form>
    </div>`;
  document.body.appendChild(modal);
  inventory.modal = modal;
  modal.querySelectorAll("[data-close]").forEach((button) => button.onclick = closeInventoryModal);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeInventoryModal(); });
  document.addEventListener("keydown", function esc(event) {
    if (event.key === "Escape" && inventory.modal === modal) {
      closeInventoryModal();
      document.removeEventListener("keydown", esc);
    }
  });
  if (showSubmit && submit) {
    modal.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      submit(Object.fromEntries(new FormData(event.target)), event.target);
    };
  }
  modal.querySelector("input")?.focus();
  return modal;
}

function options(values, selected, label = (value) => value.name) {
  return values.map((value) => `<option value="${value.id}" ${value.id === selected ? "selected" : ""}>${label(value)}</option>`).join("");
}

function itemForm() {
  const units = InventoryService.getUnits();
  const categories = InventoryService.getCategories();
  const locations = InventoryService.getLocations();
  return `
    <div class="inventory-form-section">
      <div class="inventory-form-heading"><h3>Item</h3><p>Define how the product is physically stored and counted.</p></div>
      <div class="form-grid">
        <label>Item Name<input name="name" required></label>
        <label>SKU<input name="sku"></label>
        <label>Category<select name="categoryId">${options(categories)}</select></label>
        <label>Default Location<select name="defaultLocationId">${options(locations)}</select></label>
      </div>
    </div>
    <div class="inventory-form-section">
      <div class="inventory-form-heading"><h3>Physical Unit Structure</h3><p>Example: 1 CS = 6 PK and 1 PK = 12 EA.</p></div>
      <div class="form-grid">
        <label>Primary / Purchase Unit<select name="primaryUnitId" id="itemPrimaryUnit">${options(units, "UNIT-CS", (value) => `${value.abbreviation} · ${value.name}`)}</select></label>
        <label>Intermediate Unit<select name="intermediateUnitId" id="itemIntermediateUnit"><option value="">None</option>${options(units, "UNIT-PK", (value) => `${value.abbreviation} · ${value.name}`)}</select></label>
        <label>Base Unit<select name="baseUnitId" id="itemBaseUnit">${options(units, "UNIT-EA", (value) => `${value.abbreviation} · ${value.name}`)}</select></label>
        <label>Intermediate Units per Primary<input name="intermediateUnitsPerPrimary" type="number" min="0" step="0.01" placeholder="6"></label>
        <label>Base Units per Intermediate<input name="baseUnitsPerIntermediate" type="number" min="0" step="0.01" placeholder="12"></label>
        <label>Base Units per Primary <span class="optional-label">if no intermediate</span><input name="baseUnitsPerPrimary" type="number" min="0" step="0.01" placeholder="72"></label>
      </div>
    </div>
    <div class="inventory-form-section">
      <div class="inventory-form-heading"><h3>Cost & Levels</h3><p>Cost is entered for the purchase unit; stock math remains in the base unit.</p></div>
      <div class="form-grid">
        <label>Purchase Unit Cost<input name="purchaseUnitCost" type="number" min="0" step="0.01" required placeholder="102.24"></label>
        <label>Minimum <span class="optional-label">base units</span><input name="minimumLevel" type="number" min="0" step="0.01" required></label>
        <label>Par <span class="optional-label">base units</span><input name="parLevel" type="number" min="0" step="0.01" required></label>
        <label>Maximum <span class="optional-label">base units</span><input name="maximumLevel" type="number" min="0" step="0.01" required></label>
      </div>
    </div>`;
}

function movementForm() {
  const items = InventoryService.getItems();
  const locations = InventoryService.getLocations();
  const firstItem = items[0];
  const unitIds = firstItem ? [InventoryService.getPrimaryUnitId(firstItem), firstItem.intermediateUnitId, firstItem.baseUnitId].filter((id, index, all) => id && all.indexOf(id) === index) : [];
  return `
    <div class="form-grid">
      <label>Item<select name="itemId" id="movementItem" required>${options(items)}</select></label>
      <label>Movement Type<select name="movementType"><option value="RECEIVE">Receive</option><option value="USE">Use</option><option value="ADJUSTMENT_IN">Adjustment In</option><option value="ADJUSTMENT_OUT">Adjustment Out</option></select></label>
      <label>Location<select name="locationId">${options(locations)}</select></label>
      <label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" required></label>
      <label>Unit<select name="unitId" id="movementUnit">${unitIds.map((id) => `<option value="${id}">${inventoryUnit(id)}</option>`).join("")}</select></label>
      <label class="full-width">Reason<input name="reason" required placeholder="Why did stock change?"></label>
    </div>`;
}

function renderMetrics() {
  const balances = InventoryService.getAllInventoryBalances();
  const active = balances.filter(({ item }) => item.active !== false);
  const statuses = active.map(({ item, quantity }) => InventoryService.getStockStatus(item, quantity));
  const today = new Date().toISOString().slice(0, 10);
  const wasteToday = InventoryService.getWasteRecords().filter((record) => record.createdAt?.slice(0, 10) === today).reduce((total, record) => total + Number(record.wasteCost || 0), 0);

  document.getElementById("inventoryMetrics").innerHTML = [
    ["Active Items", active.length],
    ["Inventory Value", `$${active.reduce((total, value) => total + value.value, 0).toFixed(2)}`],
    ["Out of Stock", statuses.filter((status) => status === "OUT_OF_STOCK").length],
    ["Critical", statuses.filter((status) => status === "CRITICAL").length],
    ["Below Par", statuses.filter((status) => status === "LOW").length],
    ["Waste Today", `$${wasteToday.toFixed(2)}`]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");

  const priority = ["OUT_OF_STOCK", "CRITICAL", "LOW", "OVERSTOCK"];
  const attention = active
    .filter(({ item, quantity }) => priority.includes(InventoryService.getStockStatus(item, quantity)))
    .sort((a, b) => priority.indexOf(InventoryService.getStockStatus(a.item, a.quantity)) - priority.indexOf(InventoryService.getStockStatus(b.item, b.quantity)));

  const critical = statuses.filter((status) => status === "CRITICAL").length;
  const out = statuses.filter((status) => status === "OUT_OF_STOCK").length;
  document.getElementById("inventoryHealth").innerHTML = `
    <div>
      <p class="eyebrow">INVENTORY HEALTH</p>
      <h2>${attention.length ? "Attention" : "Healthy"}</h2>
      <p>${out} out of stock · ${critical} critical · ${statuses.filter((status) => status === "LOW").length} below par</p>
    </div>
    <div class="inventory-health-mark ${attention.length ? "attention" : "healthy"}">${attention.length ? "Review exceptions" : "Stock within range"}</div>`;

  document.getElementById("inventoryAttention").innerHTML = attention.length
    ? attention.slice(0, 5).map(({ item, quantity }) => {
        const status = InventoryService.getStockStatus(item, quantity);
        return `<button class="inventory-alert ${status.toLowerCase()}" data-item-id="${item.id}"><span>${inventoryLabel(status)}</span><strong>${item.name}</strong><small>${stockBreakdown(item, quantity)} · Par ${InventoryService.formatStockBreakdown(item.id, item.parLevel)}</small></button>`;
      }).join("")
    : `<div class="attention-empty"><strong>No Inventory Exceptions</strong><span>All tracked items are within their operating ranges.</span></div>`;
  document.querySelectorAll("[data-item-id]").forEach((button) => button.onclick = () => openItemDetail(button.dataset.itemId));
}

function renderItems() {
  const query = document.getElementById("inventorySearch").value.trim().toLowerCase();
  const category = document.getElementById("inventoryCategory").value;
  const status = document.getElementById("inventoryStatus").value;
  const location = document.getElementById("inventoryLocation").value;
  const rows = InventoryService.getAllInventoryBalances().filter(({ item, quantity }) => {
    const matchesQuery = !query || item.name.toLowerCase().includes(query) || (item.sku || "").toLowerCase().includes(query);
    return matchesQuery && (!category || item.categoryId === category) && (!status || InventoryService.getStockStatus(item, quantity) === status) && (!location || InventoryService.getItemStockByLocation(item.id, location) !== 0);
  });

  document.getElementById("inventoryResult").textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;
  document.getElementById("inventoryTable").innerHTML = rows.length ? `
    <div class="inventory-table-head"><span>ITEM</span><span>CATEGORY</span><span>CURRENT</span><span>VALUE</span><span>STATUS</span></div>
    ${rows.map(({ item, quantity, value }) => `
      <button class="inventory-row" data-item-id="${item.id}">
        <strong>${item.name}<small>${item.sku || item.id}</small></strong>
        <span>${inventoryCategory(item.categoryId)}</span>
        <span class="inventory-current"><b>${stockBreakdown(item, quantity)}</b><small>${quantity.toFixed(2).replace(/\.00$/, "")} ${inventoryUnit(item.baseUnitId)} total</small></span>
        <span>$${value.toFixed(2)}</span>
        <span class="status-badge ${InventoryService.getStockStatus(item, quantity).toLowerCase()}">${inventoryLabel(InventoryService.getStockStatus(item, quantity))}</span>
      </button>`).join("")}` : `
      <div class="empty-state"><h3>Build Your Inventory</h3><p>Add your first inventory item to begin tracking stock, counts, receiving and waste.</p><div class="empty-actions"><button class="primary-button" id="emptyAddItem">Add Item</button><button class="secondary-button" id="loadDemoData">Load Demo Data</button></div></div>`;

  document.querySelectorAll(".inventory-row").forEach((row) => row.onclick = () => openItemDetail(row.dataset.itemId));
  document.getElementById("emptyAddItem")?.addEventListener("click", () => document.getElementById("addItemButton").click());
  document.getElementById("loadDemoData")?.addEventListener("click", loadDemoData);
}

function formatMovementEntered(movement) {
  if (movement.quantityBreakdown && Object.keys(movement.quantityBreakdown).length) {
    return Object.entries(movement.quantityBreakdown).filter(([, quantity]) => Number(quantity) > 0).map(([unitId, quantity]) => `${quantity} ${inventoryUnit(unitId)}`).join(" • ");
  }
  if (movement.quantityEntered != null) return `${movement.quantityEntered} ${inventoryUnit(movement.enteredUnitId)}`;
  return InventoryService.formatStockBreakdown(movement.itemId, movement.baseQuantity);
}

function renderMovements() {
  const movements = InventoryService.getMovements().slice(-8).reverse();
  document.getElementById("movementList").innerHTML = movements.length ? movements.map((movement) => {
    const item = InventoryService.getItemById(movement.itemId);
    const sign = movement.direction === "IN" ? "+" : "−";
    return `<div class="movement-row"><span>${new Date(movement.createdAt).toLocaleDateString()}</span><strong>${item?.name || movement.itemId}<small>${inventoryLabel(movement.movementType)}</small></strong><span class="${movement.direction === "IN" ? "movement-in" : "movement-out"}">${sign}${formatMovementEntered(movement)}<small>${movement.baseQuantity} ${inventoryUnit(item?.baseUnitId)} equivalent</small></span><span>${inventoryLocation(movement.locationId)}</span><small>${movement.manager}</small></div>`;
  }).join("") : `<div class="empty-state"><p>No inventory movements yet.</p></div>`;
}

function unitStructure(item) {
  const primary = InventoryService.getPrimaryUnitId(item);
  const primaryLabel = inventoryUnit(primary);
  const baseLabel = inventoryUnit(item.baseUnitId);
  if (primary === item.baseUnitId) return `1 ${primaryLabel} = 1 ${baseLabel}`;
  if (item.intermediateUnitId) {
    return `1 ${primaryLabel} = ${item.intermediateUnitsPerPrimary} ${inventoryUnit(item.intermediateUnitId)} · 1 ${inventoryUnit(item.intermediateUnitId)} = ${item.baseUnitsPerIntermediate} ${baseLabel} · 1 ${primaryLabel} = ${InventoryService.getUnitFactor(item, primary)} ${baseLabel}`;
  }
  return `1 ${primaryLabel} = ${item.baseUnitsPerPrimary} ${baseLabel}`;
}

function openItemDetail(id) {
  const item = InventoryService.getItemById(id);
  if (!item) return;
  const balance = InventoryService.getAllInventoryBalances().find((entry) => entry.item.id === id);
  const movements = InventoryService.getMovements().filter((movement) => movement.itemId === id).slice(-6).reverse();
  openInventoryModal(item.name, `
    <div class="item-detail-hero">
      <div><p class="eyebrow">${item.id}</p><h3>${inventoryLabel(InventoryService.getStockStatus(item, balance.quantity))}</h3></div>
      <strong>${stockBreakdown(item, balance.quantity)}</strong>
      <span>${balance.quantity.toFixed(2).replace(/\.00$/, "")} ${inventoryUnit(item.baseUnitId)} total · $${balance.value.toFixed(2)} value</span>
    </div>
    <div class="item-detail-grid">
      <div class="item-detail-block"><h3>Unit Structure</h3><p class="unit-structure-copy">${unitStructure(item)}</p><p>Purchase cost<strong>$${InventoryService.getPurchaseUnitCost(item).toFixed(2)} / ${inventoryUnit(InventoryService.getPrimaryUnitId(item))}</strong></p><p>Base cost<strong>$${InventoryService.getBaseUnitCost(item).toFixed(4)} / ${inventoryUnit(item.baseUnitId)}</strong></p></div>
      <div class="item-detail-block"><h3>Operating Levels</h3><p>Minimum<strong>${InventoryService.formatStockBreakdown(item.id, item.minimumLevel)}</strong></p><p>Par<strong>${InventoryService.formatStockBreakdown(item.id, item.parLevel)}</strong></p><p>Maximum<strong>${InventoryService.formatStockBreakdown(item.id, item.maximumLevel)}</strong></p></div>
    </div>
    <div class="item-detail-block"><h3>Locations</h3>${InventoryService.getLocations().map((location) => { const qty = InventoryService.getItemStockByLocation(item.id, location.id); return `<p>${location.name}<strong>${InventoryService.formatStockBreakdown(item.id, qty)}</strong></p>`; }).join("")}</div>
    <div class="item-detail-block"><h3>Recent Movements</h3>${movements.map((movement) => `<p>${inventoryLabel(movement.movementType)}<strong>${movement.direction === "IN" ? "+" : "−"}${formatMovementEntered(movement)}</strong></p>`).join("") || "<p>No movements yet.</p>"}</div>
    <div class="modal-actions"><button type="button" class="primary-button" id="itemTask">Create Task</button><button type="button" class="secondary-button" id="itemIssue">Report Issue</button></div>`, null, { showSubmit: false });
  document.getElementById("itemTask")?.addEventListener("click", () => openTaskForm({ sourceType: "INVENTORY_ITEM", sourceId: item.id, sourceLabel: item.name, category: "INVENTORY" }));
  document.getElementById("itemIssue")?.addEventListener("click", () => openIssueForm({ sourceType: "INVENTORY_ITEM", sourceId: item.id, sourceLabel: item.name, category: "INVENTORY" }));
}

function loadDemoData() {
  if (InventoryService.getItems().length) return;
  const chicken = InventoryService.createItem({ name: "Chicken Breast", sku: "PROT-001", categoryId: "CAT-PROTEIN", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-PK", baseUnitId: "UNIT-EA", intermediateUnitsPerPrimary: 6, baseUnitsPerIntermediate: 12, defaultLocationId: "LOC-WALKIN-COOLER", purchaseUnitCost: 102.24, minimumLevel: 72, parLevel: 216, maximumLevel: 360 });
  const oil = InventoryService.createItem({ name: "Fry Oil", sku: "OIL-001", categoryId: "CAT-SUPPLIES", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-JUG", baseUnitId: "UNIT-FLOZ", intermediateUnitsPerPrimary: 4, baseUnitsPerIntermediate: 128, defaultLocationId: "LOC-DRY-STORAGE", purchaseUnitCost: 88, minimumLevel: 512, parLevel: 1536, maximumLevel: 3072 });
  const buns = InventoryService.createItem({ name: "Burger Buns", sku: "BAK-001", categoryId: "CAT-DRY", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-PK", baseUnitId: "UNIT-EA", intermediateUnitsPerPrimary: 6, baseUnitsPerIntermediate: 8, defaultLocationId: "LOC-DRY-STORAGE", purchaseUnitCost: 20.16, minimumLevel: 48, parLevel: 144, maximumLevel: 240 });
  InventoryService.createInventoryMovement({ itemId: chicken.id, locationId: chicken.defaultLocationId, quantity: 3, unitId: "UNIT-CS", movementType: "RECEIVE", reason: "Demo opening stock" });
  InventoryService.createInventoryMovement({ itemId: oil.id, locationId: oil.defaultLocationId, quantity: 3, unitId: "UNIT-CS", movementType: "RECEIVE", reason: "Demo opening stock" });
  InventoryService.createInventoryMovement({ itemId: buns.id, locationId: buns.defaultLocationId, quantity: 2, unitId: "UNIT-CS", movementType: "RECEIVE", reason: "Demo opening stock" });
  render();
  showToast("Demo inventory loaded with physical unit hierarchies.");
}

function render() {
  const categorySelect = document.getElementById("inventoryCategory");
  categorySelect.innerHTML = `<option value="">All categories</option>${options(InventoryService.getCategories())}`;
  const locationSelect = document.getElementById("inventoryLocation");
  locationSelect.innerHTML = `<option value="">All locations</option>${options(InventoryService.getLocations())}`;
  renderMetrics();
  renderItems();
  renderMovements();
}

document.getElementById("addItemButton").onclick = () => {
  const modal = openInventoryModal("Add Inventory Item", itemForm(), (values) => {
    try {
      InventoryService.createItem(values);
      closeInventoryModal();
      render();
      showToast(`${values.name} added to inventory.`);
    } catch (error) { showToast(error.message, "error"); }
  }, { submitLabel: "Add Item" });
  const intermediate = modal.querySelector("#itemIntermediateUnit");
  const basePerPrimary = modal.querySelector('[name="baseUnitsPerPrimary"]');
  const interPerPrimary = modal.querySelector('[name="intermediateUnitsPerPrimary"]');
  const basePerIntermediate = modal.querySelector('[name="baseUnitsPerIntermediate"]');
  function syncHierarchyFields() {
    const hasIntermediate = Boolean(intermediate.value);
    interPerPrimary.disabled = !hasIntermediate;
    basePerIntermediate.disabled = !hasIntermediate;
    basePerPrimary.disabled = hasIntermediate;
  }
  intermediate.addEventListener("change", syncHierarchyFields);
  syncHierarchyFields();
};

document.getElementById("movementButton").onclick = () => {
  const modal = openInventoryModal("Record Movement", movementForm(), (values) => {
    try {
      InventoryService.createInventoryMovement(values);
      closeInventoryModal();
      render();
      showToast("Inventory movement recorded.");
    } catch (error) { showToast(error.message, "error"); }
  });
  const itemSelect = modal.querySelector("#movementItem");
  const unitSelect = modal.querySelector("#movementUnit");
  function updateUnits() {
    const item = InventoryService.getItemById(itemSelect.value);
    const ids = [InventoryService.getPrimaryUnitId(item), item?.intermediateUnitId, item?.baseUnitId].filter((id, index, all) => id && all.indexOf(id) === index);
    unitSelect.innerHTML = ids.map((id) => `<option value="${id}">${inventoryUnit(id)}</option>`).join("");
  }
  itemSelect.addEventListener("change", updateUnits);
  updateUnits();
};

document.getElementById("wasteButton").onclick = () => location.href = "waste.html";
document.getElementById("receiveButton").onclick = () => location.href = "receiving.html";
document.getElementById("startCountButton").onclick = () => location.href = "inventory-count.html";
["inventorySearch", "inventoryCategory", "inventoryStatus", "inventoryLocation"].forEach((id) => document.getElementById(id).addEventListener("input", renderItems));
window.addEventListener("inventory:changed", render);
render();
