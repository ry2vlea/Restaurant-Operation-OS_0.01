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
    return read().find((record) => record.date === date) || null;
  }

  function saveRecord(values) {
    const date = values.date || today();
    const now = new Date().toISOString();
    const existing = getByDate(date);
    const record = {
      id: existing?.id || `PERF-${date.replaceAll("-", "")}`,
      date,
      netSales: Number(values.netSales || 0),
      transactions: Number(values.transactions || 0),
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
    return read().filter((record) => (!startDate || record.date >= startDate) && (!endDate || record.date <= endDate)).sort((a, b) => b.date.localeCompare(a.date));
  }

  window.BusinessPerformanceService = { getRecords: read, getByDate, saveRecord, derive, recordsInRange };
})();
