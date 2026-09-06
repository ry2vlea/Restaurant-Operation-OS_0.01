(function () {

  /* =========================================================
     DATE HELPERS
     ========================================================= */

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");

    if (!match) return null;

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }


  function formatDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }


  function today() {
    return formatDate(new Date());
  }


  function addDays(dateString, days) {
    const date = parseDate(dateString);

    if (!date) return null;

    date.setDate(date.getDate() + days);

    return formatDate(date);
  }


  function datesInRange(startDate, endDate) {
    const dates = [];

    const current = parseDate(startDate);
    const end = parseDate(endDate);

    if (!current || !end || current > end) {
      return dates;
    }

    while (current <= end) {
      dates.push(formatDate(current));

      current.setDate(
        current.getDate() + 1
      );
    }

    return dates;
  }


  /* =========================================================
     SETTINGS
     ========================================================= */

  function getTargetFoodCost() {
    const settingsTarget =
      window.SettingsService
        ?.getSettings?.()
        ?.targets
        ?.foodCostPercent;

    const storedTarget =
      localStorage.getItem(
        "targetFoodCostPercent"
      );

    return Number(
      settingsTarget ||
      storedTarget ||
      30
    );
  }


  /* =========================================================
     SALES
     ========================================================= */

  function salesFor(date) {
    return Number(
      SalesService
        .calculateMetrics(date)
        .netSales || 0
    );
  }


  function salesForRange(startDate, endDate) {
    return datesInRange(
      startDate,
      endDate
    ).reduce(
      (total, date) =>
        total + salesFor(date),
      0
    );
  }


  /* =========================================================
     THEORETICAL COST
     ========================================================= */

  function theoreticalUsageCost(date) {
    return TheoreticalUsageService
      .calculateForDate(date)
      .reduce(
        (total, entry) =>
          total +
          Number(entry.theoreticalCost || 0),
        0
      );
  }


  function theoreticalForRange(
    startDate,
    endDate
  ) {
    return datesInRange(
      startDate,
      endDate
    ).reduce(
      (total, date) =>
        total +
        theoreticalUsageCost(date),
      0
    );
  }


  /* =========================================================
     INVENTORY VALUE
     ========================================================= */

  function inventoryCountValue(
    count,
    context
  ) {
    if (!count) return 0;

    return context.countLines
      .filter(
        (line) =>
          line.countId === count.id
      )
      .reduce(
        (sum, line) => {

          const item =
            context.itemById.get(
              line.itemId
            );

          if (!item) {
            return sum;
          }

          const unitCost =
            Number(
              InventoryService
                .getBaseUnitCost(item) || 0
            );

          const quantity =
            Number(
              line.physicalQuantity || 0
            );

          return sum +
            quantity * unitCost;
        },
        0
      );
  }


  /* =========================================================
     MOVEMENT COST
     ========================================================= */

  function movementUnitCost(
    movement,
    context
  ) {
    const recordedCost =
      Number(
        movement.unitCostAtMovement
      );

    if (
      Number.isFinite(recordedCost) &&
      recordedCost > 0
    ) {
      return recordedCost;
    }

    const item =
      context.itemById.get(
        movement.itemId
      );

    if (!item) {
      return 0;
    }

    return Number(
      InventoryService
        .getBaseUnitCost(item) || 0
    );
  }


  function movementExtendedCost(
    movement,
    context
  ) {
    const quantity =
      Math.abs(
        Number(
          movement.baseQuantity || 0
        )
      );

    return quantity *
      movementUnitCost(
        movement,
        context
      );
  }


  /* =========================================================
     PURCHASES
     ========================================================= */

  function purchaseActivity(
    startDate,
    endDate,
    context
  ) {
    const result = {
      receives: 0,
      returns: 0,
      netPurchases: 0
    };

    context.movements
      .filter((movement) => {

        const date =
          movement.createdAt?.slice(
            0,
            10
          );

        return (
          date &&
          date >= startDate &&
          date <= endDate &&
          ["RECEIVE", "RETURN"]
            .includes(
              movement.movementType
            )
        );
      })
      .forEach((movement) => {

        const value =
          movementExtendedCost(
            movement,
            context
          );

        if (
          movement.movementType ===
          "RECEIVE"
        ) {
          result.receives += value;
        }

        if (
          movement.movementType ===
          "RETURN"
        ) {
          result.returns += value;
        }
      });

    result.netPurchases =
      result.receives -
      result.returns;

    return result;
  }


  /* =========================================================
     WASTE
     ========================================================= */

  function wasteForRange(
    startDate,
    endDate,
    context
  ) {
    return context.waste
      .filter((record) => {

        const date =
          record.createdAt?.slice(
            0,
            10
          );

        return (
          date &&
          date >= startDate &&
          date <= endDate
        );
      })
      .reduce(
        (sum, record) =>
          sum +
          Number(
            record.wasteCost || 0
          ),
        0
      );
  }


  /* =========================================================
     COMPLETED COUNTS
     ========================================================= */

  function getCompletedCounts(context) {
    return context.counts
      .filter(
        (count) =>
          count.status === "COMPLETED"
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date)
      );
  }


  /* =========================================================
     ACTUAL COGS PERIOD
     ========================================================= */

  function actualCogSForRange(
    requestedStartDate,
    requestedEndDate,
    context
  ) {
    const completed =
      getCompletedCounts(context);

    if (completed.length < 2) {
      return null;
    }


    /*
      Counts are treated as end-of-day snapshots.

      Example:

      Aug 31 Closing Count
          ↓
      Sep 1 - Sep 7 activity
          ↓
      Sep 7 Closing Count

      COGS =
      Opening Inventory
      + Net Purchases
      - Closing Inventory
    */


    const openingCandidates =
      completed.filter(
        (count) =>
          count.date <
          requestedStartDate
      );

    let opening =
      openingCandidates[
        openingCandidates.length - 1
      ];


    /*
      Fallback in case the system does not
      yet contain a count before the
      selected start date.
    */

    if (!opening) {
      const candidates =
        completed.filter(
          (count) =>
            count.date <=
            requestedStartDate
        );

      opening =
        candidates[
          candidates.length - 1
        ];
    }


    if (!opening) {
      return null;
    }


    const closingCandidates =
      completed.filter(
        (count) =>
          count.date > opening.date &&
          count.date <= requestedEndDate
      );


    const closing =
      closingCandidates[
        closingCandidates.length - 1
      ];


    if (!closing) {
      return null;
    }


    /*
      The period begins the day after
      the opening count.
    */

    const coverageStartDate =
      addDays(
        opening.date,
        1
      );

    const coverageEndDate =
      closing.date;


    if (
      !coverageStartDate ||
      coverageStartDate >
        coverageEndDate
    ) {
      return null;
    }


    const openingInventory =
      inventoryCountValue(
        opening,
        context
      );

    const closingInventory =
      inventoryCountValue(
        closing,
        context
      );


    const purchaseData =
      purchaseActivity(
        coverageStartDate,
        coverageEndDate,
        context
      );


    const actualCost =
      openingInventory +
      purchaseData.netPurchases -
      closingInventory;


    /*
      IMPORTANT:

      Sales and theoretical usage used
      for Actual Food Cost must cover
      exactly the same inventory period.
    */

    const periodNetSales =
      salesForRange(
        coverageStartDate,
        coverageEndDate
      );


    const periodTheoreticalCost =
      theoreticalForRange(
        coverageStartDate,
        coverageEndDate
      );


    const actualFoodCostPercent =
      periodNetSales > 0
        ? actualCost /
          periodNetSales *
          100
        : null;


    const theoreticalFoodCostPercent =
      periodNetSales > 0
        ? periodTheoreticalCost /
          periodNetSales *
          100
        : null;


    return {
      openingCountId:
        opening.id,

      closingCountId:
        closing.id,

      openingCountDate:
        opening.date,

      closingCountDate:
        closing.date,

      coverageStartDate,
      coverageEndDate,

      openingInventory,
      closingInventory,

      purchases:
        purchaseData.receives,

      returns:
        purchaseData.returns,

      netPurchases:
        purchaseData.netPurchases,

      netSales:
        periodNetSales,

      theoreticalCost:
        periodTheoreticalCost,

      theoreticalFoodCostPercent,

      actualCost,

      actualFoodCostPercent
    };
  }


  /* =========================================================
     RANGE CALCULATION
     ========================================================= */

  function calculateRange(
    startDate = today(),
    endDate = startDate
  ) {

    if (
      !parseDate(startDate) ||
      !parseDate(endDate) ||
      startDate > endDate
    ) {
      startDate = today();
      endDate = startDate;
    }


    /*
      Build analytics context once.

      The old service called
      AnalyticsContext.build()
      several times per calculation.
    */

    const context =
      AnalyticsContext.build();


    const targetFoodCostPercent =
      getTargetFoodCost();


    /* Selected date range */

    const netSales =
      salesForRange(
        startDate,
        endDate
      );


    const theoreticalCost =
      theoreticalForRange(
        startDate,
        endDate
      );


    const theoreticalFoodCostPercent =
      netSales > 0
        ? theoreticalCost /
          netSales *
          100
        : null;


    const purchaseData =
      purchaseActivity(
        startDate,
        endDate,
        context
      );


    const wasteCost =
      wasteForRange(
        startDate,
        endDate,
        context
      );


    /* Actual inventory period */

    const actualPeriod =
      actualCogSForRange(
        startDate,
        endDate,
        context
      );


    const actualCost =
      actualPeriod?.actualCost ??
      null;


    const actualFoodCostPercent =
      actualPeriod
        ?.actualFoodCostPercent ??
      null;


    /*
      Actual vs Theoretical must use
      the SAME count coverage period.
    */

    const comparisonTheoreticalPercent =
      actualPeriod
        ?.theoreticalFoodCostPercent ??
      null;


    const foodCostVariancePoints =
      actualFoodCostPercent != null &&
      comparisonTheoreticalPercent != null
        ? actualFoodCostPercent -
          comparisonTheoreticalPercent
        : null;


    /*
      Separate variance against
      management target.
    */

    const targetVariancePoints =
      actualFoodCostPercent != null
        ? actualFoodCostPercent -
          targetFoodCostPercent
        : null;


    /* Inventory variance */

    const rangeVariance =
      window.VarianceService
        ?.calculateForRange?.(
          startDate,
          endDate
        );


    const inventoryVarianceCost =
      rangeVariance
        ?.totals
        ?.netVariance ??
      null;


    return {

      /* Requested range */

      startDate,
      endDate,


      /* Sales */

      netSales,


      /* Theoretical */

      theoreticalCost,

      theoreticalFoodCostPercent,


      /* Actual */

      actualCost,

      actualFoodCostPercent,


      /* Comparison */

      comparisonTheoreticalFoodCostPercent:
        comparisonTheoreticalPercent,

      foodCostVariancePoints,

      targetVariancePoints,

      targetFoodCostPercent,


      /* Inventory period */

      actualCoverageStartDate:
        actualPeriod
          ?.coverageStartDate ??
        null,

      actualCoverageEndDate:
        actualPeriod
          ?.coverageEndDate ??
        null,

      openingInventory:
        actualPeriod
          ?.openingInventory ??
        null,

      closingInventory:
        actualPeriod
          ?.closingInventory ??
        null,

      actualPeriodNetSales:
        actualPeriod
          ?.netSales ??
        null,

      actualPeriodTheoreticalCost:
        actualPeriod
          ?.theoreticalCost ??
        null,


      /* Purchases */

      purchases:
        purchaseData.receives,

      purchaseReturns:
        purchaseData.returns,

      netPurchases:
        purchaseData.netPurchases,


      /* Waste */

      wasteCost,


      /* Inventory variance */

      inventoryVarianceCost
    };
  }


  /* =========================================================
     SINGLE DAY
     ========================================================= */

  function calculate(
    date = today()
  ) {
    return {
      date,
      ...calculateRange(
        date,
        date
      )
    };
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.FoodCostService = {
    calculate,
    calculateRange
  };

})();