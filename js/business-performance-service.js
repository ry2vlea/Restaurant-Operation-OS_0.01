(function () {
  const key = "businessPerformance";

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function write(values) {
    localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("business-performance:changed"));
    return values;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function getByDate(date = today()) {
    const record = read().find((record) => record.date === date);
    const metrics = SalesService.calculateMetrics(date);
    return record || metrics.unitsSold || metrics.transactions
      ? { ...record, date, netSales: metrics.netSales, transactions: metrics.transactions } : null;
  }

  function saveRecord(values) {
    const date = values.date || today();
    const now = new Date().toISOString();
    const existing = getByDate(date);
    const record = {
      ...read().find((value) => value.date === date),
      id: existing?.id || `PERF-${date.replaceAll("-", "")}`,
      date,
      laborHours: Number(values.laborHours || 0),
      laborDollars: Number(values.laborDollars || 0),
      notes: values.notes || "",
      enteredBy: values.enteredBy || localStorage.getItem("currentManager") || "Jordan Lee",
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    write(existing ? read().map((value) => value.date === date ? record : value) : [...read(), record]);
    window.recordActivity?.({ action: "BUSINESS_PERFORMANCE_SAVED", entityType: "BUSINESS_PERFORMANCE", entityId: record.id, description: `Business performance saved for ${date}` });
    return record;
  }

  function derive(record) {
    if (!record) return null;
    const netSales = Number(record.netSales || 0);
    const transactions = Number(record.transactions || 0);
    const laborHours = Number(record.laborHours || 0);
    const laborDollars = Number(record.laborDollars || 0);
    return {
      ...record,
      averageTicket: transactions > 0 ? netSales / transactions : null,
      laborPercent: netSales > 0 ? laborDollars / netSales * 100 : null,
      salesPerLaborHour: laborHours > 0 ? netSales / laborHours : null
    };
  }

  function recordsInRange(startDate, endDate) {
    const dates = new Set([...read().map((record) => record.date), ...SalesService.getSales().map((sale) => sale.date)]);
    return [...dates].filter((date) => (!startDate || date >= startDate) && (!endDate || date <= endDate))
      .map(getByDate).sort((a, b) => b.date.localeCompare(a.date));
  }

  window.BusinessPerformanceService = { getRecords: recordsInRange, getByDate, saveRecord, derive, recordsInRange };
})();
