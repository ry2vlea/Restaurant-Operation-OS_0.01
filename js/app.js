const currentDate =
  document.getElementById("currentDate");

const managerSelect =
  document.getElementById("managerSelect");

const managerGreeting =
  document.getElementById("managerGreeting");

const startShiftButton =
  document.getElementById("startShiftButton");

const openIssuesCard =
  document.getElementById("openIssuesCard");

const pendingTasksCard =
  document.getElementById("pendingTasksCard");


function displayDate() {
  if (!currentDate) return;

  const today = new Date();

  currentDate.textContent =
    today.toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );

}


function getGreeting() {

  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}


function updateManager() {

  const manager =
    managerSelect.value;

  localStorage.setItem(
    "currentManager",
    manager
  );

  const firstName =
    manager.split(" ")[0];

  managerGreeting.textContent =
    `${getGreeting()}, ${firstName}.`;

}


const savedManager =
  localStorage.getItem(
    "currentManager"
  );

if (window.TeamService) {
  const managers = TeamService.managerNames();
  managerSelect.innerHTML = managers.map((name) => `<option>${name}</option>`).join("");
}


if (savedManager) {

  managerSelect.value =
    savedManager;

}


managerSelect.addEventListener(
  "change",
  updateManager
);


startShiftButton.addEventListener(
  "click",
  startOpeningShift
);

document.getElementById("sampleDataButton")?.addEventListener("click", () => {
  const result = SampleDataService.load();
  updateIssueCount();
  updateTaskCount();
  updateInventoryDashboard();
  updateNeedsAttention();
  showToast(`Sample data loaded: ${result.items} items, ${result.recipes} recipes, ${result.menuItems} menu items.`);
});

function updateIssueCount() {
  const count = IssueService.getOpenIssues().length;
  document.getElementById("issueCount").textContent = count;
  const issueNote = document.querySelector("#openIssuesCard span");
  issueNote.textContent = count ? `${count} issue${count === 1 ? "" : "s"} need attention` : "No critical issues";
  issueNote.classList.toggle("good", count === 0);
}

openIssuesCard.addEventListener("click", () => {
  window.location.href = "issues.html";
});

openIssuesCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    window.location.href = "issues.html";
  }
});

function updateTaskCount() {
  const pendingTasks = TaskService.getPendingTasks();
  const overdueTasks = TaskService.getOverdueTasks();
  document.getElementById("taskCount").textContent = pendingTasks.length;
  document.getElementById("taskNote").textContent = overdueTasks.length ? `${overdueTasks.length} overdue` : "Nothing overdue";
  document.getElementById("taskNote").classList.toggle("good", overdueTasks.length === 0);
}

function updateShiftCards() {
  const cards = [
    { id: "openingShiftCard", type: "OPENING", label: "Opening Shift", url: "opening.html" },
    { id: "midShiftCard", type: "MID_SHIFT", label: "Mid-Shift", url: "mid-shift.html" },
    { id: "closingShiftCard", type: "CLOSING", label: "Closing Shift", url: "closing.html" }
  ];
  cards.forEach((card) => {
    const element = document.getElementById(card.id);
    const shift = ShiftService.getTodayShift(card.type);
    const progress = shift ? ShiftService.calculateShiftProgress(shift, Number(element.dataset.total)) : { completed: 0, total: 0, percentage: 0 };
    const status = shift ? shift.status.replaceAll("_", " ") : "NOT STARTED";
    const action = shift ? (shift.status.startsWith("COMPLETED") ? "View" : "Continue") : "Start";
    element.innerHTML = `<div class="card-top"><span>${card.type.replaceAll("_", "-")}</span><span class="status neutral">${status}</span></div><h3>${card.label}</h3><p>${shift ? `Manager: ${shift.manager}` : "Manager: Not assigned"}</p>${shift ? `<p class="shift-time">Started ${new Date(shift.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${shift.completedAt ? ` · Completed ${new Date(shift.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}</p>` : ""}<div class="progress"><div class="progress-bar" style="width:${progress.percentage}%"></div></div><small>${shift ? `${progress.completed} / ${progress.total || "-"} complete` : "Not started"}</small><button class="secondary-button shift-card-action">${action}</button>`;
    element.querySelector(".shift-card-action").addEventListener("click", async () => {
      if (!shift) {
        const previousType = card.type === "MID_SHIFT" ? "OPENING" : card.type === "CLOSING" ? "MID_SHIFT" : null;
        const previous = previousType && ShiftService.getTodayShift(previousType);
        if (previous && !previous.status.startsWith("COMPLETED") && !(await showConfirm({ title: `${previousType.replaceAll("_", " ")} has not been completed`, message: "The previous shift is still active. Start now with an exception?", confirmLabel: "Start Anyway" }))) return;
        ShiftService.startShift(card.type, managerSelect.value);
      }
      window.location.href = card.url;
    });
  });
}

function updateHandoverIndicator() {
  const pending = HandoverService.getPendingHandovers();
  let indicator = document.getElementById("handoverIndicator");
  if (!pending.length) { indicator?.remove(); return; }
  if (!indicator) { indicator = document.createElement("section"); indicator.id = "handoverIndicator"; indicator.className = "handover-banner dashboard-handover"; document.querySelector(".welcome").after(indicator); }
  const handover = pending[0];
  indicator.innerHTML = `<p class="eyebrow">HANDOVER WAITING</p><h3>${handover.fromShiftType.replaceAll("_", " ")} → ${handover.toShiftType.replaceAll("_", " ")}</h3><p>${handover.fromManager} · ${handover.selectedIssueIds.length} highlighted Issues · ${handover.selectedTaskIds.length} highlighted Tasks</p><strong>${handover.nextPriority}</strong><button class="secondary-button">Review Handover</button>`;
  indicator.querySelector("button").onclick = () => { window.location.href = `handover.html?id=${handover.id}&review=true`; };
}

function updateDailyReportIndicator() {
  const report = DailyReportService.getReport();
  const button = [...document.querySelectorAll(".nav-item")].find((item) => item.textContent.trim() === "Daily Report");
  if (button) button.onclick = () => { window.location.href = "daily-report.html"; };
  let indicator = document.getElementById("dailyReportIndicator");
  if (!indicator) { indicator = document.createElement("section"); indicator.id = "dailyReportIndicator"; indicator.className = "report-dashboard-indicator"; document.querySelector(".priority").before(indicator); }
  indicator.innerHTML = `<span>DAILY REPORT</span><strong>${report ? report.status.replaceAll("_", " ") : "Not Started"}</strong><button class="secondary-button">Open Report</button>`;
  indicator.querySelector("button").onclick = () => { window.location.href = "daily-report.html"; };
}

function updateNeedsAttention() {
  const issues = IssueService.getOpenIssues().sort((a, b) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[a.priority] - ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[b.priority])));
  const overdueTasks = TaskService.getOverdueTasks();
  const handovers = HandoverService.getPendingHandovers();
  const inventoryItems = typeof InventoryService === "undefined" ? [] : InventoryService.getAllInventoryBalances().map((entry) => ({ ...entry, status: InventoryService.getStockStatus(entry.item, entry.quantity) })).filter(({ status }) => ["OUT_OF_STOCK", "CRITICAL"].includes(status));
  const variance = window.VarianceService?.calculateLatest?.();
  const equipment = window.EquipmentService?.getEquipment?.().filter((item) => item.status === "OUT_OF_SERVICE" || item.status === "ATTENTION") || [];
  const items = [
    ...issues.slice(0, 3).map((issue) => ({ type: issue.priority, title: issue.title, detail: `${issue.id} · ${issue.assignedTo} · ${issue.status.replaceAll("_", " ")}`, url: "issues.html" })),
    ...overdueTasks.slice(0, 2).map((task) => ({ type: "OVERDUE", title: task.title, detail: `${task.id} · ${task.assignedTo} · ${task.dueDate || "No due date"}`, url: "tasks.html" })),
    ...inventoryItems.slice(0, 1).map(({ item, quantity, status }) => ({ type: status, title: item.name, detail: `${quantity} ${InventoryService.getUnitById(item.baseUnitId)?.abbreviation || item.baseUnitId} · Inventory`, url: "inventory.html" })),
    ...(variance?.totals?.significantExceptions ? [{ type: "VARIANCE", title: "Inventory variance needs review", detail: `$${variance.totals.netVariance.toFixed(2)} net variance`, url: "inventory-variance.html" }] : []),
    ...equipment.slice(0, 1).map((item) => ({ type: item.status, title: item.name, detail: `${item.category} · Equipment`, url: "equipment.html" })),
    ...handovers.slice(0, 1).map((handover) => ({ type: "HANDOVER", title: `${handover.fromShiftType.replaceAll("_", " ")} → ${handover.toShiftType.replaceAll("_", " ")}`, detail: `${handover.fromManager} · ${handover.nextPriority}`, url: `handover.html?id=${handover.id}&review=true` }))
  ].slice(0, 4);
  const list = document.getElementById("attentionList");
  if (!list) return;
  list.innerHTML = items.length ? items.map((item) => `<button class="attention-item" data-attention-url="${item.url}"><span class="attention-label">${item.type}</span><span><strong>${item.title}</strong><small>${item.detail}</small></span><span class="attention-arrow">→</span></button>`).join("") : `<div class="attention-empty"><strong>All clear</strong><span>No urgent operational follow-up requires attention.</span></div>`;
  list.querySelectorAll("[data-attention-url]").forEach((item) => item.onclick = () => { window.location.href = item.dataset.attentionUrl; });
  document.getElementById("attentionViewAll").onclick = () => { window.location.href = items.some((item) => item.url.includes("issues")) ? "issues.html" : "tasks.html"; };
}
  window.addEventListener("issues:changed", () => { updateIssueCount(); updateNeedsAttention(); });
  window.addEventListener("tasks:changed", () => { updateTaskCount(); updateNeedsAttention(); });
  window.addEventListener("shifts:changed", () => { updateShiftCards(); updateNeedsAttention(); });
  window.addEventListener("handovers:changed", () => { updateHandoverIndicator(); updateNeedsAttention(); });

pendingTasksCard.addEventListener("click", () => { window.location.href = "tasks.html"; });
pendingTasksCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") window.location.href = "tasks.html";
});


function startOpeningShift() {
  ShiftService.startShift("OPENING", managerSelect.value);
  showToast("Opening Shift started.");
  window.location.href =
    "opening.html";

}


displayDate();

updateManager();
updateIssueCount();
updateTaskCount();
updateShiftCards();
updateHandoverIndicator();
updateDailyReportIndicator();
updateNeedsAttention();
function updateInventoryDashboard() {
  if (typeof InventoryService === "undefined") return;
  performance.mark?.("dashboard-inventory-render:start");
  const statusCounts = InventoryService.getAllInventoryBalances().reduce((counts, { item, quantity }) => {
    const status = InventoryService.getStockStatus(item, quantity);
    counts.total += 1;
    counts.critical += status === "CRITICAL" ? 1 : 0;
    counts.out += status === "OUT_OF_STOCK" ? 1 : 0;
    return counts;
  }, { total: 0, critical: 0, out: 0 });
  const card = document.getElementById("inventoryHealthCard"); if (!card) return; card.querySelector("h2").textContent = statusCounts.critical + statusCounts.out; const note = document.getElementById("inventoryHealthNote"); note.textContent = statusCounts.total ? `${statusCounts.critical} critical · ${statusCounts.out} out of stock` : "No inventory items"; note.classList.toggle("good", statusCounts.critical + statusCounts.out === 0); card.onclick = () => { window.location.href = "inventory.html"; };
  performance.mark?.("dashboard-inventory-render:end");
  performance.measure?.("dashboard-inventory-render", "dashboard-inventory-render:start", "dashboard-inventory-render:end");
}
updateInventoryDashboard();
window.addEventListener("inventory:changed", () => { updateInventoryDashboard(); updateNeedsAttention(); });
