const foodCostMetrics = document.getElementById("foodCostMetrics");
const foodCostSections = document.getElementById("foodCostSections");

const moneyValue = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "Insufficient Data"
    : `$${Number(value).toFixed(2)}`;

const percentValue = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "Insufficient Data"
    : `${Number(value).toFixed(1)}%`;

const pointsValue = (value) => {
  if (value == null || Number.isNaN(Number(value))) {
    return "Insufficient Data";
  }

  const number = Number(value);

  return `${number >= 0 ? "+" : ""}${number.toFixed(1)} pts`;
};


/* =========================================================
   STATUS HELPERS
   ========================================================= */

function getFoodCostStatus(actual, target) {
  if (actual == null || target == null) {
    return {
      className: "",
      label: "No Data"
    };
  }

  const difference = Number(actual) - Number(target);

  if (difference <= 0) {
    return {
      className: "is-positive",
      label: "On Target"
    };
  }

  if (difference <= 2) {
    return {
      className: "is-warning",
      label: "Watch"
    };
  }

  return {
    className: "is-danger",
    label: "Above Target"
  };
}


function getVarianceStatus(value) {
  if (value == null) {
    return "";
  }

  const variance = Number(value);

  if (variance <= 0) {
    return "is-positive";
  }

  if (variance <= 2) {
    return "is-warning";
  }

  return "is-danger";
}


function getMenuCostStatus(foodCostPercent, target) {
  if (foodCostPercent == null || target == null) {
    return {
      className: "",
      label: "No Data"
    };
  }

  const difference = Number(foodCostPercent) - Number(target);

  if (difference <= 0) {
    return {
      className: "badge-good",
      label: "Healthy"
    };
  }

  if (difference <= 3) {
    return {
      className: "badge-warning",
      label: "Watch"
    };
  }

  return {
    className: "badge-danger",
    label: "High"
  };
}


/* =========================================================
   DATE CHANGE
   ========================================================= */

document.addEventListener("ros:datechange", (event) => {
  refreshFoodCost(
    event.detail.startDate,
    event.detail.endDate
  );
});


/* =========================================================
   MAIN REFRESH
   ========================================================= */

function refreshFoodCost(startDate, endDate) {
  const data = FoodCostService.calculateRange(
    startDate,
    endDate
  );

  const target =
    data.targetFoodCostPercent == null
      ? null
      : Number(data.targetFoodCostPercent);

  const foodCostStatus = getFoodCostStatus(
    data.actualFoodCostPercent,
    target
  );

  const varianceStatus = getVarianceStatus(
    data.foodCostVariancePoints
  );


  /* =======================================================
     KPI CARDS
     ======================================================= */

  const metrics = [
    {
      label: "Actual Food Cost",
      value: percentValue(data.actualFoodCostPercent),
      note: foodCostStatus.label,
      className: foodCostStatus.className
    },

    {
      label: "Theoretical",
      value: percentValue(data.theoreticalFoodCostPercent),
      note: "Expected from sales & recipes",
      className: "is-info"
    },

    {
      label: "Target",
      value: percentValue(target),
      note: "Management target",
      className: ""
    },

    {
      label: "Variance",
      value: pointsValue(data.foodCostVariancePoints),
      note: "Actual vs target",
      className: varianceStatus
    },

    {
      label: "Recorded Waste",
      value: moneyValue(data.wasteCost),
      note: "Selected period",
      className:
        Number(data.wasteCost || 0) > 0
          ? "is-warning"
          : ""
    },

    {
      label: "Purchases",
      value: moneyValue(data.purchases),
      note: "Inventory purchases",
      className: ""
    }
  ];

  foodCostMetrics.innerHTML = metrics
    .map(
      ({
        label,
        value,
        note,
        className
      }) => `
        <article class="metric-card ${className}">
          <span class="metric-label">
            ${label}
          </span>

          <span class="metric-value">
            ${value}
          </span>

          <span class="metric-note">
            ${note}
          </span>
        </article>
      `
    )
    .join("");


  /* =======================================================
     MENU WATCH
     ======================================================= */

  const menuWatch = MenuService
    .getMenuRows()
    .filter(({ metric }) => {
      const foodCost =
        Number(metric.foodCostPercent || 0);

      if (!target) {
        return false;
      }

      return foodCost > target;
    })
    .sort(
      (a, b) =>
        Number(b.metric.foodCostPercent || 0) -
        Number(a.metric.foodCostPercent || 0)
    )
    .slice(0, 6);


  /* =======================================================
     INVENTORY VARIANCE
     ======================================================= */

  const variance = VarianceService.calculateLatest();

  const varianceRows =
    Array.isArray(variance?.rows)
      ? variance.rows
      : [];


  /* =======================================================
     OVERVIEW STATUS
     ======================================================= */

  const actualVsTarget =
    data.actualFoodCostPercent != null &&
    target != null
      ? Number(data.actualFoodCostPercent) - target
      : null;

  let overviewMessage =
    "Food cost performance cannot be evaluated yet.";

  let overviewBadge =
    `<span class="badge">No Data</span>`;

  if (actualVsTarget != null) {
    if (actualVsTarget <= 0) {
      overviewMessage =
        `Actual food cost is ${Math.abs(actualVsTarget).toFixed(1)} points below target.`;

      overviewBadge =
        `<span class="badge badge-good">Healthy</span>`;
    } else if (actualVsTarget <= 2) {
      overviewMessage =
        `Actual food cost is ${actualVsTarget.toFixed(1)} points above target.`;

      overviewBadge =
        `<span class="badge badge-warning">Watch</span>`;
    } else {
      overviewMessage =
        `Actual food cost is ${actualVsTarget.toFixed(1)} points above target.`;

      overviewBadge =
        `<span class="badge badge-danger">Needs Attention</span>`;
    }
  }


  /* =======================================================
     MANAGEMENT SECTIONS
     ======================================================= */

  foodCostSections.innerHTML = `

    <!-- COST OVERVIEW -->
    <section class="recipe-panel management-card--wide">

      <div class="management-card-header">
        <div>
          <h3 class="management-card-title">
            Cost Overview
          </h3>

          <p class="management-card-subtitle">
            Actual performance compared with theoretical usage and target.
          </p>
        </div>

        ${overviewBadge}
      </div>


      <div class="food-cost-overview-grid">

        <div class="food-cost-display">
          <span class="food-cost-display__label">
            Actual Food Cost
          </span>

          <span class="food-cost-display__value">
            ${percentValue(data.actualFoodCostPercent)}
          </span>

          <span class="food-cost-overview-message">
            ${overviewMessage}
          </span>
        </div>


        <div class="summary-list">

          <div class="summary-row">
            <span class="summary-row__label">
              Net Sales
            </span>

            <span class="summary-row__value">
              ${moneyValue(data.netSales)}
            </span>
          </div>

          <div class="summary-row">
            <span class="summary-row__label">
              Theoretical Usage
            </span>

            <span class="summary-row__value">
              ${moneyValue(data.theoreticalCost)}
            </span>
          </div>

          <div class="summary-row">
            <span class="summary-row__label">
              Actual COGS
            </span>

            <span class="summary-row__value">
              ${moneyValue(data.actualCost)}
            </span>
          </div>

          <div class="summary-row">
            <span class="summary-row__label">
              Target Food Cost
            </span>

            <span class="summary-row__value">
              ${percentValue(target)}
            </span>
          </div>

        </div>

      </div>

    </section>


    <!-- INVENTORY EXCEPTIONS -->
    <section class="recipe-panel">

      <div class="management-card-header">
        <div>
          <h3 class="management-card-title">
            Top Inventory Exceptions
          </h3>

          <p class="management-card-subtitle">
            Largest inventory value variances requiring review.
          </p>
        </div>
      </div>

      ${
        varianceRows.length
          ? `
            <div class="summary-list">
              ${varianceRows
                .slice(0, 6)
                .map((row) => {
                  const value =
                    Number(row.varianceValue || 0);

                  const varianceClass =
                    value > 0
                      ? "variance-danger"
                      : value < 0
                        ? "variance-positive"
                        : "";

                  return `
                    <div class="summary-row">

                      <span class="summary-row__label">
                        ${row.item?.name || "Unknown Item"}
                      </span>

                      <span class="summary-row__value ${varianceClass}">
                        ${moneyValue(row.varianceValue)}
                      </span>

                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          : `
            <div class="empty-state">
              <strong>No inventory variance data</strong>

              <p>
                Complete inventory counts to generate exception analysis.
              </p>
            </div>
          `
      }

    </section>


    <!-- WASTE -->
    <section class="recipe-panel">

      <div class="management-card-header">
        <div>
          <h3 class="management-card-title">
            Waste Impact
          </h3>

          <p class="management-card-subtitle">
            Recorded product loss for the selected period.
          </p>
        </div>
      </div>

      <div class="food-cost-display">

        <span class="food-cost-display__label">
          Recorded Waste
        </span>

        <span class="food-cost-display__value">
          ${moneyValue(data.wasteCost)}
        </span>

        <span class="food-cost-overview-message">
          ${
            Number(data.wasteCost || 0) > 0
              ? "Waste is contributing directly to food cost."
              : "No recorded waste for this period."
          }
        </span>

      </div>

    </section>


    <!-- MENU WATCH -->
    <section class="recipe-panel management-card--wide">

      <div class="management-card-header">

        <div>
          <h3 class="management-card-title">
            Menu Cost Watch
          </h3>

          <p class="management-card-subtitle">
            Menu items currently operating above the food cost target.
          </p>
        </div>

        ${
          menuWatch.length
            ? `
              <span class="badge badge-warning">
                ${menuWatch.length} Above Target
              </span>
            `
            : `
              <span class="badge badge-good">
                All Healthy
              </span>
            `
        }

      </div>


      ${
        menuWatch.length
          ? `
            <div class="table-wrapper">

              <table>

                <thead>
                  <tr>
                    <th>Menu Item</th>
                    <th class="numeric">
                      Food Cost
                    </th>
                    <th class="numeric">
                      Target
                    </th>
                    <th>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>

                  ${menuWatch
                    .map(({ item, metric }) => {

                      const foodCost =
                        Number(metric.foodCostPercent || 0);

                      const status =
                        getMenuCostStatus(
                          foodCost,
                          target
                        );

                      return `
                        <tr>

                          <td>
                            <strong>
                              ${item.name}
                            </strong>
                          </td>

                          <td class="numeric">
                            <span class="cost-value">
                              ${foodCost.toFixed(1)}%
                            </span>
                          </td>

                          <td class="numeric">
                            ${percentValue(target)}
                          </td>

                          <td>
                            <span class="badge ${status.className}">
                              ${status.label}
                            </span>
                          </td>

                        </tr>
                      `;
                    })
                    .join("")}

                </tbody>

              </table>

            </div>
          `
          : `
            <div class="empty-state">

              <strong>
                No menu items above target
              </strong>

              <p>
                Current menu costing is within the configured food cost target.
              </p>

            </div>
          `
      }

    </section>
  `;
}


/* =========================================================
   INITIAL LOAD
   ========================================================= */

const range =
  window.AppHeader?.getRange?.() || {};

refreshFoodCost(
  range.startDate,
  range.endDate
);