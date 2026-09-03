if (!window.showToast) document.write('<script src="js/components/ui-feedback.js"><\/script>');
const handoverManagers = ["Jordan Lee", "Alex Rivera", "Mia Torres"];
const handoverParams = new URLSearchParams(window.location.search);
const currentManager = localStorage.getItem("currentManager") || "Jordan Lee";
let handover;
let sourceShift;
const targetLabels = { MID_SHIFT: "Mid-Shift", CLOSING: "Closing Shift" };
const typeLabels = { OPENING: "Opening", MID_SHIFT: "Mid-Shift", CLOSING: "Closing Shift" };

function sourceTypeForTarget(target) { return target === "MID_SHIFT" ? "OPENING" : "MID_SHIFT"; }
function createOrLoadHandover() {
  const requested = handoverParams.get("id");
  if (requested) handover = HandoverService.getHandoverById(requested);
  if (!handover) {
    const shiftId = handoverParams.get("fromShiftId");
    sourceShift = shiftId ? ShiftService.getShiftById(shiftId) : ShiftService.getTodayShift(handoverParams.get("from") || "OPENING");
    if (!sourceShift) return false;
    const target = handoverParams.get("to") || (sourceShift.type === "OPENING" ? "MID_SHIFT" : "CLOSING");
    handover = HandoverService.createHandover({ fromShiftId: sourceShift.id, fromShiftType: sourceShift.type, toShiftType: target, fromManager: sourceShift.manager });
  }
  sourceShift = ShiftService.getShiftById(handover.fromShiftId);
  return Boolean(sourceShift);
}
function issueRows() {
  const issues = IssueService.getOpenIssues();
  if (!issues.length) return `<p class="muted-text">No Open Issues. No unresolved operational Issues to carry forward.</p>`;
  return issues.map((issue) => { const selected = handover.selectedIssueIds.includes(issue.id) || ["HIGH", "CRITICAL"].includes(issue.priority); return `<label class="handover-select-row"><input type="checkbox" data-issue-id="${issue.id}" ${selected ? "checked" : ""}><span><strong>${issue.id}</strong> <b class="issue-priority ${issue.priority.toLowerCase()}">${issue.priority}</b><br>${issue.title}<small>Assigned: ${issue.assignedTo} · ${issue.status.replaceAll("_", " ")}</small></span></label>`; }).join("");
}
function taskRows() {
  const tasks = TaskService.getPendingTasks();
  if (!tasks.length) return `<p class="muted-text">No Pending Tasks</p>`;
  return tasks.map((task) => { const selected = handover.selectedTaskIds.includes(task.id) || TaskService.isOverdue(task) || ["HIGH", "CRITICAL"].includes(task.priority); return `<label class="handover-select-row"><input type="checkbox" data-task-id="${task.id}" ${selected ? "checked" : ""}><span><strong>${task.id}</strong> <b class="issue-priority ${task.priority.toLowerCase()}">${task.priority}</b><br>${task.title}<small>${task.assignedTo} · ${task.dueDate || "No due date"} · ${task.status.replaceAll("_", " ")}</small></span></label>`; }).join("");
}
function render() {
  document.getElementById("handoverSubtitle").textContent = `${typeLabels[handover.fromShiftType]} → ${targetLabels[handover.toShiftType]} · ${handover.fromManager}`;
  document.getElementById("handoverStatus").textContent = handover.status;
  document.getElementById("handoverApp").innerHTML = `<section class="handover-hero"><p class="eyebrow">OPERATIONAL CONTINUITY</p><h2>${typeLabels[handover.fromShiftType]} → ${targetLabels[handover.toShiftType]}</h2><p>${handover.fromManager} · ${new Date(handover.createdAt).toLocaleString()}</p></section><section id="handoverCounts" class="live-counts"></section><form id="handoverForm"><section class="handover-section"><div class="section-header"><h2>Highlighted Issues</h2><span class="muted-text">Select what needs explicit attention</span></div><div class="handover-selection">${issueRows()}</div></section><section class="handover-section"><div class="section-header"><h2>Highlighted Tasks</h2><span class="muted-text">Select important carry-forward work</span></div><div class="handover-selection">${taskRows()}</div></section><section class="handover-notes"><h2>Manager Notes</h2><div class="form-grid"><label>Staffing<textarea name="staffingNotes" rows="3">${handover.staffingNotes}</textarea></label><label>Product / Inventory<textarea name="productNotes" rows="3">${handover.productNotes}</textarea></label><label>Equipment<textarea name="equipmentNotes" rows="3">${handover.equipmentNotes}</textarea></label><label>Guest Experience<textarea name="guestNotes" rows="3">${handover.guestNotes}</textarea></label><label class="full-width">Operational Notes<textarea name="operationalNotes" rows="3">${handover.operationalNotes}</textarea></label><label class="full-width next-priority-field">Next Operational Priority<input name="nextPriority" required value="${handover.nextPriority}" placeholder="What must the next manager act on first?"></label></div></section><div class="modal-actions"><button type="button" class="secondary-button" id="saveDraft">Save Draft</button><button type="submit" class="primary-button">Complete Handover</button></div></form>`;
  const counts = { issues: IssueService.getOpenIssues().length, pending: TaskService.getPendingTasks().length, overdue: TaskService.getOverdueTasks().length }; document.getElementById("handoverCounts").innerHTML = `<article class="metric-card"><p>OPEN ISSUES</p><h2>${counts.issues}</h2></article><article class="metric-card"><p>PENDING TASKS</p><h2>${counts.pending}</h2></article><article class="metric-card"><p>OVERDUE</p><h2>${counts.overdue}</h2></article>`;
  document.getElementById("saveDraft").onclick = () => save(false);
  document.getElementById("handoverForm").onsubmit = (event) => { event.preventDefault(); save(true); };
}
function save(ready) {
  const values = Object.fromEntries(new FormData(document.getElementById("handoverForm")));
  if (ready && !values.nextPriority.trim()) return document.querySelector("[name=nextPriority]").focus();
  values.selectedIssueIds = [...document.querySelectorAll("[data-issue-id]:checked")].map((input) => input.dataset.issueId);
  values.selectedTaskIds = [...document.querySelectorAll("[data-task-id]:checked")].map((input) => input.dataset.taskId);
  handover = HandoverService.updateHandover(handover.id, { ...values, status: ready ? "READY" : "DRAFT" });
  render();
  if (ready) showToast(`Handover ready for the ${targetLabels[handover.toShiftType]} manager.`);
}
function renderReview() {
  document.getElementById("handoverStatus").textContent = handover.status;
  const issues = handover.selectedIssueIds.map((id) => IssueService.getIssueById(id)).filter(Boolean);
  const tasks = handover.selectedTaskIds.map((id) => TaskService.getTaskById(id)).filter(Boolean);
  document.getElementById("handoverApp").innerHTML = `<section class="handover-review"><p class="eyebrow">HANDOVER WAITING</p><h2>${typeLabels[handover.fromShiftType]} → ${targetLabels[handover.toShiftType]}</h2><p>${handover.fromManager} · ${new Date(handover.createdAt).toLocaleString()}</p><div class="next-priority-callout"><span>NEXT PRIORITY</span><strong>${handover.nextPriority}</strong></div><div class="review-grid"><div><h3>Highlighted Issues</h3>${issues.length ? issues.map((issue) => `<p><strong>${issue.id}</strong> · ${issue.title}<small>${issue.priority} · ${issue.status}</small></p>`).join("") : "<p>No highlighted Issues.</p>"}</div><div><h3>Highlighted Tasks</h3>${tasks.length ? tasks.map((task) => `<p><strong>${task.id}</strong> · ${task.title}<small>${task.priority} · ${task.status}</small></p>`).join("") : "<p>No highlighted Tasks.</p>"}</div></div><div class="review-notes"><h3>Staffing Notes</h3><p>${handover.staffingNotes || "No notes."}</p><h3>Product Notes</h3><p>${handover.productNotes || "No notes."}</p><h3>Equipment Notes</h3><p>${handover.equipmentNotes || "No notes."}</p><h3>Guest Notes</h3><p>${handover.guestNotes || "No notes."}</p><h3>Operational Notes</h3><p>${handover.operationalNotes || "No notes."}</p></div><button class="primary-button" id="acceptHandover">Accept Handover</button></section>`;
  document.getElementById("acceptHandover").onclick = () => { handover = HandoverService.acceptHandover(handover.id, currentManager); renderReview(); showToast("Handover accepted."); };
}
if (createOrLoadHandover()) { if (handover.status === "READY" && handoverParams.get("review") === "true") renderReview(); else render(); } else { document.getElementById("handoverApp").innerHTML = "<section class=\"empty-state\"><h3>No source Shift found</h3><p>Start the outgoing Shift before preparing a Handover.</p></section>"; }
