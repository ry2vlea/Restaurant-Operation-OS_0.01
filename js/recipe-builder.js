(function () {
  const UI = RecipeUI, $ = id => document.getElementById(id);
  const recipeId = new URLSearchParams(window.location.search).get('id');
  const existing = recipeId ? RecipeService.getRecipeById(recipeId) : null;
  const state = { mode: recipeId ? 'edit' : 'create', recipeId,
    draft: existing || { name: '', type: null, yieldQuantity: 1, yieldUnitId: 'UNIT-EA', producedInventoryItemId: null, components: [], active: true, instructions: '', notes: '' },
    dirty: false, saving: false, pickerType: null, trackProduction: Boolean(existing?.producedInventoryItemId) };
  const form = $('recipeBuilder'), picker = $('componentPicker');
  const serialize = () => JSON.stringify({ draft: state.draft, trackProduction: state.trackProduction });
  let baseline = serialize();
  if (recipeId && !existing) {
    $('typeSection').hidden = true;
    $('builderError').hidden = false;
    $('builderError').className = 'recipe-panel recipe-error';
    $('builderError').textContent = 'Recipe not found. Return to Recipes to choose an existing recipe.';
    return;
  }
  function markDirty() {
    state.dirty = serialize() !== baseline;
    $('dirtyState').textContent = state.dirty ? 'Unsaved changes' : 'No unsaved changes';
  }
  function renderHeader() {
    $('builderMode').textContent = state.mode === 'edit' ? 'EDIT RECIPE' : 'NEW RECIPE';
    $('builderTitle').textContent = state.mode === 'edit' ? state.draft.name || 'Recipe Builder' : 'Recipe Builder';
    $('builderTypeBadge').innerHTML = state.draft.type ? UI.badge(state.draft.type) : '';
    if (existing) $('builderMeta').textContent = `Version ${existing.version} · Last updated ${existing.updatedAt ? new Date(existing.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'not recorded'}`;
    $('saveRecipe').textContent = state.mode === 'edit' ? 'Save Changes' : 'Create Recipe';
    $('typeSection').hidden = state.mode === 'edit';
    $('dependenciesSection').hidden = !existing;
    if (existing) $('recipeDependencies').innerHTML = UI.dependencies(existing.id);
  }
  function renderRecipeInfo() {
    for (const key of ['name', 'active', 'yieldQuantity', 'yieldUnitId', 'instructions', 'notes']) form.elements[key].value = state.draft[key] ?? '';
    $('recipeType').value = UI.labels[state.draft.type] || '';
    const prep = state.draft.type === 'PREP_ITEM';
    $('yieldSection').querySelector('.form-grid').hidden = !prep;
    $('fixedYield').hidden = prep;
    $('productionSection').hidden = !prep;
    $('trackProduction').checked = state.trackProduction;
    $('producedItemLabel').hidden = !state.trackProduction;
    const items = InventoryService.getItems().filter(item => item.active !== false || item.id === state.draft.producedInventoryItemId);
    $('producedItem').innerHTML = '<option value="">Select Inventory Item</option>' + items.map(item => `<option value="${UI.escape(item.id)}">${UI.escape(item.name)}${item.active === false ? ' (inactive)' : ''}</option>`).join('');
    if (state.draft.producedInventoryItemId && !items.some(item => item.id === state.draft.producedInventoryItemId)) $('producedItem').add(new Option('Missing inventory item', state.draft.producedInventoryItemId));
    $('producedItem').value = state.draft.producedInventoryItemId || '';
    $('componentHint').textContent = prep ? 'Inventory ingredients for one batch.' : state.draft.type === 'COMBO' ? 'Menu products plus packaging and other inventory.' : 'Inventory items and prepared components for one product.';
  }
  function renderComponents() {
    const groups = state.draft.type === 'COMBO' ? [['Menu Products', 'MENU_PRODUCT'], ['Packaging / Other Inventory', 'INVENTORY_ITEM']] : [['', null]];
    $('ingredients').innerHTML = groups.map(([label, type]) => {
      const rows = state.draft.components.map((component, index) => {
        if (type && component.sourceType !== type) return '';
        const record = UI.source(component), units = RecipeService.getComponentUnits(component);
        if (component.unitId && !units.some(unit => unit.id === component.unitId)) units.push({ id: component.unitId, abbreviation: `${UI.unit(component.unitId)} (legacy / invalid)` });
        return `<div class="recipe-edit-component" data-row="${index}"><div class="recipe-component-name"><strong>${UI.escape(record?.name || 'Missing component')}</strong>${UI.badge(component.sourceType)}</div><label>Quantity<input aria-label="Quantity for ${UI.escape(record?.name || 'component')}" data-index="${index}" data-field="quantity" type="number" step="any" min="0.000001" value="${UI.escape(component.quantity)}"></label><label>Unit<select aria-label="Unit for ${UI.escape(record?.name || 'component')}" data-index="${index}" data-field="unitId">${units.map(unit => `<option value="${UI.escape(unit.id)}" ${unit.id === component.unitId ? 'selected' : ''}>${UI.escape(unit.abbreviation)}</option>`).join('')}</select></label><div class="recipe-component-cost"><small>Cost</small><strong data-cost="${index}">Cost unavailable</strong></div><button type="button" class="icon-button" data-remove="${index}" aria-label="Remove ${UI.escape(record?.name || 'component')}">×</button></div>`;
      }).join('');
      return `${label ? `<h3 class="recipe-group-heading">${label}</h3>` : ''}${rows || '<div class="recipe-empty-inline">No components yet. Add a component to get started.</div>'}`;
    }).join('');
  }
  function refreshCostAndHealth() {
    if (!state.draft.type) return;
    const result = RecipeService.getRecipeHealth(state.draft);
    if (state.trackProduction && !state.draft.producedInventoryItemId) {
      result.valid = false;
      result.warnings.push({ severity: 'error', message: 'Select the produced Inventory Item.' });
    }
    $('costSummary').innerHTML = UI.costSummary(state.draft, result.cost);
    $('recipeHealth').innerHTML = UI.health(result);
    $('saveRecipe').disabled = !result.valid || state.saving;
    $('ingredients').querySelectorAll('[data-cost]').forEach(element => {
      const line = result.cost?.lines[Number(element.dataset.cost)];
      element.textContent = line?.missingCost ? 'Missing Cost' : UI.money(line?.cost);
    });
    markDirty();
  }
  function renderPicker() {
    const allowed = RecipeService.allowedSourceTypes(state.draft.type);
    if (!allowed.includes(state.pickerType)) state.pickerType = allowed[0];
    $('pickerTabs').innerHTML = allowed.map(type => `<button type="button" data-picker-type="${type}" class="${type === state.pickerType ? 'active' : ''}" aria-pressed="${type === state.pickerType}">${UI.labels[type]}</button>`).join('');
    const query = $('componentSearch').value.trim().toLowerCase();
    const records = state.pickerType === 'INVENTORY_ITEM' ? InventoryService.getItems() : RecipeService.getRecipes().filter(recipe => recipe.type === state.pickerType && recipe.id !== state.recipeId);
    const categories = InventoryService.getCategories();
    const matches = records.filter(record => record.active !== false && `${record.name} ${record.sku || ''} ${record.categoryId || ''} ${categories.find(category => category.id === record.categoryId)?.name || ''}`.toLowerCase().includes(query));
    $('pickerResults').innerHTML = matches.map(record => {
      const included = state.draft.components.some(component => component.sourceType === state.pickerType && component.sourceId === record.id);
      let detail = UI.unit(record.baseUnitId);
      if (state.pickerType !== 'INVENTORY_ITEM') {
        const cost = RecipeService.getRecipeHealth(record).cost;
        detail = record.type === 'PREP_ITEM' ? `Yield ${record.yieldQuantity} ${UI.unit(record.yieldUnitId)} · Cost / ${UI.unit(record.yieldUnitId)}: ${UI.money(cost?.unitCost, 4)}` : `Recipe Cost: ${UI.money(cost?.unitCost)}`;
      }
      return `<button type="button" class="recipe-picker-result" data-pick="${UI.escape(record.id)}"><span><strong>${UI.escape(record.name)}</strong><small>${UI.escape(record.sku || '')} ${UI.escape(detail)}</small></span><span>${included ? 'Included ✓' : '+ Add'}${UI.badge(state.pickerType)}</span></button>`;
    }).join('') || '<div class="empty-state"><h3>No matching components</h3><p>Try another search or add a source record in Inventory or Recipes.</p></div>';
  }
  $('yieldUnit').innerHTML = InventoryService.getUnits().map(unit => `<option value="${UI.escape(unit.id)}">${UI.escape(unit.abbreviation)}</option>`).join('');
  $('typeSelector').addEventListener('click', async event => {
    const button = event.target.closest('[data-type]');
    if (!button || state.mode !== 'create' || button.dataset.type === state.draft.type) return;
    const allowed = RecipeService.allowedSourceTypes(button.dataset.type);
    const incompatible = state.draft.components.some(component => !allowed.includes(component.sourceType));
    if (incompatible && !await showConfirm({ title: 'Change recipe type?', message: 'Components that are not supported by the new type will be removed.', confirmLabel: 'Change Type' })) return;
    state.draft.type = button.dataset.type;
    state.draft.components = state.draft.components.filter(component => allowed.includes(component.sourceType));
    if (state.draft.type !== 'PREP_ITEM') { state.draft.yieldQuantity = 1; state.draft.yieldUnitId = 'UNIT-EA'; state.draft.producedInventoryItemId = null; state.trackProduction = false; }
    $('typeSelector').querySelectorAll('[data-type]').forEach(card => card.setAttribute('aria-pressed', String(card === button)));
    form.hidden = false; renderHeader(); renderRecipeInfo(); renderComponents(); refreshCostAndHealth();
  });
  form.addEventListener('input', event => {
    const field = event.target;
    if (field.dataset.field) {
      const component = state.draft.components[Number(field.dataset.index)];
      component[field.dataset.field] = field.dataset.field === 'quantity' ? Number(field.value) : field.value;
    } else if (field.id === 'trackProduction') {
      state.trackProduction = field.checked;
      if (!field.checked) state.draft.producedInventoryItemId = null;
      $('producedItemLabel').hidden = !field.checked;
      $('producedItem').value = state.draft.producedInventoryItemId || '';
    } else if (field.name) {
      state.draft[field.name] = field.name === 'active' ? field.value === 'true' : field.name === 'yieldQuantity' ? Number(field.value) : field.name === 'producedInventoryItemId' ? field.value || null : field.value;
    }
    $('saveError').textContent = ''; refreshCostAndHealth();
  });
  $('ingredients').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    state.draft.components.splice(Number(button.dataset.remove), 1);
    renderComponents(); refreshCostAndHealth(); $('addIngredient').focus();
  });
  $('addIngredient').addEventListener('click', () => { $('componentSearch').value = ''; $('pickerMessage').textContent = ''; renderPicker(); picker.showModal(); $('componentSearch').focus(); });
  $('closePicker').addEventListener('click', () => picker.close());
  $('componentSearch').addEventListener('input', renderPicker);
  $('pickerTabs').addEventListener('click', event => { const button = event.target.closest('[data-picker-type]'); if (button) { state.pickerType = button.dataset.pickerType; renderPicker(); } });
  $('pickerResults').addEventListener('click', event => {
    const button = event.target.closest('[data-pick]'); if (!button) return;
    if (state.draft.components.some(component => component.sourceType === state.pickerType && component.sourceId === button.dataset.pick)) { $('pickerMessage').textContent = 'This component is already included.'; return; }
    const component = { sourceType: state.pickerType, sourceId: button.dataset.pick, quantity: 1 };
    const record = UI.source(component);
    component.unitId = state.pickerType === 'INVENTORY_ITEM' ? record.baseUnitId : record.yieldUnitId || 'UNIT-EA';
    state.draft.components.push(component); picker.close(); renderComponents(); refreshCostAndHealth();
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); if (state.saving) return;
    try {
      if (state.trackProduction && !state.draft.producedInventoryItemId) throw new Error('Select the produced Inventory Item.');
      if (state.mode === 'edit') {
        const current = RecipeService.getRecipeById(state.recipeId);
        if (!current || current.updatedAt !== existing.updatedAt) throw new Error('This recipe changed in another session. Reload before saving to avoid overwriting newer changes.');
      }
      RecipeService.validateRecipe(state.draft);
      state.saving = true; $('saveRecipe').disabled = true;
      if (state.mode === 'edit') RecipeService.updateRecipe(state.recipeId, state.draft);
      else RecipeService.createRecipe(state.draft);
      baseline = serialize(); state.dirty = false;
      showToast(state.mode === 'edit' ? 'Recipe changes saved.' : 'Recipe created.');
      window.location.href = 'recipes.html';
    } catch (error) { state.saving = false; $('saveError').textContent = error.message; refreshCostAndHealth(); }
  });
  window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href]');
    if (!link || !state.dirty || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (await showConfirm({ title: 'Discard unsaved changes?', message: 'Your recipe changes have not been saved.', confirmLabel: 'Discard Changes', danger: true })) { state.dirty = false; window.location.href = link.href; }
  });
  for (const name of ['inventory:changed', 'recipes:changed', 'storage']) window.addEventListener(name, () => { if (!state.saving && state.draft.type) { renderComponents(); refreshCostAndHealth(); if (existing) $('recipeDependencies').innerHTML = UI.dependencies(existing.id); } });
  renderHeader();
  if (existing) { form.hidden = false; renderRecipeInfo(); renderComponents(); refreshCostAndHealth(); }
})();
