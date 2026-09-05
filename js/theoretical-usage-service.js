(function () {
  // Calculation only: sales persistence belongs to SalesService.
  function calculateForDate(date, endDate = date) {
    const totals = new Map();
    SalesService.getSales(date, endDate).forEach((sale) => {
      let snapshot = sale.ingredientSnapshot;
      if (!Array.isArray(snapshot)) {
        const recipeId = sale.recipeIdAtSale || MenuService.getMenuItemById(sale.menuItemId)?.recipeId;
        const recipe = RecipeService.getRecipeById(recipeId);
        // Legacy records can only resolve the recipe that is available now.
        // Surface missing/circular recipes rather than silently undercount usage.
        snapshot = RecipeService.resolveInventoryUsage(RecipeService.recipeTypeOf(recipe), recipeId, 1)
          .map((ingredient) => ({ inventoryItemId: ingredient.itemId, baseQuantityPerServing: ingredient.baseQuantity }));
      }
      snapshot.forEach((ingredient) => {
        const id = ingredient.inventoryItemId;
        totals.set(id, (totals.get(id) || 0) + Number(ingredient.baseQuantityPerServing || 0) * Number(sale.quantitySold || 0));
      });
    });
    return [...totals].map(([inventoryItemId, quantityUsed]) => {
      const item = InventoryService.getItemById(inventoryItemId);
      return { inventoryItemId, quantityUsed,
        theoreticalCost: quantityUsed * InventoryService.getBaseUnitCost(item),
        // Keep existing report consumers compatible.
        item, itemId: inventoryItemId, baseQuantity: quantityUsed };
    });
  }

  window.TheoreticalUsageService = {
    calculateForDate,
    calculateTheoreticalUsage: calculateForDate
  };
})();
