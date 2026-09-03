if (!window.HandoverService) document.write('<script src="js/handover-service.js"><\/script>');
if (!window.showConfirm) document.write('<script src="js/components/ui-feedback.js"><\/script>');
(function () {
  const config = window.shiftPageConfig;
  let shift = null;
  const allTasks = config.checklist.flatMap((section) => section[2]);
  const totalTasks = allTasks.length;
  const el = (id) => document.getElementById(id);
  const formatTime = (value) => value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Not started";
  const counts = () => ({ issues: IssueService.getOpenIssues().length, pending: TaskService.getPendingTasks().length, overdue: TaskService.getOverdueTasks().length });
  const targetType = config.type === "OPENING" ? "MID_SHIFT" : config.type === "MID_SHIFT" ? "CLOSING" : null;
  function renderHandover() {
    if (targetType && shift.status.startsWith("COMPLETED") && !document.getElementById("prepareHandoverButton")) {
      const button = document.createElement("button"); button.id = "prepareHandoverButton"; button.className = "primary-button"; button.textContent = "Prepare Handover";
      button.onclick = () => { window.location.href = `handover.html?fromShiftId=${encodeURIComponent(shift.id)}&to=${targetType}`; }; el("completeShiftButton")?.parentElement?.appendChild(button);
    }
    if (targetType) {
      const incoming = HandoverService.getHandovers().find((item) => item.toShiftType === config.type && item.status === "READY");
      let banner = document.getElementById("handoverBanner");
      if (incoming && !banner) { banner = document.createElement("section"); banner.id = "handoverBanner"; banner.className = "handover-banner"; el("shiftInformation").closest("header").after(banner); }
      if (banner) banner.innerHTML = incoming ? `<p class="eyebrow">HANDOVER WAITING</p><h2>${incoming.fromShiftType.replaceAll("_", " ")} · ${incoming.fromManager}</h2><p>${incoming.selectedIssueIds.length} highlighted Issues · ${incoming.selectedTaskIds.length} highlighted Tasks</p><strong>${incoming.nextPriority}</strong><button class="secondary-button">Review Handover</button>` : "";
      if (banner && incoming) banner.querySelector("button").onclick = () => { window.location.href = `handover.html?id=${incoming.id}&review=true`; };
    }
  }

  function renderSections() {
    const container = el("shiftChecklist");
    if (!container) return;
    container.innerHTML = config.checklist.map(([title, description, tasks]) => `<section class="checklist-section"><div class="checklist-heading"><div><h2>${title}</h2><p>${description}</p></div><span>${tasks.filter((task) => shift.checklist[task[0]]).length} / ${tasks.length}</span></div><div class="checklist-card">${tasks.map(([id, label, detail]) => `<div class="checklist-item action-item"><label><input type="checkbox" data-task="${id}" ${shift.checklist[id] ? "checked" : ""} ${shift.status.startsWith("COMPLETED") ? "disabled" : ""}><div><strong>${label}</strong><small>${detail}</small></div></label>${id.includes("equipment") ? `<button class="issue-button" data-report-issue>Report Issue</button>` : ""}</div>`).join("")}</div></section>`).join("");
    container.querySelectorAll("input[data-task]").forEach((checkbox) => checkbox.addEventListener("change", saveChecklist));
    container.querySelectorAll("[data-report-issue]").forEach((button) => button.addEventListener("click", () => openIssueForm({ sourceType: "SHIFT", sourceId: shift.id, sourceLabel: config.title, category: "EQUIPMENT" })));
  }

  function render() {
    const progress = ShiftService.calculateShiftProgress(shift, totalTasks);
    el("shiftInformation").textContent = `${shift.manager} · Started ${formatTime(shift.startedAt)}`;
    el("shiftStatus").textContent = shift.status.replaceAll("_", " ");
    el("shiftStatus").className = `status shift-status ${shift.status.toLowerCase()}`;
    el("progressText").textContent = `${progress.completed} / ${progress.total} tasks complete`;
    el("progressPercentage").textContent = `${progress.percentage}%`;
    el("openingProgressBar").style.width = `${progress.percentage}%`;
    if (el("liveCounts")) {
      const live = counts();
      el("liveCounts").innerHTML = `<button class="metric-card" data-live-link="issues"><p>OPEN ISSUES</p><h2>${live.issues}</h2></button><button class="metric-card" data-live-link="tasks"><p>PENDING TASKS</p><h2>${live.pending}</h2></button><button class="metric-card"><p>OVERDUE TASKS</p><h2>${live.overdue}</h2></button>`;
      document.querySelectorAll("[data-live-link]").forEach((button) => button.addEventListener("click", () => { window.location.href = `${button.dataset.liveLink}.html`; }));
    }
    if (el("completeShiftButton")) { el("completeShiftButton").textContent = `Complete ${config.title}`; el("completeShiftButton").disabled = shift.status.startsWith("COMPLETED"); }
    if (el("createTaskButton")) el("createTaskButton").disabled = shift.status.startsWith("COMPLETED");
    if (el("tomorrowPriorityWrap")) { el("tomorrowPriorityWrap").hidden = config.type !== "CLOSING"; if (config.type === "CLOSING") el("tomorrowPriority").value = shift.notes || ""; }
    renderSections();
    renderHandover();
    if (config.type === "OPENING") {
      document.querySelectorAll('input[type="checkbox"][data-task]').forEach((input) => { input.checked = shift.checklist[input.dataset.task] === true; input.disabled = shift.status.startsWith("COMPLETED"); input.onchange = saveChecklist; });
      el("equipmentIssueButton")?.addEventListener("click", () => openIssueForm({ sourceType: "SHIFT", sourceId: shift.id, sourceLabel: config.title, category: "EQUIPMENT" }));
    }
  }

  function saveChecklist() {
    const checklist = {};
    document.querySelectorAll('input[type="checkbox"][data-task]').forEach((input) => checklist[input.dataset.task] = input.checked);
    shift = ShiftService.updateShiftChecklist(shift.id, checklist);
    render();
  }

  function complete() {
    const progress = ShiftService.calculateShiftProgress(shift, totalTasks);
    if (progress.completed < totalTasks) { showExceptionDialog(); return; }
    if (config.type === "CLOSING") { el("closingSummary").hidden = false; const live = counts(); el("summaryText").textContent = `${progress.completed} / ${totalTasks} · ${live.issues} open issues · ${live.pending} pending tasks · ${live.overdue} overdue tasks`; el("confirmClosing").onclick = () => { shift = ShiftService.completeShift(shift.id, el("tomorrowPriority").value); el("closingSummary").hidden = true; render(); }; return; }
    shift = ShiftService.completeShift(shift.id);
    render();
  }

  function showExceptionDialog() {
    const modal = document.createElement("div"); modal.className = "modal-backdrop"; modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><p class="eyebrow">INCOMPLETE CHECKLIST</p><h2>Complete with Exceptions</h2></div><button class="icon-button" data-close aria-label="Close">×</button></div><p class="muted-text">Add notes acknowledging the remaining items before completing this shift.</p><textarea id="exceptionNotes" class="exception-textarea" rows="4" required placeholder="Exception Notes"></textarea><div class="modal-actions"><button class="secondary-button" data-close>Return to Checklist</button><button class="primary-button" id="confirmExceptions">Complete with Exceptions</button></div></div>`;
    document.body.appendChild(modal); const close = () => modal.remove(); modal.querySelectorAll("[data-close]").forEach((button) => button.onclick = close); modal.querySelector("#confirmExceptions").onclick = () => { const notes = modal.querySelector("#exceptionNotes").value.trim(); if (!notes) return modal.querySelector("#exceptionNotes").focus(); shift = ShiftService.completeShift(shift.id, notes); close(); render(); };
  }

  async function start() {
    const priorType = config.type === "MID_SHIFT" ? "OPENING" : config.type === "CLOSING" ? "MID_SHIFT" : null;
    const prior = priorType && ShiftService.getTodayShift(priorType);
    if (prior && prior.status !== "COMPLETED" && prior.status !== "COMPLETED_WITH_EXCEPTIONS" && !(await showConfirm({ title: `${priorType.replaceAll("_", " ")} has not been completed`, message: "The previous shift is still active. Starting now will record an operational exception.", confirmLabel: "Start Anyway" }))) { window.location.href = "index.html"; return; }
    shift = ShiftService.startShift(config.type, localStorage.getItem("currentManager") || "Jordan Lee"); render();
  }

  el("completeShiftButton")?.addEventListener("click", complete);
  el("createTaskButton")?.addEventListener("click", () => openTaskForm({ sourceType: "SHIFT", sourceId: shift.id, sourceLabel: config.title }));
  shift = ShiftService.getTodayShift(config.type); if (!shift) start(); else render();
})();
