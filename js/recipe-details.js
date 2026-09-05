(function () {
  const UI = RecipeUI, id = new URLSearchParams(window.location.search).get('id');
  const $ = name => document.getElementById(name);
  function render() {
    const recipe = RecipeService.getRecipeById(id);
    if (!recipe) { $('detailTitle').textContent = 'Recipe not found'; $('recipeDetail').innerHTML = '<section class="recipe-panel"><p>This recipe could not be found. Return to Recipes to select another.</p></section>'; $('detailActions').innerHTML = ''; return; }
    const health = RecipeService.getRecipeHealth(recipe), output = InventoryService.getItemById(recipe.producedInventoryItemId);
    $('detailTitle').textContent = recipe.name;
    $('detailMeta').textContent = `${UI.labels[recipe.type]} · ${recipe.active ? 'Active' : 'Inactive'} · Version ${recipe.version} · Updated ${recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString() : 'not recorded'}`;
    $('detailActions').innerHTML = `<a class="primary-button" href="${UI.href(id, true)}">Edit Recipe</a>${recipe.active ? '<button type="button" id="deactivateRecipe" class="secondary-button">Deactivate Recipe</button>' : '<span class="recipe-status">Inactive</span>'}`;
    const linked = MenuService.getMenuItems().filter(item => item.recipeId === id);
    $('recipeDetail').innerHTML = `<div class="recipe-editor-layout"><div class="recipe-editor-main"><section class="recipe-panel">${UI.components(recipe, health.cost)}</section>${recipe.type === 'PREP_ITEM' ? `<section class="recipe-panel"><h2>Production</h2><div class="recipe-summary-line"><span>Track as Inventory</span><strong>${recipe.producedInventoryItemId ? 'Yes' : 'No'}</strong></div><p class="recipe-muted">${UI.escape(recipe.producedInventoryItemId ? output?.name || 'Produced inventory item missing' : 'Subrecipe used for costing and ingredient resolution.')}</p>${output ? '<a class="secondary-button" href="production.html">Open Production</a>' : ''}</section>` : ''}${recipe.instructions || recipe.notes ? `<section class="recipe-panel"><h2>Preparation Notes</h2><p class="recipe-notes">${UI.escape(recipe.instructions || '')}</p><p class="recipe-notes recipe-muted">${UI.escape(recipe.notes || '')}</p></section>` : ''}</div><aside class="recipe-editor-summary"><section class="recipe-panel"><h2>Cost Summary</h2>${UI.costSummary(recipe, health.cost)}</section><section class="recipe-panel"><h2>Recipe Health</h2>${UI.health(health)}</section><section class="recipe-panel"><h2>Used By</h2>${UI.dependencies(id)}</section>${linked.length ? `<section class="recipe-panel"><h2>Linked Menu Items</h2><ul class="recipe-link-list">${linked.map(item => `<li><a href="menu.html">${UI.escape(item.name)}</a><strong>${UI.money(item.sellingPrice)}</strong></li>`).join('')}</ul><p class="recipe-muted">Selling information is managed in Menu.</p></section>` : ''}</aside></div>`;
  }
  $('detailActions').addEventListener('click', async event => {
    if (!event.target.closest('#deactivateRecipe')) return;
    const deps = RecipeService.getDependents(id), linked = MenuService.getMenuItems().filter(item => item.recipeId === id);
    const names = [...deps, ...linked].map(record => UI.escape(record.name));
    const confirmed = await showConfirm({ title: 'Deactivate recipe?', message: names.length ? `Used by: ${names.join(', ')}. The recipe and historical records will be retained; dependent recipes will show a warning.` : 'The recipe will remain accessible in the library and historical records.', confirmLabel: 'Deactivate', danger: true });
    if (confirmed) { RecipeService.deactivateRecipe(id); showToast('Recipe deactivated.'); }
  });
  for (const name of ['recipes:changed', 'inventory:changed', 'menu:changed', 'storage']) window.addEventListener(name, render);
  render();
})();
