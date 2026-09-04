if (!window.HandoverService) {
  document.write('<script src="js/handover-service.js"><\/script>');
}

if (!window.showToast) {
  document.write('<script src="js/components/ui-feedback.js"><\/script>');
}

(function () {
  const config = window.shiftPageConfig;

  if (!config || !window.ShiftService) {
    console.error(
      "Shift Page: missing shiftPageConfig or ShiftService."
    );
    return;
  }

  let shift = null;

  const allTasks = config.checklist.flatMap(
    (section) => section[2]
  );

  const totalTasks = allTasks.length;

  const previousType = {
    OPENING: null,
    MID_SHIFT: "OPENING",
    CLOSING: "MID_SHIFT"
  }[config.type];

  const nextType = {
    OPENING: "MID_SHIFT",
    MID_SHIFT: "CLOSING",
    CLOSING: null
  }[config.type];

  const shiftLabels = {
    OPENING: "Opening Shift",
    MID_SHIFT: "Mid-Shift",
    CLOSING: "Closing Shift"
  };

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


  function formatTime(value) {
    if (!value) {
      return "Not started";
    }

    return new Date(value)
      .toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit"
        }
      );
  }


  function isCompleted(currentShift) {
    if (!currentShift) {
      return false;
    }

    return [
      ShiftService.statuses.COMPLETED,
      ShiftService.statuses
        .COMPLETED_WITH_EXCEPTIONS
    ].includes(
      currentShift.status
    );
  }


  function isChecklistValueComplete(value) {
    if (value === true) {
      return true;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      return [
        "COMPLETED",
        "EXCEPTION",
        "N/A"
      ].includes(
        value.status
      );
    }

    return false;
  }


  function isChecklistEditable() {
    return Boolean(
      shift &&
      shift.status ===
        ShiftService.statuses.IN_PROGRESS
    );
  }


  function counts() {
    return {
      issues:
        window.IssueService
          ?.getOpenIssues?.()
          .length || 0,

      pending:
        window.TaskService
          ?.getPendingTasks?.()
          .length || 0,

      overdue:
        window.TaskService
          ?.getOverdueTasks?.()
          .length || 0
    };
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


  function getPreviousShift() {
    if (!previousType) {
      return null;
    }

    return ShiftService
      .getTodayShift(
        previousType
      );
  }


  function getIncomingHandover() {
    if (!window.HandoverService) {
      return null;
    }

    if (
      typeof HandoverService
        .getIncomingHandover ===
      "function"
    ) {
      return HandoverService
        .getIncomingHandover(
          config.type,
          ShiftService.today()
        );
    }

    return (
      HandoverService
        .getHandovers()
        .find(
          (handover) =>
            handover.toShiftType ===
              config.type &&
            handover.status ===
              "READY"
        ) || null
    );
  }


  function getOutgoingHandover() {
    if (
      !shift ||
      !nextType ||
      !window.HandoverService
    ) {
      return null;
    }

    return HandoverService
      .getHandoverForShift(
        shift.id,
        nextType
      );
  }


  function goToHandover() {
    if (!shift || !nextType) {
      return;
    }

    const handover =
      getOutgoingHandover();

    if (handover) {
      window.location.href =
        `handover.html?id=${encodeURIComponent(
          handover.id
        )}`;

      return;
    }

    window.location.href =
      `handover.html?fromShiftId=${encodeURIComponent(
        shift.id
      )}` +
      `&to=${encodeURIComponent(
        nextType
      )}`;
  }


  // =========================================================
  // HANDOVER BANNER
  // =========================================================

  function renderHandoverBanner() {
    const incoming =
      getIncomingHandover();

    let banner =
      el("handoverBanner");

    if (!incoming) {
      banner?.remove();
      return;
    }

    if (!banner) {
      banner =
        document.createElement(
          "section"
        );

      banner.id =
        "handoverBanner";

      banner.className =
        "handover-banner";

      const header =
        el("shiftInformation")
          ?.closest("header");

      if (header) {
        header.after(banner);
      }
    }


    const issueCount =
      Array.isArray(
        incoming.selectedIssueIds
      )
        ? incoming
            .selectedIssueIds
            .length
        : 0;


    const taskCount =
      Array.isArray(
        incoming.selectedTaskIds
      )
        ? incoming
            .selectedTaskIds
            .length
        : 0;


    banner.innerHTML = `
      <div>

        <p class="eyebrow">
          HANDOVER WAITING
        </p>

        <h2>

          ${escapeHTML(
            shiftLabels[
              incoming.fromShiftType
            ] ||
            incoming.fromShiftType
              ?.replaceAll("_", " ") ||
            "Previous Shift"
          )}

          ·

          ${escapeHTML(
            incoming.fromManager ||
            "Manager"
          )}

        </h2>

        <p>

          ${issueCount}
          highlighted Issues ·

          ${taskCount}
          highlighted Tasks

        </p>

        <strong>

          ${escapeHTML(
            incoming.nextPriority ||
            "No priority provided."
          )}

        </strong>

      </div>


      <button
        type="button"
        class="secondary-button"
        id="reviewIncomingHandoverButton"
      >
        Review Handover
      </button>
    `;


    el(
      "reviewIncomingHandoverButton"
    )?.addEventListener(
      "click",
      () => {

        window.location.href =
          `handover.html?id=${encodeURIComponent(
            incoming.id
          )}&review=true`;

      }
    );
  }


  // =========================================================
  // CHECKLIST RENDERING
  // =========================================================

  function renderSections() {
    const container =
      el("shiftChecklist");

    if (!container) {
      return;
    }


    const checklist =
      shift?.checklist || {};

    const editable =
      isChecklistEditable();


    container.innerHTML =
      config.checklist
        .map(
          ([
            title,
            description,
            tasks
          ]) => {

            const completedCount =
              tasks.filter(
                ([id]) =>
                  isChecklistValueComplete(
                    checklist[id]
                  )
              ).length;


            return `
              <section
                class="checklist-section"
              >

                <div
                  class="checklist-heading"
                >

                  <div>

                    <h2>
                      ${escapeHTML(
                        title
                      )}
                    </h2>

                    <p>
                      ${escapeHTML(
                        description
                      )}
                    </p>

                  </div>

                  <span>
                    ${completedCount}
                    /
                    ${tasks.length}
                  </span>

                </div>


                <div
                  class="checklist-card"
                >

                  ${tasks
                    .map(
                      ([
                        id,
                        label,
                        detail
                      ]) => `

                        <div
                          class="checklist-item action-item"
                        >

                          <label>

                            <input
                              type="checkbox"
                              data-task="${escapeHTML(
                                id
                              )}"
                              ${
                                isChecklistValueComplete(
                                  checklist[
                                    id
                                  ]
                                )
                                  ? "checked"
                                  : ""
                              }
                              ${
                                editable
                                  ? ""
                                  : "disabled"
                              }
                            >

                            <div>

                              <strong>
                                ${escapeHTML(
                                  label
                                )}
                              </strong>

                              <small>
                                ${escapeHTML(
                                  detail
                                )}
                              </small>

                            </div>

                          </label>


                          ${
                            id.includes(
                              "equipment"
                            ) &&
                            shift
                              ? `
                                <button
                                  type="button"
                                  class="issue-button"
                                  data-report-issue
                                  ${
                                    editable
                                      ? ""
                                      : "disabled"
                                  }
                                >
                                  Report Issue
                                </button>
                              `
                              : ""
                          }

                        </div>

                      `
                    )
                    .join("")}

                </div>

              </section>
            `;
          }
        )
        .join("");


    container
      .querySelectorAll(
        "input[data-task]"
      )
      .forEach(
        (checkbox) => {

          checkbox
            .addEventListener(
              "change",
              saveChecklist
            );

        }
      );


    container
      .querySelectorAll(
        "[data-report-issue]"
      )
      .forEach(
        (button) => {

          button
            .addEventListener(
              "click",
              () => {

                if (!shift) {
                  return;
                }

                openIssueForm({
                  sourceType:
                    "SHIFT",

                  sourceId:
                    shift.id,

                  sourceLabel:
                    config.title,

                  category:
                    "EQUIPMENT"
                });

              }
            );

        }
      );
  }


  function renderOpeningChecklist() {
    if (el("shiftChecklist")) {
      return;
    }


    const checklist =
      shift?.checklist || {};

    const editable =
      isChecklistEditable();


    document
      .querySelectorAll(
        'input[type="checkbox"][data-task]'
      )
      .forEach(
        (input) => {

          input.checked =
            isChecklistValueComplete(
              checklist[
                input.dataset.task
              ]
            );

          input.disabled =
            !editable;

          input.onchange =
            editable
              ? saveChecklist
              : null;

        }
      );


    const staffingTaskIds = [
      "review-schedule",
      "review-callouts",
      "critical-coverage"
    ];


    const staffingCompleted =
      staffingTaskIds
        .filter(
          (id) =>
            isChecklistValueComplete(
              checklist[id]
            )
        )
        .length;


    if (
      el("staffingProgress")
    ) {
      el(
        "staffingProgress"
      ).textContent =
        `${staffingCompleted} / ${staffingTaskIds.length}`;
    }


    if (
      el("equipmentIssueButton")
    ) {
      el(
        "equipmentIssueButton"
      ).disabled =
        !editable;


      el(
        "equipmentIssueButton"
      ).onclick =
        editable
          ? () => {

              openIssueForm({
                sourceType:
                  "SHIFT",

                sourceId:
                  shift.id,

                sourceLabel:
                  config.title,

                category:
                  "EQUIPMENT"
              });

            }
          : null;
    }
  }


  function saveChecklist() {
    if (
      !shift ||
      !isChecklistEditable()
    ) {
      return;
    }


    const previousChecklist =
      shift.checklist || {};

    const checklist = {};


    document
      .querySelectorAll(
        'input[type="checkbox"][data-task]'
      )
      .forEach(
        (input) => {

          const previousValue =
            previousChecklist[
              input.dataset.task
            ];


          if (!input.checked) {

            checklist[
              input.dataset.task
            ] = false;

            return;
          }


          if (
            previousValue &&
            typeof previousValue ===
              "object"
          ) {

            checklist[
              input.dataset.task
            ] =
              previousValue;

            return;
          }


          checklist[
            input.dataset.task
          ] = true;

        }
      );


    try {

      shift =
        ShiftService
          .updateShiftChecklist(
            shift.id,
            checklist
          );

      render();

    } catch (error) {

      notify(
        error.message,
        "error"
      );

    }
  }


  // =========================================================
  // LIVE COUNTS
  // =========================================================

  function renderLiveCounts() {
    if (!el("liveCounts")) {
      return;
    }


    const live =
      counts();


    el(
      "liveCounts"
    ).innerHTML = `

      <button
        type="button"
        class="metric-card"
        data-live-link="issues"
      >
        <p>
          OPEN ISSUES
        </p>

        <h2>
          ${live.issues}
        </h2>
      </button>


      <button
        type="button"
        class="metric-card"
        data-live-link="tasks"
      >
        <p>
          PENDING TASKS
        </p>

        <h2>
          ${live.pending}
        </h2>
      </button>


      <article
        class="metric-card"
      >
        <p>
          OVERDUE TASKS
        </p>

        <h2>
          ${live.overdue}
        </h2>
      </article>
    `;


    el("liveCounts")
      .querySelectorAll(
        "[data-live-link]"
      )
      .forEach(
        (button) => {

          button
            .addEventListener(
              "click",
              () => {

                window.location.href =
                  `${button.dataset.liveLink}.html`;

              }
            );

        }
      );
  }


  // =========================================================
  // PRIMARY ACTION
  // =========================================================

  function updatePrimaryAction() {
    const button =
      el("completeShiftButton");

    if (!button) {
      return;
    }


    const incoming =
      getIncomingHandover();

    const previous =
      getPreviousShift();


    // -------------------------------------------------------
    // NOT STARTED
    // -------------------------------------------------------

    if (!shift) {

      if (incoming) {

        button.textContent =
          "Review Handover";

        button.disabled =
          false;

        return;
      }


      if (
        previous &&
        !isCompleted(previous)
      ) {

        button.textContent =
          `Waiting for ${
            shiftLabels[
              previous.type
            ] ||
            previous.type
          }`;

        button.disabled =
          true;

        return;
      }


      button.textContent =
        `Start ${config.title}`;

      button.disabled =
        false;

      return;
    }


    // -------------------------------------------------------
    // COMPLETED
    // -------------------------------------------------------

    if (isCompleted(shift)) {

      button.textContent =
        `${config.title} Complete`;

      button.disabled =
        true;

      return;
    }


    // -------------------------------------------------------
    // CLOSING
    // -------------------------------------------------------

    if (
      config.type ===
      "CLOSING"
    ) {

      button.textContent =
        "Complete Closing Shift";

      button.disabled =
        shift.status !==
        ShiftService.statuses
          .IN_PROGRESS;

      return;
    }


    // -------------------------------------------------------
    // OPENING / MID-SHIFT
    // -------------------------------------------------------

    if (
      shift.status ===
      ShiftService.statuses
        .IN_PROGRESS
    ) {

      button.textContent =
        "Prepare Handover";

      button.disabled =
        false;

      return;
    }


    if (
      shift.status ===
      ShiftService.statuses
        .READY_FOR_HANDOVER
    ) {

      button.textContent =
        "Continue Handover";

      button.disabled =
        false;

      return;
    }


    if (
      shift.status ===
      ShiftService.statuses
        .HANDOVER_PENDING
    ) {

      button.textContent =
        "Handover Pending";

      button.disabled =
        true;

      return;
    }


    button.textContent =
      config.title;

    button.disabled =
      true;
  }


  // =========================================================
  // MAIN RENDER
  // =========================================================

  function render() {
    renderHandoverBanner();


    if (!shift) {
      renderNotStarted();
      return;
    }


    const progress =
      ShiftService
        .calculateShiftProgress(
          shift,
          totalTasks
        );


    if (
      el("shiftInformation")
    ) {

      el(
        "shiftInformation"
      ).textContent =
        `${shift.manager} · Started ${formatTime(
          shift.startedAt
        )}`;

    }


    if (
      el("shiftStatus")
    ) {

      el(
        "shiftStatus"
      ).textContent =
        shift.status
          .replaceAll(
            "_",
            " "
          );


      el(
        "shiftStatus"
      ).className =
        `status shift-status ${shift.status.toLowerCase()}`;

    }


    if (
      el("progressText")
    ) {

      el(
        "progressText"
      ).textContent =
        `${progress.completed} / ${progress.total} tasks complete`;

    }


    if (
      el("progressPercentage")
    ) {

      el(
        "progressPercentage"
      ).textContent =
        `${progress.percentage}%`;

    }


    if (
      el("openingProgressBar")
    ) {

      el(
        "openingProgressBar"
      ).style.width =
        `${progress.percentage}%`;

    }


    if (
      el("createTaskButton")
    ) {

      el(
        "createTaskButton"
      ).disabled =
        !isChecklistEditable();

    }


    if (
      el("tomorrowPriorityWrap")
    ) {

      el(
        "tomorrowPriorityWrap"
      ).hidden =
        config.type !==
        "CLOSING";


      if (
        config.type ===
          "CLOSING" &&
        el("tomorrowPriority")
      ) {

        el(
          "tomorrowPriority"
        ).value =
          shift.tomorrowPriority ||
          "";


        el(
          "tomorrowPriority"
        ).disabled =
          isCompleted(shift);

      }
    }


    renderLiveCounts();

    renderSections();

    renderOpeningChecklist();

    updatePrimaryAction();
  }


  function renderNotStarted() {
    const previous =
      getPreviousShift();

    const incoming =
      getIncomingHandover();


    if (
      el("shiftInformation")
    ) {

      if (incoming) {

        el(
          "shiftInformation"
        ).textContent =
          `Handover waiting from ${
            incoming.fromManager ||
            "previous manager"
          }`;

      } else if (
        previous &&
        !isCompleted(previous)
      ) {

        el(
          "shiftInformation"
        ).textContent =
          `${
            shiftLabels[
              previous.type
            ] ||
            previous.type
          } is still active`;

      } else {

        el(
          "shiftInformation"
        ).textContent =
          "Shift has not started.";

      }
    }


    if (
      el("shiftStatus")
    ) {

      el(
        "shiftStatus"
      ).textContent =
        "NOT STARTED";


      el(
        "shiftStatus"
      ).className =
        "status shift-status not_started";

    }


    if (
      el("progressText")
    ) {

      el(
        "progressText"
      ).textContent =
        `0 / ${totalTasks} tasks complete`;

    }


    if (
      el("progressPercentage")
    ) {

      el(
        "progressPercentage"
      ).textContent =
        "0%";

    }


    if (
      el("openingProgressBar")
    ) {

      el(
        "openingProgressBar"
      ).style.width =
        "0%";

    }


    if (
      el("createTaskButton")
    ) {

      el(
        "createTaskButton"
      ).disabled =
        true;

    }


    if (
      el("tomorrowPriorityWrap")
    ) {

      el(
        "tomorrowPriorityWrap"
      ).hidden =
        config.type !==
        "CLOSING";


      if (
        el("tomorrowPriority")
      ) {

        el(
          "tomorrowPriority"
        ).disabled =
          true;

      }
    }


    renderLiveCounts();

    renderSections();

    renderOpeningChecklist();

    updatePrimaryAction();
  }


  // =========================================================
  // START SHIFT
  // =========================================================

  function startShift() {
    const previous =
      getPreviousShift();


    if (
      previous &&
      !isCompleted(previous)
    ) {

      notify(
        `${
          shiftLabels[
            previous.type
          ] ||
          previous.type
        } must be completed before starting ${config.title}.`,
        "error"
      );

      return;
    }


    try {

      shift =
        ShiftService
          .startShift(
            config.type,
            localStorage.getItem(
              "currentManager"
            ) ||
            "Jordan Lee"
          );


      render();


      notify(
        `${config.title} started.`
      );

    } catch (error) {

      notify(
        error.message,
        "error"
      );

    }
  }


  // =========================================================
  // PREPARE HANDOVER
  // =========================================================

  function prepareHandover() {
    if (
      !shift ||
      !nextType
    ) {
      return;
    }


    if (
      shift.status ===
      ShiftService.statuses
        .HANDOVER_PENDING
    ) {
      return;
    }


    if (
      shift.status ===
      ShiftService.statuses
        .READY_FOR_HANDOVER
    ) {

      goToHandover();

      return;
    }


    const progress =
      ShiftService
        .calculateShiftProgress(
          shift,
          totalTasks
        );


    if (
      progress.completed <
      totalTasks
    ) {

      showExceptionDialog(
        "HANDOVER"
      );

      return;
    }


    try {

      shift =
        ShiftService
          .markReadyForHandover(
            shift.id
          );


      goToHandover();

    } catch (error) {

      notify(
        error.message,
        "error"
      );

    }
  }


  // =========================================================
  // CLOSING
  // =========================================================

  function completeClosing(
    exceptions = null
  ) {

    if (!shift) {
      return;
    }


    const progress =
      ShiftService
        .calculateShiftProgress(
          shift,
          totalTasks
        );


    if (
      progress.completed <
        totalTasks &&
      exceptions === null
    ) {

      showExceptionDialog(
        "CLOSING"
      );

      return;
    }


    const finalExceptions =
      Array.isArray(exceptions)
        ? exceptions
        : [];


    const live =
      counts();


    if (
      el("closingSummary") &&
      el("summaryText") &&
      el("confirmClosing")
    ) {

      el(
        "closingSummary"
      ).hidden =
        false;


      el(
        "summaryText"
      ).textContent =
        `${progress.completed} / ${totalTasks} tasks complete · ` +
        `${live.issues} open issues · ` +
        `${live.pending} pending tasks · ` +
        `${live.overdue} overdue tasks`;


      el(
        "confirmClosing"
      ).onclick =
        () => {

          finalizeClosing(
            finalExceptions
          );

        };


      return;
    }


    finalizeClosing(
      finalExceptions
    );
  }


  function finalizeClosing(
    exceptions = []
  ) {

    try {

      shift =
        ShiftService
          .completeShift(
            shift.id,
            {
              exceptions,

              tomorrowPriority:
                el(
                  "tomorrowPriority"
                )
                  ?.value
                  .trim() ||
                ""
            }
          );


      if (
        el("closingSummary")
      ) {

        el(
          "closingSummary"
        ).hidden =
          true;

      }


      render();


      notify(
        "Closing Shift completed."
      );

    } catch (error) {

      notify(
        error.message,
        "error"
      );

    }
  }


  // =========================================================
  // EXCEPTIONS
  // =========================================================

  function showExceptionDialog(
    mode
  ) {

    if (!shift) {
      return;
    }


    const modal =
      document.createElement(
        "div"
      );

    modal.className =
      "modal-backdrop";


    const heading =
      mode === "CLOSING"
        ? "Complete with Exceptions"
        : "Continue to Handover with Exceptions";


    const confirmLabel =
      mode === "CLOSING"
        ? "Continue to Closing Summary"
        : "Prepare Handover";


    modal.innerHTML = `

      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shiftExceptionTitle"
      >

        <div
          class="modal-header"
        >

          <div>

            <p class="eyebrow">
              INCOMPLETE CHECKLIST
            </p>

            <h2
              id="shiftExceptionTitle"
            >
              ${heading}
            </h2>

          </div>


          <button
            type="button"
            class="icon-button"
            data-close
            aria-label="Close"
          >
            ×
          </button>

        </div>


        <p class="muted-text">

          Some checklist items remain
          incomplete.

          Record the operational reason
          before continuing.

        </p>


        <textarea
          id="exceptionNotes"
          class="exception-textarea"
          rows="4"
          required
          placeholder="Explain why the remaining items are incomplete..."
        ></textarea>


        <div
          class="modal-actions"
        >

          <button
            type="button"
            class="secondary-button"
            data-close
          >
            Return to Checklist
          </button>


          <button
            type="button"
            class="primary-button"
            id="confirmExceptions"
          >
            ${confirmLabel}
          </button>

        </div>

      </div>
    `;


    document.body
      .appendChild(
        modal
      );


    const close = () => {
      modal.remove();
    };


    modal
      .querySelectorAll(
        "[data-close]"
      )
      .forEach(
        (button) => {

          button
            .addEventListener(
              "click",
              close
            );

        }
      );


    modal
      .querySelector(
        "#confirmExceptions"
      )
      .addEventListener(
        "click",
        () => {

          const textarea =
            modal
              .querySelector(
                "#exceptionNotes"
              );


          const notes =
            textarea
              .value
              .trim();


          if (!notes) {

            textarea.focus();

            return;
          }


          const exception = {

            id:
              `EXC-${Date.now()}`,

            type:
              "CHECKLIST_INCOMPLETE",

            reason:
              notes,

            createdBy:
              localStorage.getItem(
                "currentManager"
              ) ||
              shift.manager ||
              "Jordan Lee",

            createdAt:
              new Date()
                .toISOString()

          };


          close();


          // -------------------------------------------------
          // CLOSING
          // -------------------------------------------------

          if (
            mode ===
            "CLOSING"
          ) {

            completeClosing([
              ...(
                Array.isArray(
                  shift.exceptions
                )
                  ? shift.exceptions
                  : []
              ),

              exception
            ]);

            return;
          }


          // -------------------------------------------------
          // OPENING / MID-SHIFT
          // -------------------------------------------------

          try {

            shift =
              ShiftService
                .updateShift(
                  shift.id,
                  {
                    overallStatus:
                      "ATTENTION",

                    exceptions: [
                      ...(
                        Array.isArray(
                          shift.exceptions
                        )
                          ? shift.exceptions
                          : []
                      ),

                      exception
                    ]
                  }
                );


            shift =
              ShiftService
                .markReadyForHandover(
                  shift.id
                );


            goToHandover();

          } catch (error) {

            notify(
              error.message,
              "error"
            );

          }

        }
      );


    modal
      .querySelector(
        "#exceptionNotes"
      )
      .focus();
  }


  // =========================================================
  // PRIMARY BUTTON HANDLER
  // =========================================================

  function primaryAction() {
    const incoming =
      getIncomingHandover();


    // -------------------------------------------------------
    // NOT STARTED
    // -------------------------------------------------------

    if (!shift) {

      if (incoming) {

        window.location.href =
          `handover.html?id=${encodeURIComponent(
            incoming.id
          )}&review=true`;

        return;
      }


      startShift();

      return;
    }


    // -------------------------------------------------------
    // ALREADY COMPLETED
    // -------------------------------------------------------

    if (isCompleted(shift)) {
      return;
    }


    // -------------------------------------------------------
    // CLOSING
    // -------------------------------------------------------

    if (
      config.type ===
      "CLOSING"
    ) {

      completeClosing();

      return;
    }


    // -------------------------------------------------------
    // OPENING / MID-SHIFT
    // -------------------------------------------------------

    prepareHandover();
  }


  // =========================================================
  // EVENTS
  // =========================================================

  el(
    "completeShiftButton"
  )?.addEventListener(
    "click",
    primaryAction
  );


  el(
    "createTaskButton"
  )?.addEventListener(
    "click",
    () => {

      if (
        !shift ||
        !isChecklistEditable()
      ) {
        return;
      }


      openTaskForm({
        sourceType:
          "SHIFT",

        sourceId:
          shift.id,

        sourceLabel:
          config.title
      });

    }
  );


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  shift =
    ShiftService
      .getTodayShift(
        config.type
      );


  /*
    IMPORTANT:

    We intentionally DO NOT call:

    ShiftService.startShift()

    here.

    Visiting a page no longer
    starts a Shift automatically.
  */

  render();

})();