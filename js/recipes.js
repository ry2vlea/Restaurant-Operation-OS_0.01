(function () {
  const UI = RecipeUI, $ = id => document.getElementById(id);
  const state = { type: 'ALL', query: '', status: 'ALL' };
  function renderRecipes() {
    const all = RecipeService.getRecipes().map(recipe => ({ recipe, health: RecipeService.getRecipeHealth(recipe) }));
    const menu = MenuService.getMenuItems();
    $('recipeSummary').innerHTML = [['Prep Items', all.filter(row => row.recipe.type === 'PREP_ITEM').length], ['Menu Products', all.filter(row => row.recipe.type === 'MENU_PRODUCT').length], ['Combos', all.filter(row => row.recipe.type === 'COMBO').length], ['Needs Attention', all.filter(row => row.health.warnings.length).length]].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join('');
    const rows = all.filter(({ recipe, health }) => {
      const linked = menu.filter(item => item.recipeId === recipe.id);
      const produced = InventoryService.getItemById(recipe.producedInventoryItemId);
      const haystack = `${recipe.name} ${recipe.type} ${UI.labels[recipe.type]} ${recipe.sku || ''} ${produced?.name || ''} ${produced?.sku || ''} ${linked.map(item => `${item.name} ${item.sku}`).join(' ')}`.toLowerCase();
      return (state.type === 'ALL' || recipe.type === state.type) && haystack.includes(state.query) && (state.status === 'ALL' || (state.status === 'ACTIVE' && recipe.active) || (state.status === 'INACTIVE' && !recipe.active) || (state.status === 'ATTENTION' && health.warnings.length));
    });
    $('recipeResultCount').textContent = `${rows.length} of ${all.length} recipes`;
    $('recipeList').innerHTML = rows.length ? rows.map(({ recipe, health }) => {
      const deps = RecipeService.getDependents(recipe.id), cost = health.cost;
      const stats = recipe.type === 'PREP_ITEM' ? `<div><span>Batch Cost</span><strong>${UI.money(cost?.totalCost)}</strong></div><div><span>Yield</span><strong>${UI.escape(recipe.yieldQuantity)} ${UI.escape(UI.unit(recipe.yieldUnitId))}</strong></div><div><span>Cost / ${UI.escape(UI.unit(recipe.yieldUnitId))}</span><strong>${UI.money(cost?.unitCost, 4)}</strong></div>` : `<div><span>Recipe Cost</span><strong>${UI.money(cost?.unitCost)}</strong></div><div><span>Used By</span><strong>${deps.length} ${recipe.type === 'MENU_PRODUCT' ? 'Combos' : 'Recipes'}</strong></div>`;
      return `<article class="recipe-library-card"><div class="recipe-card-heading">${UI.badge(recipe.type)}<span class="recipe-status ${recipe.active ? 'recipe-good' : ''}">${recipe.active ? 'Active' : 'Inactive'}</span></div><h2><a href="${UI.href(recipe.id)}">${UI.escape(recipe.name)}</a></h2><p class="recipe-muted">${recipe.components.length} Components · Version ${recipe.version}</p><div class="recipe-library-stats">${stats}</div>${health.warnings.length ? `<p class="recipe-attention">⚠ Needs Attention<small>${UI.escape(health.warnings[0].message)}</small></p>` : '<p class="recipe-good recipe-health-brief">✓ Recipe ready</p>'}<div class="recipe-actions"><a class="secondary-button" href="${UI.href(recipe.id)}">View</a><a class="primary-button" href="${UI.href(recipe.id, true)}">Edit</a></div></article>`;
    }).join('') : all.length ? '<div class="recipe-panel empty-state"><h3>No matching recipes</h3><p>Try another search or change your filters.</p></div>' : '<div class="recipe-panel empty-state"><h3>No Recipes Yet</h3><p>Recipes connect your inventory to the products you sell.</p><p>Create a Prep Item, Menu Product, or Combo to get started.</p><a class="primary-button" href="recipe-builder.html">+ Create First Recipe</a></div>';
  }
  $('recipeSearch').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); renderRecipes(); });
  $('recipeStatus').addEventListener('change', event => { state.status = event.target.value; renderRecipes(); });
  $('recipeTypeFilter').addEventListener('click', event => {
    const button = event.target.closest('[data-recipe-filter]'); if (!button) return;
    state.type = button.dataset.recipeFilter;
    $('recipeTypeFilter').querySelectorAll('button').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
    renderRecipes();
  });
  for (const name of ['recipes:changed', 'inventory:changed', 'menu:changed', 'storage']) window.addEventListener(name, renderRecipes);
  renderRecipes();
})();
