(function () {
  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function indexBy(values, key) {
    return new Map(values.map((value) => [value[key], value]));
  }

  function groupBy(values, key) {
    const map = new Map();
    values.forEach((value) => {
      const id = typeof key === "function" ? key(value) : value[key];
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(value);
    });
    return map;
  }

  function build() {
    const inventoryContext = window.InventoryService?.getCalculationContext?.();
    const recipeContext = window.RecipeService?.getCalculationContext?.();
    const menuContext = window.MenuService?.getCalculationContext?.();
    const inventoryItems = inventoryContext?.items || readArray("inventoryItems");
    const movements = inventoryContext?.movements || readArray("inventoryMovements");
    const recipes = recipeContext?.recipes || readArray("recipes");
    const recipeIngredients = recipeContext?.ingredients || readArray("recipeIngredients");
    const menuItems = menuContext?.items || readArray("menuItems");
    const countLines = readArray("inventoryCountLines");
    const counts = readArray("inventoryCounts");
    const context = {
      inventoryItems,
      movements,
      counts,
      countLines,
      deliveries: readArray("deliveries"),
      deliveryLines: readArray("deliveryLines"),
      waste: readArray("wasteRecords"),
      recipes,
      recipeIngredients,
      production: readArray("productionBatches"),
      menuItems,
      menuSales: readArray("menuSales"),
      issues: readArray("issues"),
      tasks: readArray("tasks"),
      shifts: readArray("shifts"),
      handovers: readArray("handovers"),
      dailyReports: readArray("dailyReports"),
      businessPerformance: readArray("businessPerformance"),
      activity: readArray("activityLog"),
      purchaseOrders: readArray("purchaseOrders"),
      purchaseOrderLines: readArray("purchaseOrderLines"),
      equipment: readArray("equipment"),
      maintenance: readArray("maintenanceRecords"),
      team: readArray("teamMembers"),
      sops: readArray("sops")
    };
    context.itemById = inventoryContext?.itemById || indexBy(inventoryItems, "id");
    context.movementsByItem = inventoryContext?.movementsByItem || groupBy(movements, "itemId");
    context.countLinesByItem = groupBy(countLines, "itemId");
    context.recipeById = recipeContext?.recipeById || indexBy(recipes, "id");
    context.ingredientsByRecipe = recipeContext?.ingredientsByRecipe || groupBy(recipeIngredients, "recipeId");
    context.menuItemById = menuContext?.itemById || indexBy(menuItems, "id");
    return context;
  }

  window.AnalyticsContext = { build, readArray, indexBy, groupBy };
})();
