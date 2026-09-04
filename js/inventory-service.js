(function () {
  const keys = {
    items: "inventoryItems",
    categories: "inventoryCategories",
    locations: "inventoryLocations",
    units: "inventoryUnits",
    conversions: "inventoryConversions",
    movements: "inventoryMovements",
    counts: "inventoryCounts",
    countLines: "inventoryCountLines",
    deliveries: "deliveries",
    deliveryLines: "deliveryLines",
    waste: "wasteRecords",
    variances: "inventoryVariances",
    vendors: "vendors"
  };

  const defaults = {
    categories: [
      ["CAT-PROTEIN", "Protein"], ["CAT-FROZEN", "Frozen"], ["CAT-PRODUCE", "Produce"],
      ["CAT-DAIRY", "Dairy"], ["CAT-DRY", "Dry Goods"], ["CAT-SAUCE", "Sauces"],
      ["CAT-BEVERAGE", "Beverages"], ["CAT-PACKAGING", "Packaging"], ["CAT-CLEANING", "Cleaning"],
      ["CAT-SUPPLIES", "Supplies"], ["CAT-OTHER", "Other"]
    ],
    locations: [
      ["LOC-WALKIN-COOLER", "Walk-In Cooler"], ["LOC-WALKIN-FREEZER", "Walk-In Freezer"],
      ["LOC-DRY-STORAGE", "Dry Storage"], ["LOC-PREP", "Prep Area"], ["LOC-FRONT", "Front Counter"],
      ["LOC-BEVERAGE", "Beverage Storage"], ["LOC-CLEANING", "Cleaning Storage"]
    ],
    units: [
      ["UNIT-EA", "Each", "EA"], ["UNIT-CS", "Case", "CS"], ["UNIT-PK", "Pack", "PK"],
      ["UNIT-TRAY", "Tray", "TRAY"], ["UNIT-BAG", "Bag", "BAG"], ["UNIT-JUG", "Jug", "JUG"],
      ["UNIT-TUB", "Tub", "TUB"], ["UNIT-LB", "Pound", "LB"], ["UNIT-OZ", "Ounce", "OZ"],
      ["UNIT-GAL", "Gallon", "GAL"], ["UNIT-QT", "Quart", "QT"], ["UNIT-FLOZ", "Fluid Ounce", "FL OZ"]
    ]
  };

  const movementDirections = {
    RECEIVE: "IN",
    RETURN: "IN",
    ADJUSTMENT_IN: "IN",
    COUNT_CORRECTION_IN: "IN",
    TRANSFER_IN: "IN",
    PRODUCTION_CREATE: "IN",
    USE: "OUT",
    WASTE: "OUT",
    ADJUSTMENT_OUT: "OUT",
    COUNT_CORRECTION_OUT: "OUT",
    TRANSFER_OUT: "OUT",
    PRODUCTION_CONSUME: "OUT"
  };

  let contextCache = null;

  function invalidateContext() {
    contextCache = null;
  }

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
    invalidateContext();
    return value;
  }

  function list(name) {
    const values = read(keys[name]);
    if (values.length || !defaults[name]) return values;
    const seeded = defaults[name].map((value, index) => {
      if (name === "categories") return { id: value[0], name: value[1], active: true, sortOrder: index };
      if (name === "locations") return { id: value[0], name: value[1], description: "", active: true };
      return { id: value[0], name: value[1], abbreviation: value[2], type: "STANDARD", active: true };
    });
    return write(keys[name], seeded);
  }

  function saveList(name, values) {
    write(keys[name], values);
    if (typeof window !== "undefined" && window.dispatchEvent && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(new CustomEvent("inventory:changed"));
    }
    return values;
  }

  function getItems() { return list("items"); }
  function saveItems(items) { return saveList("items", items); }
  function getCategories() { return list("categories"); }
  function getLocations() { return list("locations"); }
  function getUnits() { return list("units"); }
  function getConversions() { return list("conversions"); }
  function getMovements() { return list("movements"); }
  function getCounts() { return list("counts"); }
  function getCountLines() { return list("countLines"); }
  function getDeliveries() { return list("deliveries"); }
  function getDeliveryLines() { return list("deliveryLines"); }
  function getWasteRecords() { return list("waste"); }
  function getVariances() { return list("variances"); }
  function getVendors() { return list("vendors"); }

  function nextId(prefix, values, width = 6) {
    const highest = values.reduce((max, value) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(width, "0")}`;
  }

  function getCalculationContext() {
    if (contextCache) return contextCache;
    const items = getItems();
    const categories = getCategories();
    const locations = getLocations();
    const units = getUnits();
    const conversions = getConversions();
    const movements = getMovements();
    const itemById = new Map(items.map((item) => [item.id, item]));
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const locationById = new Map(locations.map((location) => [location.id, location]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const conversionByItemUnit = new Map();
    conversions.forEach((value) => {
      if (Number(value.conversionFactor) > 0) {
        conversionByItemUnit.set(`${value.inventoryItemId}|${value.fromUnitId}|${value.toUnitId}`, value);
      }
    });

    const movementsByItem = new Map();
    const movementsByItemLocation = new Map();
    const balances = { byItem: new Map(), byItemLocation: new Map() };
    movements.forEach((movement) => {
      const quantity = signedQuantity(movement);
      const itemTotal = balances.byItem.get(movement.itemId) || 0;
      balances.byItem.set(movement.itemId, itemTotal + quantity);
      const itemLocationKey = `${movement.itemId}|${movement.locationId}`;
      balances.byItemLocation.set(itemLocationKey, (balances.byItemLocation.get(itemLocationKey) || 0) + quantity);
      if (!movementsByItem.has(movement.itemId)) movementsByItem.set(movement.itemId, []);
      movementsByItem.get(movement.itemId).push(movement);
      if (!movementsByItemLocation.has(itemLocationKey)) movementsByItemLocation.set(itemLocationKey, []);
      movementsByItemLocation.get(itemLocationKey).push(movement);
    });

    contextCache = {
      items,
      categories,
      locations,
      units,
      conversions,
      movements,
      itemById,
      categoryById,
      locationById,
      unitById,
      conversionByItemUnit,
      movementsByItem,
      movementsByItemLocation,
      balances
    };
    return contextCache;
  }

  function getItemById(id) { return getCalculationContext().itemById.get(id) || null; }
  function getLocationById(id) { return getCalculationContext().locationById.get(id) || null; }
  function getUnitById(id) { return getCalculationContext().unitById.get(id) || null; }

  function getPrimaryUnitId(item) {
    return item?.primaryUnitId || item?.purchaseUnitId || item?.baseUnitId || null;
  }

  function getUnitFactor(itemOrId, unitId) {
    const item = typeof itemOrId === "string" ? getItemById(itemOrId) : itemOrId;
    if (!item || !unitId) return null;
    const primaryUnitId = getPrimaryUnitId(item);
    if (unitId === item.baseUnitId) return 1;
    if (unitId === item.intermediateUnitId && Number(item.baseUnitsPerIntermediate) > 0) {
      return Number(item.baseUnitsPerIntermediate);
    }
    if (unitId === primaryUnitId && item.intermediateUnitId && Number(item.intermediateUnitsPerPrimary) > 0 && Number(item.baseUnitsPerIntermediate) > 0) {
      return Number(item.intermediateUnitsPerPrimary) * Number(item.baseUnitsPerIntermediate);
    }
    if (unitId === primaryUnitId && !item.intermediateUnitId && Number(item.baseUnitsPerPrimary) > 0) {
      return Number(item.baseUnitsPerPrimary);
    }
    const conversion = getCalculationContext().conversionByItemUnit.get(`${item.id}|${unitId}|${item.baseUnitId}`);
    return conversion ? Number(conversion.conversionFactor) : null;
  }

  function convertToBaseUnit(itemId, quantity, unitId) {
    const item = getItemById(itemId);
    const numericQuantity = Number(quantity);
    if (!item || !item.baseUnitId || !Number.isFinite(numericQuantity) || numericQuantity < 0) {
      throw new Error("Item, base unit and a non-negative quantity are required.");
    }
    const factor = getUnitFactor(item, unitId || item.baseUnitId);
    if (!factor || factor <= 0) throw new Error(`No valid conversion to ${getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId} exists for ${item.name}.`);
    return numericQuantity * factor;
  }

  function normalizeBreakdown(itemId, breakdown) {
    const item = getItemById(itemId);
    if (!item) throw new Error("Inventory item not found.");
    const normalized = {};
    Object.entries(breakdown || {}).forEach(([unitId, quantity]) => {
      const numeric = Number(quantity || 0);
      if (numeric < 0) throw new Error("Inventory quantities cannot be negative.");
      if (numeric > 0) {
        convertToBaseUnit(itemId, numeric, unitId);
        normalized[unitId] = numeric;
      }
    });
    return normalized;
  }

  function convertBreakdownToBaseUnit(itemId, breakdown) {
    const normalized = normalizeBreakdown(itemId, breakdown);
    return Object.entries(normalized).reduce((total, [unitId, quantity]) => total + convertToBaseUnit(itemId, quantity, unitId), 0);
  }

  function getStockBreakdown(itemId, baseQuantity) {
    const item = getItemById(itemId);
    if (!item) throw new Error("Inventory item not found.");
    const numericBase = Number(baseQuantity) || 0;
    const sign = numericBase < 0 ? -1 : 1;
    let remainder = Math.abs(numericBase);
    const primaryUnitId = getPrimaryUnitId(item);
    const primaryFactor = getUnitFactor(item, primaryUnitId);
    const intermediateFactor = item.intermediateUnitId ? getUnitFactor(item, item.intermediateUnitId) : null;

    let primaryQuantity = 0;
    let intermediateQuantity = 0;
    if (primaryFactor && primaryFactor > 1) {
      primaryQuantity = Math.floor((remainder + 1e-9) / primaryFactor);
      remainder -= primaryQuantity * primaryFactor;
    }
    if (intermediateFactor && intermediateFactor > 1) {
      intermediateQuantity = Math.floor((remainder + 1e-9) / intermediateFactor);
      remainder -= intermediateQuantity * intermediateFactor;
    }
    if (Math.abs(remainder) < 1e-9) remainder = 0;

    return {
      sign,
      primary: primaryUnitId ? { unit: primaryUnitId, quantity: primaryQuantity } : null,
      intermediate: item.intermediateUnitId ? { unit: item.intermediateUnitId, quantity: intermediateQuantity } : null,
      base: { unit: item.baseUnitId, quantity: remainder },
      baseQuantity: numericBase
    };
  }

  function formatNumber(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatStockBreakdown(itemId, baseQuantity) {
    const breakdown = getStockBreakdown(itemId, baseQuantity);
    const pieces = [breakdown.primary, breakdown.intermediate, breakdown.base]
      .filter((part) => part && Number(part.quantity) > 0)
      .map((part) => `${formatNumber(part.quantity)} ${getUnitById(part.unit)?.abbreviation || part.unit}`);
    const baseLabel = getUnitById(breakdown.base.unit)?.abbreviation || breakdown.base.unit;
    const result = pieces.join(" • ") || `0 ${baseLabel}`;
    return breakdown.sign < 0 ? `−${result}` : result;
  }

  function getBaseUnitCost(itemOrId) {
    const item = typeof itemOrId === "string" ? getItemById(itemOrId) : itemOrId;
    if (!item) return 0;
    if (Number.isFinite(Number(item.baseUnitCost)) && item.baseUnitCost !== "") return Number(item.baseUnitCost);
    if (Number.isFinite(Number(item.unitCost)) && item.unitCost !== "") return Number(item.unitCost); // legacy: unitCost was base cost
    if (Number.isFinite(Number(item.purchaseUnitCost)) && item.purchaseUnitCost !== "") {
      const factor = getUnitFactor(item, getPrimaryUnitId(item));
      return factor ? Number(item.purchaseUnitCost) / factor : 0;
    }
    return 0;
  }

  function getPurchaseUnitCost(itemOrId) {
    const item = typeof itemOrId === "string" ? getItemById(itemOrId) : itemOrId;
    if (!item) return 0;
    if (Number.isFinite(Number(item.purchaseUnitCost)) && item.purchaseUnitCost !== "") return Number(item.purchaseUnitCost);
    const factor = getUnitFactor(item, getPrimaryUnitId(item)) || 1;
    return getBaseUnitCost(item) * factor;
  }

  function signedQuantity(movement) {
    const direction = movementDirections[movement.movementType] || movement.direction;
    const quantity = Number(movement.baseQuantity) || 0;
    return direction === "IN" ? quantity : direction === "OUT" ? -quantity : 0;
  }

  function getItemStock(itemId) {
    return getCalculationContext().balances.byItem.get(itemId) || 0;
  }

  function getItemStockByLocation(itemId, locationId) {
    return getCalculationContext().balances.byItemLocation.get(`${itemId}|${locationId}`) || 0;
  }

  function getAllInventoryBalances() {
    const context = getCalculationContext();
    return context.items.map((item) => {
      const quantity = context.balances.byItem.get(item.id) || 0;
      return { item, quantity, value: quantity * getBaseUnitCost(item) };
    });
  }

  function getStockStatus(item, quantity = getItemStock(item.id)) {
    const current = Number(quantity) || 0;
    const minimum = Number(item.minimumLevel || 0);
    const par = Number(item.parLevel || 0);
    const maximum = Number(item.maximumLevel || 0);
    if (current <= 0) return "OUT_OF_STOCK";
    if (current <= minimum) return "CRITICAL";
    if (current < par) return "LOW";
    if (maximum > 0 && current > maximum) return "OVERSTOCK";
    return "GOOD";
  }

  function normalizeItemValues(values, existing = null) {
    const baseUnitId = values.baseUnitId || existing?.baseUnitId;
    const primaryUnitId = values.primaryUnitId || values.purchaseUnitId || existing?.primaryUnitId || existing?.purchaseUnitId || baseUnitId;
    const intermediateUnitId = values.intermediateUnitId || null;
    const intermediateUnitsPerPrimary = Number(values.intermediateUnitsPerPrimary || 0);
    const baseUnitsPerIntermediate = Number(values.baseUnitsPerIntermediate || 0);
    const baseUnitsPerPrimary = Number(values.baseUnitsPerPrimary || 0);

    if (!values.name && !existing?.name) throw new Error("Item name is required.");
    if (!baseUnitId) throw new Error("Base unit is required.");
    if (primaryUnitId !== baseUnitId) {
      if (intermediateUnitId) {
        if (intermediateUnitsPerPrimary <= 0 || baseUnitsPerIntermediate <= 0) {
          throw new Error("Enter both intermediate units per case and base units per intermediate unit.");
        }
      } else if (baseUnitsPerPrimary <= 0) {
        throw new Error("Enter how many base units are in one primary unit.");
      }
    }

    const minimumLevel = Number(values.minimumLevel ?? existing?.minimumLevel ?? 0);
    const parLevel = Number(values.parLevel ?? existing?.parLevel ?? 0);
    const maximumLevel = Number(values.maximumLevel ?? existing?.maximumLevel ?? 0);
    if (minimumLevel < 0 || parLevel < 0 || maximumLevel < 0 || minimumLevel > parLevel || parLevel > maximumLevel) {
      throw new Error("Inventory levels must follow Minimum ≤ Par ≤ Maximum.");
    }

    const tempItem = {
      ...(existing || {}),
      baseUnitId,
      primaryUnitId,
      purchaseUnitId: primaryUnitId,
      intermediateUnitId,
      intermediateUnitsPerPrimary,
      baseUnitsPerIntermediate,
      baseUnitsPerPrimary
    };
    const primaryFactor = primaryUnitId === baseUnitId ? 1 : intermediateUnitId
      ? intermediateUnitsPerPrimary * baseUnitsPerIntermediate
      : baseUnitsPerPrimary;

    let purchaseUnitCost;
    let baseUnitCost;
    if (values.purchaseUnitCost !== undefined && values.purchaseUnitCost !== "") {
      purchaseUnitCost = Number(values.purchaseUnitCost);
      if (purchaseUnitCost < 0) throw new Error("Purchase cost cannot be negative.");
      baseUnitCost = primaryFactor > 0 ? purchaseUnitCost / primaryFactor : purchaseUnitCost;
    } else if (values.baseUnitCost !== undefined && values.baseUnitCost !== "") {
      baseUnitCost = Number(values.baseUnitCost);
      purchaseUnitCost = baseUnitCost * (primaryFactor || 1);
    } else if (values.unitCost !== undefined && values.unitCost !== "") {
      // Backward compatibility: old forms stored unitCost as base-unit cost.
      baseUnitCost = Number(values.unitCost);
      purchaseUnitCost = baseUnitCost * (primaryFactor || 1);
    } else {
      baseUnitCost = getBaseUnitCost(tempItem);
      purchaseUnitCost = getPurchaseUnitCost(tempItem);
    }

    return {
      name: (values.name ?? existing?.name ?? "").trim(),
      sku: values.sku ?? existing?.sku ?? "",
      categoryId: values.categoryId || existing?.categoryId || "CAT-OTHER",
      baseUnitId,
      purchaseUnitId: primaryUnitId,
      primaryUnitId,
      intermediateUnitId,
      intermediateUnitsPerPrimary,
      baseUnitsPerIntermediate,
      baseUnitsPerPrimary,
      defaultLocationId: values.defaultLocationId || existing?.defaultLocationId || "LOC-DRY-STORAGE",
      preferredVendorId: values.preferredVendorId ?? existing?.preferredVendorId ?? null,
      purchaseUnitCost,
      baseUnitCost,
      unitCost: baseUnitCost, // legacy compatibility for older modules
      minimumLevel,
      parLevel,
      maximumLevel,
      active: values.active !== undefined ? values.active !== false && values.active !== "false" : existing?.active !== false
    };
  }

  function createItem(values) {
    const normalized = normalizeItemValues(values);
    if (!getLocationById(normalized.defaultLocationId)) throw new Error("Select a valid default location.");
    const now = new Date().toISOString();
    const item = { id: nextId("ITEM", getItems()), ...normalized, createdAt: now, updatedAt: now };
    saveItems([...getItems(), item]);
    return item;
  }

  function updateItem(id, values) {
    const existing = getItemById(id);
    if (!existing) throw new Error("Inventory item not found.");
    const normalized = normalizeItemValues({ ...existing, ...values }, existing);
    const updated = { ...existing, ...normalized, updatedAt: new Date().toISOString() };
    saveItems(getItems().map((item) => item.id === id ? updated : item));
    return updated;
  }

  function updateItemBaseCost(id, baseUnitCost, metadata = {}) {
    const item = getItemById(id);
    if (!item) throw new Error("Inventory item not found.");
    const baseCost = Number(baseUnitCost);
    if (!Number.isFinite(baseCost) || baseCost < 0) throw new Error("A valid base-unit cost is required.");
    const primaryFactor = getUnitFactor(item, getPrimaryUnitId(item)) || 1;
    const updated = {
      ...item,
      baseUnitCost: baseCost,
      unitCost: baseCost,
      purchaseUnitCost: baseCost * primaryFactor,
      costSource: metadata.costSource || item.costSource || "MANUAL",
      costSourceId: metadata.costSourceId || item.costSourceId || null,
      updatedAt: new Date().toISOString()
    };
    saveItems(getItems().map((value) => value.id === id ? updated : value));
    return updated;
  }

  function getMovementDirection(movementType) {
    return movementDirections[movementType] || null;
  }

  function createInventoryMovement(values) {
    const item = getItemById(values.itemId);
    const location = getLocationById(values.locationId);
    const direction = getMovementDirection(values.movementType);
    if (!item || !location) throw new Error("Select a valid item and location.");
    if (!direction) throw new Error("Select a valid inventory movement type.");

    let baseQuantity;
    let quantityEntered = null;
    let enteredUnitId = null;
    let quantityBreakdown = null;
    if (values.quantityBreakdown) {
      quantityBreakdown = normalizeBreakdown(item.id, values.quantityBreakdown);
      baseQuantity = convertBreakdownToBaseUnit(item.id, quantityBreakdown);
    } else {
      quantityEntered = Number(values.quantity);
      enteredUnitId = values.unitId || item.baseUnitId;
      if (!Number.isFinite(quantityEntered) || quantityEntered <= 0) throw new Error("Enter a quantity greater than zero.");
      baseQuantity = convertToBaseUnit(item.id, quantityEntered, enteredUnitId);
    }
    if (!(baseQuantity > 0)) throw new Error("Enter at least one inventory quantity.");

    if (direction === "OUT" && getItemStockByLocation(item.id, location.id) + 1e-9 < baseQuantity && !values.allowNegative) {
      const available = getItemStockByLocation(item.id, location.id);
      throw new Error(`Insufficient inventory in ${location.name}. Available: ${formatStockBreakdown(item.id, available)}.`);
    }

    const now = new Date().toISOString();
    const movement = {
      id: nextId("MOVE", getMovements()),
      itemId: item.id,
      locationId: location.id,
      destinationLocationId: values.destinationLocationId || null,
      movementType: values.movementType,
      direction,
      quantityEntered,
      enteredUnitId,
      quantityBreakdown,
      baseQuantity,
      unitCostAtMovement: Number(values.unitCostAtMovement ?? getBaseUnitCost(item)),
      reason: values.reason || "",
      manager: values.manager || localStorage.getItem("currentManager") || "Jordan Lee",
      source: values.source || null,
      createdAt: now
    };
    saveList("movements", [...getMovements(), movement]);
    return movement;
  }

  function transfer(values) {
    if (!values.fromLocationId || !values.toLocationId || values.fromLocationId === values.toLocationId) {
      throw new Error("Transfer locations must be different.");
    }
    if (!getLocationById(values.toLocationId)) throw new Error("Select a valid destination location.");
    const baseQuantity = values.quantityBreakdown
      ? convertBreakdownToBaseUnit(values.itemId, values.quantityBreakdown)
      : convertToBaseUnit(values.itemId, Number(values.quantity), values.unitId || getItemById(values.itemId)?.baseUnitId);
    if (getItemStockByLocation(values.itemId, values.fromLocationId) + 1e-9 < baseQuantity) {
      throw new Error("Insufficient inventory at the source location.");
    }
    const reference = `TRANSFER-${Date.now()}`;
    const common = {
      itemId: values.itemId,
      quantity: values.quantity,
      unitId: values.unitId,
      quantityBreakdown: values.quantityBreakdown,
      reason: values.reason || "Location transfer",
      manager: values.manager,
      source: { type: "TRANSFER", id: reference }
    };
    const out = createInventoryMovement({ ...common, locationId: values.fromLocationId, destinationLocationId: values.toLocationId, movementType: "TRANSFER_OUT" });
    const incoming = createInventoryMovement({ ...common, locationId: values.toLocationId, destinationLocationId: values.fromLocationId, movementType: "TRANSFER_IN" });
    return { out, incoming };
  }

  function createWaste(values) {
    const item = getItemById(values.itemId);
    if (!item) throw new Error("Select a valid inventory item.");
    const quantityBreakdown = values.quantityBreakdown ? normalizeBreakdown(item.id, values.quantityBreakdown) : null;
    const baseQuantity = quantityBreakdown
      ? convertBreakdownToBaseUnit(item.id, quantityBreakdown)
      : convertToBaseUnit(item.id, Number(values.quantity), values.unitId || item.baseUnitId);
    if (!(baseQuantity > 0)) throw new Error("Enter waste quantity.");
    const now = new Date().toISOString();
    const baseCost = getBaseUnitCost(item);
    const waste = {
      id: nextId("WASTE", getWasteRecords()),
      itemId: item.id,
      locationId: values.locationId,
      quantity: values.quantity !== undefined ? Number(values.quantity) : null,
      unitId: values.unitId || null,
      quantityBreakdown,
      baseQuantity,
      reason: values.reason || "OTHER",
      unitCost: baseCost,
      wasteCost: baseQuantity * baseCost,
      manager: values.manager || localStorage.getItem("currentManager") || "Jordan Lee",
      shiftId: values.shiftId || null,
      notes: values.notes || "",
      createdAt: now
    };
    createInventoryMovement({
      itemId: item.id,
      locationId: values.locationId,
      quantity: values.quantity,
      unitId: values.unitId,
      quantityBreakdown,
      movementType: "WASTE",
      reason: waste.reason,
      source: { type: "WASTE", id: waste.id }
    });
    saveList("waste", [...getWasteRecords(), waste]);
    return waste;
  }

  function createCount(values) {
    const now = new Date().toISOString();
    const count = {
      id: nextId("COUNT", getCounts()),
      type: values.type || "FULL",
      date: values.date || now.slice(0, 10),
      manager: values.manager || localStorage.getItem("currentManager") || "Jordan Lee",
      status: "IN_PROGRESS",
      startedAt: now,
      completedAt: null,
      notes: values.notes || ""
    };
    saveList("counts", [...getCounts(), count]);
    return count;
  }

  function updateCountLine(line) {
    const lines = getCountLines().filter((value) => value.id !== line.id);
    saveList("countLines", [...lines, line]);
    return line;
  }

  function completeCount(countId) {
    const count = getCounts().find((value) => value.id === countId);
    if (!count || count.status !== "IN_PROGRESS") throw new Error("Count is already completed or missing.");
    const allLines = getCountLines();
    const lines = allLines.filter((line) => line.countId === countId);
    if (!lines.length) throw new Error("Enter at least one physical count before completing.");
    const now = new Date().toISOString();
    const updatedLines = lines.map((line) => {
      const item = getItemById(line.itemId);
      const systemQuantity = getItemStockByLocation(line.itemId, line.locationId);
      const physicalQuantity = Number(line.physicalQuantity || 0);
      const unitCostAtCount = Number(line.unitCostAtCount ?? getBaseUnitCost(item));
      return {
        ...line,
        systemQuantity,
        physicalQuantity,
        unitCostAtCount,
        varianceQuantity: physicalQuantity - systemQuantity,
        varianceValue: (physicalQuantity - systemQuantity) * unitCostAtCount
      };
    });
    saveList("countLines", allLines.map((line) => updatedLines.find((value) => value.id === line.id) || line));

    const existingVariances = getVariances();
    const newVariances = [];
    updatedLines.filter((line) => Math.abs(line.varianceQuantity) > 1e-9).forEach((line) => {
      newVariances.push({
        id: nextId("VAR", [...existingVariances, ...newVariances]),
        countId,
        itemId: line.itemId,
        locationId: line.locationId,
        expectedQuantity: line.systemQuantity,
        physicalQuantity: line.physicalQuantity,
        varianceQuantity: line.varianceQuantity,
        varianceValue: line.varianceValue,
        status: "UNREVIEWED",
        reason: null,
        managerNotes: "",
        reviewedBy: null,
        reviewedAt: null
      });
    });
    saveList("variances", [...existingVariances, ...newVariances]);
    saveList("counts", getCounts().map((value) => value.id === countId ? { ...value, status: "COMPLETED", completedAt: now } : value));
    return getCounts().find((value) => value.id === countId);
  }

  function correctVariance(varianceId) {
    const variance = getVariances().find((value) => value.id === varianceId);
    if (!variance || variance.status === "ADJUSTED") throw new Error("Variance is already adjusted or missing.");
    const item = getItemById(variance.itemId);
    const locationId = variance.locationId || item?.defaultLocationId;
    if (!item || !locationId) throw new Error("Variance is missing item or location information.");
    const movementType = variance.varianceQuantity > 0 ? "COUNT_CORRECTION_IN" : "COUNT_CORRECTION_OUT";
    createInventoryMovement({
      itemId: item.id,
      locationId,
      quantity: Math.abs(variance.varianceQuantity),
      unitId: item.baseUnitId,
      movementType,
      reason: "Count correction",
      source: { type: "VARIANCE", id: variance.id }
    });
    const updated = {
      ...variance,
      status: "ADJUSTED",
      reviewedBy: localStorage.getItem("currentManager") || "Jordan Lee",
      reviewedAt: new Date().toISOString()
    };
    saveList("variances", getVariances().map((value) => value.id === varianceId ? updated : value));
    return updated;
  }

  window.InventoryService = {
    getItems, saveItems, getCategories, getLocations, getUnits, getConversions, getMovements, getCounts, getCountLines,
    getDeliveries, getDeliveryLines, getWasteRecords, getVariances, getVendors, getItemById, getLocationById, getUnitById,
    getPrimaryUnitId, getUnitFactor, convertToBaseUnit, convertBreakdownToBaseUnit, getStockBreakdown, formatStockBreakdown,
    getBaseUnitCost, getPurchaseUnitCost, getMovementDirection, getCalculationContext, getItemStock, getItemStockByLocation, getAllInventoryBalances,
    getStockStatus, createItem, updateItem, updateItemBaseCost, createInventoryMovement, transfer, createWaste, createCount,
    updateCountLine, completeCount, correctVariance
  };
  window.addEventListener?.("storage", invalidateContext);
})();
