const builder = { ingredients: [] };
const inventoryItems = InventoryService.getItems().filter((item) => item.active !== false);
const inventoryUnits = InventoryService.getUnits();
const builderForm = document.getElementById("recipeBuilder");

function unitOptions(itemId, selected) {
  const item = InventoryService.getItemById(itemId);
  const ids = [InventoryService.getPrimaryUnitId(item), item?.intermediateUnitId, item?.baseUnitId].filter((id, index, values) => id && values.indexOf(id) === index);
  return ids.map((id) => `<option value="${id}" ${id === selected ? "selected" : ""}>${InventoryService.getUnitById(id)?.abbreviation || id}</option>`).join("");
}

function ingredientCost(ingredient) {
  const item = InventoryService.getItemById(ingredient.inventoryItemId);
  if (!item) return 0;
  try {
    const baseQuantity = InventoryService.convertToBaseUnit(item.id, Number(ingredient.quantity), ingredient.unitId || item.baseUnitId);
    return baseQuantity * InventoryService.getBaseUnitCost(item);
  } catch (error) { return 0; }
}

function renderIngredients() {
  document.getElementById("ingredients").innerHTML = builder.ingredients.length ? builder.ingredients.map((ingredient, index) => {
    const item = InventoryService.getItemById(ingredient.inventoryItemId);
    return `<div class="ingredient-row">
      <select data-ingredient="${index}" data-field="inventoryItemId">${inventoryItems.map((candidate) => `<option value="${candidate.id}" ${candidate.id === ingredient.inventoryItemId ? "selected" : ""}>${candidate.name}</option>`).join("")}</select>
      <input data-ingredient="${index}" data-field="quantity" type="number" min="0.01" step="0.01" value="${ingredient.quantity}">
      <select data-ingredient="${index}" data-field="unitId">${unitOptions(ingredient.inventoryItemId, ingredient.unitId)}</select>
      <div class="ingredient-cost"><strong>$${ingredientCost(ingredient).toFixed(2)}</strong><small>${item ? `$${InventoryService.getBaseUnitCost(item).toFixed(4)} / ${InventoryService.getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId}` : ""}</small></div>
      <button type="button" class="icon-button" data-remove="${index}" aria-label="Remove ingredient">×</button>
    </div>`;
  }).join("") : `<div class="empty-state"><p>Add an Inventory Item to begin costing this recipe.</p></div>`;

  document.querySelectorAll("[data-ingredient]").forEach((field) => field.oninput = () => {
    const ingredient = builder.ingredients[Number(field.dataset.ingredient)];
    ingredient[field.dataset.field] = field.value;
    if (field.dataset.field === "inventoryItemId") {
      ingredient.unitId = InventoryService.getItemById(field.value)?.baseUnitId;
      renderIngredients();
    }
    updateCost();
  });
  document.querySelectorAll("[data-remove]").forEach((button) => button.onclick = () => {
    builder.ingredients.splice(Number(button.dataset.remove), 1);
    renderIngredients();
    updateCost();
  });
}

function updateCost() {
  const total = builder.ingredients.reduce((sum, ingredient) => sum + ingredientCost(ingredient), 0);
  document.getElementById("recipeCost").textContent = `$${total.toFixed(2)}`;
}

function syncRecipeType() {
  const type = builderForm.elements.recipeType.value;
  const produced = builderForm.elements.producedInventoryItemId.closest("label");
  const price = builderForm.elements.sellingPrice.closest("label");
  produced.hidden = type !== "PREP";
  price.hidden = type === "PREP";
}

document.getElementById("yieldUnit").innerHTML = inventoryUnits.map((unit) => `<option value="${unit.id}">${unit.abbreviation}</option>`).join("");
document.getElementById("producedItem").innerHTML += inventoryItems.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
document.getElementById("addIngredient").onclick = () => {
  const item = inventoryItems[0];
  if (!item) { showToast("Add Inventory Items before creating a recipe.", "error"); return; }
  builder.ingredients.push({ inventoryItemId: item.id, quantity: 1, unitId: item.baseUnitId });
  renderIngredients();
  updateCost();
};
builderForm.elements.recipeType.addEventListener("change", syncRecipeType);
builderForm.onsubmit = (event) => {
  event.preventDefault();
  try {
    const values = Object.fromEntries(new FormData(builderForm));
    RecipeService.createRecipe(values, builder.ingredients);
    showToast("Recipe created.");
    setTimeout(() => { location.href = "recipes.html"; }, 350);
  } catch (error) { showToast(error.message, "error"); }
};
syncRecipeType();
if (inventoryItems.length) document.getElementById("addIngredient").click();
