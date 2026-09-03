(function () {
  const recipeKey = "recipes";
  const ingredientKey = "recipeIngredients";

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) { return []; }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function nextId(prefix, values) {
    const number = values.reduce((max, value) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(number + 1).padStart(6, "0")}`;
  }

  function getRecipes() { return read(recipeKey); }
  function getAllIngredients() { return read(ingredientKey); }
  function getRecipeIngredients(recipeId) { return getAllIngredients().filter((ingredient) => ingredient.recipeId === recipeId).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)); }
  function getRecipeById(id) { return getRecipes().find((recipe) => recipe.id === id) || null; }

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

  function validateRecipe(values, ingredients, existingId = null) {
    if (!values.name?.trim()) throw new Error("Recipe name is required.");
    if (!Array.isArray(ingredients) || !ingredients.length) throw new Error("Add at least one ingredient.");
    const type = values.recipeType || "MENU";
    if (!["MENU", "PREP"].includes(type)) throw new Error("Select a valid recipe type.");
    if (!(Number(values.yieldQuantity || 0) > 0)) throw new Error("Recipe yield must be greater than zero.");
    if (type === "PREP" && !values.producedInventoryItemId) throw new Error("Prep recipes require a produced Inventory Item.");

    if (type === "PREP" && values.producedInventoryItemId && ingredients.some((ingredient) => ingredient.inventoryItemId === values.producedInventoryItemId)) {
      throw new Error("A Prep Recipe cannot use the item it produces as an ingredient.");
    }

    ingredients.forEach((ingredient) => {
      const item = InventoryService.getItemById(ingredient.inventoryItemId);
      if (!item) throw new Error("Every ingredient must reference a valid Inventory Item.");
      if (!(Number(ingredient.quantity) > 0)) throw new Error(`Enter a positive quantity for ${item.name}.`);
      InventoryService.convertToBaseUnit(item.id, Number(ingredient.quantity), ingredient.unitId || item.baseUnitId);
    });

    if (existingId) {
      const recipe = getRecipeById(existingId);
      if (!recipe) throw new Error("Recipe not found.");
    }
  }

  function buildIngredientRecords(recipeId, ingredients, existingIngredients) {
    const all = [...existingIngredients];
    return ingredients.map((ingredient, index) => {
      const item = InventoryService.getItemById(ingredient.inventoryItemId);
      const unitId = ingredient.unitId || item.baseUnitId;
      const record = {
        id: nextId("RING", all),
        recipeId,
        inventoryItemId: item.id,
        quantity: Number(ingredient.quantity),
        unitId,
        baseQuantity: InventoryService.convertToBaseUnit(item.id, Number(ingredient.quantity), unitId),
        sortOrder: index + 1
      };
      all.push(record);
      return record;
    });
  }

  function createRecipe(values, ingredients) {
    validateRecipe(values, ingredients);
    const now = new Date().toISOString();
    const recipe = {
      id: nextId("REC", getRecipes()),
      name: values.name.trim(),
      recipeType: values.recipeType || "MENU",
      categoryId: values.categoryId || "RCAT-OTHER",
      yieldQuantity: Number(values.yieldQuantity || 1),
      yieldUnitId: values.yieldUnitId || "UNIT-EA",
      sellingPrice: values.sellingPrice !== "" && values.sellingPrice != null ? Number(values.sellingPrice) : null,
      linkedMenuItemId: values.linkedMenuItemId || null,
      producedInventoryItemId: values.producedInventoryItemId || null,
      instructions: values.instructions || "",
      notes: values.notes || "",
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    const existingIngredients = getAllIngredients();
    const records = buildIngredientRecords(recipe.id, ingredients, existingIngredients);
    saveRecipes([...getRecipes(), recipe]);
    saveIngredients([...existingIngredients, ...records]);
    return recipe;
  }

  function updateRecipe(id, values, ingredients) {
    const recipe = getRecipeById(id);
    if (!recipe) throw new Error("Recipe not found.");
    const nextValues = { ...recipe, ...values };
    const nextIngredients = ingredients || getRecipeIngredients(id);
    validateRecipe(nextValues, nextIngredients, id);
    const updated = {
      ...recipe,
      ...values,
      name: (values.name ?? recipe.name).trim(),
      yieldQuantity: Number(values.yieldQuantity ?? recipe.yieldQuantity),
      sellingPrice: values.sellingPrice === "" ? null : Number(values.sellingPrice ?? recipe.sellingPrice),
      producedInventoryItemId: values.producedInventoryItemId || null,
      updatedAt: new Date().toISOString(),
      version: Number(recipe.version || 1) + 1
    };
    saveRecipes(getRecipes().map((value) => value.id === id ? updated : value));
    if (ingredients) {
      const remaining = getAllIngredients().filter((ingredient) => ingredient.recipeId !== id);
      const records = buildIngredientRecords(id, ingredients, remaining);
      saveIngredients([...remaining, ...records]);
    }
    return getRecipeById(id);
  }

  function calculateRecipeCost(recipeId) {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return { recipe: null, lines: [], totalCost: 0, costPerYieldUnit: 0, yieldBaseQuantity: 0, costPerYieldBaseUnit: 0 };
    const ingredients = getRecipeIngredients(recipeId);
    const lines = ingredients.map((ingredient) => {
      const item = InventoryService.getItemById(ingredient.inventoryItemId);
      const baseUnitCost = InventoryService.getBaseUnitCost(item);
      const cost = Number(ingredient.baseQuantity || 0) * baseUnitCost;
      return { ingredient, item, baseUnitCost, cost };
    });
    const totalCost = lines.reduce((total, line) => total + line.cost, 0);
    let yieldBaseQuantity = Number(recipe.yieldQuantity || 1);
    if (recipe.recipeType === "PREP" && recipe.producedInventoryItemId) {
      try {
        yieldBaseQuantity = InventoryService.convertToBaseUnit(recipe.producedInventoryItemId, Number(recipe.yieldQuantity || 0), recipe.yieldUnitId);
      } catch (error) {
        yieldBaseQuantity = 0;
      }
    }
    return {
      recipe,
      lines,
      totalCost,
      costPerYieldUnit: Number(recipe.yieldQuantity) > 0 ? totalCost / Number(recipe.yieldQuantity) : 0,
      yieldBaseQuantity,
      costPerYieldBaseUnit: yieldBaseQuantity > 0 ? totalCost / yieldBaseQuantity : 0
    };
  }

  function deactivateRecipe(id) {
    const recipe = getRecipeById(id);
    if (!recipe) throw new Error("Recipe not found.");
    const updated = { ...recipe, active: false, updatedAt: new Date().toISOString() };
    saveRecipes(getRecipes().map((value) => value.id === id ? updated : value));
    return updated;
  }

  window.RecipeService = {
    getRecipes,
    getRecipeIngredients,
    getRecipeById,
    saveRecipes,
    saveIngredients,
    createRecipe,
    updateRecipe,
    calculateRecipeCost,
    deactivateRecipe
  };
})();
