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
    const yieldQuantity = Number(recipe.yieldQuantity || 1);
    const ingredientSnapshot = RecipeService.getRecipeIngredients(recipe.id).map((ingredient) => ({
      inventoryItemId: ingredient.inventoryItemId,
      baseQuantityPerServing: Number(ingredient.baseQuantity || 0) / yieldQuantity
    }));
    const now = new Date().toISOString();
    const sale = {
      id: `MSALE-${now.slice(0, 10).replaceAll("-", "")}-${Date.now()}`,
      date: values.date || now.slice(0, 10),
      menuItemId: item.id,
      quantitySold: Number(values.quantitySold),
      recipeIdAtSale: recipe.id,
      recipeVersionAtSale: recipe.version || 1,
      ingredientSnapshot,
      enteredBy: values.enteredBy || localStorage.getItem("currentManager") || "Jordan Lee",
      createdAt: now,
      updatedAt: now
    };
    write([...read(), sale]);
    return sale;
  }

  function calculateTheoreticalUsage(date) {
    const totals = {};
    getSales(date).forEach((sale) => {
      const snapshot = Array.isArray(sale.ingredientSnapshot) && sale.ingredientSnapshot.length
        ? sale.ingredientSnapshot
        : (() => {
            const recipe = RecipeService.getRecipeById(sale.recipeIdAtSale);
            const yieldQuantity = Number(recipe?.yieldQuantity || 1);
            return RecipeService.getRecipeIngredients(sale.recipeIdAtSale).map((ingredient) => ({ inventoryItemId: ingredient.inventoryItemId, baseQuantityPerServing: Number(ingredient.baseQuantity || 0) / yieldQuantity }));
          })();
      snapshot.forEach((ingredient) => {
        totals[ingredient.inventoryItemId] = (totals[ingredient.inventoryItemId] || 0) + Number(ingredient.baseQuantityPerServing || 0) * Number(sale.quantitySold || 0);
      });
    });
    return Object.entries(totals).map(([itemId, baseQuantity]) => ({ item: InventoryService.getItemById(itemId), itemId, baseQuantity }));
  }

  window.TheoreticalUsageService = { getSales, saveSale, calculateTheoreticalUsage };
})();
