(function () {
  function salesFor(date) {
    const perf = window.BusinessPerformanceService?.getByDate?.(date);
    return Number(perf?.netSales || 0);
  }

  function theoreticalUsageCost(date) {
    return TheoreticalUsageService.calculateTheoreticalUsage(date).reduce((total, entry) => total + Number(entry.baseQuantity || 0) * InventoryService.getBaseUnitCost(entry.item), 0);
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

  function calculate(date = new Date().toISOString().slice(0, 10)) {
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

  window.FoodCostService = { calculate };
})();
