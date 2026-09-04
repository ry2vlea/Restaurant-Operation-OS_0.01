(function () {
  const key = "menuSales";
  const read = () => { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch (error) { return []; } };
  const write = (value) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("menu-sales:changed")); return value; };

  function getSales(date) { return read().filter((sale) => !date || sale.date === date); }

  function saveSale(values) {
    if (!values.menuItemId || Number(values.quantitySold) < 0) throw new Error("Menu item and valid quantity are required.");
    const item = MenuService.getMenuItemById(values.menuItemId);
    if (!item) throw new Error("Menu item not found.");
    const recipe = RecipeService.getRecipeById(item.recipeId);
    if (!recipe) throw new Error("Menu item has no valid recipe.");
    const recipeCost = RecipeService.calculateRecipeCost(recipe.id);
    const ingredientSnapshot = RecipeService.resolveInventoryUsage(RecipeService.recipeTypeOf(recipe), recipe.id, 1).map((ingredient) => ({
      inventoryItemId: ingredient.itemId,
      baseQuantityPerServing: Number(ingredient.baseQuantity || 0)
    }));
    const now = new Date().toISOString();
    const sale = {
      id: `MSALE-${now.slice(0, 10).replaceAll("-", "")}-${Date.now()}`,
      date: values.date || now.slice(0, 10),
      menuItemId: item.id,
      quantitySold: Number(values.quantitySold),
      recipeIdAtSale: recipe.id,
      recipeVersionAtSale: recipe.version || 1,
      sellingPriceAtSale: Number(item.sellingPrice || 0),
      theoreticalUnitCostAtSale: recipeCost.unitCost,
      ingredientSnapshot,
      enteredBy: values.enteredBy || localStorage.getItem("currentManager") || "Jordan Lee",
      createdAt: now,
      updatedAt: now
    };
    write([...read(), sale]);
    return sale;
  }

  function calculateTheoreticalUsage(date) {
    performance.mark?.("theoretical-usage-calculate:start");
    const recipeContext = RecipeService.getCalculationContext();
    const inventoryContext = InventoryService.getCalculationContext();
    const totals = {};
    getSales(date).forEach((sale) => {
      const recipe = recipeContext.recipeById.get(sale.recipeIdAtSale);
      const snapshot = Array.isArray(sale.ingredientSnapshot) && sale.ingredientSnapshot.length
        ? sale.ingredientSnapshot
        : RecipeService.resolveInventoryUsage(RecipeService.recipeTypeOf(recipe), sale.recipeIdAtSale, 1).map((ingredient) => ({ inventoryItemId: ingredient.itemId, baseQuantityPerServing: Number(ingredient.baseQuantity || 0) }));
      snapshot.forEach((ingredient) => {
        totals[ingredient.inventoryItemId] = (totals[ingredient.inventoryItemId] || 0) + Number(ingredient.baseQuantityPerServing || 0) * Number(sale.quantitySold || 0);
      });
    });
    const result = Object.entries(totals).map(([itemId, baseQuantity]) => ({ item: inventoryContext.itemById.get(itemId) || null, itemId, baseQuantity }));
    performance.mark?.("theoretical-usage-calculate:end");
    performance.measure?.("theoretical-usage-calculate", "theoretical-usage-calculate:start", "theoretical-usage-calculate:end");
    return result;
  }

  function calculateSalesMetrics(startDate, endDate = startDate) {
    const totals = read().filter((sale) => (!startDate || sale.date >= startDate) && (!endDate || sale.date <= endDate)).reduce((total, sale) => {
      const item = MenuService.getMenuItemById(sale.menuItemId);
      const recipe = RecipeService.getRecipeById(sale.recipeIdAtSale || item?.recipeId);
      const quantity = Number(sale.quantitySold || 0);
      const sellingPrice = Number(sale.sellingPriceAtSale ?? item?.sellingPrice ?? 0);
      const unitCost = sale.theoreticalUnitCostAtSale != null ? Number(sale.theoreticalUnitCostAtSale) : RecipeService.calculateRecipeCost(recipe?.id).unitCost;
      total.unitsSold += quantity;
      total.revenue += quantity * sellingPrice;
      total.theoreticalCOGS += unitCost == null ? 0 : quantity * unitCost;
      return total;
    }, { unitsSold: 0, revenue: 0, theoreticalCOGS: 0, theoreticalFoodCostPercent: null });
    totals.theoreticalFoodCostPercent = totals.revenue > 0 ? totals.theoreticalCOGS / totals.revenue * 100 : null;
    return totals;
  }

  window.TheoreticalUsageService = { getSales, saveSale, calculateTheoreticalUsage, calculateSalesMetrics };
})();
