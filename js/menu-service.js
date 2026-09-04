(function () {
  const key = "menuItems";
  let contextCache = null;
  const read = () => { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch (error) { return []; } };
  const save = (items) => { localStorage.setItem(key, JSON.stringify(items)); contextCache = null; window.dispatchEvent(new CustomEvent("menu:changed")); return items; };
  const nextId = () => `MENU-${String(read().reduce((max, item) => Math.max(max, Number((item.id || "").replace("MENU-", "")) || 0), 0) + 1).padStart(6, "0")}`;

  function getMenuItems() { return read(); }
  function getCalculationContext() {
    if (contextCache) return contextCache;
    const items = getMenuItems();
    const itemById = new Map(items.map((item) => [item.id, item]));
    const itemsByRecipe = new Map();
    items.forEach((item) => {
      if (!itemsByRecipe.has(item.recipeId)) itemsByRecipe.set(item.recipeId, []);
      itemsByRecipe.get(item.recipeId).push(item);
    });
    contextCache = { items, itemById, itemsByRecipe, metricsByItem: new Map(), availabilityByItem: new Map() };
    return contextCache;
  }
  function getMenuItemById(id) { return getCalculationContext().itemById.get(id) || null; }

  function createMenuItem(values) {
    const recipe = RecipeService.getRecipeById(values.recipeId);
    if (!values.name?.trim() || !(Number(values.sellingPrice) > 0) || !recipe) throw new Error("Name, valid Menu Recipe and selling price are required.");
    if (recipe.recipeType !== "MENU") throw new Error("Menu Items must link to a Menu Recipe.");
    const now = new Date().toISOString();
    const item = {
      id: nextId(),
      name: values.name.trim(),
      sku: values.sku || "",
      categoryId: values.categoryId || "MCAT-OTHER",
      recipeId: recipe.id,
      sellingPrice: Number(values.sellingPrice),
      status: "AVAILABLE",
      manualUnavailableReason: null,
      active: true,
      description: values.description || "",
      limitedThreshold: Math.max(0, Number(values.limitedThreshold || 10)),
      createdAt: now,
      updatedAt: now
    };
    save([...read(), item]);
    return item;
  }

  function updateMenuItem(id, values) {
    const item = getMenuItemById(id);
    if (!item) throw new Error("Menu item not found.");
    const recipeId = values.recipeId || item.recipeId;
    const recipe = RecipeService.getRecipeById(recipeId);
    if (!recipe || recipe.recipeType !== "MENU") throw new Error("Select a valid Menu Recipe.");
    const updated = {
      ...item,
      ...values,
      recipeId,
      sellingPrice: Number(values.sellingPrice ?? item.sellingPrice),
      limitedThreshold: Number(values.limitedThreshold ?? item.limitedThreshold),
      updatedAt: new Date().toISOString()
    };
    save(read().map((value) => value.id === id ? updated : value));
    return updated;
  }

  function setManualAvailability(id, unavailable, reason = "") {
    const item = getMenuItemById(id);
    if (!item) throw new Error("Menu item not found.");
    const updated = {
      ...item,
      status: unavailable ? "MANUALLY_UNAVAILABLE" : "AVAILABLE",
      manualUnavailableReason: unavailable ? (reason || "Manual management override") : null,
      updatedAt: new Date().toISOString()
    };
    save(read().map((value) => value.id === id ? updated : value));
    return updated;
  }

  function calculateAvailability(menuItem) {
    const context = getCalculationContext();
    if (menuItem?.id && context.availabilityByItem.has(menuItem.id)) return context.availabilityByItem.get(menuItem.id);
    const inventoryContext = InventoryService.getCalculationContext();
    const recipeContext = RecipeService.getCalculationContext();
    const recipe = RecipeService.getRecipeById(menuItem?.recipeId);
    if (!menuItem || !recipe || recipe.recipeType !== "MENU") return { servings: 0, status: "UNAVAILABLE", limitingIngredient: null, ingredientAvailability: [] };
    const yieldQuantity = Number(recipe.yieldQuantity || 1);
    const ingredients = recipeContext.ingredientsByRecipe.get(recipe.id) || [];
    const availability = ingredients.map((ingredient) => {
      const stock = inventoryContext.balances.byItem.get(ingredient.inventoryItemId) || 0;
      const perServingBaseQuantity = Number(ingredient.baseQuantity || 0) / yieldQuantity;
      const servings = perServingBaseQuantity > 0 ? Math.floor((stock + 1e-9) / perServingBaseQuantity) : 0;
      return { ingredient, item: inventoryContext.itemById.get(ingredient.inventoryItemId) || null, stock, perServingBaseQuantity, servings };
    }).sort((a, b) => a.servings - b.servings);
    const limiting = availability[0] || null;
    const servings = limiting?.servings ?? 0;
    const status = menuItem.status === "MANUALLY_UNAVAILABLE"
      ? "MANUALLY_UNAVAILABLE"
      : servings <= 0 ? "UNAVAILABLE"
      : servings < Number(menuItem.limitedThreshold || 0) ? "LIMITED"
      : "AVAILABLE";
    const result = { servings, status, limitingIngredient: limiting?.item || null, ingredientAvailability: availability };
    if (menuItem.id) context.availabilityByItem.set(menuItem.id, result);
    return result;
  }

  function calculateMenuMetrics(menuItem) {
    const context = getCalculationContext();
    if (menuItem?.id && context.metricsByItem.has(menuItem.id)) return context.metricsByItem.get(menuItem.id);
    const recipeCost = RecipeService.calculateRecipeCost(menuItem.recipeId);
    const cost = recipeCost.costPerYieldUnit;
    const availability = calculateAvailability(menuItem);
    const result = {
      ...availability,
      cost,
      foodCostPercent: menuItem.sellingPrice > 0 ? cost / menuItem.sellingPrice * 100 : null,
      contribution: Number(menuItem.sellingPrice || 0) - cost
    };
    if (menuItem.id) context.metricsByItem.set(menuItem.id, result);
    return result;
  }

  function getMenuRows() {
    return getCalculationContext().items.map((item) => ({ item, metric: calculateMenuMetrics(item) }));
  }

  window.MenuService = { getMenuItems, getMenuItemById, getCalculationContext, getMenuRows, createMenuItem, updateMenuItem, setManualAvailability, calculateAvailability, calculateMenuMetrics };
  window.addEventListener?.("inventory:changed", () => { contextCache = null; });
  window.addEventListener?.("recipes:changed", () => { contextCache = null; });
  window.addEventListener?.("storage", () => { contextCache = null; });
})();
