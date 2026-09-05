(function () {
  const labels = { PREP_ITEM: 'Prep Item', MENU_PRODUCT: 'Menu Product', COMBO: 'Combo', INVENTORY_ITEM: 'Inventory' };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = (value, digits = 2) => value == null || !Number.isFinite(Number(value)) ? 'Cost unavailable' : `$${Number(value).toFixed(digits)}`;
  const unit = (id) => InventoryService.getUnitById(id)?.abbreviation || id || 'EA';
  const href = (id, edit = false) => `${edit ? 'recipe-builder' : 'recipe-details'}.html?id=${encodeURIComponent(id)}`;
  const badge = (type) => `<span class="recipe-type-badge">${escape(labels[type] || type)}</span>`;
  function source(component) {
    return component.sourceType === 'INVENTORY_ITEM' ? InventoryService.getItemById(component.sourceId) : RecipeService.getRecipeById(component.sourceId);
  }
  function costSummary(recipe, cost) {
    const line = (label, value) => `<div class="recipe-summary-line"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
    if (!cost) return '<p class="recipe-notice">Cost unavailable. Resolve recipe errors below.</p>';
    let rows = '';
    if (recipe.type === 'COMBO') {
      rows += line('Menu Products', money(cost.menuProductsCost));
      rows += line('Packaging / Other', money(cost.inventoryCost));
    }
    rows += line(recipe.type === 'PREP_ITEM' ? 'Batch Cost' : 'Total Recipe Cost', money(cost.totalCost));
    rows += line('Yield', `${recipe.yieldQuantity} ${unit(recipe.yieldUnitId)}`);
    rows += line(`Cost / ${unit(recipe.yieldUnitId)}`, money(cost.unitCost, recipe.type === 'PREP_ITEM' ? 4 : 2));
    return rows;
  }
  function health(result) {
    return result.warnings.length ? `<ul class="recipe-health-list">${result.warnings.map(w => `<li class="${w.severity === 'error' ? 'recipe-error' : 'recipe-warning'}"><span aria-hidden="true">${w.severity === 'error' ? '✕' : '⚠'}</span> ${escape(w.message || w.name)}</li>`).join('')}</ul>` : '<ul class="recipe-health-list recipe-good"><li>✓ Valid recipe name and yield</li><li>✓ Components valid</li><li>✓ Units compatible</li><li>✓ Ingredient costs available</li></ul>';
  }
  function dependencies(id) {
    const recipes = RecipeService.getDependents(id);
    return recipes.length ? `<ul class="recipe-link-list">${recipes.map(recipe => `<li><a href="${href(recipe.id)}">${escape(recipe.name)}</a>${badge(recipe.type)}</li>`).join('')}</ul>` : '<p class="recipe-muted">Not used by other recipes yet.</p>';
  }
  function components(recipe, cost) {
    const groups = recipe.type === 'COMBO' ? [['Menu Products', 'MENU_PRODUCT'], ['Packaging / Other Inventory', 'INVENTORY_ITEM']] : [['Components', null]];
    return groups.map(([label, type]) => `<section class="recipe-component-group"><h3>${label}</h3>${recipe.components.map((component, index) => {
      if (type && component.sourceType !== type) return '';
      const record = source(component), line = cost?.lines[index];
      return `<div class="recipe-view-component"><div><strong>${escape(record?.name || 'Missing component')}</strong>${badge(component.sourceType)}</div><span>${escape(component.quantity)} ${escape(unit(component.unitId))}</span><strong>${escape(line?.missingCost ? 'Missing Cost' : money(line?.cost))}</strong></div>`;
    }).join('') || '<p class="recipe-muted">No components in this group.</p>'}</section>`).join('');
  }
  window.RecipeUI = { labels, escape, money, unit, href, badge, source, costSummary, health, dependencies, components };
})();
