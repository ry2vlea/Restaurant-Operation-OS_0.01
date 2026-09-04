(function () {
  const recipeKey = "recipes";
  const ingredientKey = "recipeIngredients";
  const recipeTypes = {
    PREP_ITEM: "PREP_ITEM",
    MENU_PRODUCT: "MENU_PRODUCT",
    COMBO: "COMBO"
  };
  const sourceTypes = {
    INVENTORY_ITEM: "INVENTORY_ITEM",
    PREP_ITEM: "PREP_ITEM",
    MENU_PRODUCT: "MENU_PRODUCT",
    COMBO: "COMBO"
  };
  let contextCache = null;

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
    contextCache = null;
    return value;
  }

  function nextId(prefix, values) {
    const number = values.reduce((max, value) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(number + 1).padStart(6, "0")}`;
  }

  function normalizeType(type) {
    if (type === "PREP" || type === recipeTypes.PREP_ITEM) return recipeTypes.PREP_ITEM;
    if (type === "MENU" || type === recipeTypes.MENU_PRODUCT) return recipeTypes.MENU_PRODUCT;
    if (type === recipeTypes.COMBO) return recipeTypes.COMBO;
    return recipeTypes.MENU_PRODUCT;
  }

  function recipeTypeOf(recipe) {
    return normalizeType(recipe?.type || recipe?.recipeType);
  }

  function readRecipesRaw() {
    return read(recipeKey);
  }

  function getAllIngredients() {
    return read(ingredientKey);
  }

  function legacyComponents(recipe, ingredients) {
    return ingredients
      .filter((ingredient) => ingredient.recipeId === recipe.id)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((ingredient) => ({
        sourceType: sourceTypes.INVENTORY_ITEM,
        sourceId: ingredient.inventoryItemId,
        quantity: Number(ingredient.quantity || 0),
        unitId: ingredient.unitId || InventoryService.getItemById(ingredient.inventoryItemId)?.baseUnitId,
        baseQuantity: Number(ingredient.baseQuantity || 0),
        legacyIngredientId: ingredient.id,
        sortOrder: ingredient.sortOrder || 0
      }));
  }

  function normalizeComponent(component) {
    const sourceType = component.sourceType || sourceTypes.INVENTORY_ITEM;
    return {
      sourceType,
      sourceId: component.sourceId || component.inventoryItemId || component.recipeId || component.menuProductId,
      quantity: Number(component.quantity || 0),
      unitId: component.unitId || component.unit || null,
      baseQuantity: Number(component.baseQuantity || 0),
      sortOrder: component.sortOrder || 0
    };
  }

  function defaultTargetFoodCost() {
    return Number(window.SettingsService?.getSettings?.().targets?.foodCostPercent || localStorage.getItem("targetFoodCostPercent") || 30);
  }

  function normalizeRecipe(recipe, legacyIngredients) {
    const type = recipeTypeOf(recipe);
    const components = Array.isArray(recipe.components) && recipe.components.length
      ? recipe.components.map(normalizeComponent)
      : legacyComponents(recipe, legacyIngredients);
    return {
      ...recipe,
      type,
      recipeType: type,
      components,
      yieldQuantity: Number(recipe.yieldQuantity || 1),
      yieldUnitId: recipe.yieldUnitId || "UNIT-EA",
      sellingPrice: recipe.sellingPrice !== "" && recipe.sellingPrice != null ? Number(recipe.sellingPrice) : null,
      targetFoodCostPercent: recipe.targetFoodCostPercent !== "" && recipe.targetFoodCostPercent != null
        ? Number(recipe.targetFoodCostPercent)
        : defaultTargetFoodCost(),
      active: recipe.active !== false,
      version: Number(recipe.version || 1)
    };
  }

  function getCalculationContext() {
    if (contextCache) return contextCache;
    const legacyIngredients = getAllIngredients();
    const recipes = readRecipesRaw().map((recipe) => normalizeRecipe(recipe, legacyIngredients));
    const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    const componentsByRecipe = new Map(recipes.map((recipe) => [recipe.id, recipe.components || []]));
    const recipesByInventoryItem = new Map();
    recipes.forEach((recipe) => {
      (recipe.components || []).forEach((component) => {
        if (component.sourceType !== sourceTypes.INVENTORY_ITEM) return;
        if (!recipesByInventoryItem.has(component.sourceId)) recipesByInventoryItem.set(component.sourceId, new Set());
        recipesByInventoryItem.get(component.sourceId).add(recipe.id);
      });
    });
    contextCache = {
      recipes,
      ingredients: legacyIngredients,
      recipeById,
      componentsByRecipe,
      ingredientsByRecipe: componentsByRecipe,
      recipesByInventoryItem,
      costByRecipe: new Map(),
      usageByRequest: new Map()
    };
    return contextCache;
  }

  function getRecipes() {
    return getCalculationContext().recipes;
  }

  function getRecipeById(id) {
    return getCalculationContext().recipeById.get(id) || null;
  }

  function getRecipeIngredients(recipeId) {
    return [...(getCalculationContext().componentsByRecipe.get(recipeId) || [])];
  }

  function saveRecipes(recipes) {
    write(recipeKey, recipes);
    window.dispatchEvent(new CustomEvent("recipes:changed"));
    return recipes;
  }

  function saveIngredients(ingredients) {
    write(ingredientKey, ingredients);
    window.dispatchEvent(new CustomEvent("recipes:changed"));
    return ingredients;
  }

  function allowedSourceTypes(type) {
    if (type === recipeTypes.PREP_ITEM) return [sourceTypes.INVENTORY_ITEM];
    if (type === recipeTypes.COMBO) return [sourceTypes.MENU_PRODUCT, sourceTypes.INVENTORY_ITEM];
    return [sourceTypes.INVENTORY_ITEM, sourceTypes.PREP_ITEM];
  }

  function convertYieldQuantity(recipe, quantity, unitId) {
    const numeric = Number(quantity || 0);
    const from = unitId || recipe.yieldUnitId || "UNIT-EA";
    const to = recipe.yieldUnitId || from;
    if (from === to) return numeric;
    const factors = {
      "UNIT-LB": 16,
      "UNIT-OZ": 1,
      "UNIT-GAL": 128,
      "UNIT-QT": 32,
      "UNIT-FLOZ": 1
    };
    if (factors[from] && factors[to]) return numeric * factors[from] / factors[to];
    throw new Error(`No valid conversion from ${InventoryService.getUnitById(from)?.abbreviation || from} to ${InventoryService.getUnitById(to)?.abbreviation || to} exists for ${recipe.name}.`);
  }

  function inventoryComponentCost(component, issues) {
    const item = InventoryService.getItemById(component.sourceId);
    if (!item) throw new Error("Every Inventory Item component must reference a valid item.");
    const unitId = component.unitId || item.baseUnitId;
    const baseQuantity = InventoryService.convertToBaseUnit(item.id, Number(component.quantity), unitId);
    const baseUnitCost = InventoryService.getBaseUnitCost(item);
    if (!(baseUnitCost > 0)) issues.push({ type: "MISSING_COST", sourceType: sourceTypes.INVENTORY_ITEM, sourceId: item.id, name: item.name });
    return {
      component: { ...component, unitId, baseQuantity },
      item,
      label: item.name,
      quantity: Number(component.quantity),
      unitId,
      baseQuantity,
      unitCost: baseUnitCost,
      cost: baseQuantity * baseUnitCost,
      missingCost: !(baseUnitCost > 0)
    };
  }

  function calculateSuggestedPrice(cost, targetFoodCostPercent) {
    const target = Number(targetFoodCostPercent || 0);
    return target > 0 && cost != null ? Number(cost) / (target / 100) : null;
  }

  function calculateCost(recipeId, options = {}) {
    const context = getCalculationContext();
    const cache = options.cache || context.costByRecipe;
    if (cache.has(recipeId)) return cache.get(recipeId);
    const recipe = getRecipeById(recipeId);
    if (!recipe) return { recipe: null, lines: [], totalCost: null, incomplete: true, missingCosts: [], errors: ["Recipe not found."] };
    if (options.expectedType && recipeTypeOf(recipe) !== options.expectedType) {
      throw new Error(`${recipe.name} is not a valid ${options.expectedType.replaceAll("_", " ")} component.`);
    }
    const stack = options.stack || [];
    if (stack.includes(recipeId)) throw new Error(`Circular recipe dependency detected: ${[...stack, recipeId].join(" -> ")}`);
    const nextStack = [...stack, recipeId];
    const issues = [];
    const type = recipeTypeOf(recipe);
    const lines = (recipe.components || []).map((component) => {
      if (!allowedSourceTypes(type).includes(component.sourceType)) {
        throw new Error(`${recipe.name} cannot use ${component.sourceType.replaceAll("_", " ")} components.`);
      }
      if (component.sourceType === sourceTypes.INVENTORY_ITEM) return inventoryComponentCost(component, issues);
      const child = getRecipeById(component.sourceId);
      if (!child) throw new Error("Recipe component not found.");
      const childCost = calculateCost(child.id, { cache, stack: nextStack, expectedType: component.sourceType });
      const quantity = Number(component.quantity || 0);
      let cost = null;
      if (component.sourceType === sourceTypes.PREP_ITEM) {
        const convertedQuantity = convertYieldQuantity(child, quantity, component.unitId || child.yieldUnitId);
        cost = childCost.costPerYieldUnit == null ? null : convertedQuantity * childCost.costPerYieldUnit;
      } else {
        cost = childCost.unitCost == null ? null : quantity * childCost.unitCost;
      }
      issues.push(...(childCost.missingCosts || []));
      return {
        component,
        recipe: child,
        label: child.name,
        quantity,
        unitId: component.unitId || child.yieldUnitId || "UNIT-EA",
        unitCost: childCost.unitCost,
        cost,
        missingCost: childCost.incomplete,
        nested: childCost
      };
    });
    const missingCosts = issues.filter((issue, index, all) => all.findIndex((value) => value.sourceId === issue.sourceId) === index);
    const incomplete = missingCosts.length > 0 || lines.some((line) => line.cost == null);
    const totalCost = incomplete ? null : lines.reduce((total, line) => total + Number(line.cost || 0), 0);
    const costPerYieldUnit = type === recipeTypes.PREP_ITEM && totalCost != null && Number(recipe.yieldQuantity) > 0
      ? totalCost / Number(recipe.yieldQuantity)
      : null;
    const unitCost = type === recipeTypes.PREP_ITEM ? costPerYieldUnit : totalCost;
    const sellingPrice = Number(recipe.sellingPrice || 0);
    const foodCostPercent = totalCost != null && sellingPrice > 0 ? totalCost / sellingPrice * 100 : null;
    const result = {
      recipe,
      lines,
      totalCost,
      unitCost,
      costPerYieldUnit,
      costPerYieldBaseUnit: costPerYieldUnit,
      yieldBaseQuantity: Number(recipe.yieldQuantity || 0),
      foodCostPercent,
      contribution: totalCost != null ? sellingPrice - totalCost : null,
      suggestedSellingPrice: calculateSuggestedPrice(totalCost, recipe.targetFoodCostPercent),
      targetFoodCostPercent: recipe.targetFoodCostPercent,
      incomplete,
      missingCosts,
      errors: []
    };
    cache.set(recipeId, result);
    return result;
  }

  function resolveComponentCost(sourceType, sourceId, options = {}) {
    if (sourceType === sourceTypes.INVENTORY_ITEM) {
      return inventoryComponentCost({ sourceType, sourceId, quantity: 1, unitId: InventoryService.getItemById(sourceId)?.baseUnitId }, []);
    }
    return calculateCost(sourceId, { cache: options.cache || new Map(), stack: options.stack || [], expectedType: sourceType });
  }

  function resolveInventoryUsage(sourceType, sourceId, quantity = 1, options = {}) {
    const cache = options.cache || getCalculationContext().usageByRequest;
    const key = `${sourceType}|${sourceId}|${quantity}`;
    if (cache.has(key)) return cache.get(key).map((entry) => ({ ...entry }));
    const totals = new Map();

    function add(itemId, baseQuantity) {
      totals.set(itemId, (totals.get(itemId) || 0) + Number(baseQuantity || 0));
    }

    function walk(type, id, multiplier, unitId, path) {
      if (type === sourceTypes.INVENTORY_ITEM) {
        const item = InventoryService.getItemById(id);
        if (!item) throw new Error("Inventory component not found.");
        add(item.id, InventoryService.convertToBaseUnit(item.id, multiplier, unitId || item.baseUnitId));
        return;
      }
      const recipe = getRecipeById(id);
      if (!recipe) throw new Error("Recipe component not found.");
      if (path.includes(recipe.id)) throw new Error(`Circular recipe dependency detected: ${[...path, recipe.id].join(" -> ")}`);
      const recipeType = recipeTypeOf(recipe);
      const recipeMultiplier = recipeType === recipeTypes.PREP_ITEM
        ? convertYieldQuantity(recipe, multiplier, unitId || recipe.yieldUnitId) / Number(recipe.yieldQuantity || 1)
        : multiplier;
      (recipe.components || []).forEach((component) => {
        if (!allowedSourceTypes(recipeType).includes(component.sourceType)) {
          throw new Error(`${recipe.name} cannot use ${component.sourceType.replaceAll("_", " ")} components.`);
        }
        walk(component.sourceType, component.sourceId, Number(component.quantity || 0) * recipeMultiplier, component.unitId, [...path, recipe.id]);
      });
    }

    walk(sourceType, sourceId, Number(quantity || 0), null, options.stack || []);
    const result = [...totals.entries()].map(([itemId, baseQuantity]) => ({ itemId, item: InventoryService.getItemById(itemId), baseQuantity }));
    cache.set(key, result);
    return result.map((entry) => ({ ...entry }));
  }

  function validateRecipe(values, components, existingId = null) {
    const type = normalizeType(values.type || values.recipeType);
    if (!values.name?.trim()) throw new Error("Recipe name is required.");
    if (!Object.values(recipeTypes).includes(type)) throw new Error("Select a valid recipe type.");
    if (!Array.isArray(components) || !components.length) throw new Error("Add at least one component.");
    if (type === recipeTypes.PREP_ITEM && !(Number(values.yieldQuantity || 0) > 0)) throw new Error("Prep Item yield must be greater than zero.");
    const allowed = allowedSourceTypes(type);
    components.forEach((component) => {
      if (!allowed.includes(component.sourceType)) throw new Error(`${type.replaceAll("_", " ")} cannot use ${component.sourceType.replaceAll("_", " ")} components.`);
      if (!(Number(component.quantity) > 0)) throw new Error("Component quantities must be greater than zero.");
      if (component.sourceType === sourceTypes.INVENTORY_ITEM) {
        const item = InventoryService.getItemById(component.sourceId || component.inventoryItemId);
        if (!item) throw new Error("Every Inventory Item component must reference a valid item.");
        InventoryService.convertToBaseUnit(item.id, Number(component.quantity), component.unitId || component.unit || item.baseUnitId);
      } else {
        const recipe = getRecipeById(component.sourceId);
        if (!recipe) throw new Error("Every recipe component must reference a valid recipe.");
        if (recipe.id === existingId) throw new Error("A recipe cannot include itself.");
        if (recipeTypeOf(recipe) !== component.sourceType) throw new Error("Recipe component type does not match the selected source.");
        if (existingId && reachesRecipe(recipe.id, existingId, new Set())) {
          throw new Error(`Circular recipe dependency detected: ${recipe.name} already depends on this recipe.`);
        }
      }
    });
  }

  function reachesRecipe(sourceId, targetId, seen) {
    if (sourceId === targetId) return true;
    if (seen.has(sourceId)) return false;
    seen.add(sourceId);
    const source = getRecipeById(sourceId);
    return (source?.components || []).some((component) => component.sourceType !== sourceTypes.INVENTORY_ITEM && reachesRecipe(component.sourceId, targetId, seen));
  }

  function normalizeInputComponents(components) {
    return components.map((component, index) => {
      const sourceType = component.sourceType || sourceTypes.INVENTORY_ITEM;
      const sourceId = component.sourceId || component.inventoryItemId;
      const normalized = { sourceType, sourceId, quantity: Number(component.quantity), unitId: component.unitId || component.unit || null, sortOrder: index + 1 };
      if (sourceType === sourceTypes.INVENTORY_ITEM) {
        const item = InventoryService.getItemById(sourceId);
        normalized.unitId = normalized.unitId || item?.baseUnitId;
        normalized.baseQuantity = InventoryService.convertToBaseUnit(sourceId, normalized.quantity, normalized.unitId);
      }
      return normalized;
    });
  }

  function createRecipe(values, components) {
    const type = normalizeType(values.type || values.recipeType);
    const normalizedComponents = normalizeInputComponents(components || []);
    validateRecipe({ ...values, type }, normalizedComponents);
    const now = new Date().toISOString();
    const recipe = {
      id: nextId("REC", readRecipesRaw()),
      name: values.name.trim(),
      type,
      recipeType: type,
      categoryId: values.categoryId || "RCAT-OTHER",
      components: normalizedComponents,
      yieldQuantity: type === recipeTypes.PREP_ITEM ? Number(values.yieldQuantity || 1) : 1,
      yieldUnitId: values.yieldUnitId || "UNIT-EA",
      sellingPrice: type !== recipeTypes.PREP_ITEM && values.sellingPrice !== "" && values.sellingPrice != null ? Number(values.sellingPrice) : null,
      targetFoodCostPercent: values.targetFoodCostPercent !== "" && values.targetFoodCostPercent != null ? Number(values.targetFoodCostPercent) : null,
      linkedMenuItemId: values.linkedMenuItemId || null,
      producedInventoryItemId: values.producedInventoryItemId || null,
      instructions: values.instructions || "",
      notes: values.notes || "",
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    saveRecipes([...readRecipesRaw(), recipe]);
    return recipe;
  }

  function updateRecipe(id, values, components) {
    const recipe = getRecipeById(id);
    if (!recipe) throw new Error("Recipe not found.");
    const type = normalizeType(values.type || values.recipeType || recipe.type);
    const normalizedComponents = components ? normalizeInputComponents(components) : recipe.components;
    validateRecipe({ ...recipe, ...values, type }, normalizedComponents, id);
    const updated = {
      ...recipe,
      ...values,
      name: (values.name ?? recipe.name).trim(),
      type,
      recipeType: type,
      components: normalizedComponents,
      yieldQuantity: type === recipeTypes.PREP_ITEM ? Number(values.yieldQuantity ?? recipe.yieldQuantity) : 1,
      sellingPrice: type !== recipeTypes.PREP_ITEM && values.sellingPrice !== "" ? Number(values.sellingPrice ?? recipe.sellingPrice) : null,
      targetFoodCostPercent: values.targetFoodCostPercent !== "" && values.targetFoodCostPercent != null ? Number(values.targetFoodCostPercent) : recipe.targetFoodCostPercent,
      updatedAt: new Date().toISOString(),
      version: Number(recipe.version || 1) + 1
    };
    saveRecipes(readRecipesRaw().map((value) => value.id === id ? updated : value));
    return getRecipeById(id);
  }

  function deactivateRecipe(id) {
    const recipe = getRecipeById(id);
    if (!recipe) throw new Error("Recipe not found.");
    const updated = { ...recipe, active: false, updatedAt: new Date().toISOString() };
    saveRecipes(readRecipesRaw().map((value) => value.id === id ? updated : value));
    return updated;
  }

  function calculateRecipeCost(recipeId) {
    return calculateCost(recipeId);
  }

  window.RecipeService = {
    recipeTypes,
    sourceTypes,
    getRecipes,
    getRecipeIngredients,
    getRecipeById,
    saveRecipes,
    saveIngredients,
    createRecipe,
    updateRecipe,
    deactivateRecipe,
    calculateCost,
    calculateRecipeCost,
    resolveComponentCost,
    resolveInventoryUsage,
    calculateSuggestedPrice,
    validateRecipe,
    getCalculationContext,
    recipeTypeOf,
    allowedSourceTypes
  };
  window.addEventListener?.("inventory:changed", () => { contextCache = null; });
  window.addEventListener?.("storage", () => { contextCache = null; });
})();
