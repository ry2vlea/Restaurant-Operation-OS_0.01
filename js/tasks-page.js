const taskStatusLabels = { PENDING: "Pending", IN_PROGRESS: "In Progress", BLOCKED: "Blocked", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const taskPriorityWeight = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const taskPage = { list: document.getElementById("taskList"), summary: document.getElementById("taskSummary") };

function taskText(value) { return (value || "Not provided").replaceAll("_", " "); }
function taskDue(task) { return task.dueDate ? new Date(`${task.dueDate}T${task.dueTime || "23:59"}`) : null; }
function dueLabel(task) {
  const due = taskDue(task);
  if (!due) return "No due date";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0);
  const dayDifference = Math.round((dueDay - today) / 86400000);
  if (TaskService.isOverdue(task)) return `OVERDUE · ${Math.abs(dayDifference)} day${Math.abs(dayDifference) === 1 ? "" : "s"} ago`;
  if (dayDifference === 0) return "Due Today";
  if (dayDifference === 1) return "Due Tomorrow";
  return `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
function dueDateText(task) { return task.dueDate ? `${dueLabel(task)}${task.dueTime ? `, ${new Date(`2000-01-01T${task.dueTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}` : "No due date"; }

function renderTaskSummary() {
  const tasks = TaskService.getTasks(); const today = new Date().toDateString();
  const values = [["Pending", tasks.filter((task) => task.status === "PENDING").length, "open"], ["In Progress", tasks.filter((task) => task.status === "IN_PROGRESS").length, "progress"], ["Overdue", TaskService.getOverdueTasks().length, "attention"], ["Completed Today", tasks.filter((task) => task.completedAt && new Date(task.completedAt).toDateString() === today).length, "resolved"], ["Critical", tasks.filter((task) => task.priority === "CRITICAL" && !["COMPLETED", "CANCELLED"].includes(task.status)).length, "critical"]];
  taskPage.summary.innerHTML = values.map(([label, value, tone]) => `<article class="metric-card issue-summary-card ${tone}"><p>${label}</p><h2>${value}</h2></article>`).join("");
}
function filteredTasks() {
  const query = document.getElementById("taskSearch").value.toLowerCase();
  const filters = { status: document.getElementById("taskStatusFilter").value, priority: document.getElementById("taskPriorityFilter").value, category: document.getElementById("taskCategoryFilter").value, assignedTo: document.getElementById("taskAssigneeFilter").value, dueDate: document.getElementById("taskDueDateFilter").value };
  return TaskService.getTasks().filter((task) => `${task.id} ${task.title} ${task.description} ${task.source?.label || ""}`.toLowerCase().includes(query) && Object.entries(filters).every(([key, value]) => !value || task[key] === value)).sort((a, b) => {
    const aClosed = ["COMPLETED", "CANCELLED"].includes(a.status); const bClosed = ["COMPLETED", "CANCELLED"].includes(b.status);
    if (aClosed !== bClosed) return aClosed ? 1 : -1;
    const overdueDifference = Number(TaskService.isOverdue(b)) - Number(TaskService.isOverdue(a)); if (overdueDifference) return overdueDifference;
    const priorityDifference = taskPriorityWeight[a.priority] - taskPriorityWeight[b.priority]; if (priorityDifference) return priorityDifference;
    return (taskDue(a)?.getTime() || Infinity) - (taskDue(b)?.getTime() || Infinity);
  });
}
function renderTasks() {
  const tasks = filteredTasks(); document.getElementById("taskResultCount").textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
  if (!tasks.length) { taskPage.list.innerHTML = `<div class="empty-state"><h3>No Tasks Yet</h3><p>${TaskService.getTasks().length ? "No tasks match these filters." : "Create a task to track operational follow-up and ownership."}</p></div>`; return; }
  taskPage.list.innerHTML = tasks.map((task) => `<article class="issue-row task-row ${TaskService.isOverdue(task) ? "overdue" : ""}" data-task-id="${task.id}" tabindex="0"><div class="issue-row-main"><strong>${task.title}</strong><span>${task.id} · ${taskText(task.category)}</span><small>${task.description || "No description"}</small></div><div class="task-due ${TaskService.isOverdue(task) ? "overdue-text" : ""}">${dueDateText(task)}</div><div class="issue-row-meta"><span class="issue-priority ${task.priority.toLowerCase()}">${taskText(task.priority)}</span><span class="status-badge ${task.status.toLowerCase()}">${taskStatusLabels[task.status]}</span><span>Assigned to ${task.assignedTo}</span><span>Source: ${task.source ? task.source.id : "Direct task"}</span></div></article>`).join("");
  taskPage.list.querySelectorAll("[data-task-id]").forEach((row) => { row.addEventListener("click", () => openTaskDetail(row.dataset.taskId)); row.addEventListener("keydown", (event) => { if (event.key === "Enter") openTaskDetail(row.dataset.taskId); }); });
}
function renderTaskPage() { renderTaskSummary(); renderTasks(); }

function openTaskDetail(id) {
  const task = TaskService.getTaskById(id); if (!task) return;
  const modal = document.createElement("div"); modal.className = "modal-backdrop";
  modal.innerHTML = `<div class="modal issue-detail-modal" role="dialog" aria-modal="true"><div class="modal-header"><div><p class="eyebrow">${task.id}</p><h2>${task.title}</h2></div><button class="icon-button" data-close aria-label="Close">×</button></div><div class="detail-badges"><span class="issue-priority ${task.priority.toLowerCase()}">${taskText(task.priority)}</span><span class="status-badge ${task.status.toLowerCase()}">${taskStatusLabels[task.status]}</span>${TaskService.isOverdue(task) ? "<span class=\"status-badge critical\">OVERDUE</span>" : ""}</div><dl class="issue-details"><div><dt>Category</dt><dd>${taskText(task.category)}</dd></div><div><dt>Assigned To</dt><dd><select id="taskAssignee">${["Jordan Lee", "Alex Rivera", "Mia Torres"].map((name) => `<option ${name === task.assignedTo ? "selected" : ""}>${name}</option>`).join("")}</select></dd></div><div><dt>Created By</dt><dd>${task.createdBy}</dd></div><div><dt>Due</dt><dd>${dueDateText(task)}</dd></div><div><dt>Source</dt><dd>${task.source ? task.source.label : "Direct task"}</dd></div><div><dt>Created At</dt><dd>${new Date(task.createdAt).toLocaleString()}</dd></div><div><dt>Started At</dt><dd>${task.startedAt ? new Date(task.startedAt).toLocaleString() : "Not started"}</dd></div><div><dt>Completed At</dt><dd>${task.completedAt ? new Date(task.completedAt).toLocaleString() : "Not completed"}</dd></div></dl><div class="detail-copy"><h3>Description</h3><p>${task.description || "Not provided"}</p><h3>Notes</h3><p>${task.notes || "Not provided"}</p></div><div class="detail-actions"><button class="secondary-button" id="saveTaskAssignee">Assign</button><button class="secondary-button" id="editTask">Edit</button><button class="secondary-button" id="startTask">Start Task</button><button class="secondary-button" id="blockTask">Mark Blocked</button><button class="primary-button" id="completeTask">Complete Task</button><button class="secondary-button" id="cancelTask">Cancel Task</button></div></div>`;
  document.body.appendChild(modal); const close = () => modal.remove(); modal.querySelector("[data-close]").addEventListener("click", close); modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  const refresh = (action) => { action(); renderTaskPage(); close(); };
  modal.querySelector("#saveTaskAssignee").addEventListener("click", () => refresh(() => TaskService.updateTask(id, { assignedTo: modal.querySelector("#taskAssignee").value })));
  modal.querySelector("#editTask").addEventListener("click", () => { close(); openTaskForm({ editTask: task }); });
  modal.querySelector("#startTask").addEventListener("click", () => refresh(() => TaskService.startTask(id)));
  modal.querySelector("#blockTask").addEventListener("click", () => refresh(() => TaskService.updateTask(id, { status: "BLOCKED" })));
  modal.querySelector("#completeTask").addEventListener("click", () => refresh(() => TaskService.completeTask(id)));
  modal.querySelector("#cancelTask").addEventListener("click", () => refresh(() => TaskService.cancelTask(id)));
}

document.getElementById("createTaskButton").addEventListener("click", () => openTaskForm());
["taskSearch", "taskStatusFilter", "taskPriorityFilter", "taskCategoryFilter", "taskAssigneeFilter", "taskDueDateFilter"].forEach((id) => document.getElementById(id).addEventListener("input", renderTasks));
window.addEventListener("tasks:changed", renderTaskPage); window.addEventListener("task:created", renderTaskPage); renderTaskPage();
const requestedTaskId = new URLSearchParams(window.location.search).get("task");
if (requestedTaskId) openTaskDetail(requestedTaskId);
