const salesDate =
  document.getElementById(
    "salesDate"
  );


const transactionsInput =
  document.getElementById(
    "transactionsInput"
  );


const salesMetrics =
  document.getElementById(
    "salesMetrics"
  );


const salesTable =
  document.getElementById(
    "salesTable"
  );


const menuMixTable =
  document.getElementById(
    "menuMixTable"
  );


const saveSalesButton =
  document.getElementById(
    "saveSalesButton"
  );


const clearQuantitiesButton =
  document.getElementById(
    "clearQuantitiesButton"
  );



// --------------------------------------------------
// DATE
// --------------------------------------------------

function today() {

  return new Date()
    .toISOString()
    .slice(0, 10);

}


salesDate.value =
  today();



// --------------------------------------------------
// FORMATTERS
// --------------------------------------------------

function money(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD"
    }
  );

}


function percent(value) {

  return `${Number(
    value || 0
  ).toFixed(1)}%`;

}



// --------------------------------------------------
// GET ACTIVE MENU ITEMS
// --------------------------------------------------

function getMenuItems() {

  return MenuService
    .getMenuItems()
    .filter(
      (item) =>
        item.active !== false
    );

}



// --------------------------------------------------
// RENDER METRICS
// --------------------------------------------------

function renderMetrics() {

  const date =
    salesDate.value;


  const metrics =
    SalesService
      .calculateMetrics(date);


  const cards = [

    {
      label: "Net Sales",
      value:
        money(
          metrics.netSales
        )
    },

    {
      label: "Transactions",
      value:
        metrics.transactions
    },

    {
      label: "Average Ticket",
      value:
        money(
          metrics.averageTicket
        )
    },

    {
      label: "Units Sold",
      value:
        metrics.unitsSold
    },

    {
      label: "Theoretical COGS",
      value:
        money(
          metrics.theoreticalCOGS
        )
    },

    {
      label: "Food Cost",
      value:
        percent(
          metrics
            .theoreticalFoodCostPercent
        )
    }

  ];


  salesMetrics.innerHTML =
    cards
      .map(
        (card) => `
          <article class="metric-card">

            <p>
              ${card.label}
            </p>

            <h2>
              ${card.value}
            </h2>

          </article>
        `
      )
      .join("");

}



// --------------------------------------------------
// SALES ENTRY TABLE
// --------------------------------------------------

function renderSalesTable() {

  const date =
    salesDate.value;


  const items =
    getMenuItems();


  const savedSales =
    SalesService
      .getSales(date);


  const savedByMenuItem =
    new Map(
      savedSales.map(
        (sale) => [
          sale.menuItemId,
          sale
        ]
      )
    );


  if (!items.length) {

    salesTable.innerHTML = `
      <div class="empty-state">

        <h3>
          No Menu Items
        </h3>

        <p>
          Create menu items before
          entering sales.
        </p>

      </div>
    `;

    return;

  }


  salesTable.innerHTML = `

    <div
      class="inventory-table-head sales-table-head"
    >

      <span>
        MENU ITEM
      </span>

      <span>
        PRICE
      </span>

      <span>
        QUANTITY SOLD
      </span>

      <span>
        SALES
      </span>

      <span>
        UNIT COST
      </span>

    </div>


    ${items.map((item) => {

      const existing =
        savedByMenuItem.get(
          item.id
        );


      const quantity =
        Number(
          existing?.quantitySold || 0
        );


      const price =
        Number(
          existing?.sellingPriceAtSale ??
          item.sellingPrice ??
          0
        );


      let unitCost = 0;


      try {

        unitCost =
          Number(
            RecipeService
              .calculateRecipeCost(
                item.recipeId
              )
              .unitCost || 0
          );

      } catch (error) {

        unitCost = 0;

      }


      return `

        <div
          class="inventory-row sales-table-row"
          data-menu-item-id="${item.id}"
        >

          <strong>

            ${item.name}

            <small>
              ${item.sku || item.id}
            </small>

          </strong>


          <span>

            ${money(price)}

          </span>


          <span>

            <input
              class="sales-quantity-input"
              data-menu-item-id="${item.id}"
              type="number"
              min="0"
              step="1"
              value="${quantity}"
            >

          </span>


          <span
            class="sales-row-total"
          >

            ${money(
              quantity *
              price
            )}

          </span>


          <span>

            ${money(unitCost)}

          </span>

        </div>

      `;

    }).join("")}

  `;


  bindQuantityInputs();

}



// --------------------------------------------------
// QUANTITY INPUT EVENTS
// --------------------------------------------------

function bindQuantityInputs() {

  const inputs =
    document.querySelectorAll(
      ".sales-quantity-input"
    );


  inputs.forEach(
    (input) => {

      input.addEventListener(
        "input",
        () => {

          updateRowTotal(input);

          renderPreviewMetrics();

        }
      );

    }
  );

}



// --------------------------------------------------
// UPDATE ROW SALES
// --------------------------------------------------

function updateRowTotal(input) {

  const menuItemId =
    input.dataset.menuItemId;


  const item =
    MenuService
      .getMenuItemById(
        menuItemId
      );


  if (!item) {
    return;
  }


  const quantity =
    Math.max(
      0,
      Number(
        input.value || 0
      )
    );


  const sales =
    quantity *
    Number(
      item.sellingPrice || 0
    );


  const row =
    input.closest(
      ".sales-table-row"
    );


  const totalElement =
    row.querySelector(
      ".sales-row-total"
    );


  totalElement.textContent =
    money(sales);

}



// --------------------------------------------------
// PREVIEW METRICS BEFORE SAVING
// --------------------------------------------------

function renderPreviewMetrics() {

  const inputs =
    [
      ...document.querySelectorAll(
        ".sales-quantity-input"
      )
    ];


  let unitsSold = 0;

  let netSales = 0;

  let theoreticalCOGS = 0;


  inputs.forEach(
    (input) => {

      const item =
        MenuService
          .getMenuItemById(
            input.dataset.menuItemId
          );


      if (!item) {
        return;
      }


      const quantity =
        Math.max(
          0,
          Number(
            input.value || 0
          )
        );


      let unitCost = 0;


      try {

        unitCost =
          Number(
            RecipeService
              .calculateRecipeCost(
                item.recipeId
              )
              .unitCost || 0
          );

      } catch (error) {

        unitCost = 0;

      }


      unitsSold +=
        quantity;


      netSales +=
        quantity *
        Number(
          item.sellingPrice || 0
        );


      theoreticalCOGS +=
        quantity *
        unitCost;

    }
  );


  const transactions =
    Math.max(
      0,
      Number(
        transactionsInput.value || 0
      )
    );


  const averageTicket =
    transactions > 0
      ? netSales /
        transactions
      : 0;


  const foodCost =
    netSales > 0
      ? (
          theoreticalCOGS /
          netSales
        ) * 100
      : 0;


  const cards = [

    [
      "Net Sales",
      money(netSales)
    ],

    [
      "Transactions",
      transactions
    ],

    [
      "Average Ticket",
      money(averageTicket)
    ],

    [
      "Units Sold",
      unitsSold
    ],

    [
      "Theoretical COGS",
      money(theoreticalCOGS)
    ],

    [
      "Food Cost",
      percent(foodCost)
    ]

  ];


  salesMetrics.innerHTML =
    cards.map(
      ([label, value]) => `
        <article class="metric-card">

          <p>
            ${label}
          </p>

          <h2>
            ${value}
          </h2>

        </article>
      `
    ).join("");

}



// --------------------------------------------------
// COLLECT SALES FROM SCREEN
// --------------------------------------------------

function collectSalesRows() {

  const inputs =
    document.querySelectorAll(
      ".sales-quantity-input"
    );


  return [
    ...inputs
  ].map(
    (input) => ({

      menuItemId:
        input.dataset.menuItemId,

      quantitySold:
        Math.max(
          0,
          Number(
            input.value || 0
          )
        )

    })
  );

}



// --------------------------------------------------
// SAVE DAILY SALES
// --------------------------------------------------

function saveDailySales() {

  try {

    const date =
      salesDate.value;


    if (!date) {

      throw new Error(
        "Select a business date."
      );

    }


    const rows =
      collectSalesRows();


    SalesService
      .saveDailySales({

        date,

        rows,

        transactions:
          Number(
            transactionsInput.value || 0
          )

      });


    renderPage();


    showToast(
      "Daily sales saved."
    );


  } catch (error) {

    console.error(error);


    showToast(
      error.message,
      "error"
    );

  }

}



// --------------------------------------------------
// MENU MIX
// --------------------------------------------------

function renderMenuMix() {

  const date =
    salesDate.value;


  const mix =
    SalesService
      .getMenuMix(date);


  if (!mix.length) {

    menuMixTable.innerHTML = `
      <div class="empty-state">

        <h3>
          No Sales
        </h3>

        <p>
          Enter sales for this
          business date to see
          menu mix.
        </p>

      </div>
    `;

    return;

  }


  menuMixTable.innerHTML = `

    <div
      class="inventory-table-head sales-mix-head"
    >

      <span>
        MENU ITEM
      </span>

      <span>
        QTY
      </span>

      <span>
        SALES
      </span>

      <span>
        MIX %
      </span>

      <span>
        CONTRIBUTION
      </span>

    </div>


    ${mix.map((entry) => `

      <div
        class="inventory-row sales-mix-row"
      >

        <strong>

          ${
            entry.item?.name ||
            entry.sale.menuItemId
          }

          <small>
            ${
              entry.item?.sku ||
              entry.sale.menuItemId
            }
          </small>

        </strong>


        <span>
          ${entry.quantity}
        </span>


        <span>
          ${money(
            entry.salesAmount
          )}
        </span>


        <span>
          ${percent(
            entry.salesMixPercent
          )}
        </span>


        <span>

          ${money(
            entry.contribution
          )}

          <small>
            after theoretical food cost
          </small>

        </span>

      </div>

    `).join("")}

  `;

}



// --------------------------------------------------
// LOAD DAY SUMMARY
// --------------------------------------------------

function loadDaySummary() {

  const summary =
    SalesService
      .getDaySummary(
        salesDate.value
      );


  transactionsInput.value =
    Number(
      summary.transactions || 0
    );

}



// --------------------------------------------------
// CLEAR SCREEN
// --------------------------------------------------

function clearQuantities() {

  document
    .querySelectorAll(
      ".sales-quantity-input"
    )
    .forEach(
      (input) => {

        input.value = 0;

        updateRowTotal(input);

      }
    );


  renderPreviewMetrics();

}



// --------------------------------------------------
// RENDER WHOLE PAGE
// --------------------------------------------------

function renderPage() {

  loadDaySummary();

  renderMetrics();

  renderSalesTable();

  renderMenuMix();

}



// --------------------------------------------------
// EVENTS
// --------------------------------------------------

saveSalesButton
  .addEventListener(
    "click",
    saveDailySales
  );


clearQuantitiesButton
  .addEventListener(
    "click",
    clearQuantities
  );


salesDate
  .addEventListener(
    "change",
    renderPage
  );


transactionsInput
  .addEventListener(
    "input",
    renderPreviewMetrics
  );



// --------------------------------------------------
// INITIAL LOAD
// --------------------------------------------------

renderPage();