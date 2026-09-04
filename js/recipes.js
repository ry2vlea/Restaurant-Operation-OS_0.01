const recipeList = document.getElementById("recipeList");
const typeFilter = document.getElementById("recipeTypeFilter");
let activeFilter = "ALL";

const money = (value) => value == null ? "Incomplete" : `$${Number(value).toFixed(2)}`;
const pct = (value) => value == null ? "-" : `${Number(value).toFixed(1)}%`;

function typeLabel(type) {
  return type.replaceAll("_", " ");
}

function unitLabel(unitId) {
  return InventoryService.getUnitById(unitId)?.abbreviation || unitId || "";
}

function renderPrepSummary(recipe, cost) {
  return `
    <p>Batch Cost <strong>${money(cost.totalCost)}</strong></p>
    <p>Yield <strong>${recipe.yieldQuantity} ${unitLabel(recipe.yieldUnitId)}</strong></p>
    <p>Cost / ${unitLabel(recipe.yieldUnitId)} <strong>${money(cost.costPerYieldUnit)}</strong></p>
  `;
}

function renderSellableSummary(recipe, cost) {
  return `
    <p>Selling Price <strong>${money(recipe.sellingPrice)}</strong></p>
    <p>Recipe Cost <strong>${money(cost.totalCost)}</strong></p>
    <p>Food Cost <strong>${pct(cost.foodCostPercent)}</strong></p>
    <p>Contribution <strong>${money(cost.contribution)}</strong></p>
  `;
}

function renderRecipeDetail(recipe, cost) {
  const rows = cost.lines.map((line) => {
    const unit = line.component.sourceType === "MENU_PRODUCT" ? "" : ` ${unitLabel(line.unitId)}`;
    return `<div class="recipe-detail-row"><span>${line.label}</span><span>${line.quantity}${unit}</span><strong>${money(line.cost)}</strong></div>`;
  }).join("");
  const missing = cost.missingCosts.length ? `<div class="status-badge critical">MISSING COST: ${cost.missingCosts.map((item) => item.name).join(", ")}</div>` : "";
  const errors = cost.errors?.length ? `<div class="status-badge critical">${cost.errors.join(" ")}</div>` : "";
  return `
    <details class="recipe-detail">
      <summary>View Cost Detail</summary>
      ${missing}
      ${errors}
      <div class="recipe-detail-table">${rows}</div>
      <div class="recipe-total"><span>${RecipeService.recipeTypeOf(recipe) === "PREP_ITEM" ? "Batch Cost" : "Recipe Cost"}</span><strong>${money(cost.totalCost)}</strong></div>
      ${RecipeService.recipeTypeOf(recipe) !== "PREP_ITEM" ? `<div class="recipe-total"><span>Suggested Price</span><strong>${money(cost.suggestedSellingPrice)}</strong></div>` : ""}
    </details>
  `;
}

function renderRecipes() {
  performance.mark?.("recipe-cost-render:start");
  const recipes = RecipeService.getRecipes().filter((recipe) => recipe.active !== false && (activeFilter === "ALL" || RecipeService.recipeTypeOf(recipe) === activeFilter));
  recipeList.innerHTML = recipes.length ? recipes.map((recipe) => {
    const type = RecipeService.recipeTypeOf(recipe);
    let cost;
    try {
      cost = RecipeService.calculateCost(recipe.id);
    } catch (error) {
      cost = { lines: [], totalCost: null, costPerYieldUnit: null, foodCostPercent: null, contribution: null, suggestedSellingPrice: null, missingCosts: [], errors: [error.message] };
    }
    return `<article class="recipe-card recipe-card-detailed">
      <div class="recipe-card-main">
        <p class="eyebrow">${typeLabel(type)}</p>
        <h2>${recipe.name}</h2>
        <div class="recipe-card-stats">${type === "PREP_ITEM" ? renderPrepSummary(recipe, cost) : renderSellableSummary(recipe, cost)}</div>
        ${renderRecipeDetail(recipe, cost)}
      </div>
    </article>`;
  }).join("") : `<div class="empty-state"><h3>No Recipes Yet</h3><p>Create a Prep Item, Menu Product or Combo to begin recipe costing.</p></div>`;
  performance.mark?.("recipe-cost-render:end");
  performance.measure?.("recipe-cost-render", "recipe-cost-render:start", "recipe-cost-render:end");
}

typeFilter?.querySelectorAll("[data-recipe-filter]").forEach((button) => {
  button.onclick = () => {
    activeFilter = button.dataset.recipeFilter;
    typeFilter.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    renderRecipes();
  };
});

document.getElementById("newRecipe").onclick = () => location.href = "recipe-builder.html";
window.addEventListener("recipes:changed", renderRecipes);
renderRecipes();
