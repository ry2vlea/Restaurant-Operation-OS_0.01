(function () {
  const storageKey = "handovers";

  const statuses = {
    DRAFT: "DRAFT",
    READY: "READY",
    ACCEPTED: "ACCEPTED",
    CANCELLED: "CANCELLED"
  };

  const shiftSequence = {
    OPENING: "MID_SHIFT",
    MID_SHIFT: "CLOSING",
    CLOSING: null
  };


  // =========================================================
  // DATE
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

  function getHandovers() {
    let handovers = [];

    try {
      handovers =
        JSON.parse(
          localStorage.getItem(storageKey)
        ) || [];
    } catch (error) {
      console.warn(
        "HandoverService: unable to parse handovers.",
        error
      );

      handovers = [];
    }

    if (!Array.isArray(handovers)) {
      return [];
    }

    return handovers;
  }


  function saveHandovers(handovers) {
    if (!Array.isArray(handovers)) {
      throw new Error(
        "HandoverService.saveHandovers expects an array."
      );
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify(handovers)
    );

    window.dispatchEvent(
      new CustomEvent(
        "handovers:changed"
      )
    );

    return handovers;
  }


  // =========================================================
  // IDS
  // =========================================================

  function nextHandoverId(
    businessDate = today()
  ) {
    const dateCode =
      businessDate.replaceAll("-", "");

    const prefix =
      `HO-${dateCode}-`;

    const highest =
      getHandovers().reduce(
        (highestValue, handover) => {

          const match =
            new RegExp(
              `^${prefix}(\\d+)$`
            ).exec(
              handover.id || ""
            );

          if (!match) {
            return highestValue;
          }

          return Math.max(
            highestValue,
            Number(match[1])
          );
        },
        0
      );

    return (
      `${prefix}` +
      String(
        highest + 1
      ).padStart(3, "0")
    );
  }


  // =========================================================
  // READ
  // =========================================================

  function getHandoverById(id) {
    if (!id) {
      return null;
    }

    return (
      getHandovers().find(
        (handover) =>
          handover.id === id
      ) || null
    );
  }


  function getHandoverForShift(
    fromShiftId,
    toShiftType
  ) {
    return (
      getHandovers().find(
        (handover) =>
          handover.fromShiftId ===
            fromShiftId &&
          handover.toShiftType ===
            toShiftType &&
          handover.status !==
            statuses.CANCELLED
      ) || null
    );
  }


  function getHandoversByDate(
    date = today()
  ) {
    return getHandovers().filter(
      (handover) =>
        handover.date === date
    );
  }


  function getPendingHandovers(
    date = null
  ) {
    return getHandovers().filter(
      (handover) => {

        if (
          handover.status !==
          statuses.READY
        ) {
          return false;
        }

        if (
          date &&
          handover.date !== date
        ) {
          return false;
        }

        return true;
      }
    );
  }


  function getIncomingHandover(
    toShiftType,
    date = today()
  ) {
    return (
      getHandovers().find(
        (handover) =>
          handover.toShiftType ===
            toShiftType &&
          handover.date === date &&
          handover.status ===
            statuses.READY
      ) || null
    );
  }


  function getAcceptedHandover(
    toShiftType,
    date = today()
  ) {
    return (
      getHandovers().find(
        (handover) =>
          handover.toShiftType ===
            toShiftType &&
          handover.date === date &&
          handover.status ===
            statuses.ACCEPTED
      ) || null
    );
  }


  // =========================================================
  // VALIDATION
  // =========================================================

  function validateShiftTransition(
    fromShiftType,
    toShiftType
  ) {
    const expectedTarget =
      shiftSequence[
        fromShiftType
      ];

    if (!expectedTarget) {
      throw new Error(
        `${fromShiftType} does not hand over to another shift.`
      );
    }

    if (
      expectedTarget !==
      toShiftType
    ) {
      throw new Error(
        `Invalid handover transition: ${fromShiftType} → ${toShiftType}. ` +
        `Expected ${fromShiftType} → ${expectedTarget}.`
      );
    }

    return true;
  }


  // =========================================================
  // CREATE
  // =========================================================

  function createHandover(
    values = {}
  ) {
    if (!values.fromShiftId) {
      throw new Error(
        "fromShiftId is required."
      );
    }


    let sourceShift = null;

    if (
      window.ShiftService
    ) {
      sourceShift =
        ShiftService.getShiftById(
          values.fromShiftId
        );
    }


    if (
      window.ShiftService &&
      !sourceShift
    ) {
      throw new Error(
        `Source shift not found: ${values.fromShiftId}`
      );
    }


    const fromShiftType =
      values.fromShiftType ||
      sourceShift?.type;

    const toShiftType =
      values.toShiftType ||
      shiftSequence[
        fromShiftType
      ];


    if (
      !fromShiftType ||
      !toShiftType
    ) {
      throw new Error(
        "A valid source and target shift are required."
      );
    }


    validateShiftTransition(
      fromShiftType,
      toShiftType
    );


    const existing =
      getHandoverForShift(
        values.fromShiftId,
        toShiftType
      );

    if (existing) {
      return existing;
    }


    const now =
      new Date().toISOString();

    const businessDate =
      sourceShift?.date ||
      values.date ||
      today();


    const handover = {
      id:
        nextHandoverId(
          businessDate
        ),

      date:
        businessDate,

      fromShiftId:
        values.fromShiftId,

      fromShiftType,

      toShiftType,

      toShiftId:
        null,

      fromManager:
        values.fromManager ||
        sourceShift?.manager ||
        localStorage.getItem(
          "currentManager"
        ) ||
        "Jordan Lee",

      toManager:
        null,

      status:
        statuses.DRAFT,

      staffingNotes: "",

      productNotes: "",

      equipmentNotes: "",

      guestNotes: "",

      operationalNotes: "",

      nextPriority: "",

      selectedIssueIds: [],

      selectedTaskIds: [],

      createdAt:
        now,

      submittedAt:
        null,

      acceptedAt:
        null,

      cancelledAt:
        null,

      updatedAt:
        now
    };


    saveHandovers([
      ...getHandovers(),
      handover
    ]);

    return handover;
  }


  // =========================================================
  // SHIFT SYNCHRONIZATION
  // =========================================================

  function prepareOutgoingShift(
    handover
  ) {
    if (
      !window.ShiftService
    ) {
      return null;
    }


    let shift =
      ShiftService.getShiftById(
        handover.fromShiftId
      );


    if (!shift) {
      throw new Error(
        `Source shift not found: ${handover.fromShiftId}`
      );
    }


    /*
      Current project compatibility:

      The old Shift Page may already have
      COMPLETED the shift before creating
      the handover.

      In that case we do not modify it.
    */

    if (
      shift.status ===
        ShiftService.statuses.COMPLETED ||
      shift.status ===
        ShiftService.statuses
          .COMPLETED_WITH_EXCEPTIONS
    ) {
      return shift;
    }


    if (
      shift.status ===
      ShiftService.statuses
        .IN_PROGRESS
    ) {
      shift =
        ShiftService
          .markReadyForHandover(
            shift.id
          );
    }


    if (
      shift.status ===
      ShiftService.statuses
        .READY_FOR_HANDOVER
    ) {
      shift =
        ShiftService
          .markHandoverPending(
            shift.id
          );
    }


    if (
      shift.status !==
        ShiftService.statuses
          .HANDOVER_PENDING
    ) {
      throw new Error(
        `Source shift cannot enter handover from status: ${shift.status}`
      );
    }


    return shift;
  }


  // =========================================================
  // UPDATE
  // =========================================================

  function updateHandover(
    id,
    changes = {}
  ) {
    const existing =
      getHandoverById(id);

    if (!existing) {
      throw new Error(
        `Handover not found: ${id}`
      );
    }


    if (
      changes.status &&
      !Object.values(
        statuses
      ).includes(
        changes.status
      )
    ) {
      throw new Error(
        `Invalid handover status: ${changes.status}`
      );
    }


    /*
      Existing handover-page.js currently calls:

      updateHandover(id, {
        ...,
        status: "READY"
      })

      So READY must trigger the Shift
      state transition here.
    */

    let submittedAt =
      existing.submittedAt;

    if (
      changes.status ===
        statuses.READY &&
      existing.status !==
        statuses.READY &&
      existing.status !==
        statuses.ACCEPTED
    ) {
      if (
        !String(
          changes.nextPriority ??
          existing.nextPriority ??
          ""
        ).trim()
      ) {
        throw new Error(
          "Next operational priority is required before submitting a handover."
        );
      }

      prepareOutgoingShift(
        existing
      );

      submittedAt =
        new Date()
          .toISOString();
    }


    const updatedAt =
      new Date().toISOString();


    const handovers =
      getHandovers().map(
        (handover) => {

          if (
            handover.id !== id
          ) {
            return handover;
          }

          return {
            ...handover,
            ...changes,

            submittedAt,

            updatedAt
          };
        }
      );


    saveHandovers(
      handovers
    );

    return getHandoverById(
      id
    );
  }


  // =========================================================
  // SUBMIT
  // =========================================================

  function submitHandover(
    id,
    changes = {}
  ) {
    return updateHandover(
      id,
      {
        ...changes,
        status:
          statuses.READY
      }
    );
  }


  // =========================================================
  // ACCEPT
  // =========================================================

  function acceptHandover(
    id,
    toManager
  ) {
    let handover =
      getHandoverById(id);

    if (!handover) {
      throw new Error(
        `Handover not found: ${id}`
      );
    }


    /*
      Make ACCEPT idempotent.
      Clicking twice should not start
      another shift.
    */

    if (
      handover.status ===
      statuses.ACCEPTED
    ) {
      return handover;
    }


    if (
      handover.status !==
      statuses.READY
    ) {
      throw new Error(
        "Only a READY handover can be accepted."
      );
    }


    const manager =
      String(
        toManager ||
        localStorage.getItem(
          "currentManager"
        ) ||
        ""
      ).trim();


    if (!manager) {
      throw new Error(
        "Receiving manager is required."
      );
    }


    let targetShift =
      null;


    // -------------------------------------------------------
    // Complete outgoing Shift
    // -------------------------------------------------------

    if (
      window.ShiftService
    ) {
      let sourceShift =
        ShiftService.getShiftById(
          handover.fromShiftId
        );

      if (!sourceShift) {
        throw new Error(
          `Source shift not found: ${handover.fromShiftId}`
        );
      }


      /*
        This also protects against someone
        somehow accepting without READY
        having synchronized the Shift.
      */

      if (
        sourceShift.status ===
        ShiftService.statuses
          .IN_PROGRESS
      ) {
        sourceShift =
          ShiftService
            .markReadyForHandover(
              sourceShift.id
            );
      }


      if (
        sourceShift.status ===
        ShiftService.statuses
          .READY_FOR_HANDOVER
      ) {
        sourceShift =
          ShiftService
            .markHandoverPending(
              sourceShift.id
            );
      }


      if (
        sourceShift.status ===
        ShiftService.statuses
          .HANDOVER_PENDING
      ) {
        sourceShift =
          ShiftService
            .completeShift(
              sourceShift.id,
              {
                exceptions:
                  Array.isArray(
                    sourceShift
                      .exceptions
                  )
                    ? sourceShift
                        .exceptions
                    : [],

                notes:
                  sourceShift.notes ||
                  "",

                tomorrowPriority:
                  sourceShift
                    .tomorrowPriority ||
                  ""
              }
            );
      }


      const sourceCompleted =
        sourceShift.status ===
          ShiftService.statuses
            .COMPLETED ||
        sourceShift.status ===
          ShiftService.statuses
            .COMPLETED_WITH_EXCEPTIONS;


      if (!sourceCompleted) {
        throw new Error(
          `Unable to complete source shift. Current status: ${sourceShift.status}`
        );
      }


      // -----------------------------------------------------
      // Find or start incoming Shift
      // -----------------------------------------------------

      const shiftsForDate =
        ShiftService
          .getShiftsByDate(
            handover.date
          );


      targetShift =
        shiftsForDate.find(
          (shift) =>
            shift.type ===
            handover.toShiftType
        ) || null;


      /*
        Only automatically create the
        next Shift when accepting the
        handover on the same business day.

        This prevents accidentally creating
        today's shift while reviewing an old
        handover.
      */

      if (
        !targetShift &&
        handover.date ===
          ShiftService.today()
      ) {
        targetShift =
          ShiftService.startShift(
            handover.toShiftType,
            manager
          );
      }
    }


    // -------------------------------------------------------
    // Accept Handover
    // -------------------------------------------------------

    const now =
      new Date().toISOString();


    handover =
      updateHandover(
        id,
        {
          status:
            statuses.ACCEPTED,

          toManager:
            manager,

          toShiftId:
            targetShift?.id ||
            handover.toShiftId ||
            null,

          acceptedAt:
            now
        }
      );


    window.dispatchEvent(
      new CustomEvent(
        "handover:accepted",
        {
          detail: {
            handoverId:
              handover.id,

            fromShiftId:
              handover
                .fromShiftId,

            toShiftId:
              handover
                .toShiftId,

            toShiftType:
              handover
                .toShiftType,

            toManager:
              handover
                .toManager
          }
        }
      )
    );


    return handover;
  }


  // =========================================================
  // CANCEL
  // =========================================================

  function cancelHandover(
    id
  ) {
    const handover =
      getHandoverById(id);

    if (!handover) {
      throw new Error(
        `Handover not found: ${id}`
      );
    }


    if (
      handover.status ===
      statuses.ACCEPTED
    ) {
      throw new Error(
        "An accepted handover cannot be cancelled."
      );
    }


    return updateHandover(
      id,
      {
        status:
          statuses.CANCELLED,

        cancelledAt:
          new Date()
            .toISOString()
      }
    );
  }


  // =========================================================
  // PUBLIC API
  // =========================================================

  window.HandoverService = {
    statuses,
    shiftSequence,

    getHandovers,
    saveHandovers,

    getHandoverById,
    getHandoverForShift,

    getHandoversByDate,
    getPendingHandovers,

    getIncomingHandover,
    getAcceptedHandover,

    createHandover,
    updateHandover,
    submitHandover,

    acceptHandover,
    cancelHandover
  };

})();