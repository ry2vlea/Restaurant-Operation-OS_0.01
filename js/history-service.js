(function () {
  function days() {
    const context = AnalyticsContext.build();
    const dates = new Set();
    [
      ...context.shifts.map((x) => x.date),
      ...context.handovers.map((x) => x.date),
      ...context.issues.map((x) => x.createdAt?.slice(0, 10)),
      ...context.tasks.map((x) => x.createdAt?.slice(0, 10)),
      ...context.counts.map((x) => x.date),
      ...context.deliveries.map((x) => x.deliveryDate || x.createdAt?.slice(0, 10)),
      ...context.waste.map((x) => x.createdAt?.slice(0, 10)),
      ...context.production.map((x) => x.completedAt?.slice(0, 10)),
      ...context.menuSales.map((x) => x.date),
      ...context.businessPerformance.map((x) => x.date),
      ...context.dailyReports.map((x) => x.date)
    ].filter(Boolean).forEach((date) => dates.add(date));
    return [...dates].sort((a, b) => b.localeCompare(a)).map((date) => summaryForDate(date, context));
  }

  function summaryForDate(date, context = AnalyticsContext.build()) {
    const waste = context.waste.filter((record) => record.createdAt?.slice(0, 10) === date);
    const variance = window.VarianceService?.calculateLatest?.();
    return {
      date,
      shifts: context.shifts.filter((record) => record.date === date),
      handovers: context.handovers.filter((record) => record.date === date),
      issues: context.issues.filter((record) => record.createdAt?.slice(0, 10) === date),
      tasks: context.tasks.filter((record) => record.createdAt?.slice(0, 10) === date),
      counts: context.counts.filter((record) => record.date === date),
      deliveries: context.deliveries.filter((record) => (record.deliveryDate || record.createdAt?.slice(0, 10)) === date),
      waste,
      production: context.production.filter((record) => record.completedAt?.slice(0, 10) === date),
      menuSales: context.menuSales.filter((record) => record.date === date),
      businessPerformance: context.businessPerformance.find((record) => record.date === date) || null,
      dailyReport: context.dailyReports.find((record) => record.date === date) || null,
      wasteCost: waste.reduce((sum, record) => sum + Number(record.wasteCost || 0), 0),
      varianceCost: variance?.end?.date === date ? variance.totals.netVariance : null
    };
  }

  window.HistoryService = { days, summaryForDate };
})();
