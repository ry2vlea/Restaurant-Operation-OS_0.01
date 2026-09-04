(function () {
  const key = "inventoryVarianceReviews";
  const countCorrectionTypes = ["COUNT_CORRECTION_IN", "COUNT_CORRECTION_OUT"];
  const inTypes = ["RECEIVE", "RETURN", "ADJUSTMENT_IN", "TRANSFER_IN", "PRODUCTION_CREATE"];
  const outTypes = ["TRANSFER_OUT", "WASTE", "ADJUSTMENT_OUT", "PRODUCTION_CONSUME", "USE"];

  function readReviews() {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function saveReviews(values) {
    localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("variance:changed"));
    return values;
  }

  function latestCompletedCounts() {
    return AnalyticsContext.build().counts
      .filter((count) => count.status === "COMPLETED")
      .sort((a, b) => new Date(b.completedAt || b.startedAt || b.createdAt) - new Date(a.completedAt || a.startedAt || a.createdAt));
  }

  function physicalByCount(countId) {
    const map = new Map();
    AnalyticsContext.build().countLines.filter((line) => line.countId === countId).forEach((line) => {
      map.set(line.itemId, (map.get(line.itemId) || 0) + Number(line.physicalQuantity || 0));
    });
    return map;
  }

  function theoreticalUsageByItem(startDate, endDate) {
    const totals = new Map();
    AnalyticsContext.build().menuSales
      .filter((sale) => (!startDate || sale.date >= startDate) && (!endDate || sale.date <= endDate))
      .forEach((sale) => {
        (sale.ingredientSnapshot || []).forEach((ingredient) => {
          const used = Number(ingredient.baseQuantityPerServing || 0) * Number(sale.quantitySold || 0);
          totals.set(ingredient.inventoryItemId, (totals.get(ingredient.inventoryItemId) || 0) + used);
        });
      });
    return totals;
  }

  function calculate(startCountId, endCountId) {
    const context = AnalyticsContext.build();
    const counts = context.counts;
    const start = counts.find((count) => count.id === startCountId);
    const end = counts.find((count) => count.id === endCountId);
    if (!start || !end) return { status: "INSUFFICIENT_DATA", rows: [], totals: summary([]), start, end };
    const startTime = new Date(start.completedAt || start.startedAt || start.createdAt || 0);
    const endTime = new Date(end.completedAt || end.startedAt || end.createdAt || 0);
    if (!(startTime < endTime)) return { status: "INSUFFICIENT_DATA", rows: [], totals: summary([]), start, end };
    const beginning = physicalByCount(start.id);
    const ending = physicalByCount(end.id);
    const theoretical = theoreticalUsageByItem(start.date, end.date);
    const reviews = new Map(readReviews().map((review) => [review.id, review]));
    const rows = context.inventoryItems.map((item) => {
      const movementDelta = context.movements
        .filter((movement) => movement.itemId === item.id)
        .filter((movement) => {
          const timestamp = new Date(movement.createdAt || 0);
          return timestamp > startTime && timestamp <= endTime && !countCorrectionTypes.includes(movement.movementType);
        })
        .reduce((total, movement) => {
          const quantity = Number(movement.baseQuantity || 0);
          if (inTypes.includes(movement.movementType)) return total + quantity;
          if (outTypes.includes(movement.movementType)) return total - quantity;
          return total;
        }, 0);
      const beginningQuantity = beginning.get(item.id) || 0;
      const physicalEndingQuantity = ending.get(item.id) || 0;
      const expectedEndingQuantity = beginningQuantity + movementDelta - (theoretical.get(item.id) || 0);
      const varianceQuantity = physicalEndingQuantity - expectedEndingQuantity;
      const varianceValue = varianceQuantity * InventoryService.getBaseUnitCost(item);
      const id = `VAN-${start.id}-${end.id}-${item.id}`;
      const review = reviews.get(id);
      return {
        id,
        itemId: item.id,
        item,
        startCountId: start.id,
        endCountId: end.id,
        beginningQuantity,
        expectedEndingQuantity,
        physicalEndingQuantity,
        varianceQuantity,
        varianceValue,
        status: review?.status || "UNREVIEWED",
        reason: review?.reason || null,
        notes: review?.notes || "",
        reviewedBy: review?.reviewedBy || null,
        reviewedAt: review?.reviewedAt || null,
        createdAt: review?.createdAt || new Date().toISOString()
      };
    }).filter((row) => Math.abs(row.varianceQuantity) > 1e-9).sort((a, b) => a.varianceValue - b.varianceValue);
    return { status: "OK", start, end, rows, totals: summary(rows) };
  }

  function summary(rows) {
    return {
      netVariance: rows.reduce((total, row) => total + row.varianceValue, 0),
      itemsWithVariance: rows.length,
      significantExceptions: rows.filter((row) => Math.abs(row.varianceValue) >= Number(window.SettingsService?.getSettings?.().targets?.varianceAlertThreshold || 50)).length,
      explained: rows.filter((row) => row.status === "EXPLAINED" || row.status === "CLOSED").length,
      underReview: rows.filter((row) => row.status === "INVESTIGATING").length
    };
  }

  function calculateLatest() {
    const counts = latestCompletedCounts();
    if (counts.length < 2) return { status: "INSUFFICIENT_DATA", rows: [], totals: summary([]), start: counts[1], end: counts[0] };
    return calculate(counts[1].id, counts[0].id);
  }

  function calculateForRange(startDate, endDate) {
    const counts = AnalyticsContext.build().counts
      .filter((count) => count.status === "COMPLETED")
      .filter((count) => (!startDate || count.date >= startDate) && (!endDate || count.date <= endDate))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (counts.length < 2) return { status: "INSUFFICIENT_DATA", rows: [], totals: summary([]), start: counts[0], end: counts[counts.length - 1] };
    return calculate(counts[0].id, counts[counts.length - 1].id);
  }

  function reviewVariance(id, changes) {
    const reviews = readReviews();
    const existing = reviews.find((review) => review.id === id);
    const updated = {
      ...(existing || { id, createdAt: new Date().toISOString() }),
      status: changes.status || existing?.status || "INVESTIGATING",
      reason: changes.reason || null,
      notes: changes.notes || "",
      reviewedBy: localStorage.getItem("currentManager") || "Jordan Lee",
      reviewedAt: new Date().toISOString()
    };
    saveReviews(existing ? reviews.map((review) => review.id === id ? updated : review) : [...reviews, updated]);
    window.recordActivity?.({ action: "INVENTORY_VARIANCE_REVIEWED", entityType: "INVENTORY_VARIANCE", entityId: id, description: `Variance reviewed: ${updated.status}` });
    return updated;
  }

  window.VarianceService = { calculate, calculateLatest, calculateForRange, latestCompletedCounts, reviewVariance };
})();
