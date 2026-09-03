(function () {
  const key = "dailyReports";
  const today = () => new Date().toISOString().slice(0, 10);
  const read = (name) => { try { const value = JSON.parse(localStorage.getItem(name)); return Array.isArray(value) ? value : []; } catch (error) { return []; } };
  function getReports() { return read(key); }
  function saveReports(reports) { localStorage.setItem(key, JSON.stringify(reports)); window.dispatchEvent(new CustomEvent("daily-reports:changed")); return reports; }
  function getReport(date = today()) { return getReports().find((report) => report.date === date) || null; }
  function metrics(date = today()) {
    const shifts = read("shifts").filter((shift) => shift.date === date);
    const issues = read("issues").filter((issue) => issue.createdAt?.slice(0, 10) === date);
    const tasks = read("tasks");
    const completedTasks = tasks.filter((task) => task.completedAt?.slice(0, 10) === date);
    const pendingTasks = tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status));
    const overdue = pendingTasks.filter((task) => task.dueDate && new Date(`${task.dueDate}T${task.dueTime || "23:59"}`) < new Date());
    const inventoryItems = read("inventoryItems");
    const movements = read("inventoryMovements");
    const waste = read("wasteRecords").filter((record) => record.createdAt?.slice(0, 10) === date);
    const inventoryBalances = inventoryItems.map((item) => ({ item, quantity: movements.filter((movement) => movement.itemId === item.id).reduce((total, movement) => total + (movement.direction === "IN" ? movement.baseQuantity : -movement.baseQuantity), 0) }));
    const inventory = { critical: inventoryBalances.filter(({ item, quantity }) => quantity > 0 && quantity <= Number(item.minimumLevel || 0)).length, outOfStock: inventoryBalances.filter(({ quantity }) => quantity <= 0).length, wasteEntries: waste.length, wasteCost: waste.reduce((total, record) => total + Number(record.wasteCost || 0), 0) };
    return { shifts, issues, tasks, handovers: read("handovers").filter((handover) => handover.date === date), shiftsCompleted: shifts.filter((shift) => shift.status.startsWith("COMPLETED")).length, issuesCreated: issues.length, issuesResolved: issues.filter((issue) => issue.resolvedAt?.slice(0, 10) === date).length, issuesOpenAtClose: issues.filter((issue) => !["RESOLVED", "CLOSED"].includes(issue.status)).length, tasksCompleted: completedTasks.length, tasksPendingAtClose: pendingTasks.length, overdueTasksAtClose: overdue.length, inventory };
  }
  function createReport(date = today()) { const existing = getReport(date); if (existing) return existing; const now = new Date().toISOString(); const report = { id: `DOR-${date.replaceAll("-", "")}`, date, status: "DRAFT", preparedBy: localStorage.getItem("currentManager") || "Jordan Lee", overallStatus: "MINOR_ISSUES", executiveSummary: "", whatWorkedWell: "", mainOperationalChallenge: "", correctiveActions: "", trainingOpportunity: "", tomorrowPriority: "", additionalNotes: "", snapshot: null, createdAt: now, updatedAt: now, completedAt: null }; saveReports([...getReports(), report]); return report; }
  function updateReport(id, changes) { const reports = getReports().map((report) => report.id === id ? { ...report, ...changes, updatedAt: new Date().toISOString() } : report); saveReports(reports); return getReports().find((report) => report.id === id); }
  function finalizeReport(id) { const report = getReports().find((item) => item.id === id); const data = metrics(report.date); const snapshot = { shifts: data.shifts, issues: data.issues, tasks: data.tasks, handovers: data.handovers, inventory: data.inventory, metrics: { shiftsCompleted: data.shiftsCompleted, issuesCreated: data.issuesCreated, issuesResolved: data.issuesResolved, issuesOpenAtClose: data.issuesOpenAtClose, tasksCompleted: data.tasksCompleted, tasksPendingAtClose: data.tasksPendingAtClose, overdueTasksAtClose: data.overdueTasksAtClose, inventory: data.inventory } }; return updateReport(id, { status: "COMPLETED", completedAt: new Date().toISOString(), snapshot }); }
  window.DailyReportService = { getReports, saveReports, getReport, createReport, updateReport, finalizeReport, metrics };
})();