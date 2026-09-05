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
    return type || recipeTypes.MENU_PRODUCT;
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
    const sourceType = component.sourceType || component.componentType || sourceTypes.INVENTORY_ITEM;
    return {
      sourceType,
      sourceId: component.sourceId || component.componentId || component.inventoryItemId || component.recipeId || component.menuProductId,
      quantity: Number(component.quantity ?? 0),
      unitId: component.unitId || component.unit || null,
      baseQuantity: Number(component.baseQuantity || 0),
      sortOrder: component.sortOrder || 0
    };
  }

  function normalizeRecipe(recipe, legacyIngredients = []) {
    const type = recipeTypeOf(recipe);
    const components = Array.isArray(recipe.components)
      ? recipe.components.map(normalizeComponent)
      : legacyComponents(recipe, legacyIngredients);
    return {
      ...recipe,
      type,
      recipeType: type,
      components,
      yieldQuantity: Number(recipe.yieldQuantity ?? 1),
      yieldUnitId: recipe.yieldUnitId || recipe.yieldUnit || "UNIT-EA",
      producedInventoryItemId: recipe.producedInventoryItemId || null,
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
    return getCalculationContext().recipes.map((recipe) => structuredClone(recipe));
  }

  function getRecipeById(id) {
    const recipe = getCalculationContext().recipeById.get(id);
    return recipe ? structuredClone(recipe) : null;
  }

  function getRecipeIngredients(recipeId) {
    return structuredClone(getCalculationContext().componentsByRecipe.get(recipeId) || []);
  }

  function saveRecipes(recipes) {
    write(recipeKey, recipes);
    window.dispatchEvent(new CustomEvent("recipes:changed"));
    return recipes;
  }

  function allowedSourceTypes(type) {
    if (type === recipeTypes.PREP_ITEM) return [sourceTypes.INVENTORY_ITEM];
    if (type === recipeTypes.COMBO) return [sourceTypes.MENU_PRODUCT, sourceTypes.INVENTORY_ITEM];
    if (type === recipeTypes.MENU_PRODUCT) return [sourceTypes.INVENTORY_ITEM, sourceTypes.PREP_ITEM];
    throw new Error("Select a valid recipe type.");
  }

  function convertYieldQuantity(recipe, quantity, unitId) {
    const numeric = Number(quantity ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error("Yield quantity must be finite and non-negative.");
    const from = unitId || recipe.yieldUnitId || "UNIT-EA";
    const to = recipe.yieldUnitId || from;
    if (!InventoryService.getUnitById(from) || !InventoryService.getUnitById(to)) throw new Error("Invalid recipe yield unit.");
    if (from === to) return numeric;
    // Item-specific conversion is authoritative for tracked production.
    if (recipe.producedInventoryItemId) {
      const fromFactor = InventoryService.getUnitFactor(recipe.producedInventoryItemId, from);
      const toFactor = InventoryService.getUnitFactor(recipe.producedInventoryItemId, to);
      if (fromFactor > 0 && toFactor > 0) return numeric * fromFactor / toFactor;
    }
    const factors = {
      "UNIT-LB": 16,
      "UNIT-OZ": 1,
      "UNIT-GAL": 128,
      "UNIT-QT": 32,
      "UNIT-FLOZ": 1
    };
    // Preserve legacy OZ-as-fluid-ounce recipes (GAL/QT/OZ), but never infer LB-to-volume density.
    const volume = ["UNIT-GAL", "UNIT-QT", "UNIT-FLOZ"];
    const crossesMassVolume = (from === "UNIT-LB" && volume.includes(to)) || (to === "UNIT-LB" && volume.includes(from));
    if (!crossesMassVolume && factors[from] && factors[to]) return numeric * factors[from] / factors[to];
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

  function componentCostLine(component, issues, cache, stack) {
    if (component.sourceType === sourceTypes.INVENTORY_ITEM) return inventoryComponentCost(component, issues);
    const child = getRecipeById(component.sourceId);
    if (!child) throw new Error("Recipe component not found.");
    const childCost = calculateCost(child.id, { cache, stack, expectedType: component.sourceType });
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
  }

  function calculateCost(recipeId, options = {}) {
    const context = getCalculationContext();
    const cache = options.cache || context.costByRecipe;
    const recipe = options.recipe || getRecipeById(recipeId);
    if (!recipe) return { recipe: null, lines: [], totalCost: null, incomplete: true, missingCosts: [], errors: ["Recipe not found."] };
    if (options.expectedType && recipeTypeOf(recipe) !== options.expectedType) {
      throw new Error(`${recipe.name} is not a valid ${options.expectedType.replaceAll("_", " ")} component.`);
    }
    const stack = options.stack || [];
    if (stack.includes(recipeId)) throw new Error(`Circular recipe dependency detected: ${[...stack, recipeId].join(" -> ")}`);
    validateRecipe(recipe, recipe.components, recipe.id);
    if (cache.has(recipeId)) return cache.get(recipeId);
    const nextStack = [...stack, recipeId];
    const issues = [];
    const type = recipeTypeOf(recipe);
    const lines = recipe.components.map((component) => componentCostLine(component, issues, cache, nextStack));
    const missingCosts = issues.filter((issue, index, all) => all.findIndex((value) => value.sourceId === issue.sourceId) === index);
    const incomplete = missingCosts.length > 0 || lines.some((line) => line.cost == null);
    const totalCost = incomplete ? null : lines.reduce((total, line) => total + Number(line.cost || 0), 0);
    const costPerYieldUnit = type === recipeTypes.PREP_ITEM && totalCost != null && Number(recipe.yieldQuantity) > 0
      ? totalCost / Number(recipe.yieldQuantity)
      : null;
    const unitCost = type === recipeTypes.PREP_ITEM ? costPerYieldUnit : totalCost;
    const result = {
      recipe,
      recipeId: recipe.id,
      type,
      yieldQuantity: recipe.yieldQuantity,
      yieldUnitId: recipe.yieldUnitId,
      lines,
      totalCost,
      unitCost,
      costPerYieldUnit,
      costPerYieldBaseUnit: costPerYieldUnit,
      yieldBaseQuantity: Number(recipe.yieldQuantity || 0),
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
    if (!Number.isFinite(Number(quantity)) || Number(quantity) < 0) throw new Error("Usage quantity must be finite and non-negative.");
    if (!Object.values(sourceTypes).includes(sourceType)) throw new Error("Invalid usage source type.");
    if (sourceType !== sourceTypes.INVENTORY_ITEM) {
      const recipe = getRecipeById(sourceId);
      if (!recipe) throw new Error("Recipe component not found.");
      if (recipe.type !== sourceType) throw new Error("Recipe component type does not match the selected source.");
      validateRecipe(recipe, recipe.components, recipe.id);
    }
    const key = `${sourceType}|${sourceId}|${quantity}|${options.unitId || ""}`;
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
      if (recipeType !== type) throw new Error("Recipe component type does not match the selected source.");
      const recipeMultiplier = recipeType === recipeTypes.PREP_ITEM
        ? convertYieldQuantity(recipe, multiplier, unitId || recipe.yieldUnitId) / Number(recipe.yieldQuantity)
        : multiplier;
      (recipe.components || []).forEach((component) => {
        if (!allowedSourceTypes(recipeType).includes(component.sourceType)) {
          throw new Error(`${recipe.name} cannot use ${component.sourceType.replaceAll("_", " ")} components.`);
        }
        walk(component.sourceType, component.sourceId, Number(component.quantity || 0) * recipeMultiplier, component.unitId, [...path, recipe.id]);
      });
    }

    walk(sourceType, sourceId, Number(quantity), options.unitId || null, options.stack || []);
    const result = [...totals.entries()].map(([itemId, baseQuantity]) => ({ itemId, item: InventoryService.getItemById(itemId), baseQuantity }));
    cache.set(key, result);
    return result.map((entry) => ({ ...entry }));
  }

  function validateRecipe(values, components = values.components, existingId = values.id || null) {
    const candidate = normalizeRecipe({ ...values, id: existingId || "__DRAFT__", components });
    const visiting = new Set();
    const visited = new Set();
    function visit(recipe) {
      if (visiting.has(recipe.id)) throw new Error(`Circular recipe dependency detected at ${recipe.name}.`);
      if (visited.has(recipe.id)) return;
      if (typeof recipe.name !== "string" || !recipe.name.trim()) throw new Error("Recipe name is required.");
      const allowed = allowedSourceTypes(recipe.type);
      if (!recipe.components.length) throw new Error("Add at least one component.");
      if (!Number.isFinite(recipe.yieldQuantity) || recipe.yieldQuantity <= 0) throw new Error("Recipe yield must be finite and greater than zero.");
      if (!InventoryService.getUnitById(recipe.yieldUnitId)) throw new Error("Invalid recipe yield unit.");
      if (recipe.producedInventoryItemId) {
        if (recipe.type !== recipeTypes.PREP_ITEM) throw new Error("Only PREP_ITEM recipes can track produced inventory.");
        const output = InventoryService.getItemById(recipe.producedInventoryItemId);
        if (!output) throw new Error("Produced Inventory Item not found.");
        InventoryService.convertToBaseUnit(output.id, recipe.yieldQuantity, recipe.yieldUnitId);
      }
      visiting.add(recipe.id);
      recipe.components.forEach((component) => {
        if (!allowed.includes(component.sourceType)) throw new Error(`${recipe.type} recipes cannot contain ${component.sourceType} components directly.`);
        if (!Number.isFinite(component.quantity) || component.quantity <= 0) throw new Error("Component quantities must be finite and greater than zero.");
        if (component.sourceType === sourceTypes.INVENTORY_ITEM) {
          const item = InventoryService.getItemById(component.sourceId);
          if (!item) throw new Error("Every Inventory Item component must reference a valid item.");
          const unit = component.unitId || item.baseUnitId;
          if (!InventoryService.getUnitById(unit)) throw new Error("Invalid inventory component unit.");
          InventoryService.convertToBaseUnit(item.id, component.quantity, unit);
          if (item.id === recipe.producedInventoryItemId) throw new Error("A Prep Item cannot consume its own produced inventory.");
        } else {
          const child = component.sourceId === candidate.id ? candidate : getRecipeById(component.sourceId);
          if (!child) throw new Error("Every recipe component must reference a valid recipe.");
          if (visiting.has(child.id)) throw new Error(`Circular recipe dependency detected at ${child.name}.`);
          if (child.type !== component.sourceType) throw new Error("Recipe component type does not match the selected source.");
          if (child.type === recipeTypes.PREP_ITEM) convertYieldQuantity(child, component.quantity, component.unitId);
          else if (component.unitId && component.unitId !== "UNIT-EA") throw new Error("MENU_PRODUCT components must use Each (EA).");
          visit(child);
        }
      });
      visiting.delete(recipe.id);
      visited.add(recipe.id);
    }
    visit(candidate);
    return true;
  }

  function normalizeInputComponents(components) {
    if (!Array.isArray(components)) throw new Error("Recipe components must be an array.");
    return components.map((component, index) => {
      const normalized = { ...normalizeComponent(component), sortOrder: index + 1 };
      if (normalized.sourceType === sourceTypes.INVENTORY_ITEM) {
        const item = InventoryService.getItemById(normalized.sourceId);
        normalized.unitId ||= item?.baseUnitId;
        normalized.baseQuantity = InventoryService.convertToBaseUnit(normalized.sourceId, normalized.quantity, normalized.unitId);
      } else {
        normalized.unitId ||= normalized.sourceType === sourceTypes.PREP_ITEM
          ? getRecipeById(normalized.sourceId)?.yieldUnitId : "UNIT-EA";
      }
      return normalized;
    });
  }

  function prepareRecipe(values, components, existing = null) {
    // Preserve deprecated fields already stored, but never accept new pricing input.
    const { sellingPrice, targetFoodCostPercent, ...changes } = values;
    const type = normalizeType(changes.type || changes.recipeType || existing?.type);
    const recipe = normalizeRecipe({ ...existing, ...changes, type,
      components: normalizeInputComponents(components ?? changes.components ?? existing?.components ?? []),
      yieldQuantity: type === recipeTypes.PREP_ITEM ? Number(changes.yieldQuantity ?? existing?.yieldQuantity ?? 1) : 1,
      yieldUnitId: type === recipeTypes.PREP_ITEM ? changes.yieldUnitId || changes.yieldUnit || existing?.yieldUnitId || "UNIT-EA" : "UNIT-EA",
      producedInventoryItemId: changes.producedInventoryItemId !== undefined ? changes.producedInventoryItemId || null : existing?.producedInventoryItemId || null
    });
    validateRecipe(recipe, recipe.components, existing?.id);
    return { ...recipe, name: recipe.name.trim() };
  }

  function createRecipe(values, components) {
    const prepared = prepareRecipe(values, components);
    const now = new Date().toISOString();
    const recipe = { categoryId: "RCAT-OTHER", instructions: "", notes: "", ...prepared,
      id: nextId("REC", readRecipesRaw()), version: 1, createdAt: now, updatedAt: now };
    saveRecipes([...readRecipesRaw(), recipe]);
    return getRecipeById(recipe.id);
  }

  function updateRecipe(id, changes, components) {
    const existing = getRecipeById(id);
    if (!existing) throw new Error("Recipe not found.");
    const prepared = prepareRecipe(changes, components, existing);
    // A type edit must not invalidate recipes or menu items already referencing this recipe.
    if (prepared.type !== existing.type) {
      const usedByRecipe = getRecipes().some((recipe) => recipe.components.some((component) => component.sourceType !== sourceTypes.INVENTORY_ITEM && component.sourceId === id));
      const usedByMenu = read("menuItems").some((item) => item.recipeId === id);
      if (usedByRecipe || usedByMenu) throw new Error("Cannot change the type of a recipe referenced by Recipes or Menu.");
    }
    const content = (recipe) => JSON.stringify([recipe.name, recipe.type, recipe.components, recipe.yieldQuantity, recipe.yieldUnitId, recipe.producedInventoryItemId, recipe.active, recipe.instructions, recipe.notes, recipe.categoryId]);
    const updated = { ...prepared, id, createdAt: existing.createdAt,
      version: existing.version + (content(prepared) !== content(existing) ? 1 : 0), updatedAt: new Date().toISOString() };
    saveRecipes(readRecipesRaw().map((recipe) => recipe.id === id ? updated : recipe));
    return getRecipeById(id);
  }

  function calculateRecipePreview(values, components) {
    const recipe = prepareRecipe(values, components);
    return calculateCost("__PREVIEW__", { recipe, cache: new Map() });
  }

  function getRecipeWarnings(recipeId) {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return [{ type: "INVALID_RECIPE", message: "Recipe not found." }];
    const warnings = [];
    try { validateRecipe(recipe); } catch (error) { warnings.push({ type: "INVALID_RECIPE", message: error.message }); }
    try {
      const cost = calculateRecipeCost(recipeId);
      warnings.push(...cost.missingCosts);
      const seen = new Set();
      function check(current) {
        if (seen.has(current.id)) return;
        seen.add(current.id);
        if (!current.active) warnings.push({ type: "INACTIVE_RECIPE", sourceId: current.id, name: current.name });
        current.components.forEach((component) => {
          if (component.sourceType === sourceTypes.INVENTORY_ITEM) {
            const item = InventoryService.getItemById(component.sourceId);
            if (item?.active === false) warnings.push({ type: "INACTIVE_INVENTORY", sourceId: item.id, name: item.name });
          } else {
            const child = getRecipeById(component.sourceId);
            if (child) check(child);
          }
        });
      }
      check(recipe);
    } catch (error) {
      if (!warnings.some((warning) => warning.message === error.message)) warnings.push({ type: "INVALID_RECIPE", message: error.message });
    }
    return warnings;
  }

  function deactivateRecipe(id) {
    return updateRecipe(id, { active: false });
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
    createRecipe,
    updateRecipe,
    deactivateRecipe,
    calculateCost,
    calculateRecipeCost,
    resolveComponentCost,
    resolveInventoryUsage,
    calculateRecipePreview,
    getRecipeWarnings,
    convertYieldQuantity,
    validateRecipe,
    getCalculationContext,
    recipeTypeOf,
    allowedSourceTypes
  };
  window.addEventListener?.("inventory:changed", () => { contextCache = null; });
  window.addEventListener?.("storage", () => { contextCache = null; });
})();
