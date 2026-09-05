# Sales ownership refactor

SalesService owns menuSales, daily summaries, persistence, metrics, and menu mix. TheoreticalUsageService calculates expected consumption only. Sales never create inventory movements. Menu Analysis is read-only and uses the selected business date. Existing CSS and visual classes are preserved.

## Files modified

- `activity.html`
- `business-performance.html`
- `daily-report.html`
- `equipment.html`
- `food-cost.html`
- `history.html`
- `index.html`
- `inventory-variance.html`
- `inventory.html`
- `js/analytics-context.js`
- `js/business-performance-service.js`
- `js/business-performance.js`
- `js/food-cost-service.js`
- `js/menu-analysis.js`
- `js/sales-service.js`
- `js/sales.js`
- `js/sample-data.js`
- `js/theoretical-usage-service.js`
- `js/variance-service.js`
- `menu-analysis.html`
- `purchasing.html`
- `settings.html`
- `sops.html`
- `team.html`
- `tests/sales-architecture.cjs` (added regression coverage)
- `docs/sales-architecture-refactor.md` (this report)

The additional HTML changes load SalesService before analytics/theoretical consumers. Business Performance retains labor entry but its existing sales and transaction fields are now read-only. Sample data uses SalesService.

## Functions removed

- TheoreticalUsageService: storage `read`/`write`, `getSales`, `saveSale`, and `calculateSalesMetrics`.
- Menu Analysis: `loadSalesOptions` and the `saveSale` button handler; removed menu/quantity entry controls and their variables.
- Removed duplicate calculations inside variance usage and Sales page preview metrics; existing rendering functions now delegate to services.

## Functions added

- TheoreticalUsageService: `calculateForDate(date, endDate = date)`.
- SalesService: `buildSalesForQuantity`, `getLegacySummaries`, `getSaleValues`, `previewSale`, and `previewDailySales`.
- Menu Analysis: `renderSalesPerformance` and `refreshAnalysis`.
- SalesService `getSales`, `calculateMetrics`, and `getMenuMix` additionally accept a date range.

## Compatibility

- Keeps menuSales and the existing salesDaySummaries key; introduces no new sales storage key.
- Keeps `calculateTheoreticalUsage` as a calculation alias and `item`, `itemId`, `baseQuantity` result fields alongside inventoryItemId, quantityUsed, theoreticalCost.
- Keeps both sales:changed and menu-sales:changed. Daily-save notifications fire after transactions and sales have been stored.
- Historical ingredient snapshots, prices, costs, IDs, and creation dates survive quantity edits. Legacy duplicate item/day sales retain their individual snapshots: increases extend the last stored entry; decreases reduce the newest entries first. Sales omitted from a daily form, including retired menu items, are retained.
- Sales without snapshots resolve recipeIdAtSale, or the current menu recipe when the former is absent, through RecipeService. An empty snapshot is authoritative. Missing recipe dependencies report an error rather than silently producing partial usage.
- Missing financial snapshots fall back to current menu/recipe values. Historical Business Performance daily totals remain a read-only fallback in SalesService when itemized sales and an explicit daily summary do not supersede them. Labor edits cannot change those legacy totals.

## Verification

Run `node tests/sales-architecture.cjs`.

Passed using Node 24.18.1 bundled with VS Code: syntax validation for top-level JavaScript files, actual inventory/recipe/menu service integration, PREP_ITEM/MENU_PRODUCT/COMBO costing and resolution, sales saves and reloads, transactions, net sales, average ticket, COGS, food cost percentage, menu mix, date filtering, snapshot preservation after recipe edits, duplicate legacy records, missing inventory references, deletion, event timing, and unchanged inventory movements. A simulated DOM exercises Sales entry/save/date changes and read-only Menu Analysis refresh. HTML dependency order and removal of old controls are checked. `git diff --check` passed.

Browser automation CLI is unavailable in this environment. Simulated-DOM checks do not establish visual rendering or real browser interaction; those remain unverified.

## Remaining technical debt

- Historical recipes cannot be reconstructed for records that never stored snapshots. The fallback necessarily uses available recipes.
- Usage valuation uses current InventoryService base-unit costs. Historical financial COGS still uses sale-time costs when present; these values may diverge as inventory prices change.
- Legacy aggregate daily sales cannot provide ingredient usage or menu mix without itemized sales.
- localStorage writes to sales and summaries are separate operations, not an atomic transaction.
- Temporary legacy event/API aliases remain for compatibility.

No duplicate interactive sales-entry logic remains: sales are entered on Sales; Menu Analysis calculates and displays results, and Business Performance only edits labor/notes. Backup/restore and sample-data setup retain their existing roles.
