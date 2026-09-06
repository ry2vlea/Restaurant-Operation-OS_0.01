(function () {
  const poKey = "purchaseOrders";
  const lineKey = "purchaseOrderLines";

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("purchasing:changed"));
    return value;
  }

  function nextId(prefix, values) {
    const highest = values.reduce((max, value) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(6, "0")}`;
  }

  function getPurchaseOrders() { return read(poKey); }
  function getPurchaseOrderLines(id) { return read(lineKey).filter((line) => !id || line.purchaseOrderId === id); }

  function suggestedOrder() {
    return InventoryService.getAllInventoryBalances().filter(({ item }) => item.active !== false).map(({ item, quantity }) => {
      const suggestedBaseQuantity = Math.max(Number(item.parLevel || 0) - Number(quantity || 0), 0);
      const unitId = InventoryService.getPrimaryUnitId(item) || item.baseUnitId;
      const factor = InventoryService.getUnitFactor(item, unitId) || 1;
      return { item, suggestedBaseQuantity, suggestedQuantity: factor > 0 ? Math.ceil(suggestedBaseQuantity / factor) : suggestedBaseQuantity, unitId, estimatedCost: suggestedBaseQuantity * InventoryService.getBaseUnitCost(item) };
    }).filter((row) => row.suggestedBaseQuantity > 0);
  }

  function createPurchaseOrder(values, lines) {
    const orders = getPurchaseOrders();
    const allLines = read(lineKey);
    const now = new Date().toISOString();
    const order = {
      id: nextId("PO", orders),
      vendorId: values.vendorId || "",
      status: values.status || "DRAFT",
      orderDate: values.orderDate || now.slice(0, 10),
      expectedDeliveryDate: values.expectedDeliveryDate || "",
      createdBy: values.createdBy || localStorage.getItem("currentManager") || "Jordan Lee",
      notes: values.notes || "",
      createdAt: now,
      updatedAt: now
    };
    const records = lines.map((line) => {
      const item = InventoryService.getItemById(line.itemId);
      const orderedQuantity = Number(line.orderedQuantity || 0);
      const unitId = line.unitId || InventoryService.getPrimaryUnitId(item);
      const baseQuantityOrdered = InventoryService.convertToBaseUnit(item.id, orderedQuantity, unitId);
      const estimatedUnitCost = Number(line.estimatedUnitCost || InventoryService.getPurchaseUnitCost(item));
      return { id: nextId("POL", allLines), purchaseOrderId: order.id, itemId: item.id, orderedQuantity, unitId, baseQuantityOrdered, estimatedUnitCost, estimatedLineCost: estimatedUnitCost * orderedQuantity, receivedBaseQuantity: 0 };
    });
    write(poKey, [...orders, order]);
    write(lineKey, [...allLines, ...records]);
    window.recordActivity?.({ action: "PO_CREATED", entityType: "PURCHASE_ORDER", entityId: order.id, description: `Purchase order ${order.id} created` });
    return order;
  }

  function receivePurchaseOrder(id) {
    const order = getPurchaseOrders().find((value) => value.id === id);
    if (!order || ["RECEIVED", "CANCELLED"].includes(order.status)) return order;
    const lines = getPurchaseOrderLines(id);
    lines.forEach((line) => {
      const item = InventoryService.getItemById(line.itemId);
      if (!item || Number(line.receivedBaseQuantity || 0) >= Number(line.baseQuantityOrdered || 0)) return;
      InventoryService.createInventoryMovement({ itemId: item.id, locationId: item.defaultLocationId, quantity: line.orderedQuantity, unitId: line.unitId, movementType: "RECEIVE", reason: `PO ${id}`, source: { type: "PURCHASE_ORDER", id } });
    });
    write(lineKey, read(lineKey).map((line) => line.purchaseOrderId === id ? { ...line, receivedBaseQuantity: line.baseQuantityOrdered } : line));
    const updated = { ...order, status: "RECEIVED", updatedAt: new Date().toISOString() };
    write(poKey, getPurchaseOrders().map((value) => value.id === id ? updated : value));
    window.recordActivity?.({ action: "PO_RECEIVED", entityType: "PURCHASE_ORDER", entityId: id, description: `Purchase order ${id} received` });
    return updated;
  }

  window.PurchasingService = { getPurchaseOrders, getPurchaseOrderLines, suggestedOrder, createPurchaseOrder, receivePurchaseOrder };
})();
