const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = new Map();
const listeners = new Map();
const context = vm.createContext({ console, performance, Date, Map, Set, structuredClone,
  localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) },
  CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  addEventListener(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); },
  dispatchEvent(event) { (listeners.get(event.type) || []).forEach(fn => fn(event)); },
});
context.window = context;
const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
const run = code => vm.runInContext(code, context);
for (const file of fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(root, 'js', file), 'utf8'), { filename: file });
}
for (const name of ['inventory', 'recipe', 'menu', 'sales', 'theoretical-usage', 'business-performance']) load(`js/${name}-service.js`);
load('js/sample-data.js');
run('SampleDataService.load()');
const S = context.SalesService, T = context.TheoreticalUsageService;
const menu = context.MenuService.getMenuItems();
assert(menu.length > 0);
for (const type of ['PREP_ITEM', 'MENU_PRODUCT', 'COMBO']) {
  const recipes = context.RecipeService.getRecipes().filter(r => context.RecipeService.recipeTypeOf(r) === type);
  assert(recipes.length, `${type} fixture exists`);
  for (const recipe of recipes) {
    assert(Number.isFinite(context.RecipeService.calculateRecipeCost(recipe.id).unitCost));
    assert(context.RecipeService.resolveInventoryUsage(type, recipe.id, 1).length);
  }
}
const date = '2026-08-01';
const movements = data.get('inventoryMovements');
let eventCount = 0, oldEventCount = 0;
context.addEventListener('sales:changed', () => { if (S.getSales(date).length) assert.equal(S.getDaySummary(date).transactions, 5); eventCount++; });
context.addEventListener('menu-sales:changed', () => oldEventCount++);
S.saveDailySales({ date, rows: [{ menuItemId: menu[0].id, quantitySold: 10 }], transactions: 5 });
assert.equal(eventCount, 1); assert.equal(oldEventCount, 1);
let sale = S.getSales(date)[0];
const snapshot = JSON.stringify(sale.ingredientSnapshot);
const metrics = S.calculateMetrics(date);
assert.equal(metrics.netSales, 10 * sale.sellingPriceAtSale);
assert.equal(metrics.averageTicket, metrics.netSales / 5);
assert.equal(metrics.theoreticalCOGS, 10 * sale.theoreticalUnitCostAtSale);
assert.equal(metrics.theoreticalFoodCostPercent, metrics.theoreticalCOGS / metrics.netSales * 100);
assert.equal(S.getMenuMix(date)[0].salesMixPercent, 100);
for (const usage of T.calculateForDate(date)) {
  const expected = sale.ingredientSnapshot.filter(i => i.inventoryItemId === usage.inventoryItemId).reduce((n, i) => n + i.baseQuantityPerServing * 10, 0);
  assert.equal(usage.quantityUsed, expected);
  assert.equal(usage.theoreticalCost, expected * context.InventoryService.getBaseUnitCost(usage.inventoryItemId));
}
const recipe = context.RecipeService.getRecipeById(menu[0].recipeId);
context.RecipeService.updateRecipe(recipe.id, recipe, recipe.components.map(c => ({ ...c, quantity: c.quantity * 2 })));
S.saveDailySales({ date, rows: [{ menuItemId: menu[0].id, quantitySold: 12 }], transactions: 5 });
assert.equal(JSON.stringify(S.getSales(date)[0].ingredientSnapshot), snapshot);
assert.equal(S.getSales(date)[0].sellingPriceAtSale, sale.sellingPriceAtSale);
assert.equal(data.get('inventoryMovements'), movements, 'sales do not move inventory');
load('js/sales-service.js');
assert.equal(context.SalesService.getSales(date)[0].quantitySold, 12, 'reload persists');
assert.equal(S.getSales('1999-01-01').length, 0);
assert.throws(() => S.saveDailySales({ date, rows: [{ menuItemId: menu[0].id, quantitySold: NaN }], transactions: 5 }));
assert.throws(() => S.saveDailySales({ date, rows: [], transactions: -1 }));
const original = JSON.parse(data.get('menuSales'));
const legacy = { id: 'legacy', date: '2026-08-02', menuItemId: menu[0].id, quantitySold: 3 };
data.set('menuSales', JSON.stringify([...original, legacy]));
assert(T.calculateForDate(legacy.date).length, 'legacy recipe fallback');
assert(S.calculateMetrics(legacy.date).netSales > 0, 'legacy price fallback');
legacy.ingredientSnapshot = [];
data.set('menuSales', JSON.stringify([...original, legacy]));
assert.equal(T.calculateForDate(legacy.date).length, 0, 'empty snapshot is authoritative');
legacy.ingredientSnapshot = [{ inventoryItemId: 'missing-item', baseQuantityPerServing: 2 }];
data.set('menuSales', JSON.stringify([...original, legacy]));
assert.equal(T.calculateForDate(legacy.date)[0].quantityUsed, 6);
assert.equal(T.calculateForDate(legacy.date)[0].theoreticalCost, 0);
const duplicate = { ...original.find(s => s.date === date), id: 'duplicate' };
data.set('menuSales', JSON.stringify([...original, duplicate]));
assert.equal(S.getMenuMix(date)[0].quantity, 24);
S.saveDailySales({ date, rows: [{ menuItemId: menu[0].id, quantitySold: 24 }], transactions: 5 });
assert.equal(S.getSales(date).length, 2, 'legacy snapshots retained');
S.saveDailySales({ date, rows: [{ menuItemId: menu[0].id, quantitySold: 25 }], transactions: 5 });
assert.equal(S.getMenuMix(date)[0].quantity, 25);
S.deleteSale('duplicate');
assert.equal(S.getSales(date).length, 1);
S.saveSale({ date, menuItemId: menu[0].id, quantitySold: 0 });
assert.equal(S.getSales(date).length, 0);
assert.deepEqual(Object.keys(T).sort(), ['calculateForDate', 'calculateTheoreticalUsage']);
for (const html of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const text = fs.readFileSync(path.join(root, html), 'utf8');
  const scripts = [...text.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  for (const dependency of ['js/theoretical-usage-service.js', 'js/analytics-context.js']) {
    if (scripts.includes(dependency)) assert(scripts.indexOf('js/sales-service.js') >= 0 && scripts.indexOf('js/sales-service.js') < scripts.indexOf(dependency), html);
  }
}
assert(!/salesQuantity|salesMenuItem|id="saveSale"/.test(fs.readFileSync(path.join(root, 'menu-analysis.html'), 'utf8')));
console.log('PASS: recipe types, persistence, metrics, snapshots, legacy fallback, deletion, events, inventory isolation, and script dependencies');
// Render both pages with a minimal DOM and exercise their registered actions.
function element() {
  return { value: '', innerHTML: '', textContent: '', dataset: {}, handlers: {},
    addEventListener(type, fn) { this.handlers[type] = fn; } };
}
const elements = new Map();
context.document = {
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  querySelectorAll() { return context.testInputs || []; }
};
context.showToast = () => {};
load('js/sales.js');
assert(elements.get('salesTable').innerHTML.includes(menu[0].name));
elements.get('salesDate').value = '2026-08-03';
elements.get('transactionsInput').value = 4;
context.testInputs = [{ ...element(), value: '8', dataset: { menuItemId: menu[0].id } }];
elements.get('saveSalesButton').handlers.click();
assert.equal(S.getSales('2026-08-03')[0].quantitySold, 8);
assert.equal(S.getDaySummary('2026-08-03').transactions, 4);
assert(elements.get('menuMixTable').innerHTML.includes('100.0%'));
elements.get('salesDate').value = '1999-01-01';
elements.get('salesDate').handlers.change();
assert.equal(elements.get('transactionsInput').value, 0);
load('js/menu-analysis.js');
elements.get('analysisDate').value = '2026-08-03';
elements.get('analysisDate').handlers.change();
assert(elements.get('salesPerformance').innerHTML.includes(menu[0].name));
assert(elements.get('usageList').innerHTML.includes('theoretical'));
S.saveSale({ date: '2026-08-03', menuItemId: menu[0].id, quantitySold: 9 });
assert(elements.get('salesPerformance').innerHTML.includes('<span>9</span>'));
const rawBefore = data.get('menuSales');
elements.get('analysisDate').handlers.change();
assert.equal(data.get('menuSales'), rawBefore, 'analysis is read-only');
data.set('businessPerformance', JSON.stringify([{ date: '2020-01-01', netSales: 120, transactions: 6, laborHours: 2 }]));
assert.equal(S.calculateMetrics('2020-01-01').netSales, 120);
assert.equal(S.calculateMetrics('2020-01-01').averageTicket, 20);
context.BusinessPerformanceService.saveRecord({ date: '2020-01-01', laborHours: 3, netSales: 999 });
assert.equal(S.calculateMetrics('2020-01-01').netSales, 120, 'labor edits cannot rewrite sales');
console.log('PASS: sales entry/save/date changes, read-only analysis, live refresh, and legacy daily totals');
