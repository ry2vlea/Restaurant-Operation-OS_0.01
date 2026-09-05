const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = new Map(), listeners = new Map();
const context = vm.createContext({ console, performance, structuredClone,
  localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) },
  CustomEvent: class { constructor(type) { this.type = type; } },
  addEventListener(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); },
  dispatchEvent(event) { (listeners.get(event.type) || []).forEach(fn => fn(event)); }
});
context.window = context;
const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
for (const name of ['inventory', 'recipe', 'menu', 'sales', 'theoretical-usage', 'production', 'food-cost']) load(`js/${name}-service.js`);
load('js/analytics-context.js');
const R = context.RecipeService, I = context.InventoryService, M = context.MenuService, S = context.SalesService;
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function inventory(name, baseUnitId, baseUnitCost) {
  return I.createItem({ name, sku: name, primaryUnitId: baseUnitId, baseUnitId, baseUnitCost,
    defaultLocationId: 'LOC-PREP', categoryId: 'CAT-OTHER' });
}
const mayo = inventory('Mayo', 'UNIT-OZ', .1), ketchup = inventory('Ketchup', 'UNIT-OZ', .2), seasoning = inventory('Seasoning', 'UNIT-OZ', .5);
const filet = inventory('Filet', 'UNIT-EA', 1.8), bun = inventory('Bun', 'UNIT-EA', .35), pickles = inventory('Pickles', 'UNIT-EA', .05), wrapper = inventory('Wrapper', 'UNIT-EA', .02);
const fry = inventory('Fries', 'UNIT-EA', .6), drink = inventory('Drink', 'UNIT-EA', .4), bag = inventory('Bag', 'UNIT-EA', .08), napkin = inventory('Napkin', 'UNIT-EA', .01);
const inv = (item, quantity) => ({ sourceType: 'INVENTORY_ITEM', sourceId: item.id, quantity, unitId: item.baseUnitId });
const prepComponents = [inv(mayo, 96), inv(ketchup, 24), inv(seasoning, 8)];
const sauce = R.createRecipe({ name: 'House Sauce', type: 'PREP_ITEM', yieldQuantity: 128, yieldUnitId: 'UNIT-OZ', components: prepComponents, sellingPrice: 99, targetFoodCostPercent: 20 });
assert(!('sellingPrice' in sauce)); assert(!('targetFoodCostPercent' in sauce));
near(R.calculateRecipeCost(sauce.id).totalCost, 18.4);
near(R.calculateRecipeCost(sauce.id).unitCost, .14375);
const usage = (type, id, qty, options) => new Map(R.resolveInventoryUsage(type, id, qty, options).map(line => [line.itemId, line.baseQuantity]));
near(usage('PREP_ITEM', sauce.id, 128).get(mayo.id), 96);
near(usage('PREP_ITEM', sauce.id, 1).get(ketchup.id), .1875);
const sandwichComponents = [inv(filet, 1), inv(bun, 1), { sourceType: 'PREP_ITEM', sourceId: sauce.id, quantity: .5, unitId: 'UNIT-OZ' }, inv(pickles, 2), inv(wrapper, 1)];
const sandwich = R.createRecipe({ name: 'Chicken Sandwich', type: 'MENU_PRODUCT', components: sandwichComponents });
near(R.calculateRecipeCost(sandwich.id).unitCost, 2.341875);
near(usage('MENU_PRODUCT', sandwich.id, 1).get(mayo.id), .375);
const fries = R.createRecipe({ name: 'Regular Fries', type: 'MENU_PRODUCT', components: [inv(fry, 1)] });
const soda = R.createRecipe({ name: 'Drink', type: 'MENU_PRODUCT', components: [inv(drink, 1)] });
const comboComponents = [sandwich, fries, soda].map(recipe => ({ sourceType: 'MENU_PRODUCT', sourceId: recipe.id, quantity: 1, unitId: 'UNIT-EA' })).concat([inv(bag, 1), inv(napkin, 2)]);
const combo = R.createRecipe({ name: 'Chicken Sandwich Combo', type: 'COMBO', components: comboComponents });
near(R.calculateRecipeCost(combo.id).unitCost, 3.441875);
near(usage('COMBO', combo.id, 10).get(mayo.id), 3.75);
near(usage('COMBO', combo.id, 10).get(napkin.id), 20);
// GAL/OZ conversion uses the exact same engine for preview, costing, and usage.
R.updateRecipe(sauce.id, { yieldQuantity: 1, yieldUnitId: 'UNIT-GAL' });
near(R.calculateRecipeCost(sandwich.id).unitCost, 2.341875);
near(R.calculateRecipePreview({ name: 'Preview', type: 'MENU_PRODUCT', components: sandwichComponents }).unitCost, 2.341875);
near(R.convertYieldQuantity(R.getRecipeById(sauce.id), 4, 'UNIT-OZ'), 1 / 32);
near(usage('PREP_ITEM', sauce.id, 4, { unitId: 'UNIT-OZ' }).get(mayo.id), 3);
assert.throws(() => R.convertYieldQuantity(R.getRecipeById(sauce.id), 1, 'UNIT-LB'), /conversion/);
// Enforce allowed types on create and update, even with a warmed cost cache.
for (const [type, allowed] of Object.entries({ PREP_ITEM: ['INVENTORY_ITEM'], MENU_PRODUCT: ['INVENTORY_ITEM', 'PREP_ITEM'], COMBO: ['MENU_PRODUCT', 'INVENTORY_ITEM'] })) {
  for (const sourceType of ['INVENTORY_ITEM', 'PREP_ITEM', 'MENU_PRODUCT', 'COMBO']) {
    if (allowed.includes(sourceType)) continue;
    const sourceId = { PREP_ITEM: sauce.id, MENU_PRODUCT: sandwich.id, COMBO: combo.id, INVENTORY_ITEM: bun.id }[sourceType];
    const values = { name: 'Invalid', type, components: [{ sourceType, sourceId, quantity: 1, unitId: 'UNIT-EA' }] };
    assert.throws(() => R.createRecipe(values), /cannot contain/);
  }
}
assert.throws(() => R.createRecipe({ name: 'Invalid', type: 'BOGUS', components: [inv(bun, 1)] }), /valid recipe type/);
for (const quantity of [0, -1, Infinity, NaN]) {
  assert.throws(() => R.updateRecipe(sandwich.id, { components: [{ sourceType: 'PREP_ITEM', sourceId: sauce.id, quantity, unitId: 'UNIT-OZ' }] }));
}
assert.throws(() => R.updateRecipe(sauce.id, { yieldQuantity: 0 }), /yield/);
assert.throws(() => R.updateRecipe(sauce.id, { producedInventoryItemId: 'missing' }), /Produced Inventory/);
assert.throws(() => R.updateRecipe(combo.id, { components: [{ sourceType: 'MENU_PRODUCT', sourceId: sauce.id, quantity: 1 }] }), /type does not match/);
assert.throws(() => R.resolveComponentCost('MENU_PRODUCT', sauce.id), /valid MENU PRODUCT/);
assert.throws(() => R.resolveInventoryUsage('MENU_PRODUCT', sauce.id, 1), /type does not match/);
assert.throws(() => R.updateRecipe(sauce.id, { type: 'MENU_PRODUCT' }), /referenced/);
assert.throws(() => R.updateRecipe(combo.id, { components: [{ sourceType: 'MENU_PRODUCT', sourceId: combo.id, quantity: 1 }] }), /Circular/);
assert.throws(() => R.updateRecipe(combo.id, { components: [{ sourceType: 'MENU_PRODUCT', sourceId: sandwich.id, quantity: 1, unitId: 'UNIT-GAL' }] }), /Each/);
// Editing copies cannot mutate cached recipes; material edits increment versions.
const editing = R.getRecipeById(sandwich.id), previousVersion = editing.version;
editing.components[0].quantity = 2;
assert.equal(R.getRecipeById(sandwich.id).components[0].quantity, 1);
R.updateRecipe(sandwich.id, { components: editing.components });
assert.equal(R.getRecipeById(sandwich.id).version, previousVersion + 1);
R.updateRecipe(sandwich.id, { sellingPrice: 500, targetFoodCostPercent: 1 });
assert.equal(R.getRecipeById(sandwich.id).version, previousVersion + 1);
const menu = M.createMenuItem({ name: 'Combo', recipeId: combo.id, sellingPrice: 10, targetFoodCostPercent: 25 });
near(M.calculateMenuMetrics(menu).suggestedSellingPrice, R.calculateRecipeCost(combo.id).unitCost * 4);
const beforeMovements = data.get('inventoryMovements');
S.saveSale({ date: '2026-09-01', menuItemId: menu.id, quantitySold: 10 });
const snapshot = JSON.stringify(S.getSales('2026-09-01')[0]);
R.updateRecipe(sandwich.id, { components: sandwichComponents });
assert.equal(JSON.stringify(S.getSales('2026-09-01')[0]), snapshot);
assert.equal(data.get('inventoryMovements'), beforeMovements);
assert(context.TheoreticalUsageService.calculateForDate('2026-09-01').length);
assert(context.FoodCostService.calculate('2026-09-01').theoreticalCost > 0);
// Tracked production consumes inputs and creates output; subrecipe-only prep cannot produce.
R.updateRecipe(sauce.id, { yieldQuantity: 128, yieldUnitId: 'UNIT-OZ' });
const output = inventory('Produced Sauce', 'UNIT-OZ', .1);
R.updateRecipe(sauce.id, { producedInventoryItemId: output.id });
for (const item of [mayo, ketchup, seasoning]) I.createInventoryMovement({ itemId: item.id, locationId: 'LOC-PREP', quantity: 1000, unitId: 'UNIT-OZ', movementType: 'RECEIVE', reason: 'Test stock' });
const batch = context.ProductionService.produce({ recipeId: sauce.id, actualYield: 128, batchMultiplier: 1, destinationLocationId: 'LOC-PREP', idempotencyKey: 'batch-1' });
near(batch.totalBatchCost, 18.4); near(batch.costPerYieldBaseUnit, .14375);
near(I.getCalculationContext().balances.byItem.get(output.id), 128);
near(I.getCalculationContext().balances.byItem.get(mayo.id), 904);
assert.equal(context.ProductionService.produce({ recipeId: sauce.id, actualYield: 128, idempotencyKey: 'batch-1' }).id, batch.id);
R.updateRecipe(sauce.id, { producedInventoryItemId: null });
assert.throws(() => context.ProductionService.produce({ recipeId: sauce.id, actualYield: 128 }), /produced Inventory/);
// Legacy fields and separate ingredient rows remain readable, without writes on read.
const raw = JSON.parse(data.get('recipes'));
raw.push({ id: 'legacy', name: 'Legacy', recipeType: 'MENU', sellingPrice: 77, targetFoodCostPercent: 13, version: 4 });
data.set('recipes', JSON.stringify(raw));
data.set('recipeIngredients', JSON.stringify([{ id: 'old-line', recipeId: 'legacy', inventoryItemId: bun.id, quantity: 2, unitId: 'UNIT-EA' }]));
context.dispatchEvent({ type: 'storage' });
const beforeRead = data.get('recipes');
near(R.calculateRecipeCost('legacy').totalCost, .7);
assert.equal(data.get('recipes'), beforeRead);
R.updateRecipe('legacy', { name: 'Legacy edited', sellingPrice: 999, targetFoodCostPercent: 99 });
const savedLegacy = JSON.parse(data.get('recipes')).find(r => r.id === 'legacy');
assert.equal(savedLegacy.sellingPrice, 77); assert.equal(savedLegacy.targetFoodCostPercent, 13);
assert(!('foodCostPercent' in R.calculateRecipeCost('legacy')));
assert.throws(() => R.updateRecipe('legacy', { components: [] }), /at least one/);
// Missing costs are incomplete in preview, rather than silently summed as zero.
const noCost = inventory('Missing cost', 'UNIT-EA', 0);
const incomplete = R.createRecipe({ name: 'Incomplete', type: 'MENU_PRODUCT', components: [inv(noCost, 1)] });
assert.equal(R.calculateRecipePreview(incomplete).totalCost, null);
assert(R.getRecipeWarnings(incomplete.id).some(w => w.type === 'MISSING_COST'));
const corrupt = JSON.parse(data.get('recipes'));
corrupt.push({ id: 'corrupt', name: 'Corrupt', type: 'MENU_PRODUCT', components: [{ sourceType: 'PREP_ITEM', sourceId: 'corrupt', quantity: 1 }] });
data.set('recipes', JSON.stringify(corrupt)); context.dispatchEvent({ type: 'storage' });
assert(R.getRecipeWarnings('corrupt').some(w => /Circular/.test(w.message)));
assert.throws(() => R.resolveInventoryUsage('MENU_PRODUCT', 'corrupt', 1), /Circular/);
console.log('PASS: A/B/C costs and usage, preview conversion, validation, versioning, legacy preservation, Sales, Food Cost, and Production');
