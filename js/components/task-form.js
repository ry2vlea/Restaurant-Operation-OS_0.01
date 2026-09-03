(function () {
  const categories = ["OPERATIONS", "EQUIPMENT", "INVENTORY", "STAFFING", "GUEST", "FACILITY", "VENDOR", "MANAGEMENT", "OTHER"];
  const managers = ["Jordan Lee", "Alex Rivera", "Mia Torres"];

  function options(values, selected) {
    return values.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value.replaceAll("_", " ")}</option>`).join("");
  }

  function closeTaskForm() { document.getElementById("taskFormModal")?.remove(); }

  function openTaskForm(context = {}) {
    closeTaskForm();
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.id = "taskFormModal";
    const editingTask = context.editTask;
    modal.innerHTML = `<div class="modal issue-form-modal" role="dialog" aria-modal="true" aria-labelledby="taskFormTitle">
      <div class="modal-header"><div><p class="eyebrow">OPERATIONAL FOLLOW-UP</p><h2 id="taskFormTitle">${editingTask ? "Edit Task" : "Create Task"}</h2></div><button class="icon-button" type="button" data-close aria-label="Close">×</button></div>
      <form id="taskForm"><div class="form-grid">
        <label class="full-width">Task Title<input name="title" required maxlength="120" placeholder="What needs to happen next?" value="${editingTask?.title || ""}"></label>
        <label class="full-width">Description<textarea name="description" rows="3" placeholder="Optional details">${editingTask?.description || ""}</textarea></label>
        <label>Category<select name="category">${options(categories, editingTask?.category || context.category || "OPERATIONS")}</select></label>
        <label>Priority<select name="priority">${options(["LOW", "MEDIUM", "HIGH", "CRITICAL"], editingTask?.priority || context.priority || "MEDIUM")}</select></label>
        <label>Assigned To<select name="assignedTo">${options(managers, editingTask?.assignedTo || context.assignedTo || "Jordan Lee")}</select></label>
        <label>Due Date<input name="dueDate" type="date" required value="${editingTask?.dueDate || ""}"></label>
        <label>Due Time<input name="dueTime" type="time" value="${editingTask?.dueTime || ""}"></label>
        <label class="full-width">Notes<textarea name="notes" rows="2" placeholder="Optional">${editingTask?.notes || ""}</textarea></label>
      </div>${context.sourceLabel ? `<p class="form-context">Source: <strong>${context.sourceLabel}</strong></p>` : ""}
      <div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">${editingTask ? "Save Changes" : "Create Task"}</button></div></form></div>`;
    document.body.appendChild(modal);
    const form = modal.querySelector("form");
    modal.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeTaskForm));
    modal.addEventListener("click", (event) => { if (event.target === modal) closeTaskForm(); });
    const escapeHandler = (event) => { if (event.key === "Escape") { closeTaskForm(); document.removeEventListener("keydown", escapeHandler); } };
    document.addEventListener("keydown", escapeHandler);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      values.source = context.sourceType ? { type: context.sourceType, id: context.sourceId || null, label: context.sourceLabel || context.sourceType } : null;
      values.relatedIssueId = context.sourceType === "ISSUE" ? context.sourceId : null;
      const task = editingTask ? TaskService.updateTask(editingTask.id, values) : TaskService.createTask(values);
      closeTaskForm();
      window.dispatchEvent(new CustomEvent("task:created", { detail: task }));
    });
    form.querySelector("input")?.focus();
  }

  window.openTaskForm = openTaskForm;
})();