(function () {
  const storageKey = "shifts";

  const types = [
    "OPENING",
    "MID_SHIFT",
    "CLOSING"
  ];

  const statuses = {
    NOT_STARTED: "NOT_STARTED",
    IN_PROGRESS: "IN_PROGRESS",
    READY_FOR_HANDOVER: "READY_FOR_HANDOVER",
    HANDOVER_PENDING: "HANDOVER_PENDING",
    COMPLETED: "COMPLETED",
    COMPLETED_WITH_EXCEPTIONS: "COMPLETED_WITH_EXCEPTIONS"
  };

  const activeStatuses = [
    statuses.IN_PROGRESS,
    statuses.READY_FOR_HANDOVER,
    statuses.HANDOVER_PENDING
  ];


  // =========================================================
  // DATE HELPERS
  // =========================================================

  function today() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


  // =========================================================
  // STORAGE
  // =========================================================

  function getShifts() {
    let shifts = [];

    try {
      shifts =
        JSON.parse(
          localStorage.getItem(storageKey)
        ) || [];
    } catch (error) {
      console.warn(
        "ShiftService: unable to parse shifts.",
        error
      );

      shifts = [];
    }

    if (!Array.isArray(shifts)) {
      shifts = [];
    }


    // ---------------------------------------------------------
    // Legacy Opening Shift Migration
    // ---------------------------------------------------------

    let legacy = null;

    try {
      legacy = JSON.parse(
        localStorage.getItem("openingShift") ||
        "null"
      );
    } catch (error) {
      console.warn(
        "ShiftService: unable to parse legacy opening shift.",
        error
      );

      legacy = null;
    }

    if (legacy) {
      const legacyDate =
        legacy.date || today();

      const alreadyMigrated =
        shifts.some(
          (shift) =>
            shift.type === "OPENING" &&
            shift.date === legacyDate
        );

      if (!alreadyMigrated) {
        const now =
          new Date().toISOString();

        shifts.push({
          id:
            legacy.id ||
            `SHIFT-${legacyDate.replaceAll(
              "-",
              ""
            )}-OPENING-001`,

          date: legacyDate,

          type: "OPENING",

          manager:
            legacy.manager ||
            "Jordan Lee",

          status:
            legacy.status ||
            statuses.IN_PROGRESS,

          overallStatus: "NORMAL",

          startedAt:
            legacy.startedAt || now,

          readyForHandoverAt: null,

          handoverSubmittedAt: null,

          completedAt:
            legacy.completedAt || null,

          checklist:
            legacy.checklist || {},

          notes: "",

          exceptions: [],

          tomorrowPriority: "",

          createdAt:
            legacy.startedAt || now,

          updatedAt: now
        });

        localStorage.setItem(
          storageKey,
          JSON.stringify(shifts)
        );
      }
    }


    return shifts.filter(
      (shift) =>
        types.includes(shift.type)
    );
  }


  function saveShifts(shifts) {
    if (!Array.isArray(shifts)) {
      throw new Error(
        "ShiftService.saveShifts expects an array."
      );
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify(shifts)
    );

    window.dispatchEvent(
      new CustomEvent(
        "shifts:changed"
      )
    );

    return shifts;
  }


  // =========================================================
  // READ
  // =========================================================

  function getShiftById(id) {
    if (!id) {
      return null;
    }

    return (
      getShifts().find(
        (shift) =>
          shift.id === id
      ) || null
    );
  }


  function getTodayShift(type) {
    if (!types.includes(type)) {
      return null;
    }

    return (
      getShifts().find(
        (shift) =>
          shift.type === type &&
          shift.date === today()
      ) || null
    );
  }


  function getShiftsByDate(
    date = today()
  ) {
    return getShifts().filter(
      (shift) =>
        shift.date === date
    );
  }


  function getActiveShift(
    date = today()
  ) {
    return (
      getShifts().find(
        (shift) =>
          shift.date === date &&
          activeStatuses.includes(
            shift.status
          )
      ) || null
    );
  }


  // =========================================================
  // CREATE / START
  // =========================================================

  function createShift(
    type,
    manager
  ) {
    if (!types.includes(type)) {
      throw new Error(
        `Invalid shift type: ${type}`
      );
    }


    // Only one shift of each type
    // is allowed per operating day.

    const existingShift =
      getTodayShift(type);

    if (existingShift) {
      return existingShift;
    }


    // Prevent multiple active shifts.

    const activeShift =
      getActiveShift();

    if (activeShift) {
      throw new Error(
        `${activeShift.type} is already active. ` +
        `Complete or hand over the current shift before starting ${type}.`
      );
    }


    const now =
      new Date().toISOString();

    const businessDate =
      today();

    const prefix =
      `SHIFT-${businessDate.replaceAll(
        "-",
        ""
      )}-${type}`;

    const count =
      getShifts().filter(
        (shift) =>
          shift.id?.startsWith(
            prefix
          )
      ).length + 1;


    const shift = {
      id:
        `${prefix}-${String(
          count
        ).padStart(3, "0")}`,

      date: businessDate,

      type,

      manager:
        manager ||
        localStorage.getItem(
          "currentManager"
        ) ||
        "Jordan Lee",

      status:
        statuses.IN_PROGRESS,

      overallStatus:
        "NORMAL",

      startedAt: now,

      readyForHandoverAt:
        null,

      handoverSubmittedAt:
        null,

      completedAt:
        null,

      checklist: {},

      notes: "",

      exceptions: [],

      tomorrowPriority: "",

      createdAt: now,

      updatedAt: now
    };


    saveShifts([
      ...getShifts(),
      shift
    ]);

    return shift;
  }


  function startShift(
    type,
    manager
  ) {
    const existingShift =
      getTodayShift(type);

    if (existingShift) {
      return existingShift;
    }

    return createShift(
      type,
      manager
    );
  }


  // =========================================================
  // UPDATE
  // =========================================================

  function updateShift(
    id,
    changes
  ) {
    const existing =
      getShiftById(id);

    if (!existing) {
      throw new Error(
        `Shift not found: ${id}`
      );
    }

    const now =
      new Date().toISOString();

    const shifts =
      getShifts().map(
        (shift) => {
          if (
            shift.id !== id
          ) {
            return shift;
          }

          return {
            ...shift,
            ...changes,
            updatedAt: now
          };
        }
      );

    saveShifts(shifts);

    return getShiftById(id);
  }


  function updateShiftChecklist(
    id,
    checklist
  ) {
    if (
      !checklist ||
      typeof checklist !== "object" ||
      Array.isArray(checklist)
    ) {
      throw new Error(
        "Checklist must be an object."
      );
    }

    return updateShift(
      id,
      {
        checklist
      }
    );
  }


  // =========================================================
  // CHECKLIST PROGRESS
  // =========================================================

  function calculateShiftProgress(
    shift,
    total
  ) {
    const checklist =
      Object.values(
        shift?.checklist || {}
      );


    const completed =
      checklist.filter(
        (item) => {

          // -----------------------------------------------
          // Legacy boolean checklist
          // -----------------------------------------------

          if (item === true) {
            return true;
          }


          // -----------------------------------------------
          // Structured checklist format
          // -----------------------------------------------

          if (
            item &&
            typeof item === "object"
          ) {
            return [
              "COMPLETED",
              "EXCEPTION",
              "N/A"
            ].includes(
              item.status
            );
          }


          return false;
        }
      ).length;


    const safeTotal =
      Number.isFinite(total) &&
      total > 0
        ? total
        : 0;


    return {
      completed,

      total: safeTotal,

      percentage:
        safeTotal
          ? Math.round(
              (
                completed /
                safeTotal
              ) * 100
            )
          : 0
    };
  }


  // =========================================================
  // HANDOVER STATES
  // =========================================================

  function markReadyForHandover(
    id
  ) {
    const shift =
      getShiftById(id);

    if (!shift) {
      throw new Error(
        `Shift not found: ${id}`
      );
    }


    if (
      shift.status !==
      statuses.IN_PROGRESS
    ) {
      throw new Error(
        "Only an active shift can be marked ready for handover."
      );
    }


    return updateShift(
      id,
      {
        status:
          statuses.READY_FOR_HANDOVER,

        readyForHandoverAt:
          new Date().toISOString()
      }
    );
  }


  function markHandoverPending(
    id
  ) {
    const shift =
      getShiftById(id);

    if (!shift) {
      throw new Error(
        `Shift not found: ${id}`
      );
    }


    if (
      shift.status !==
      statuses.READY_FOR_HANDOVER
    ) {
      throw new Error(
        "Shift must be ready for handover before submitting a handover."
      );
    }


    return updateShift(
      id,
      {
        status:
          statuses.HANDOVER_PENDING,

        handoverSubmittedAt:
          new Date().toISOString()
      }
    );
  }


  // =========================================================
  // COMPLETE SHIFT
  // =========================================================

  function completeShift(
    id,
    options = {}
  ) {
    const shift =
      getShiftById(id);

    if (!shift) {
      throw new Error(
        `Shift not found: ${id}`
      );
    }


    // -------------------------------------------------------
    // Prevent completing an already completed
    // or invalid shift.
    // -------------------------------------------------------

    const allowedCompletionStatuses = [
      statuses.IN_PROGRESS,
      statuses.READY_FOR_HANDOVER,
      statuses.HANDOVER_PENDING
    ];


    if (
      !allowedCompletionStatuses.includes(
        shift.status
      )
    ) {
      throw new Error(
        `Shift cannot be completed from status: ${shift.status}`
      );
    }


    // -------------------------------------------------------
    // Temporary backwards compatibility
    //
    // Old code may still call:
    //
    // completeShift(id, "some exception")
    //
    // -------------------------------------------------------

    if (
      typeof options === "string"
    ) {
      options = {
        exceptions:
          options
            ? [
                {
                  id:
                    `EXC-${Date.now()}`,

                  type:
                    "GENERAL",

                  reason:
                    options,

                  createdAt:
                    new Date()
                      .toISOString()
                }
              ]
            : []
      };
    }


    const exceptions =
      Array.isArray(
        options.exceptions
      )
        ? options.exceptions
        : [];


    const hasExceptions =
      exceptions.length > 0;


    const completedAt =
      new Date().toISOString();


    return updateShift(
      id,
      {
        status:
          hasExceptions
            ? statuses.COMPLETED_WITH_EXCEPTIONS
            : statuses.COMPLETED,

        overallStatus:
          hasExceptions
            ? "ATTENTION"
            : "NORMAL",

        exceptions,

        notes:
          options.notes || "",

        tomorrowPriority:
          options.tomorrowPriority ||
          "",

        completedAt
      }
    );
  }


  // =========================================================
  // PUBLIC API
  // =========================================================

  window.ShiftService = {
    types,
    statuses,

    today,

    getShifts,
    saveShifts,

    getShiftById,
    getTodayShift,
    getShiftsByDate,
    getActiveShift,

    createShift,
    startShift,

    updateShift,
    updateShiftChecklist,

    calculateShiftProgress,

    markReadyForHandover,
    markHandoverPending,

    completeShift
  };

})();