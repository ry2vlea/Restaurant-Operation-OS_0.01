(function () {
  const salesKey = "menuSales";
  const summaryKey = "salesDaySummaries";

  // --------------------------------------------------
  // STORAGE
  // --------------------------------------------------

  function readSales() {
    try {
      const value = JSON.parse(localStorage.getItem(salesKey));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error("Could not read sales:", error);
      return [];
    }
  }

  function writeSales(sales) {
    localStorage.setItem(
      salesKey,
      JSON.stringify(sales)
    );

    window.dispatchEvent(
      new CustomEvent("sales:changed")
    );

    // We keep this event because your current
    // TheoreticalUsageService already uses menuSales.
    window.dispatchEvent(
      new CustomEvent("menu-sales:changed")
    );

    return sales;
  }

  function readSummaries() {
    try {
      const value = JSON.parse(
        localStorage.getItem(summaryKey)
      );

      return Array.isArray(value)
        ? value
        : [];
    } catch (error) {
      console.error(
        "Could not read sales summaries:",
        error
      );

      return [];
    }
  }

  function writeSummaries(summaries) {
    localStorage.setItem(
      summaryKey,
      JSON.stringify(summaries)
    );

    return summaries;
  }


  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  function today() {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }


  function createId(date) {
    return `SALE-${date.replaceAll("-", "")}-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;
  }


  function buildSale({
    date,
    menuItemId,
    quantitySold,
    existingSale = null
  }) {

    const item =
      MenuService.getMenuItemById(menuItemId);

    if (!item) {
      throw new Error(
        "Menu item not found."
      );
    }


    const recipe =
      RecipeService.getRecipeById(
        item.recipeId
      );

    if (!recipe) {
      throw new Error(
        `${item.name} does not have a valid recipe.`
      );
    }


    const recipeCost =
      RecipeService.calculateRecipeCost(
        recipe.id
      );


    /*
      IMPORTANT:

      We create a snapshot of the ingredients
      at the moment of the sale.

      Example:

      Chicken Sandwich

      1 bun
      1 filet
      0.5 oz sauce

      Even if the recipe changes tomorrow,
      today's sale still remembers what recipe
      structure existed today.
    */

    const ingredientSnapshot =
      RecipeService
        .resolveInventoryUsage(
          RecipeService.recipeTypeOf(recipe),
          recipe.id,
          1
        )
        .map((ingredient) => ({
          inventoryItemId:
            ingredient.itemId,

          baseQuantityPerServing:
            Number(
              ingredient.baseQuantity || 0
            )
        }));


    const now =
      new Date().toISOString();


    return {
      id:
        existingSale?.id ||
        createId(date),

      date,

      menuItemId:
        item.id,

      quantitySold:
        Number(quantitySold),

      recipeIdAtSale:
        recipe.id,

      recipeVersionAtSale:
        recipe.version || 1,

      sellingPriceAtSale:
        Number(
          item.sellingPrice || 0
        ),

      theoreticalUnitCostAtSale:
        Number(
          recipeCost.unitCost || 0
        ),

      ingredientSnapshot,

      enteredBy:
        localStorage.getItem(
          "currentManager"
        ) || "Unknown Manager",

      createdAt:
        existingSale?.createdAt ||
        now,

      updatedAt:
        now
    };
  }


  // --------------------------------------------------
  // GET SALES
  // --------------------------------------------------

  function getSales(date = null) {

    const sales =
      readSales();

    if (!date) {
      return sales;
    }

    return sales.filter(
      (sale) =>
        sale.date === date
    );
  }


  function getSale(
    date,
    menuItemId
  ) {
    return readSales().find(
      (sale) =>
        sale.date === date &&
        sale.menuItemId === menuItemId
    ) || null;
  }


  // --------------------------------------------------
  // SINGLE SALE
  // --------------------------------------------------

  function saveSale(values) {

    const date =
      values.date ||
      today();

    const quantity =
      Number(
        values.quantitySold || 0
      );


    if (!values.menuItemId) {
      throw new Error(
        "Menu item is required."
      );
    }


    if (quantity < 0) {
      throw new Error(
        "Quantity cannot be negative."
      );
    }


    const sales =
      readSales();


    const existingSale =
      sales.find(
        (sale) =>
          sale.date === date &&
          sale.menuItemId ===
            values.menuItemId
      );


    /*
      If quantity = 0,
      remove the sale from that day.
    */

    if (quantity === 0) {

      const updated =
        sales.filter(
          (sale) =>
            !(
              sale.date === date &&
              sale.menuItemId ===
                values.menuItemId
            )
        );

      writeSales(updated);

      return null;
    }


    const sale =
      buildSale({
        date,
        menuItemId:
          values.menuItemId,
        quantitySold:
          quantity,
        existingSale
      });


    let updatedSales;


    if (existingSale) {

      updatedSales =
        sales.map(
          (existing) =>
            existing.id ===
            existingSale.id
              ? sale
              : existing
        );

    } else {

      updatedSales = [
        ...sales,
        sale
      ];

    }


    writeSales(updatedSales);

    return sale;
  }


  // --------------------------------------------------
  // BULK DAILY SALES
  // --------------------------------------------------

  function saveDailySales({
    date,
    rows,
    transactions = 0
  }) {

    if (!date) {
      throw new Error(
        "Date is required."
      );
    }


    if (!Array.isArray(rows)) {
      throw new Error(
        "Sales rows are required."
      );
    }


    /*
      Get everything NOT from this date.

      Then we rebuild the selected date.

      This prevents duplicate daily sales
      when the manager edits the same day.
    */

    const allSales =
      readSales();


    const otherDates =
      allSales.filter(
        (sale) =>
          sale.date !== date
      );


    const existingToday =
      new Map(
        allSales
          .filter(
            (sale) =>
              sale.date === date
          )
          .map(
            (sale) => [
              sale.menuItemId,
              sale
            ]
          )
      );


    const dailySales = [];


    rows.forEach((row) => {

      const quantity =
        Number(
          row.quantitySold || 0
        );


      if (quantity < 0) {
        throw new Error(
          "Quantity sold cannot be negative."
        );
      }


      /*
        We don't store zero sales.
      */

      if (quantity === 0) {
        return;
      }


      const sale =
        buildSale({
          date,

          menuItemId:
            row.menuItemId,

          quantitySold:
            quantity,

          existingSale:
            existingToday.get(
              row.menuItemId
            )
        });


      dailySales.push(sale);

    });


    writeSales([
      ...otherDates,
      ...dailySales
    ]);


    saveDaySummary({
      date,
      transactions
    });


    return dailySales;
  }


  // --------------------------------------------------
  // DAY SUMMARY
  // --------------------------------------------------

  function saveDaySummary({
    date,
    transactions = 0
  }) {

    const summaries =
      readSummaries();


    const existing =
      summaries.find(
        (summary) =>
          summary.date === date
      );


    const summary = {
      date,

      transactions:
        Math.max(
          0,
          Number(transactions || 0)
        ),

      updatedAt:
        new Date().toISOString()
    };


    if (existing) {

      writeSummaries(
        summaries.map(
          (value) =>
            value.date === date
              ? {
                  ...value,
                  ...summary
                }
              : value
        )
      );

    } else {

      writeSummaries([
        ...summaries,
        summary
      ]);

    }


    return summary;
  }


  function getDaySummary(date) {

    return (
      readSummaries().find(
        (summary) =>
          summary.date === date
      ) || {
        date,
        transactions: 0
      }
    );
  }


  // --------------------------------------------------
  // SALES METRICS
  // --------------------------------------------------

  function calculateMetrics(date) {

    const sales =
      getSales(date);


    const summary =
      getDaySummary(date);


    const totals =
      sales.reduce(
        (result, sale) => {

          const quantity =
            Number(
              sale.quantitySold || 0
            );


          const price =
            Number(
              sale.sellingPriceAtSale || 0
            );


          const unitCost =
            Number(
              sale.theoreticalUnitCostAtSale || 0
            );


          result.unitsSold +=
            quantity;


          result.netSales +=
            quantity * price;


          result.theoreticalCOGS +=
            quantity * unitCost;


          return result;

        },
        {
          unitsSold: 0,
          netSales: 0,
          theoreticalCOGS: 0
        }
      );


    const transactions =
      Number(
        summary.transactions || 0
      );


    const averageTicket =
      transactions > 0
        ? totals.netSales /
          transactions
        : 0;


    const theoreticalFoodCostPercent =
      totals.netSales > 0
        ? (
            totals.theoreticalCOGS /
            totals.netSales
          ) * 100
        : 0;


    return {
      ...totals,

      transactions,

      averageTicket,

      theoreticalFoodCostPercent
    };
  }


  // --------------------------------------------------
  // MENU MIX
  // --------------------------------------------------

  function getMenuMix(date) {

    const sales =
      getSales(date);


    const metrics =
      calculateMetrics(date);


    return sales
      .map((sale) => {

        const item =
          MenuService.getMenuItemById(
            sale.menuItemId
          );


        const quantity =
          Number(
            sale.quantitySold || 0
          );


        const salesAmount =
          quantity *
          Number(
            sale.sellingPriceAtSale || 0
          );


        const theoreticalCost =
          quantity *
          Number(
            sale.theoreticalUnitCostAtSale || 0
          );


        const contribution =
          salesAmount -
          theoreticalCost;


        const salesMixPercent =
          metrics.netSales > 0
            ? (
                salesAmount /
                metrics.netSales
              ) * 100
            : 0;


        return {
          sale,

          item,

          quantity,

          salesAmount,

          theoreticalCost,

          contribution,

          salesMixPercent
        };

      })
      .sort(
        (a, b) =>
          b.salesAmount -
          a.salesAmount
      );
  }


  // --------------------------------------------------
  // DELETE
  // --------------------------------------------------

  function deleteSale(id) {

    const updated =
      readSales().filter(
        (sale) =>
          sale.id !== id
      );


    writeSales(updated);

    return updated;
  }


  // --------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------

  window.SalesService = {
    getSales,
    getSale,

    saveSale,
    saveDailySales,

    getDaySummary,
    saveDaySummary,

    calculateMetrics,
    getMenuMix,

    deleteSale
  };

})();