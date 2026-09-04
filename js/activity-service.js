(function () {
  const key = "activityLog";

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
    window.dispatchEvent(new CustomEvent("activity:changed"));
    return values;
  }

  function nextId(values = read()) {
    const highest = values.reduce((max, record) => {
      const match = /^ACT-(\d+)$/.exec(record.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `ACT-${String(highest + 1).padStart(6, "0")}`;
  }

  function recordActivity(values) {
    const records = read();
    const now = new Date().toISOString();
    const record = {
      id: nextId(records),
      timestamp: values.timestamp || now,
      actor: values.actor || localStorage.getItem("currentManager") || "Jordan Lee",
      action: values.action || "SYSTEM_ACTIVITY",
      entityType: values.entityType || "SYSTEM",
      entityId: values.entityId || "",
      description: values.description || values.action || "System activity",
      metadata: values.metadata || {}
    };
    write([...records, record]);
    return record;
  }

  function derivedEvents() {
    const context = AnalyticsContext.build();
    return [
      ...context.issues.map((issue) => ({ timestamp: issue.createdAt, actor: issue.reportedBy, action: "ISSUE_CREATED", entityType: "ISSUE", entityId: issue.id, description: `Issue created: ${issue.title}`, derived: true })),
      ...context.tasks.map((task) => ({ timestamp: task.createdAt, actor: task.createdBy, action: "TASK_CREATED", entityType: "TASK", entityId: task.id, description: `Task created: ${task.title}`, derived: true })),
      ...context.movements.map((movement) => ({ timestamp: movement.createdAt, actor: movement.manager, action: `INVENTORY_${movement.movementType}`, entityType: "INVENTORY_MOVEMENT", entityId: movement.id, description: `${movement.movementType} ${movement.itemId}`, derived: true }))
    ].filter((event) => event.timestamp);
  }

  function getActivity() {
    return [...read(), ...derivedEvents()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  window.ActivityService = { getActivity, recordActivity, saveActivity: write };
  window.recordActivity = recordActivity;
})();
