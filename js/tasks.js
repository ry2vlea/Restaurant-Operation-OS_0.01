(function () {
  const storageKey = "tasks";
  const activeStatuses = ["PENDING", "IN_PROGRESS", "BLOCKED"];

  function getTasks() {
    try {
      const storedTasks = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(storedTasks) ? storedTasks : [];
    } catch (error) {
      return [];
    }
  }

  function saveTasks(tasks) {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
    window.dispatchEvent(new CustomEvent("tasks:changed"));
    return tasks;
  }

  function nextTaskId() {
    const highestNumber = getTasks().reduce((highest, task) => {
      const match = /^TASK-(\d+)$/.exec(task.id || "");
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `TASK-${String(highestNumber + 1).padStart(6, "0")}`;
  }

  function createTask(values) {
    const now = new Date().toISOString();
    const task = {
      id: nextTaskId(), title: values.title, description: values.description || "",
      category: values.category || "OTHER", priority: values.priority || "MEDIUM", status: "PENDING",
      assignedTo: values.assignedTo || "Jordan Lee", createdBy: values.createdBy || localStorage.getItem("currentManager") || "Jordan Lee",
      dueDate: values.dueDate || "", dueTime: values.dueTime || "", source: values.source || null,
      relatedIssueId: values.relatedIssueId || null, relatedEquipmentId: values.relatedEquipmentId || null,
      relatedInventoryItemId: values.relatedInventoryItemId || null, createdAt: now, updatedAt: now,
      startedAt: null, completedAt: null, cancelledAt: null, notes: values.notes || ""
    };
    saveTasks([...getTasks(), task]);
    return task;
  }

  function getTaskById(id) { return getTasks().find((task) => task.id === id) || null; }

  function updateTask(id, changes) {
    const updatedTasks = getTasks().map((task) => task.id === id ? { ...task, ...changes, updatedAt: new Date().toISOString() } : task);
    saveTasks(updatedTasks);
    return getTaskById(id);
  }

  function getPendingTasks() { return getTasks().filter((task) => activeStatuses.includes(task.status)); }

  function isOverdue(task) {
    if (!task.dueDate || ["COMPLETED", "CANCELLED"].includes(task.status)) return false;
    const due = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`);
    return due < new Date();
  }

  function getOverdueTasks() { return getTasks().filter(isOverdue); }

  function startTask(id) { return updateTask(id, { status: "IN_PROGRESS", startedAt: new Date().toISOString() }); }
  function completeTask(id) { return updateTask(id, { status: "COMPLETED", completedAt: new Date().toISOString() }); }
  function cancelTask(id) { return updateTask(id, { status: "CANCELLED", cancelledAt: new Date().toISOString() }); }

  window.TaskService = { getTasks, saveTasks, createTask, getTaskById, updateTask, getPendingTasks, getOverdueTasks, startTask, completeTask, cancelTask, isOverdue };
})();