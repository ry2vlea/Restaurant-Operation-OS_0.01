const prepRecipes = RecipeService.getRecipes().filter((recipe) => recipe.recipeType === "PREP" && recipe.active !== false);
const recipeSelect = document.getElementById("productionRecipe");
const locationSelect = document.getElementById("productionLocation");
const productionForm = document.getElementById("productionForm");

recipeSelect.innerHTML = prepRecipes.map((recipe) => `<option value="${recipe.id}">${recipe.name}</option>`).join("");
locationSelect.innerHTML = InventoryService.getLocations().filter((location) => location.active !== false).map((location) => `<option value="${location.id}">${location.name}</option>`).join("");

function syncProductionRecipe() {
  const recipe = RecipeService.getRecipeById(recipeSelect.value);
  if (!recipe) return;
  const produced = InventoryService.getItemById(recipe.producedInventoryItemId);
  const actualYield = productionForm.elements.actualYield;
  actualYield.value = Number(recipe.yieldQuantity || 0);
  actualYield.placeholder = `Expected ${recipe.yieldQuantity} ${InventoryService.getUnitById(recipe.yieldUnitId)?.abbreviation || recipe.yieldUnitId}`;
  if (produced?.defaultLocationId) locationSelect.value = produced.defaultLocationId;
}

recipeSelect.addEventListener("change", syncProductionRecipe);
productionForm.onsubmit = (event) => {
  event.preventDefault();
  const button = event.submitter || productionForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(event.target));
    values.idempotencyKey = `PRODUCTION-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ProductionService.produce(values);
    showToast("Production completed and inventory movements recorded.");
    renderProduction();
    syncProductionRecipe();
  } catch (error) { showToast(error.message, "error"); }
  button.disabled = false;
};

function renderProduction() {
  performance.mark?.("production-render:start");
  const recipeContext = RecipeService.getCalculationContext();
  const batches = ProductionService.getBatches().slice().reverse();
  document.getElementById("productionList").innerHTML = batches.length ? batches.map((batch) => {
    const recipe = recipeContext.recipeById.get(batch.recipeId);
    const yieldPercent = batch.expectedYield ? batch.actualYield / batch.expectedYield * 100 : 0;
    return `<article class="recipe-card production-card"><div><p class="eyebrow">COMPLETED BATCH</p><h2>${recipe?.name || batch.recipeId}</h2><p>Expected ${batch.expectedYield} · Actual ${batch.actualYield} · Yield ${yieldPercent.toFixed(1)}%</p><small>${new Date(batch.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${batch.manager}</small></div><div class="recipe-card-metrics"><strong>$${Number(batch.totalBatchCost || 0).toFixed(2)}</strong><span>$${Number(batch.costPerYieldBaseUnit || 0).toFixed(4)} / base unit</span></div></article>`;
  }).join("") : `<div class="empty-state"><p>No Production Batches Today</p></div>`;
  performance.mark?.("production-render:end");
  performance.measure?.("production-render", "production-render:start", "production-render:end");
}

syncProductionRecipe();
renderProduction();
