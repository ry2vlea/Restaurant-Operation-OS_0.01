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

    // Temporary compatibility for existing sales listeners.
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

    // Quantity edits must not replace the historical recipe or price.
    if (existingSale) {
      return { ...existingSale, quantitySold: Number(quantitySold), updatedAt: new Date().toISOString() };
    }

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

  function getSales(date = null, endDate = date) {

    const sales =
      readSales();

    if (!date && !endDate) {
      return sales;
    }

    return sales.filter(
      (sale) =>
        (!date || sale.date >= date) && (!endDate || sale.date <= endDate)
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

  // Old Menu Analysis appended multiple sales for the same item/day.
  // Keep those snapshots; increases extend the last entry, decreases trim newest first.
  function buildSalesForQuantity(date, menuItemId, quantity, existing) {
    if (!quantity) return [];
    if (!existing.length) return [buildSale({ date, menuItemId, quantitySold: quantity })];
    let remaining = quantity;
    return existing.flatMap((sale, index) => {
      const quantitySold = index === existing.length - 1 ? remaining : Math.min(remaining, Number(sale.quantitySold || 0));
      remaining -= quantitySold;
      return quantitySold > 0 ? [buildSale({ date, menuItemId, quantitySold, existingSale: sale })] : [];
    });
  }

  function saveSale(values) {
    const date = values.date || today();
    const quantity = Number(values.quantitySold ?? 0);
    if (!values.menuItemId || !Number.isFinite(quantity) || quantity < 0) throw new Error("Menu item and valid non-negative quantity are required.");
    const sales = readSales();
    const matches = (sale) => sale.date === date && sale.menuItemId === values.menuItemId;
    const updated = buildSalesForQuantity(date, values.menuItemId, quantity, sales.filter(matches));
    writeSales([...sales.filter((sale) => !matches(sale)), ...updated]);
    return updated[updated.length - 1] || null;
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


    const existingToday = new Map();
    allSales.filter((sale) => sale.date === date).forEach((sale) => {
      const entries = existingToday.get(sale.menuItemId) || [];
      entries.push(sale);
      existingToday.set(sale.menuItemId, entries);
    });

    const dailySales = [];
    const seen = new Set();
    const transactionCount = Number(transactions);
    if (!Number.isInteger(transactionCount) || transactionCount < 0) throw new Error("Transactions must be a non-negative integer.");


    rows.forEach((row) => {
      if (!row.menuItemId || seen.has(row.menuItemId)) throw new Error("Each menu item must appear once.");
      seen.add(row.menuItemId);

      const quantity =
        Number(
          row.quantitySold ?? 0
        );


      if (!Number.isFinite(quantity) || quantity < 0) {
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


      dailySales.push(...buildSalesForQuantity(date, row.menuItemId, quantity, existingToday.get(row.menuItemId) || []));

    });


    // Sales for retired items are absent from the entry form; retain them.
    existingToday.forEach((entries, id) => { if (!seen.has(id)) dailySales.push(...entries); });
    saveDaySummary({ date, transactions, notify: false });
    writeSales([...otherDates, ...dailySales]);


    return dailySales;
  }


  // --------------------------------------------------
  // DAY SUMMARY
  // --------------------------------------------------

  function saveDaySummary({
    date,
    transactions = 0,
    notify = true
  }) {
    if (!date || !Number.isInteger(Number(transactions)) || Number(transactions) < 0) throw new Error("Date and non-negative integer transactions are required.");

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


    if (notify) {
      window.dispatchEvent(new CustomEvent("sales:changed"));
      window.dispatchEvent(new CustomEvent("menu-sales:changed"));
    }
    return summary;
  }


  // Read-only compatibility for historical manually entered daily totals.
  function getLegacySummaries() {
    try {
      const records = JSON.parse(localStorage.getItem("businessPerformance"));
      return Array.isArray(records) ? records : [];
    } catch { return []; }
  }

  function getDaySummary(date) {

    return (
      readSummaries().find(
        (summary) =>
          summary.date === date
      ) || {
        date,
        transactions: Number(getLegacySummaries().find((record) => record.date === date)?.transactions || 0)
      }
    );
  }


  // --------------------------------------------------
  // SALES METRICS
  // --------------------------------------------------

  // Old records without financial snapshots use current menu/recipe values.
  function getSaleValues(sale) {
    const item = MenuService.getMenuItemById(sale.menuItemId);
    const sellingPrice = Number(sale.sellingPriceAtSale ?? item?.sellingPrice ?? 0);
    const unitCost = sale.theoreticalUnitCostAtSale != null
      ? Number(sale.theoreticalUnitCostAtSale)
      : Number(RecipeService.calculateRecipeCost(sale.recipeIdAtSale || item?.recipeId).unitCost || 0);
    return { sellingPrice, unitCost };
  }

  function calculateMetrics(date, endDate = date, previewSales = null, previewTransactions = null) {
    const sales = previewSales || getSales(date, endDate);
    const totals = sales.reduce((result, sale) => {
      const quantity = Number(sale.quantitySold || 0);
      const { sellingPrice, unitCost } = getSaleValues(sale);
      result.unitsSold += quantity;
      result.netSales += quantity * sellingPrice;
      result.theoreticalCOGS += quantity * unitCost;
      return result;
    }, { unitsSold: 0, netSales: 0, theoreticalCOGS: 0 });
    const summaries = readSummaries();
    const inRange = (record) => (!date || record.date >= date) && (!endDate || record.date <= endDate);
    const legacy = getLegacySummaries().filter(inRange);
    if (!previewSales) {
      legacy.filter((record) => !sales.some((sale) => sale.date === record.date) && !summaries.some((summary) => summary.date === record.date))
        .forEach((record) => { totals.netSales += Number(record.netSales || 0); });
    }
    const transactions = previewTransactions ?? [...summaries.filter(inRange),
      ...legacy.filter((record) => !summaries.some((summary) => summary.date === record.date))]
      .reduce((total, summary) => total + Number(summary.transactions || 0), 0);
    return { ...totals, transactions,
      averageTicket: transactions > 0 ? totals.netSales / transactions : 0,
      theoreticalFoodCostPercent: totals.netSales > 0 ? totals.theoreticalCOGS / totals.netSales * 100 : 0 };
  }

  function previewSale(date, menuItemId, quantity) {
    const sales = buildSalesForQuantity(date, menuItemId, quantity,
      getSales(date).filter((sale) => sale.menuItemId === menuItemId));
    return calculateMetrics(date, date, sales, 0);
  }

  function previewDailySales({ date, rows, transactions = 0 }) {
    const existing = getSales(date);
    const ids = new Set(rows.map((row) => row.menuItemId));
    const sales = existing.filter((sale) => !ids.has(sale.menuItemId));
    rows.forEach((row) => sales.push(...buildSalesForQuantity(date, row.menuItemId,
      Math.max(0, Number(row.quantitySold || 0)), existing.filter((sale) => sale.menuItemId === row.menuItemId))));
    return calculateMetrics(date, date, sales, transactions);
  }

  function getMenuMix(date, endDate = date) {
    const groups = new Map();
    getSales(date, endDate).forEach((sale) => {
      const entry = groups.get(sale.menuItemId) || {
        sale, item: MenuService.getMenuItemById(sale.menuItemId),
        quantity: 0, salesAmount: 0, theoreticalCost: 0
      };
      const { sellingPrice, unitCost } = getSaleValues(sale);
      const quantity = Number(sale.quantitySold || 0);
      entry.quantity += quantity;
      entry.salesAmount += quantity * sellingPrice;
      entry.theoreticalCost += quantity * unitCost;
      groups.set(sale.menuItemId, entry);
    });
    const netSales = [...groups.values()].reduce((total, entry) => total + entry.salesAmount, 0);
    return [...groups.values()].map((entry) => ({ ...entry,
      contribution: entry.salesAmount - entry.theoreticalCost,
      salesMixPercent: netSales > 0 ? entry.salesAmount / netSales * 100 : 0
    })).sort((a, b) => b.salesAmount - a.salesAmount);
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

    previewSale,
    previewDailySales,
    getSaleValues,
    calculateMetrics,
    getMenuMix,

    deleteSale
  };

})();