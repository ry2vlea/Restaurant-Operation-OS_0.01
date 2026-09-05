(function () {
  function datesInRange(startDate, endDate) {
    const dates = [];
    const current = parseDate(startDate);
    const end = parseDate(endDate);
    if (!current || !end) return dates;
    while (current <= end) {
      dates.push(formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function today() {
    return formatDate(new Date());
  }

  function salesFor(date) {
    return SalesService.calculateMetrics(date).netSales;
  }

  function theoreticalUsageCost(date) {
    return TheoreticalUsageService.calculateForDate(date).reduce((total, entry) => total + entry.theoreticalCost, 0);
  }

  function actualCogS(date) {
    const context = AnalyticsContext.build();
    const completed = context.counts.filter((count) => count.status === "COMPLETED" && count.date <= date).sort((a, b) => b.date.localeCompare(a.date));
    if (completed.length < 2) return null;
    const end = completed[0];
    const start = completed[1];
    const valueForCount = (count) => context.countLines
      .filter((line) => line.countId === count.id)
      .reduce((sum, line) => sum + Number(line.physicalQuantity || 0) * InventoryService.getBaseUnitCost(context.itemById.get(line.itemId)), 0);
    const purchases = context.movements
      .filter((movement) => movement.createdAt?.slice(0, 10) >= start.date && movement.createdAt?.slice(0, 10) <= end.date)
      .filter((movement) => ["RECEIVE", "RETURN"].includes(movement.movementType))
      .reduce((sum, movement) => sum + Number(movement.baseQuantity || 0) * Number(movement.unitCostAtMovement || InventoryService.getBaseUnitCost(context.itemById.get(movement.itemId))), 0);
    return valueForCount(start) + purchases - valueForCount(end);
  }

  function calculate(date = today()) {
    const netSales = salesFor(date);
    const theoreticalCost = theoreticalUsageCost(date);
    const actualCost = actualCogS(date);
    const waste = AnalyticsContext.build().waste.filter((record) => record.createdAt?.slice(0, 10) === date).reduce((sum, record) => sum + Number(record.wasteCost || 0), 0);
    const variance = window.VarianceService?.calculateLatest?.();
    return {
      date,
      netSales,
      theoreticalCost,
      theoreticalFoodCostPercent: netSales > 0 ? theoreticalCost / netSales * 100 : null,
      actualCost,
      actualFoodCostPercent: actualCost != null && netSales > 0 ? actualCost / netSales * 100 : null,
      foodCostVariancePoints: actualCost != null && netSales > 0 ? actualCost / netSales * 100 - theoreticalCost / netSales * 100 : null,
      targetFoodCostPercent: Number(window.SettingsService?.getSettings?.().targets?.foodCostPercent || localStorage.getItem("targetFoodCostPercent") || 30),
      wasteCost: waste,
      inventoryVarianceCost: variance?.totals?.netVariance ?? null,
      purchases: AnalyticsContext.build().movements.filter((movement) => movement.createdAt?.slice(0, 10) === date && movement.movementType === "RECEIVE").reduce((sum, movement) => sum + Number(movement.baseQuantity || 0) * Number(movement.unitCostAtMovement || 0), 0)
    };
  }

  function calculateRange(startDate = today(), endDate = startDate) {
    const dates = datesInRange(startDate, endDate);
    if (!dates.length) return calculate(today());
    const daily = dates.map((date) => calculate(date));
    const netSales = daily.reduce((total, entry) => total + Number(entry.netSales || 0), 0);
    const theoreticalCost = daily.reduce((total, entry) => total + Number(entry.theoreticalCost || 0), 0);
    const actualValues = daily.map((entry) => entry.actualCost).filter((value) => value != null);
    const actualCost = actualValues.length ? actualValues.reduce((total, value) => total + Number(value || 0), 0) : null;
    const wasteCost = daily.reduce((total, entry) => total + Number(entry.wasteCost || 0), 0);
    const purchases = daily.reduce((total, entry) => total + Number(entry.purchases || 0), 0);
    return {
      startDate,
      endDate,
      netSales,
      theoreticalCost,
      theoreticalFoodCostPercent: netSales > 0 ? theoreticalCost / netSales * 100 : null,
      actualCost,
      actualFoodCostPercent: actualCost != null && netSales > 0 ? actualCost / netSales * 100 : null,
      foodCostVariancePoints: actualCost != null && netSales > 0 ? actualCost / netSales * 100 - theoreticalCost / netSales * 100 : null,
      targetFoodCostPercent: daily[0]?.targetFoodCostPercent || Number(window.SettingsService?.getSettings?.().targets?.foodCostPercent || localStorage.getItem("targetFoodCostPercent") || 30),
      wasteCost,
      inventoryVarianceCost: window.VarianceService?.calculateForRange?.(startDate, endDate)?.totals?.netVariance ?? window.VarianceService?.calculateLatest?.().totals?.netVariance ?? null,
      purchases
    };
  }

  window.FoodCostService = { calculate, calculateRange };
})();
