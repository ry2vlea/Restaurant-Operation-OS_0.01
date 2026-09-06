(function () {
  const UI = RecipeUI, $ = id => document.getElementById(id);
  const state = { type: 'ALL', query: '', category: 'ALL', status: 'ALL', editing: null, saving: false };
  const categories = { 'MCAT-SANDWICHES': 'Sandwiches', 'MCAT-COMBOS': 'Combos', 'MCAT-CHICKEN': 'Chicken', 'MCAT-SIDES': 'Sides', 'MCAT-DESSERTS': 'Desserts', 'MCAT-BEVERAGES': 'Beverages', 'MCAT-SAUCES': 'Sauces', 'MCAT-OTHER': 'Other' };
  const categoryLabel = id => categories[id] || String(id || 'Other').replace('MCAT-', '').replaceAll('_', ' ');
  const pct = n => n == null ? 'Not available' : `${Number(n).toFixed(1)}%`;
  const form = $('menuItemForm'), editor = $('menuEditor');
  function renderMenu() {
    const rows = MenuService.getMenuRows();
    const needsAttention = row => row.metric.incomplete || (row.item.active && row.metric.status !== 'AVAILABLE');
    $('menuMetrics').innerHTML = [['Menu Items', rows.length], ['Active', rows.filter(row => row.item.active).length], ['Available', rows.filter(row => row.item.active && row.metric.status === 'AVAILABLE').length], ['Needs Attention', rows.filter(needsAttention).length]].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join('');
    const ids = [...new Set(rows.map(row => row.item.categoryId))];
    $('menuCategory').innerHTML = '<option value="ALL">All categories</option>' + ids.map(id => `<option value="${UI.escape(id)}">${UI.escape(categoryLabel(id))}</option>`).join('');
    if (!ids.includes(state.category)) state.category = 'ALL';
    $('menuCategory').value = state.category;
    const filtered = rows.filter(row => {
      const recipe = RecipeService.getRecipeById(row.item.recipeId);
      const match = `${row.item.name} ${row.item.sku || ''} ${recipe?.name || ''}`.toLowerCase().includes(state.query);
      return match && (state.type === 'ALL' || row.metric.recipeType === state.type) && (state.category === 'ALL' || row.item.categoryId === state.category) && (state.status === 'ALL' || (state.status === 'ACTIVE' && row.item.active) || (state.status === 'INACTIVE' && !row.item.active) || (state.status === 'AVAILABLE' && row.item.active && row.metric.status === 'AVAILABLE') || (state.status === 'ATTENTION' && needsAttention(row)));
    });
    $('menuResultCount').textContent = `${filtered.length} of ${rows.length} menu items`;
    $('menuList').innerHTML = filtered.length ? filtered.map(({ item, metric }) => {
      const recipe = RecipeService.getRecipeById(item.recipeId);
      const attention = metric.incomplete ? 'Recipe cost unavailable. Check the linked recipe.' : !item.active ? '' : metric.status === 'MANUALLY_UNAVAILABLE' ? item.manualUnavailableReason : metric.status !== 'AVAILABLE' ? `${metric.servings} servings available${metric.limitingIngredient ? ` · Limited by ${metric.limitingIngredient.name}` : ''}` : '';
      return `<article class="recipe-library-card menu-library-card"><div class="recipe-card-heading">${UI.badge(metric.recipeType || 'No recipe')}<span class="recipe-status ${item.active && metric.status === 'AVAILABLE' ? 'recipe-good' : ''}">${item.active ? UI.escape(metric.status.replaceAll('_', ' ')) : 'Inactive'}</span></div><h2>${UI.escape(item.name)}</h2><p class="recipe-muted">${UI.escape(categoryLabel(item.categoryId))}${item.sku ? ` · ${UI.escape(item.sku)}` : ''}</p><div class="menu-price">${UI.money(item.sellingPrice)}<span>Selling price</span></div><div class="recipe-library-stats"><div><span>Recipe Cost</span><strong>${UI.money(metric.cost)}</strong></div><div><span>Food Cost</span><strong>${pct(metric.foodCostPercent)}</strong></div><div><span>Contribution</span><strong>${UI.money(metric.contribution)}</strong></div></div><p class="recipe-muted">Target ${pct(metric.targetFoodCostPercent)}</p>${attention ? `<p class="recipe-attention">⚠ ${UI.escape(attention)}</p>` : ''}<p class="menu-recipe-link">${recipe ? `<a href="${UI.href(recipe.id)}">View recipe: ${UI.escape(recipe.name)} →</a>` : 'Linked recipe missing'}</p><div class="recipe-actions"><button class="primary-button" data-edit="${UI.escape(item.id)}">Edit</button><button class="secondary-button menu-delete" data-delete="${UI.escape(item.id)}">Delete</button></div></article>`;
    }).join('') : `<div class="recipe-panel empty-state"><h3>${rows.length ? 'No matching menu items' : 'Build Your Menu'}</h3><p>${rows.length ? 'Try another search or change your filters.' : 'Connect a recipe and set a selling price to get started.'}</p>${rows.length ? '' : '<button class="primary-button" data-new>+ Add First Menu Item</button>'}</div>`;
  }
  function formValues() {
    const values = Object.fromEntries(new FormData(form));
    values.active = values.active === 'true';
    return values;
  }
  function renderPreview() {
    const values = formValues();
    const metric = MenuService.calculateMenuMetrics({ ...values, sellingPrice: Number(values.sellingPrice), limitedThreshold: Number(values.limitedThreshold) });
    $('menuPreview').innerHTML = `<span>Recipe Cost <strong>${UI.money(metric.cost)}</strong></span><span>Food Cost <strong>${pct(metric.foodCostPercent)}</strong></span><span>Contribution <strong>${UI.money(metric.contribution)}</strong></span>`;
    form.elements.manualUnavailableReason.disabled = values.status !== 'MANUALLY_UNAVAILABLE';
  }
  function openMenuForm(id = null) {
    const item = id ? MenuService.getMenuItemById(id) : null;
    if (id && (!item || item.deletedAt)) { showToast('Menu item no longer exists.', 'error'); return; }
    const recipes = RecipeService.getRecipes().filter(recipe => ['MENU_PRODUCT', 'COMBO'].includes(recipe.type) && (recipe.active || recipe.id === item?.recipeId));
    if (!recipes.length) { showToast('Create a Menu Product or Combo in Recipes first.', 'error'); return; }
    state.editing = item; state.saving = false; form.reset();
    const categoryOptions = { ...categories };
    if (item?.categoryId && !categoryOptions[item.categoryId]) categoryOptions[item.categoryId] = categoryLabel(item.categoryId);
    form.elements.categoryId.innerHTML = Object.entries(categoryOptions).map(([value, label]) => `<option value="${UI.escape(value)}">${UI.escape(label)}</option>`).join('');
    form.elements.recipeId.innerHTML = '<option value="">Select a recipe</option>' + recipes.map(recipe => `<option value="${UI.escape(recipe.id)}">${UI.escape(recipe.name)}${!recipe.active ? ' (inactive)' : ''}</option>`).join('');
    if (item) form.querySelectorAll('[name]').forEach(field => { field.value = field.name === 'active' ? String(item.active !== false) : item[field.name] ?? ''; });
    else { form.elements.categoryId.value = 'MCAT-OTHER'; form.elements.limitedThreshold.value = '10'; }
    $('menuEditorTitle').textContent = id ? 'Edit Menu Item' : 'Add Menu Item';
    $('menuSave').textContent = id ? 'Save Changes' : 'Create Menu Item';
    $('menuSave').disabled = false; $('menuFormError').textContent = '';
    renderPreview(); editor.showModal(); form.elements.name.focus();
  }
  $('newMenuItem').addEventListener('click', () => openMenuForm());
  $('menuList').addEventListener('click', async event => {
    const edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-delete]');
    if (edit) openMenuForm(edit.dataset.edit);
    if (event.target.closest('[data-new]')) openMenuForm();
    if (remove) {
      const item = MenuService.getMenuItemById(remove.dataset.delete);
      if (!item || item.deletedAt) return;
      if (await showConfirm({ title: 'Delete menu item?', message: `${UI.escape(item.name)} will be removed from Menu and new sales entry. Its recipe and recorded sales will be kept.`, confirmLabel: 'Delete Item', danger: true })) {
        try { MenuService.deleteMenuItem(item.id); showToast('Menu item deleted.'); $('newMenuItem').focus(); }
        catch (error) { showToast(UI.escape(error.message), 'error'); }
      }
    }
  });
  editor.addEventListener('click', event => { if (event.target.closest('[data-close]')) editor.close(); });
  form.addEventListener('input', renderPreview);
  form.addEventListener('submit', event => {
    event.preventDefault(); if (state.saving) return;
    state.saving = true; $('menuSave').disabled = true;
    try {
      if (state.editing) {
        const current = MenuService.getMenuItemById(state.editing.id);
        if (!current || current.deletedAt || current.updatedAt !== state.editing.updatedAt) throw new Error('This item changed elsewhere. Close and reopen it before saving.');
        MenuService.updateMenuItem(state.editing.id, formValues());
      } else MenuService.createMenuItem(formValues());
      editor.close(); showToast(state.editing ? 'Menu changes saved.' : 'Menu item created.');
    } catch (error) { $('menuFormError').textContent = error.message; }
    finally { state.saving = false; $('menuSave').disabled = false; }
  });
  $('menuSearch').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); renderMenu(); });
  $('menuCategory').addEventListener('change', event => { state.category = event.target.value; renderMenu(); });
  $('menuStatus').addEventListener('change', event => { state.status = event.target.value; renderMenu(); });
  $('menuTypeFilter').addEventListener('click', event => { const button = event.target.closest('[data-type]'); if (!button) return; state.type = button.dataset.type; $('menuTypeFilter').querySelectorAll('button').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); }); renderMenu(); });
  for (const name of ['menu:changed', 'inventory:changed', 'recipes:changed', 'storage']) window.addEventListener(name, renderMenu);
  renderMenu();
})();
