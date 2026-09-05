const builder = { components: [] };
const inventoryItems = InventoryService.getItems().filter((item) => item.active !== false);
const inventoryUnits = InventoryService.getUnits();
const builderForm = document.getElementById("recipeBuilder");

function unitLabel(unitId) {
  return InventoryService.getUnitById(unitId)?.abbreviation || unitId || "";
}

function recipeOptions(type, selected) {
  return RecipeService.getRecipes()
    .filter((recipe) => RecipeService.recipeTypeOf(recipe) === type && recipe.active !== false)
    .map((recipe) => `<option value="${recipe.id}" ${recipe.id === selected ? "selected" : ""}>${recipe.name}</option>`)
    .join("");
}

function inventoryOptions(selected) {
  return inventoryItems.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${item.name}</option>`).join("");
}

function unitOptions(component, selected) {
  if (component.sourceType !== "INVENTORY_ITEM") {
    const recipe = RecipeService.getRecipeById(component.sourceId);
    const units = component.sourceType === "PREP_ITEM"
      ? inventoryUnits.filter((unit) => ["UNIT-OZ", "UNIT-LB", "UNIT-FLOZ", "UNIT-QT", "UNIT-GAL", recipe?.yieldUnitId].includes(unit.id))
      : inventoryUnits.filter((unit) => unit.id === "UNIT-EA");
    return units.map((unit) => `<option value="${unit.id}" ${unit.id === selected ? "selected" : ""}>${unit.abbreviation}</option>`).join("");
  }
  const item = InventoryService.getItemById(component.sourceId);
  const ids = [InventoryService.getPrimaryUnitId(item), item?.intermediateUnitId, item?.baseUnitId].filter((id, index, values) => id && values.indexOf(id) === index);
  return ids.map((id) => `<option value="${id}" ${id === selected ? "selected" : ""}>${unitLabel(id)}</option>`).join("");
}

function allowedTypes() {
  const type = RecipeService.recipeTypeOf({ recipeType: builderForm.elements.recipeType.value });
  return RecipeService.allowedSourceTypes(type);
}

function defaultSource(type) {
  if (type === "INVENTORY_ITEM") return inventoryItems[0]?.id || "";
  return RecipeService.getRecipes().find((recipe) => RecipeService.recipeTypeOf(recipe) === type && recipe.active !== false)?.id || "";
}

function sourceOptions(component) {
  if (component.sourceType === "INVENTORY_ITEM") return inventoryOptions(component.sourceId);
  return recipeOptions(component.sourceType, component.sourceId);
}

function renderComponents() {
  let lines = [];
  try { lines = RecipeService.calculateRecipePreview(previewRecipe()).lines; } catch {}
  document.getElementById("ingredients").innerHTML = builder.components.length ? builder.components.map((component, index) => {
    const cost = lines[index]?.missingCost ? null : lines[index]?.cost;
    return `<div class="ingredient-row recipe-component-row">
      <select data-component="${index}" data-field="sourceType">${allowedTypes().map((type) => `<option value="${type}" ${type === component.sourceType ? "selected" : ""}>${type.replaceAll("_", " ")}</option>`).join("")}</select>
      <select data-component="${index}" data-field="sourceId">${sourceOptions(component)}</select>
      <input data-component="${index}" data-field="quantity" type="number" min="0.01" step="0.01" value="${component.quantity}">
      <select data-component="${index}" data-field="unitId">${unitOptions(component, component.unitId)}</select>
      <div class="ingredient-cost"><strong data-component-cost="${index}">${cost == null ? "Incomplete" : `$${cost.toFixed(2)}`}</strong><small>${component.sourceType.replaceAll("_", " ")}</small></div>
      <button type="button" class="icon-button" data-remove="${index}" aria-label="Remove component">×</button>
    </div>`;
  }).join("") : `<div class="empty-state"><p>Add a valid component to begin costing this recipe.</p></div>`;

  document.querySelectorAll("[data-component]").forEach((field) => field.oninput = () => {
    const component = builder.components[Number(field.dataset.component)];
    component[field.dataset.field] = field.value;
    if (field.dataset.field === "sourceType") {
      component.sourceId = defaultSource(field.value);
      component.unitId = field.value === "INVENTORY_ITEM"
        ? InventoryService.getItemById(component.sourceId)?.baseUnitId
        : RecipeService.getRecipeById(component.sourceId)?.yieldUnitId || "UNIT-EA";
      renderComponents();
    }
    if (field.dataset.field === "sourceId") {
      component.unitId = component.sourceType === "INVENTORY_ITEM"
        ? InventoryService.getItemById(component.sourceId)?.baseUnitId
        : RecipeService.getRecipeById(component.sourceId)?.yieldUnitId || "UNIT-EA";
      renderComponents();
    }
    updateCost();
  });
  document.querySelectorAll("[data-remove]").forEach((button) => button.onclick = () => {
    builder.components.splice(Number(button.dataset.remove), 1);
    renderComponents();
    updateCost();
  });
}

function previewRecipe() {
  return {
    id: "__PREVIEW__",
    name: builderForm.elements.name.value || "Preview",
    type: builderForm.elements.recipeType.value,
    recipeType: builderForm.elements.recipeType.value,
    components: builder.components,
    yieldQuantity: Number(builderForm.elements.yieldQuantity.value),
    yieldUnitId: builderForm.elements.yieldUnitId.value,
    producedInventoryItemId: builderForm.elements.recipeType.value === "PREP_ITEM" ? builderForm.elements.producedInventoryItemId.value : null
  };
}

function updateCost() {
  try {
    const cost = RecipeService.calculateRecipePreview(previewRecipe());
    document.querySelectorAll("[data-component-cost]").forEach((element) => {
      const line = cost.lines[Number(element.dataset.componentCost)];
      element.textContent = line?.cost == null || line.missingCost ? "Incomplete" : `$${line.cost.toFixed(2)}`;
    });
    document.getElementById("recipeCost").textContent = cost.incomplete ? "Incomplete" : `$${cost.totalCost.toFixed(2)}`;
  } catch (error) {
    document.querySelectorAll("[data-component-cost]").forEach((element) => { element.textContent = "Incomplete"; });
    document.getElementById("recipeCost").textContent = `Incomplete: ${error.message}`;
  }
}

function syncRecipeType() {
  const type = builderForm.elements.recipeType.value;
  const produced = builderForm.elements.producedInventoryItemId.closest("label");
  const yieldQuantity = builderForm.elements.yieldQuantity.closest("label");
  const yieldUnit = builderForm.elements.yieldUnitId.closest("label");
  produced.hidden = type !== "PREP_ITEM";
  yieldQuantity.hidden = type !== "PREP_ITEM";
  yieldUnit.hidden = type !== "PREP_ITEM";
  builder.components = builder.components.filter((component) => allowedTypes().includes(component.sourceType));
  if (!builder.components.length) addComponent();
  renderComponents();
  updateCost();
}

function addComponent() {
  const sourceType = allowedTypes()[0];
  const sourceId = defaultSource(sourceType);
  if (!sourceId) {
    showToast("Add the required source records before creating this recipe.", "error");
    return;
  }
  builder.components.push({
    sourceType,
    sourceId,
    quantity: 1,
    unitId: sourceType === "INVENTORY_ITEM" ? InventoryService.getItemById(sourceId)?.baseUnitId : RecipeService.getRecipeById(sourceId)?.yieldUnitId || "UNIT-EA"
  });
}

document.getElementById("yieldUnit").innerHTML = inventoryUnits.map((unit) => `<option value="${unit.id}">${unit.abbreviation}</option>`).join("");
document.getElementById("producedItem").innerHTML += inventoryItems.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
document.getElementById("addIngredient").onclick = () => {
  addComponent();
  renderComponents();
  updateCost();
};
builderForm.elements.recipeType.addEventListener("change", syncRecipeType);
["yieldQuantity", "yieldUnitId", "producedInventoryItemId"].forEach((name) => {
  builderForm.elements[name].addEventListener("input", updateCost);
});
builderForm.onsubmit = (event) => {
  event.preventDefault();
  try {
    const values = Object.fromEntries(new FormData(builderForm));
    values.type = values.recipeType;
    if (values.type !== "PREP_ITEM") values.producedInventoryItemId = null;
    RecipeService.createRecipe(values, builder.components);
    showToast("Recipe created.");
    setTimeout(() => { location.href = "recipes.html"; }, 350);
  } catch (error) {
    showToast(error.message, "error");
  }
};
syncRecipeType();
