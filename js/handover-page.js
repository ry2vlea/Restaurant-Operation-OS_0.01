if (!window.showToast) {
  document.write(
    '<script src="js/components/ui-feedback.js"><\/script>'
  );
}

(function () {
  // =========================================================
  // CONFIGURATION
  // =========================================================

  const params =
    new URLSearchParams(
      window.location.search
    );

  const currentManager =
    localStorage.getItem(
      "currentManager"
    ) ||
    "Jordan Lee";

  const targetLabels = {
    MID_SHIFT: "Mid-Shift",
    CLOSING: "Closing Shift"
  };

  const typeLabels = {
    OPENING: "Opening",
    MID_SHIFT: "Mid-Shift",
    CLOSING: "Closing Shift"
  };

  const shiftPages = {
    OPENING: "opening.html",
    MID_SHIFT: "mid-shift.html",
    CLOSING: "closing.html"
  };

  let handover = null;
  let sourceShift = null;


  // =========================================================
  // DOM
  // =========================================================

  const el = (id) =>
    document.getElementById(id);


  // =========================================================
  // HELPERS
  // =========================================================

  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function notify(
    message,
    type = "success"
  ) {
    if (window.showToast) {
      showToast(
        message,
        type
      );

      return;
    }

    if (type === "error") {
      console.error(message);
    } else {
      console.log(message);
    }
  }


  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  }


  function normalizeHandover(
    current
  ) {
    if (!current) {
      return null;
    }

    return {
      ...current,

      selectedIssueIds:
        Array.isArray(
          current.selectedIssueIds
        )
          ? current.selectedIssueIds
          : [],

      selectedTaskIds:
        Array.isArray(
          current.selectedTaskIds
        )
          ? current.selectedTaskIds
          : [],

      staffingNotes:
        current.staffingNotes || "",

      productNotes:
        current.productNotes || "",

      equipmentNotes:
        current.equipmentNotes || "",

      guestNotes:
        current.guestNotes || "",

      operationalNotes:
        current.operationalNotes || "",

      nextPriority:
        current.nextPriority || ""
    };
  }


  function getTargetLabel() {
    return (
      targetLabels[
        handover?.toShiftType
      ] ||
      handover?.toShiftType
        ?.replaceAll("_", " ") ||
      "Next Shift"
    );
  }


  function getSourceLabel() {
    return (
      typeLabels[
        handover?.fromShiftType
      ] ||
      handover?.fromShiftType
        ?.replaceAll("_", " ") ||
      "Previous Shift"
    );
  }


  function setPageHeader() {
    if (!handover) {
      return;
    }

    if (
      el("handoverSubtitle")
    ) {
      el(
        "handoverSubtitle"
      ).textContent =
        `${getSourceLabel()} → ${getTargetLabel()} · ${handover.fromManager}`;
    }

    if (
      el("handoverStatus")
    ) {
      el(
        "handoverStatus"
      ).textContent =
        handover.status;

      el(
        "handoverStatus"
      ).className =
        `status shift-status ${handover.status.toLowerCase()}`;
    }
  }


  // =========================================================
  // LOAD / CREATE
  // =========================================================

  function createOrLoadHandover() {
    const requestedId =
      params.get("id");


    // -------------------------------------------------------
    // Existing Handover
    // -------------------------------------------------------

    if (requestedId) {
      handover =
        HandoverService
          .getHandoverById(
            requestedId
          );

      if (!handover) {
        return false;
      }

      handover =
        normalizeHandover(
          handover
        );

      sourceShift =
        ShiftService
          .getShiftById(
            handover.fromShiftId
          );

      return Boolean(
        sourceShift
      );
    }


    // -------------------------------------------------------
    // Create from Shift
    // -------------------------------------------------------

    const shiftId =
      params.get(
        "fromShiftId"
      );


    if (shiftId) {
      sourceShift =
        ShiftService
          .getShiftById(
            shiftId
          );
    } else {
      const sourceType =
        params.get("from") ||
        "OPENING";

      sourceShift =
        ShiftService
          .getTodayShift(
            sourceType
          );
    }


    if (!sourceShift) {
      return false;
    }


    const target =
      params.get("to") ||
      HandoverService
        .shiftSequence[
          sourceShift.type
        ];


    if (!target) {
      return false;
    }


    try {
      handover =
        HandoverService
          .createHandover({
            fromShiftId:
              sourceShift.id,

            fromShiftType:
              sourceShift.type,

            toShiftType:
              target,

            fromManager:
              sourceShift.manager
          });


      handover =
        normalizeHandover(
          handover
        );


      return true;

    } catch (error) {

      notify(
        error.message,
        "error"
      );

      return false;
    }
  }


  // =========================================================
  // ISSUES
  // =========================================================

  function issueRows() {
    const issues =
      window.IssueService
        ?.getOpenIssues?.() ||
      [];


    if (!issues.length) {
      return `
        <p class="muted-text">
          No Open Issues.
          No unresolved operational Issues
          to carry forward.
        </p>
      `;
    }


    return issues
      .map(
        (issue) => {

          const selected =
            handover
              .selectedIssueIds
              .includes(
                issue.id
              ) ||
            [
              "HIGH",
              "CRITICAL"
            ].includes(
              issue.priority
            );


          return `
            <label
              class="handover-select-row"
            >

              <input
                type="checkbox"
                data-issue-id="${escapeHTML(
                  issue.id
                )}"
                ${
                  selected
                    ? "checked"
                    : ""
                }
              >

              <span>

                <strong>
                  ${escapeHTML(
                    issue.id
                  )}
                </strong>

                <b
                  class="issue-priority ${escapeHTML(
                    (
                      issue.priority ||
                      "LOW"
                    ).toLowerCase()
                  )}"
                >
                  ${escapeHTML(
                    issue.priority ||
                    "LOW"
                  )}
                </b>

                <br>

                ${escapeHTML(
                  issue.title
                )}

                <small>
                  Assigned:
                  ${escapeHTML(
                    issue.assignedTo ||
                    "Unassigned"
                  )}
                  ·
                  ${escapeHTML(
                    (
                      issue.status ||
                      "OPEN"
                    ).replaceAll(
                      "_",
                      " "
                    )
                  )}
                </small>

              </span>

            </label>
          `;
        }
      )
      .join("");
  }


  // =========================================================
  // TASKS
  // =========================================================

  function taskRows() {
    const tasks =
      window.TaskService
        ?.getPendingTasks?.() ||
      [];


    if (!tasks.length) {
      return `
        <p class="muted-text">
          No Pending Tasks
        </p>
      `;
    }


    return tasks
      .map(
        (task) => {

          const selected =
            handover
              .selectedTaskIds
              .includes(
                task.id
              ) ||
            Boolean(
              window.TaskService
                ?.isOverdue?.(
                  task
                )
            ) ||
            [
              "HIGH",
              "CRITICAL"
            ].includes(
              task.priority
            );


          return `
            <label
              class="handover-select-row"
            >

              <input
                type="checkbox"
                data-task-id="${escapeHTML(
                  task.id
                )}"
                ${
                  selected
                    ? "checked"
                    : ""
                }
              >

              <span>

                <strong>
                  ${escapeHTML(
                    task.id
                  )}
                </strong>

                <b
                  class="issue-priority ${escapeHTML(
                    (
                      task.priority ||
                      "LOW"
                    ).toLowerCase()
                  )}"
                >
                  ${escapeHTML(
                    task.priority ||
                    "LOW"
                  )}
                </b>

                <br>

                ${escapeHTML(
                  task.title
                )}

                <small>

                  ${escapeHTML(
                    task.assignedTo ||
                    "Unassigned"
                  )}

                  ·

                  ${escapeHTML(
                    task.dueDate ||
                    "No due date"
                  )}

                  ·

                  ${escapeHTML(
                    (
                      task.status ||
                      "PENDING"
                    ).replaceAll(
                      "_",
                      " "
                    )
                  )}

                </small>

              </span>

            </label>
          `;
        }
      )
      .join("");
  }


  // =========================================================
  // LIVE COUNTS
  // =========================================================

  function renderCounts() {
    const container =
      el("handoverCounts");

    if (!container) {
      return;
    }


    const issues =
      window.IssueService
        ?.getOpenIssues?.()
        .length || 0;


    const pending =
      window.TaskService
        ?.getPendingTasks?.()
        .length || 0;


    const overdue =
      window.TaskService
        ?.getOverdueTasks?.()
        .length || 0;


    container.innerHTML = `

      <article
        class="metric-card"
      >
        <p>
          OPEN ISSUES
        </p>

        <h2>
          ${issues}
        </h2>
      </article>


      <article
        class="metric-card"
      >
        <p>
          PENDING TASKS
        </p>

        <h2>
          ${pending}
        </h2>
      </article>


      <article
        class="metric-card"
      >
        <p>
          OVERDUE
        </p>

        <h2>
          ${overdue}
        </h2>
      </article>
    `;
  }


  // =========================================================
  // EDITABLE DRAFT
  // =========================================================

  function renderDraft() {
    setPageHeader();


    const container =
      el("handoverApp");

    if (!container) {
      return;
    }


    container.innerHTML = `

      <section
        class="handover-hero"
      >

        <p class="eyebrow">
          OPERATIONAL CONTINUITY
        </p>

        <h2>
          ${escapeHTML(
            getSourceLabel()
          )}
          →
          ${escapeHTML(
            getTargetLabel()
          )}
        </h2>

        <p>
          ${escapeHTML(
            handover.fromManager
          )}
          ·
          ${escapeHTML(
            formatDateTime(
              handover.createdAt
            )
          )}
        </p>

      </section>


      <section
        id="handoverCounts"
        class="live-counts"
      ></section>


      <form
        id="handoverForm"
      >

        <section
          class="handover-section"
        >

          <div
            class="section-header"
          >

            <h2>
              Highlighted Issues
            </h2>

            <span
              class="muted-text"
            >
              Select what needs
              explicit attention
            </span>

          </div>


          <div
            class="handover-selection"
          >
            ${issueRows()}
          </div>

        </section>


        <section
          class="handover-section"
        >

          <div
            class="section-header"
          >

            <h2>
              Highlighted Tasks
            </h2>

            <span
              class="muted-text"
            >
              Select important
              carry-forward work
            </span>

          </div>


          <div
            class="handover-selection"
          >
            ${taskRows()}
          </div>

        </section>


        <section
          class="handover-notes"
        >

          <h2>
            Manager Notes
          </h2>


          <div
            class="form-grid"
          >

            <label>

              Staffing

              <textarea
                name="staffingNotes"
                rows="3"
              >${escapeHTML(
                handover.staffingNotes
              )}</textarea>

            </label>


            <label>

              Product / Inventory

              <textarea
                name="productNotes"
                rows="3"
              >${escapeHTML(
                handover.productNotes
              )}</textarea>

            </label>


            <label>

              Equipment

              <textarea
                name="equipmentNotes"
                rows="3"
              >${escapeHTML(
                handover.equipmentNotes
              )}</textarea>

            </label>


            <label>

              Guest Experience

              <textarea
                name="guestNotes"
                rows="3"
              >${escapeHTML(
                handover.guestNotes
              )}</textarea>

            </label>


            <label
              class="full-width"
            >

              Operational Notes

              <textarea
                name="operationalNotes"
                rows="3"
              >${escapeHTML(
                handover.operationalNotes
              )}</textarea>

            </label>


            <label
              class="full-width
              next-priority-field"
            >

              Next Operational Priority

              <input
                name="nextPriority"
                required
                value="${escapeHTML(
                  handover.nextPriority
                )}"
                placeholder="What must the next manager act on first?"
              >

            </label>

          </div>

        </section>


        <div
          class="modal-actions"
        >

          <button
            type="button"
            class="secondary-button"
            id="saveDraft"
          >
            Save Draft
          </button>


          <button
            type="submit"
            class="primary-button"
          >
            Send Handover
          </button>

        </div>

      </form>
    `;


    renderCounts();


    el(
      "saveDraft"
    )?.addEventListener(
      "click",
      () => {
        saveDraft();
      }
    );


    el(
      "handoverForm"
    )?.addEventListener(
      "submit",
      (event) => {

        event.preventDefault();

        submitHandover();

      }
    );
  }


  // =========================================================
  // FORM VALUES
  // =========================================================

  function getFormValues() {
    const form =
      el("handoverForm");

    if (!form) {
      return null;
    }


    const values =
      Object.fromEntries(
        new FormData(form)
      );


    values.selectedIssueIds =
      [
        ...document
          .querySelectorAll(
            "[data-issue-id]:checked"
          )
      ].map(
        (input) =>
          input.dataset.issueId
      );


    values.selectedTaskIds =
      [
        ...document
          .querySelectorAll(
            "[data-task-id]:checked"
          )
      ].map(
        (input) =>
          input.dataset.taskId
      );


    return values;
  }


  // =========================================================
  // SAVE DRAFT
  // =========================================================

  function saveDraft() {
    if (
      handover.status !==
      HandoverService
        .statuses.DRAFT
    ) {

      notify(
        "A submitted handover can no longer be returned to Draft.",
        "error"
      );

      renderCurrentState();

      return;
    }


    const values =
      getFormValues();

    if (!values) {
      return;
    }


    try {

      handover =
        HandoverService
          .updateHandover(
            handover.id,
            {
              ...values,

              status:
                HandoverService
                  .statuses.DRAFT
            }
          );


      handover =
        normalizeHandover(
          handover
        );


      renderDraft();


      notify(
        "Handover draft saved."
      );

    } catch (error) {

      notify(
        error.message,
        "error"
      );

    }
  }


  // =========================================================
  // SUBMIT HANDOVER
  // =========================================================

  function submitHandover() {
    if (
      handover.status !==
      HandoverService
        .statuses.DRAFT
    ) {

      renderCurrentState();

      return;
    }


    const values =
      getFormValues();

    if (!values) {
      return;
    }


    const priority =
      String(
        values.nextPriority ||
        ""
      ).trim();


    if (!priority) {

      document
        .querySelector(
          '[name="nextPriority"]'
        )
        ?.focus();

      notify(
        "Next Operational Priority is required.",
        "error"
      );

      return;
    }


    values.nextPriority =
      priority;


    try {

      if (
        typeof HandoverService
          .submitHandover ===
        "function"
      ) {

        handover =
          HandoverService
            .submitHandover(
              handover.id,
              values
            );

      } else {

        handover =
          HandoverService
            .updateHandover(
              handover.id,
              {
                ...values,

                status:
                  HandoverService
                    .statuses.READY
              }
            );

      }


      handover =
        normalizeHandover(
          handover
        );


      notify(
        `Handover sent to the ${getTargetLabel()} manager.`
      );


      renderReview();

    } catch (error) {

      notify(
        error.message,
        "error"
      );

    }
  }


  // =========================================================
  // REVIEW
  // =========================================================

  function renderReview() {
    setPageHeader();


    const issues =
      handover
        .selectedIssueIds
        .map(
          (id) =>
            window.IssueService
              ?.getIssueById?.(
                id
              )
        )
        .filter(Boolean);


    const tasks =
      handover
        .selectedTaskIds
        .map(
          (id) =>
            window.TaskService
              ?.getTaskById?.(
                id
              )
        )
        .filter(Boolean);


    const container =
      el("handoverApp");

    if (!container) {
      return;
    }


    container.innerHTML = `

      <section
        class="handover-review"
      >

        <p class="eyebrow">
          HANDOVER WAITING
        </p>


        <h2>
          ${escapeHTML(
            getSourceLabel()
          )}
          →
          ${escapeHTML(
            getTargetLabel()
          )}
        </h2>


        <p>
          Sent by
          <strong>
            ${escapeHTML(
              handover.fromManager
            )}
          </strong>

          ·

          ${escapeHTML(
            formatDateTime(
              handover.submittedAt ||
              handover.createdAt
            )
          )}
        </p>


        <div
          class="next-priority-callout"
        >

          <span>
            NEXT PRIORITY
          </span>

          <strong>
            ${escapeHTML(
              handover.nextPriority ||
              "No priority provided."
            )}
          </strong>

        </div>


        <div
          class="review-grid"
        >

          <div>

            <h3>
              Highlighted Issues
            </h3>

            ${
              issues.length
                ? issues
                    .map(
                      (issue) => `

                        <p>

                          <strong>
                            ${escapeHTML(
                              issue.id
                            )}
                          </strong>

                          ·

                          ${escapeHTML(
                            issue.title
                          )}

                          <small>
                            ${escapeHTML(
                              issue.priority ||
                              ""
                            )}
                            ·
                            ${escapeHTML(
                              (
                                issue.status ||
                                ""
                              ).replaceAll(
                                "_",
                                " "
                              )
                            )}
                          </small>

                        </p>

                      `
                    )
                    .join("")
                : `
                    <p>
                      No highlighted Issues.
                    </p>
                  `
            }

          </div>


          <div>

            <h3>
              Highlighted Tasks
            </h3>

            ${
              tasks.length
                ? tasks
                    .map(
                      (task) => `

                        <p>

                          <strong>
                            ${escapeHTML(
                              task.id
                            )}
                          </strong>

                          ·

                          ${escapeHTML(
                            task.title
                          )}

                          <small>
                            ${escapeHTML(
                              task.priority ||
                              ""
                            )}
                            ·
                            ${escapeHTML(
                              (
                                task.status ||
                                ""
                              ).replaceAll(
                                "_",
                                " "
                              )
                            )}
                          </small>

                        </p>

                      `
                    )
                    .join("")
                : `
                    <p>
                      No highlighted Tasks.
                    </p>
                  `
            }

          </div>

        </div>


        <div
          class="review-notes"
        >

          <h3>
            Staffing Notes
          </h3>

          <p>
            ${escapeHTML(
              handover.staffingNotes ||
              "No notes."
            )}
          </p>


          <h3>
            Product / Inventory Notes
          </h3>

          <p>
            ${escapeHTML(
              handover.productNotes ||
              "No notes."
            )}
          </p>


          <h3>
            Equipment Notes
          </h3>

          <p>
            ${escapeHTML(
              handover.equipmentNotes ||
              "No notes."
            )}
          </p>


          <h3>
            Guest Experience Notes
          </h3>

          <p>
            ${escapeHTML(
              handover.guestNotes ||
              "No notes."
            )}
          </p>


          <h3>
            Operational Notes
          </h3>

          <p>
            ${escapeHTML(
              handover.operationalNotes ||
              "No notes."
            )}
          </p>

        </div>


        <div
          class="modal-actions"
        >

          <button
            type="button"
            class="primary-button"
            id="acceptHandover"
          >
            Accept & Start ${escapeHTML(
              getTargetLabel()
            )}
          </button>

        </div>

      </section>
    `;


    el(
      "acceptHandover"
    )?.addEventListener(
      "click",
      acceptHandover
    );
  }


  // =========================================================
  // ACCEPT
  // =========================================================

  function acceptHandover() {
    if (
      handover.status ===
      HandoverService
        .statuses.ACCEPTED
    ) {

      renderAccepted();

      return;
    }


    const button =
      el("acceptHandover");


    if (button) {
      button.disabled =
        true;

      button.textContent =
        "Accepting...";
    }


    try {

      handover =
        HandoverService
          .acceptHandover(
            handover.id,
            currentManager
          );


      handover =
        normalizeHandover(
          handover
        );


      notify(
        "Handover accepted."
      );


      renderAccepted();

    } catch (error) {

      if (button) {
        button.disabled =
          false;

        button.textContent =
          `Accept & Start ${getTargetLabel()}`;
      }


      notify(
        error.message,
        "error"
      );

    }
  }


  // =========================================================
  // ACCEPTED STATE
  // =========================================================

  function renderAccepted() {
    setPageHeader();


    const nextShift =
      handover.toShiftId
        ? ShiftService
            .getShiftById(
              handover.toShiftId
            )
        : ShiftService
            .getTodayShift(
              handover.toShiftType
            );


    const targetPage =
      shiftPages[
        handover.toShiftType
      ];


    const container =
      el("handoverApp");

    if (!container) {
      return;
    }


    container.innerHTML = `

      <section
        class="handover-review"
      >

        <p class="eyebrow">
          CONTINUITY CONFIRMED
        </p>


        <h2>
          Handover Accepted
        </h2>


        <p>
          ${escapeHTML(
            getSourceLabel()
          )}
          has transferred operational
          responsibility to
          ${escapeHTML(
            getTargetLabel()
          )}.
        </p>


        <div
          class="next-priority-callout"
        >

          <span>
            NEXT PRIORITY
          </span>

          <strong>
            ${escapeHTML(
              handover.nextPriority ||
              "No priority provided."
            )}
          </strong>

        </div>


        <div
          class="review-grid"
        >

          <div>

            <h3>
              Outgoing Manager
            </h3>

            <p>
              ${escapeHTML(
                handover.fromManager ||
                "—"
              )}
            </p>

          </div>


          <div>

            <h3>
              Incoming Manager
            </h3>

            <p>
              ${escapeHTML(
                handover.toManager ||
                currentManager
              )}
            </p>

          </div>


          <div>

            <h3>
              Accepted
            </h3>

            <p>
              ${escapeHTML(
                formatDateTime(
                  handover.acceptedAt
                )
              )}
            </p>

          </div>


          <div>

            <h3>
              ${escapeHTML(
                getTargetLabel()
              )}
            </h3>

            <p>
              ${
                nextShift
                  ? `${escapeHTML(
                      nextShift.status.replaceAll(
                        "_",
                        " "
                      )
                    )} · Started ${escapeHTML(
                      formatDateTime(
                        nextShift.startedAt
                      )
                    )}`
                  : "Shift record not available."
              }
            </p>

          </div>

        </div>


        ${
          targetPage
            ? `
                <div
                  class="modal-actions"
                >

                  <button
                    type="button"
                    class="secondary-button"
                    id="dashboardButton"
                  >
                    Dashboard
                  </button>


                  <button
                    type="button"
                    class="primary-button"
                    id="openNextShiftButton"
                  >
                    Open ${escapeHTML(
                      getTargetLabel()
                    )}
                  </button>

                </div>
              `
            : ""
        }

      </section>
    `;


    el(
      "dashboardButton"
    )?.addEventListener(
      "click",
      () => {

        window.location.href =
          "index.html";

      }
    );


    el(
      "openNextShiftButton"
    )?.addEventListener(
      "click",
      () => {

        window.location.href =
          targetPage;

      }
    );
  }


  // =========================================================
  // EMPTY / ERROR STATE
  // =========================================================

  function renderEmpty() {
    if (
      el("handoverStatus")
    ) {
      el(
        "handoverStatus"
      ).textContent =
        "UNAVAILABLE";
    }


    if (
      el("handoverSubtitle")
    ) {
      el(
        "handoverSubtitle"
      ).textContent =
        "Unable to prepare this handover.";
    }


    if (
      el("handoverApp")
    ) {

      el(
        "handoverApp"
      ).innerHTML = `

        <section
          class="empty-state"
        >

          <h3>
            No source Shift found
          </h3>

          <p>
            Start the outgoing Shift
            before preparing a Handover.
          </p>


          <button
            type="button"
            class="primary-button"
            id="returnDashboard"
          >
            Return to Dashboard
          </button>

        </section>
      `;


      el(
        "returnDashboard"
      )?.addEventListener(
        "click",
        () => {

          window.location.href =
            "index.html";

        }
      );
    }
  }


  // =========================================================
  // STATE ROUTER
  // =========================================================

  function renderCurrentState() {
    if (!handover) {
      renderEmpty();
      return;
    }


    handover =
      normalizeHandover(
        handover
      );


    switch (
      handover.status
    ) {

      case HandoverService
        .statuses.DRAFT:

        renderDraft();

        break;


      case HandoverService
        .statuses.READY:

        renderReview();

        break;


      case HandoverService
        .statuses.ACCEPTED:

        renderAccepted();

        break;


      case HandoverService
        .statuses.CANCELLED:

        renderCancelled();

        break;


      default:

        console.warn(
          "Unknown Handover status:",
          handover.status
        );

        renderDraft();
    }
  }


  // =========================================================
  // CANCELLED
  // =========================================================

  function renderCancelled() {
    setPageHeader();


    if (
      el("handoverApp")
    ) {

      el(
        "handoverApp"
      ).innerHTML = `

        <section
          class="empty-state"
        >

          <p class="eyebrow">
            HANDOVER CANCELLED
          </p>

          <h3>
            This handover is no longer active.
          </h3>

          <p>
            No shift transition will
            occur from this handover.
          </p>


          <button
            type="button"
            class="primary-button"
            id="returnDashboard"
          >
            Return to Dashboard
          </button>

        </section>
      `;


      el(
        "returnDashboard"
      )?.addEventListener(
        "click",
        () => {

          window.location.href =
            "index.html";

        }
      );
    }
  }


  // =========================================================
  // INITIALIZATION
  // =========================================================

  if (
    !window.HandoverService ||
    !window.ShiftService
  ) {

    console.error(
      "Handover Page: required services are not loaded."
    );

    renderEmpty();

  } else if (
    createOrLoadHandover()
  ) {

    renderCurrentState();

  } else {

    renderEmpty();
  }

})();