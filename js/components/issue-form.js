(function () {
  const categories = ["STAFFING", "INVENTORY", "EQUIPMENT", "GUEST", "FACILITY", "OPERATIONS", "VENDOR", "OTHER"];
  const managers = ["Jordan Lee", "Alex Rivera", "Mia Torres"];

  function optionList(values, selected) {
    return values.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value.replaceAll("_", " ")}</option>`).join("");
  }

  function closeIssueForm() {
    document.getElementById("issueFormModal")?.remove();
  }

  function openIssueForm(context = {}) {
    closeIssueForm();
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.id = "issueFormModal";
    modal.innerHTML = `
      <div class="modal issue-form-modal" role="dialog" aria-modal="true" aria-labelledby="issueFormTitle">
        <div class="modal-header"><div><p class="eyebrow">OPERATIONAL RECORD</p><h2 id="issueFormTitle">Report Issue</h2></div><button class="icon-button" type="button" data-close aria-label="Close">×</button></div>
        <form id="issueForm">
          <div class="form-grid">
            <label>Category<select name="category">${optionList(categories, context.category || "OTHER")}</select></label>
            <label>Priority<select name="priority">${optionList(["LOW", "MEDIUM", "HIGH", "CRITICAL"], "MEDIUM")}</select></label>
            <label class="full-width">Issue Title<input name="title" required maxlength="120" placeholder="What needs attention?"></label>
            <label class="full-width">Description<textarea name="description" required rows="4" placeholder="Describe what happened and where."></textarea></label>
            <label>Operational Impact<select name="operationalImpact">${optionList(["LOW", "MODERATE", "HIGH", "CRITICAL"], "MODERATE")}</select></label>
            <label>Assigned To<select name="assignedTo">${optionList(managers, "Jordan Lee")}</select></label>
            <label class="full-width">Immediate Action Taken<textarea name="immediateAction" rows="3" placeholder="Optional"></textarea></label>
          </div>
          ${context.sourceLabel ? `<p class="form-context">Source: <strong>${context.sourceLabel}</strong></p>` : ""}
          <div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save Issue</button></div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    const form = modal.querySelector("form");
    modal.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeIssueForm));
    modal.addEventListener("click", (event) => { if (event.target === modal) closeIssueForm(); });
    document.addEventListener("keydown", function escapeHandler(event) {
      if (event.key === "Escape") { closeIssueForm(); document.removeEventListener("keydown", escapeHandler); }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      values.source = context.sourceType ? { type: context.sourceType, id: context.sourceId || null, label: context.sourceLabel || context.sourceType } : null;
      const issue = IssueService.createIssue(values);
      closeIssueForm();
      window.dispatchEvent(new CustomEvent("issue:created", { detail: issue }));
    });
    form.querySelector("input")?.focus();
  }

  window.openIssueForm = openIssueForm;
})();