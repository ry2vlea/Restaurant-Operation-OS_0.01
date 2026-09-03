(function () {
  const key = "productionBatches";
  const read = () => { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch (error) { return []; } };
  const save = (batches) => { localStorage.setItem(key, JSON.stringify(batches)); window.dispatchEvent(new CustomEvent("production:changed")); return batches; };
  const nextId = () => `PROD-${String(read().reduce((max, batch) => Math.max(max, Number((batch.id || "").replace("PROD-", "")) || 0), 0) + 1).padStart(6, "0")}`;

  function getBatches() { return read(); }

  function produce(values) {
    const recipe = RecipeService.getRecipeById(values.recipeId);
    if (!recipe || recipe.recipeType !== "PREP" || !recipe.producedInventoryItemId) throw new Error("Select a valid Prep Recipe with a produced Inventory Item.");
    const multiplier = Number(values.batchMultiplier || 1);
    if (!(multiplier > 0)) throw new Error("Batch multiplier must be greater than zero.");
    const actualYield = Number(values.actualYield);
    if (!(actualYield > 0)) throw new Error("Actual yield must be greater than zero.");
    const destinationLocationId = values.destinationLocationId || "LOC-PREP";
    if (!InventoryService.getLocationById(destinationLocationId)) throw new Error("Select a valid production destination.");

    if (values.idempotencyKey) {
      const existing = read().find((batch) => batch.idempotencyKey === values.idempotencyKey && batch.status === "COMPLETED");
      if (existing) return existing;
    }

    const cost = RecipeService.calculateRecipeCost(recipe.id);
    const ingredients = cost.lines.map((line) => ({ ...line, requiredBaseQuantity: Number(line.ingredient.baseQuantity) * multiplier }));
    ingredients.forEach((line) => {
      const sourceLocationId = line.item.defaultLocationId;
      const available = InventoryService.getItemStockByLocation(line.item.id, sourceLocationId);
      if (available + 1e-9 < line.requiredBaseQuantity) {
        throw new Error(`${line.item.name} is short in ${InventoryService.getLocationById(sourceLocationId)?.name || "its default location"}. Required ${InventoryService.formatStockBreakdown(line.item.id, line.requiredBaseQuantity)}, available ${InventoryService.formatStockBreakdown(line.item.id, available)}.`);
      }
    });

    const producedItem = InventoryService.getItemById(recipe.producedInventoryItemId);
    if (!producedItem) throw new Error("The produced Inventory Item no longer exists.");
    const actualYieldBase = InventoryService.convertToBaseUnit(producedItem.id, actualYield, recipe.yieldUnitId);
    if (!(actualYieldBase > 0)) throw new Error("Actual yield cannot be converted to the produced item's base unit.");

    const totalBatchCost = cost.totalCost * multiplier;
    const costPerYieldBaseUnit = totalBatchCost / actualYieldBase;
    const now = new Date().toISOString();
    const batch = {
      id: nextId(),
      idempotencyKey: values.idempotencyKey || null,
      recipeId: recipe.id,
      recipeVersion: recipe.version || 1,
      batchMultiplier: multiplier,
      expectedYield: Number(recipe.yieldQuantity) * multiplier,
      actualYield,
      actualYieldBase,
      yieldUnitId: recipe.yieldUnitId,
      destinationLocationId,
      manager: values.manager || localStorage.getItem("currentManager") || "Jordan Lee",
      totalBatchCost,
      costPerYieldBaseUnit,
      status: "COMPLETED",
      createdAt: now,
      completedAt: now,
      ingredientSnapshot: ingredients.map((line) => ({
        itemId: line.item.id,
        itemName: line.item.name,
        baseQuantity: line.requiredBaseQuantity,
        unitCost: InventoryService.getBaseUnitCost(line.item),
        cost: line.requiredBaseQuantity * InventoryService.getBaseUnitCost(line.item),
        sourceLocationId: line.item.defaultLocationId
      }))
    };

    // All validations happen above; only now write movements.
    ingredients.forEach((line) => InventoryService.createInventoryMovement({
      itemId: line.item.id,
      locationId: line.item.defaultLocationId,
      quantity: line.requiredBaseQuantity,
      unitId: line.item.baseUnitId,
      movementType: "PRODUCTION_CONSUME",
      reason: `Production ${batch.id}`,
      source: { type: "PRODUCTION", id: batch.id }
    }));

    InventoryService.createInventoryMovement({
      itemId: producedItem.id,
      locationId: destinationLocationId,
      quantity: actualYield,
      unitId: recipe.yieldUnitId,
      movementType: "PRODUCTION_CREATE",
      reason: `Production ${batch.id}`,
      source: { type: "PRODUCTION", id: batch.id },
      unitCostAtMovement: costPerYieldBaseUnit
    });

    InventoryService.updateItemBaseCost(producedItem.id, costPerYieldBaseUnit, { costSource: "PRODUCTION", costSourceId: batch.id });
    save([...read(), batch]);
    return batch;
  }

  window.ProductionService = { getBatches, produce };
})();
