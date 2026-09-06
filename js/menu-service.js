(function () {
  const key = "menuItems";
  let contextCache = null;
  const read = () => { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch (error) { return []; } };
  const save = (items) => { localStorage.setItem(key, JSON.stringify(items)); contextCache = null; window.dispatchEvent(new CustomEvent("menu:changed")); return items; };
  const nextId = () => `MENU-${String(read().reduce((max, item) => Math.max(max, Number((item.id || "").replace("MENU-", "")) || 0), 0) + 1).padStart(6, "0")}`;

  function getMenuItems() { return read().filter((item) => !item.deletedAt); }
  function getCalculationContext() {
    if (contextCache) return contextCache;
    const items = getMenuItems();
    // Historical lookups retain deleted records; working lists exclude them.
    const itemById = new Map(read().map((item) => [item.id, item]));
    const itemsByRecipe = new Map();
    items.forEach((item) => {
      if (!itemsByRecipe.has(item.recipeId)) itemsByRecipe.set(item.recipeId, []);
      itemsByRecipe.get(item.recipeId).push(item);
    });
    contextCache = { items, itemById, itemsByRecipe, metricsByItem: new Map(), availabilityByItem: new Map() };
    return contextCache;
  }
  function getMenuItemById(id) { return getCalculationContext().itemById.get(id) || null; }

  function targetFoodCost(value) {
    if (value === undefined || value === null || value === "") return null;
    const target = Number(value);
    if (!Number.isFinite(target) || target <= 0 || target > 100) throw new Error("Target food cost must be greater than zero and at most 100%.");
    return target;
  }

  function calculateSuggestedPrice(cost, target) {
    return cost != null && Number(target) > 0 ? Number(cost) / (Number(target) / 100) : null;
  }

  function normalizeMenuItem(values, existing = {}) {
    const merged = { ...existing, ...values };
    const recipe = RecipeService.getRecipeById(merged.recipeId);
    const sellingPrice = Number(merged.sellingPrice);
    const limitedThreshold = Number(merged.limitedThreshold ?? 10);
    if (typeof merged.name !== "string" || !merged.name.trim()) throw new Error("Menu item name is required.");
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) throw new Error("Selling price must be a finite number greater than zero.");
    if (!Number.isFinite(limitedThreshold) || limitedThreshold < 0) throw new Error("Limited threshold must be a non-negative number.");
    if (!recipe || !["MENU_PRODUCT", "COMBO"].includes(recipe.type)) throw new Error("Select a valid Menu Product or Combo.");
    if (recipe.active === false && recipe.id !== existing.recipeId) throw new Error("Select an active recipe.");
    return { name: merged.name.trim(), sku: String(merged.sku || "").trim(),
      categoryId: merged.categoryId || "MCAT-OTHER", recipeId: recipe.id, sellingPrice,
      targetFoodCostPercent: targetFoodCost(merged.targetFoodCostPercent), limitedThreshold,
      active: merged.active !== false, description: String(merged.description || ""),
      status: merged.status === "MANUALLY_UNAVAILABLE" ? "MANUALLY_UNAVAILABLE" : "AVAILABLE",
      manualUnavailableReason: merged.status === "MANUALLY_UNAVAILABLE" ? String(merged.manualUnavailableReason || "Manual management override") : null };
  }

  function createMenuItem(values) {
    const normalized = normalizeMenuItem(values);
    const now = new Date().toISOString();
    const item = { ...normalized, id: nextId(), createdAt: now, updatedAt: now };
    save([...read(), item]);
    return item;
  }

  function updateMenuItem(id, values) {
    const item = getMenuItemById(id);
    if (!item || item.deletedAt) throw new Error("Menu item not found.");
    const updated = { ...item, ...normalizeMenuItem(values, item), updatedAt: new Date().toISOString() };
    save(read().map((value) => value.id === id ? updated : value));
    return updated;
  }

  function deleteMenuItem(id) {
    const item = getMenuItemById(id);
    if (!item || item.deletedAt) throw new Error("Menu item not found.");
    const now = new Date().toISOString();
    const deleted = { ...item, active: false, deletedAt: now, updatedAt: now };
    save(read().map((value) => value.id === id ? deleted : value));
    return deleted;
  }

  function setManualAvailability(id, unavailable, reason = "") {
    const item = getMenuItemById(id);
    if (!item || item.deletedAt) throw new Error("Menu item not found.");
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
    const recipe = RecipeService.getRecipeById(menuItem?.recipeId);
    if (!menuItem || menuItem.active === false || menuItem.deletedAt || !recipe || recipe.active === false || !["MENU_PRODUCT", "COMBO"].includes(RecipeService.recipeTypeOf(recipe))) return { servings: 0, status: "UNAVAILABLE", limitingIngredient: null, ingredientAvailability: [] };
    let usage = [];
    try {
      usage = RecipeService.resolveInventoryUsage(RecipeService.recipeTypeOf(recipe), recipe.id, 1);
    } catch (error) {
      return { servings: 0, status: "UNAVAILABLE", limitingIngredient: null, ingredientAvailability: [], error: error.message };
    }
    const availability = usage.map((ingredient) => {
      const stock = inventoryContext.balances.byItem.get(ingredient.itemId) || 0;
      const perServingBaseQuantity = Number(ingredient.baseQuantity || 0);
      const servings = perServingBaseQuantity > 0 ? Math.floor((stock + 1e-9) / perServingBaseQuantity) : 0;
      return { ingredient, item: inventoryContext.itemById.get(ingredient.itemId) || null, stock, perServingBaseQuantity, servings };
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
    const recipe = RecipeService.getRecipeById(menuItem.recipeId);
    let recipeCost;
    try { recipeCost = RecipeService.calculateRecipeCost(menuItem.recipeId); }
    catch (error) { recipeCost = { incomplete: true, unitCost: null, errors: [error.message] }; }
    const cost = recipeCost.incomplete ? null : recipeCost.unitCost;
    const availability = calculateAvailability(menuItem);
    const target = menuItem.targetFoodCostPercent ?? Number(window.SettingsService?.getSettings?.().targets?.foodCostPercent || localStorage.getItem("targetFoodCostPercent") || 30);
    const result = {
      ...availability,
      cost,
      incomplete: recipeCost.incomplete,
      targetFoodCostPercent: target,
      suggestedSellingPrice: calculateSuggestedPrice(cost, target),
      recipeType: recipe ? RecipeService.recipeTypeOf(recipe) : null,
      foodCostPercent: cost != null && menuItem.sellingPrice > 0 ? cost / menuItem.sellingPrice * 100 : null,
      contribution: cost != null ? Number(menuItem.sellingPrice || 0) - cost : null
    };
    if (menuItem.id) context.metricsByItem.set(menuItem.id, result);
    return result;
  }

  function getMenuRows() {
    return getCalculationContext().items.map((item) => ({ item, metric: calculateMenuMetrics(item) }));
  }

  window.MenuService = { getMenuItems, getMenuItemById, getCalculationContext, getMenuRows, createMenuItem, updateMenuItem, deleteMenuItem, setManualAvailability, calculateAvailability, calculateMenuMetrics, calculateSuggestedPrice };
  window.addEventListener?.("inventory:changed", () => { contextCache = null; });
  window.addEventListener?.("recipes:changed", () => { contextCache = null; });
  window.addEventListener?.("settings:changed", () => { contextCache = null; });
  window.addEventListener?.("storage", () => { contextCache = null; });
})();
