const statusLabels = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  WAITING: "Waiting",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};
const taskStatusLabels = { PENDING: "Pending", IN_PROGRESS: "In Progress", BLOCKED: "Blocked", COMPLETED: "Completed", CANCELLED: "Cancelled" };

const issuePage = {
  list: document.getElementById("issueList"),
  summary: document.getElementById("issueSummary")
};

function displayValue(value) {
  return (value || "Not provided").replaceAll("_", " ");
}

function renderSummary() {
  const issues = IssueService.getIssues();
  const today = new Date().toDateString();
  const values = [
    ["Open", issues.filter((issue) => ["OPEN", "ACKNOWLEDGED"].includes(issue.status)).length, "open"],
    ["High Priority", issues.filter((issue) => ["HIGH", "CRITICAL"].includes(issue.priority) && issue.status !== "CLOSED").length, "attention"],
    ["In Progress", issues.filter((issue) => issue.status === "IN_PROGRESS").length, "progress"],
    ["Waiting", issues.filter((issue) => issue.status === "WAITING").length, "waiting"],
    ["Resolved Today", issues.filter((issue) => issue.resolvedAt && new Date(issue.resolvedAt).toDateString() === today).length, "resolved"]
  ];
  issuePage.summary.innerHTML = values.map(([label, value, tone]) => `<article class="metric-card issue-summary-card ${tone}"><p>${label}</p><h2>${value}</h2></article>`).join("");
}

function getFilteredIssues() {
  const query = document.getElementById("issueSearch").value.toLowerCase();
  const filters = {
    status: document.getElementById("statusFilter").value,
    priority: document.getElementById("priorityFilter").value,
    category: document.getElementById("categoryFilter").value,
    assignedTo: document.getElementById("assigneeFilter").value
  };
  return IssueService.getIssues().filter((issue) => {
    const searchable = `${issue.id} ${issue.title} ${issue.description}`.toLowerCase();
    return searchable.includes(query) && Object.entries(filters).every(([key, value]) => !value || issue[key] === value);
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderIssues() {
  const issues = getFilteredIssues();
  document.getElementById("issueResultCount").textContent = `${issues.length} issue${issues.length === 1 ? "" : "s"}`;
  if (!issues.length) {
    issuePage.list.innerHTML = `<div class="empty-state"><h3>No issues found</h3><p>Operational issues will appear here when reported.</p></div>`;
    return;
  }
  issuePage.list.innerHTML = issues.map((issue) => `<article class="issue-row" data-issue-id="${issue.id}" tabindex="0">
    <div class="issue-priority ${issue.priority.toLowerCase()}">${displayValue(issue.priority)}</div>
    <div class="issue-row-main"><strong>${issue.title}</strong><span>${issue.id} · ${displayValue(issue.category)}</span><small>${issue.description}</small></div>
    <div class="issue-row-meta"><span class="status-badge ${issue.status.toLowerCase()}">${displayValue(statusLabels[issue.status])}</span><span>Assigned to ${issue.assignedTo}</span><span>${issue.source ? issue.source.label : "Direct report"}</span></div>
  </article>`).join("");
  issuePage.list.querySelectorAll("[data-issue-id]").forEach((row) => {
    row.addEventListener("click", () => openIssueDetail(row.dataset.issueId));
    row.addEventListener("keydown", (event) => { if (event.key === "Enter") openIssueDetail(row.dataset.issueId); });
  });
}

function renderPage() { renderSummary(); renderIssues(); }

function relatedTaskMarkup(issueId) {
  const relatedTasks = TaskService.getTasks().filter((task) => task.relatedIssueId === issueId);
  if (!relatedTasks.length) return "<p class=\"muted-text\">No follow-up tasks yet.</p>";
  return relatedTasks.map((task) => `<button class="related-task" data-related-task="${task.id}"><strong>${task.id}</strong><span>${task.title}</span><span>${task.assignedTo} · ${taskStatusLabels[task.status] || task.status}</span></button>`).join("");
}

function openIssueDetail(id) {
  const issue = IssueService.getIssueById(id);
  if (!issue) return;
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<div class="modal issue-detail-modal" role="dialog" aria-modal="true"><div class="modal-header"><div><p class="eyebrow">${issue.id}</p><h2>${issue.title}</h2></div><button class="icon-button" data-close aria-label="Close">×</button></div>
    <div class="detail-badges"><span class="issue-priority ${issue.priority.toLowerCase()}">${displayValue(issue.priority)}</span><span class="status-badge ${issue.status.toLowerCase()}">${statusLabels[issue.status]}</span></div>
    <dl class="issue-details"><div><dt>Category</dt><dd>${displayValue(issue.category)}</dd></div><div><dt>Operational Impact</dt><dd>${displayValue(issue.operationalImpact)}</dd></div><div><dt>Reported By</dt><dd>${issue.reportedBy}</dd></div><div><dt>Created At</dt><dd>${new Date(issue.createdAt).toLocaleString()}</dd></div><div><dt>Source</dt><dd>${issue.source ? issue.source.label : "Direct report"}</dd></div><div><dt>Assigned To</dt><dd><select id="detailAssignee">${["Jordan Lee", "Alex Rivera", "Mia Torres"].map((name) => `<option ${name === issue.assignedTo ? "selected" : ""}>${name}</option>`).join("")}</select></dd></div></dl>
    <div class="detail-copy"><h3>Description</h3><p>${issue.description}</p><h3>Immediate Action</h3><p>${issue.immediateAction || "Not provided"}</p>${issue.resolution ? `<h3>Resolution</h3><p>${issue.resolution}</p>` : `<label class="resolution-field">Resolution<textarea id="resolutionInput" rows="3" placeholder="Required to resolve this issue"></textarea></label>`}<h3>Follow-Up Tasks</h3><div id="relatedTasks" class="related-task-list">${relatedTaskMarkup(issue.id)}</div></div>
    <div class="detail-actions"><button class="secondary-button" id="saveAssignment">Assign</button><select id="detailStatus">${Object.keys(statusLabels).map((status) => `<option value="${status}" ${status === issue.status ? "selected" : ""}>${statusLabels[status]}</option>`).join("")}</select><button class="secondary-button" id="saveStatus">Change Status</button><button class="primary-button" id="createFollowUpTask">Create Follow-Up Task</button><button class="primary-button" id="resolveIssue">Resolve Issue</button><button class="secondary-button" id="closeIssue">Close Issue</button></div></div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("[data-close]").addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.querySelector("#saveAssignment").addEventListener("click", () => { IssueService.updateIssue(id, { assignedTo: modal.querySelector("#detailAssignee").value }); renderPage(); close(); });
  modal.querySelector("#saveStatus").addEventListener("click", () => { IssueService.updateIssue(id, { status: modal.querySelector("#detailStatus").value }); renderPage(); close(); });
  modal.querySelector("#createFollowUpTask").addEventListener("click", () => openTaskForm({ sourceType: "ISSUE", sourceId: issue.id, sourceLabel: issue.title, assignedTo: issue.assignedTo, priority: issue.priority }));
  modal.querySelector("#resolveIssue").addEventListener("click", () => {
    const resolution = modal.querySelector("#resolutionInput")?.value;
    if (!resolution || !resolution.trim()) {
      modal.querySelector("#resolutionInput")?.focus();
      return;
    }
    IssueService.resolveIssue(id, resolution);
    renderPage();
    close();
  });
  modal.querySelector("#closeIssue").addEventListener("click", () => { IssueService.closeIssue(id); renderPage(); close(); });
  modal.querySelector("#relatedTasks").addEventListener("click", (event) => {
    const relatedTask = event.target.closest("[data-related-task]");
    if (relatedTask) window.location.href = `tasks.html?task=${relatedTask.dataset.relatedTask}`;
  });
}

document.getElementById("reportIssueButton").addEventListener("click", () => openIssueForm());
["issueSearch", "statusFilter", "priorityFilter", "categoryFilter", "assigneeFilter"].forEach((id) => document.getElementById(id).addEventListener("input", renderIssues));
window.addEventListener("issues:changed", renderPage);
window.addEventListener("issue:created", renderPage);
window.addEventListener("tasks:changed", () => {
  const relatedTasks = document.getElementById("relatedTasks");
  const issueId = document.querySelector(".issue-detail-modal .eyebrow")?.textContent;
  if (relatedTasks && issueId) relatedTasks.innerHTML = relatedTaskMarkup(issueId);
});
renderPage();
