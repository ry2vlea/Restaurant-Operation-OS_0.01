(function () {
  const markerKey = "restaurantOsSampleDataLoaded";

  function today(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function findItemBySku(sku) {
    return InventoryService.getItems().find((item) => item.sku === sku) || null;
  }

  function ensureItem(values) {
    return findItemBySku(values.sku) || InventoryService.createItem(values);
  }

  function hasMovement(itemId, reason) {
    return InventoryService.getMovements().some((movement) => movement.itemId === itemId && movement.reason === reason);
  }

  function ensureMovement(values) {
    if (!hasMovement(values.itemId, values.reason)) InventoryService.createInventoryMovement(values);
  }

  function findRecipeByName(name) {
    return RecipeService.getRecipes().find((recipe) => recipe.name === name) || null;
  }

  function ensureRecipe(values, ingredients) {
    return findRecipeByName(values.name) || RecipeService.createRecipe(values, ingredients);
  }

  function findMenuItemByName(name) {
    return MenuService.getMenuItems().find((item) => item.name === name) || null;
  }

  function ensureMenuItem(values) {
    return findMenuItemByName(values.name) || MenuService.createMenuItem(values);
  }

  function ensureIssue(values) {
    if (!window.IssueService) return null;
    const existing = IssueService.getIssues().find((issue) => issue.title === values.title);
    return existing || IssueService.createIssue(values);
  }

  function ensureTask(values) {
    if (!window.TaskService) return null;
    const existing = TaskService.getTasks().find((task) => task.title === values.title);
    return existing || TaskService.createTask(values);
  }

  function ensureSale(values) {
    if (!window.TheoreticalUsageService) return null;
    const existing = TheoreticalUsageService.getSales(values.date).find((sale) => sale.menuItemId === values.menuItemId);
    return existing || TheoreticalUsageService.saveSale(values);
  }

  function ensureEquipment(values) {
    if (!window.EquipmentService) return null;
    const existing = EquipmentService.getEquipment().find((item) => item.name === values.name);
    return existing || EquipmentService.createEquipment(values);
  }

  function ensureTeam(values) {
    if (!window.TeamService) return null;
    const existing = TeamService.getMembers().find((member) => member.name === values.name);
    return existing || TeamService.createMember(values);
  }

  function ensureSop(values) {
    if (!window.SopService) return null;
    const existing = SopService.getSops().find((sop) => sop.title === values.title);
    return existing || SopService.createSop(values);
  }

  function load() {
    const items = {
      chicken: ensureItem({ name: "Chicken Breast", sku: "PROT-001", categoryId: "CAT-PROTEIN", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-PK", baseUnitId: "UNIT-EA", intermediateUnitsPerPrimary: 6, baseUnitsPerIntermediate: 12, defaultLocationId: "LOC-WALKIN-COOLER", purchaseUnitCost: 102.24, minimumLevel: 72, parLevel: 216, maximumLevel: 360 }),
      thighs: ensureItem({ name: "Chicken Thighs", sku: "PROT-002", categoryId: "CAT-PROTEIN", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-PK", baseUnitId: "UNIT-EA", intermediateUnitsPerPrimary: 4, baseUnitsPerIntermediate: 10, defaultLocationId: "LOC-WALKIN-COOLER", purchaseUnitCost: 68, minimumLevel: 40, parLevel: 120, maximumLevel: 240 }),
      oil: ensureItem({ name: "Fry Oil", sku: "OIL-001", categoryId: "CAT-SUPPLIES", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-JUG", baseUnitId: "UNIT-FLOZ", intermediateUnitsPerPrimary: 4, baseUnitsPerIntermediate: 128, defaultLocationId: "LOC-DRY-STORAGE", purchaseUnitCost: 88, minimumLevel: 512, parLevel: 1536, maximumLevel: 3072 }),
      buns: ensureItem({ name: "Burger Buns", sku: "BAK-001", categoryId: "CAT-DRY", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-PK", baseUnitId: "UNIT-EA", intermediateUnitsPerPrimary: 6, baseUnitsPerIntermediate: 8, defaultLocationId: "LOC-DRY-STORAGE", purchaseUnitCost: 20.16, minimumLevel: 48, parLevel: 144, maximumLevel: 240 }),
      lettuce: ensureItem({ name: "Romaine Lettuce", sku: "PROD-001", categoryId: "CAT-PRODUCE", primaryUnitId: "UNIT-CS", intermediateUnitId: "", baseUnitId: "UNIT-EA", baseUnitsPerPrimary: 24, defaultLocationId: "LOC-WALKIN-COOLER", purchaseUnitCost: 38.4, minimumLevel: 12, parLevel: 48, maximumLevel: 96 }),
      tomato: ensureItem({ name: "Tomatoes", sku: "PROD-002", categoryId: "CAT-PRODUCE", primaryUnitId: "UNIT-CS", intermediateUnitId: "", baseUnitId: "UNIT-LB", baseUnitsPerPrimary: 25, defaultLocationId: "LOC-WALKIN-COOLER", purchaseUnitCost: 42.5, minimumLevel: 10, parLevel: 35, maximumLevel: 75 }),
      cheese: ensureItem({ name: "American Cheese", sku: "DAIRY-001", categoryId: "CAT-DAIRY", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-PK", baseUnitId: "UNIT-EA", intermediateUnitsPerPrimary: 4, baseUnitsPerIntermediate: 160, defaultLocationId: "LOC-WALKIN-COOLER", purchaseUnitCost: 96, minimumLevel: 160, parLevel: 640, maximumLevel: 1280 }),
      fries: ensureItem({ name: "Frozen Fries", sku: "FRZ-001", categoryId: "CAT-FROZEN", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-BAG", baseUnitId: "UNIT-LB", intermediateUnitsPerPrimary: 6, baseUnitsPerIntermediate: 5, defaultLocationId: "LOC-WALKIN-FREEZER", purchaseUnitCost: 54, minimumLevel: 30, parLevel: 120, maximumLevel: 240 }),
      sauce: ensureItem({ name: "House Sauce", sku: "SAUCE-001", categoryId: "CAT-SAUCE", primaryUnitId: "UNIT-TUB", intermediateUnitId: "", baseUnitId: "UNIT-FLOZ", baseUnitsPerPrimary: 128, defaultLocationId: "LOC-PREP", purchaseUnitCost: 18, minimumLevel: 64, parLevel: 256, maximumLevel: 512 }),
      cups: ensureItem({ name: "Drink Cups 20oz", sku: "PACK-001", categoryId: "CAT-PACKAGING", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-PK", baseUnitId: "UNIT-EA", intermediateUnitsPerPrimary: 20, baseUnitsPerIntermediate: 50, defaultLocationId: "LOC-DRY-STORAGE", purchaseUnitCost: 74, minimumLevel: 500, parLevel: 2000, maximumLevel: 4000 }),
      cola: ensureItem({ name: "Cola Syrup", sku: "BEV-001", categoryId: "CAT-BEVERAGE", primaryUnitId: "UNIT-BAG", intermediateUnitId: "", baseUnitId: "UNIT-FLOZ", baseUnitsPerPrimary: 640, defaultLocationId: "LOC-BEVERAGE", purchaseUnitCost: 98, minimumLevel: 640, parLevel: 1920, maximumLevel: 3840 }),
      sanitizer: ensureItem({ name: "Sanitizer", sku: "CLEAN-001", categoryId: "CAT-CLEANING", primaryUnitId: "UNIT-CS", intermediateUnitId: "UNIT-JUG", baseUnitId: "UNIT-FLOZ", intermediateUnitsPerPrimary: 4, baseUnitsPerIntermediate: 128, defaultLocationId: "LOC-CLEANING", purchaseUnitCost: 44, minimumLevel: 128, parLevel: 512, maximumLevel: 1024 })
    };

    [
      [items.chicken, 4, "UNIT-CS"], [items.thighs, 3, "UNIT-CS"], [items.oil, 3, "UNIT-CS"],
      [items.buns, 4, "UNIT-CS"], [items.lettuce, 2, "UNIT-CS"], [items.tomato, 2, "UNIT-CS"],
      [items.cheese, 2, "UNIT-CS"], [items.fries, 5, "UNIT-CS"], [items.sauce, 3, "UNIT-TUB"],
      [items.cups, 3, "UNIT-CS"], [items.cola, 4, "UNIT-BAG"], [items.sanitizer, 1, "UNIT-CS"]
    ].forEach(([item, quantity, unitId]) => {
      ensureMovement({ itemId: item.id, locationId: item.defaultLocationId, quantity, unitId, movementType: "RECEIVE", reason: "Sample opening stock" });
    });

    ensureMovement({ itemId: items.chicken.id, locationId: items.chicken.defaultLocationId, quantity: 42, unitId: "UNIT-EA", movementType: "USE", reason: "Sample lunch rush usage" });
    ensureMovement({ itemId: items.fries.id, locationId: items.fries.defaultLocationId, quantity: 18, unitId: "UNIT-LB", movementType: "USE", reason: "Sample lunch rush usage" });
    ensureMovement({ itemId: items.buns.id, locationId: items.buns.defaultLocationId, quantity: 36, unitId: "UNIT-EA", movementType: "USE", reason: "Sample lunch rush usage" });

    const chickenSandwich = ensureRecipe({ name: "Crispy Chicken Sandwich", recipeType: "MENU", yieldQuantity: 1, yieldUnitId: "UNIT-EA", sellingPrice: 9.5 }, [
      { inventoryItemId: items.chicken.id, quantity: 1, unitId: "UNIT-EA" },
      { inventoryItemId: items.buns.id, quantity: 1, unitId: "UNIT-EA" },
      { inventoryItemId: items.lettuce.id, quantity: 0.25, unitId: "UNIT-EA" },
      { inventoryItemId: items.tomato.id, quantity: 0.12, unitId: "UNIT-LB" },
      { inventoryItemId: items.sauce.id, quantity: 1, unitId: "UNIT-FLOZ" }
    ]);
    const chickenCombo = ensureRecipe({ name: "Chicken Sandwich Combo", recipeType: "MENU", yieldQuantity: 1, yieldUnitId: "UNIT-EA", sellingPrice: 13.75 }, [
      { inventoryItemId: items.chicken.id, quantity: 1, unitId: "UNIT-EA" },
      { inventoryItemId: items.buns.id, quantity: 1, unitId: "UNIT-EA" },
      { inventoryItemId: items.fries.id, quantity: 0.5, unitId: "UNIT-LB" },
      { inventoryItemId: items.cups.id, quantity: 1, unitId: "UNIT-EA" },
      { inventoryItemId: items.cola.id, quantity: 3, unitId: "UNIT-FLOZ" }
    ]);
    const friesRecipe = ensureRecipe({ name: "Large Fries", recipeType: "MENU", yieldQuantity: 1, yieldUnitId: "UNIT-EA", sellingPrice: 4.25 }, [
      { inventoryItemId: items.fries.id, quantity: 0.65, unitId: "UNIT-LB" },
      { inventoryItemId: items.oil.id, quantity: 1.5, unitId: "UNIT-FLOZ" }
    ]);

    const menuItems = [
      ensureMenuItem({ name: "Crispy Chicken Sandwich", sku: "MENU-CHK-SAND", categoryId: "MCAT-SANDWICHES", recipeId: chickenSandwich.id, sellingPrice: 9.5, limitedThreshold: 20 }),
      ensureMenuItem({ name: "Chicken Sandwich Combo", sku: "MENU-CHK-COMBO", categoryId: "MCAT-COMBOS", recipeId: chickenCombo.id, sellingPrice: 13.75, limitedThreshold: 15 }),
      ensureMenuItem({ name: "Large Fries", sku: "MENU-LG-FRIES", categoryId: "MCAT-SIDES", recipeId: friesRecipe.id, sellingPrice: 4.25, limitedThreshold: 25 })
    ];

    ensureSale({ menuItemId: menuItems[0].id, quantitySold: 24, date: today() });
    ensureSale({ menuItemId: menuItems[1].id, quantitySold: 18, date: today() });
    ensureSale({ menuItemId: menuItems[2].id, quantitySold: 32, date: today() });

    ensureIssue({ title: "Walk-in cooler running warm", description: "Temperature peaked at 43F during prep. Monitoring every 30 minutes.", category: "EQUIPMENT", priority: "HIGH", operationalImpact: "HIGH", assignedTo: "Alex Rivera", immediateAction: "Move proteins to lower shelf and verify door seal." });
    ensureIssue({ title: "Sauce station short on backup tubs", description: "Prep station has less than one backup tub for dinner service.", category: "INVENTORY", priority: "MEDIUM", operationalImpact: "MODERATE", assignedTo: "Mia Torres", relatedInventoryItemId: items.sauce.id });

    ensureTask({ title: "Verify cooler temperature log", description: "Check and record walk-in cooler temp before dinner rush.", category: "EQUIPMENT", priority: "HIGH", assignedTo: "Alex Rivera", dueDate: today(), dueTime: "16:30" });
    ensureTask({ title: "Prep two backup sauce tubs", description: "Build sauce par before dinner service.", category: "INVENTORY", priority: "MEDIUM", assignedTo: "Mia Torres", dueDate: today(), dueTime: "15:30", relatedInventoryItemId: items.sauce.id });
    ensureTask({ title: "Confirm tomorrow bun order", description: "Review sales trend and confirm bakery order quantity.", category: "INVENTORY", priority: "LOW", assignedTo: "Jordan Lee", dueDate: today(1), dueTime: "10:00", relatedInventoryItemId: items.buns.id });

    if (window.BusinessPerformanceService && !BusinessPerformanceService.getByDate(today())) {
      BusinessPerformanceService.saveRecord({ date: today(), netSales: 8420.18, transactions: 612, laborHours: 126.5, laborDollars: 1718.44, notes: "Sample operating day entered by demo loader." });
    }

    const fryer = ensureEquipment({ name: "Fryer #2", category: "COOKING", location: "Kitchen", manufacturer: "Pitco", model: "SG14", serialNumber: "FRY-02", status: "ATTENTION", notes: "Oil recovery slower than normal during lunch." });
    ensureEquipment({ name: "Walk-In Cooler", category: "REFRIGERATION", location: "Back of House", manufacturer: "Kolpak", model: "KPC", serialNumber: "WIC-01", status: "ATTENTION", notes: "Temperature requires monitoring." });
    if (fryer && window.EquipmentService && !EquipmentService.getMaintenance().some((record) => record.equipmentId === fryer.id)) {
      EquipmentService.createMaintenance({ equipmentId: fryer.id, type: "INSPECTION", status: "SCHEDULED", scheduledDate: today(), vendor: "Metro Service", cost: 0, notes: "Inspect recovery time and thermostat." });
    }

    const jordan = ensureTeam({ name: "Jordan Lee", role: "Manager", positions: ["Manager", "Opening", "Inventory Count"], phone: "", email: "" });
    const alex = ensureTeam({ name: "Alex Rivera", role: "Manager", positions: ["Manager", "Production", "Closing"], phone: "", email: "" });
    const mia = ensureTeam({ name: "Mia Torres", role: "Shift Lead", positions: ["Counter", "Prep", "Drive-Thru"], phone: "", email: "" });
    if (window.TeamService) {
      [[jordan, "Manager", "TRAINER"], [alex, "Production", "TRAINER"], [mia, "Counter", "QUALIFIED"], [mia, "Prep", "TRAINING"]].forEach(([member, skill, status]) => member && TeamService.saveSkill(member.id, skill, status));
    }

    ensureSop({ title: "Opening Fryer Procedure", category: "Equipment", tags: "fryer, opening", content: "Verify oil level.\nConfirm fryer reaches operating temperature.\nRecord any recovery issues as Equipment Issues." });
    ensureSop({ title: "Receiving Temperature Check", category: "Receiving", tags: "receiving, food safety", content: "Check delivery temperature before accepting product.\nRecord exceptions immediately.\nEscalate unsafe product to manager." });

    if (window.PurchasingService && !PurchasingService.getPurchaseOrders().some((order) => order.notes === "Sample par replenishment")) {
      let suggestions = PurchasingService.suggestedOrder().slice(0, 4);
      if (!suggestions.length) {
        const item = items.buns;
        suggestions = [{ item, suggestedQuantity: 1, unitId: InventoryService.getPrimaryUnitId(item), estimatedCost: InventoryService.getPurchaseUnitCost(item) }];
      }
      if (suggestions.length) PurchasingService.createPurchaseOrder({ vendorId: "VEN-GENERAL", status: "ORDERED", expectedDeliveryDate: today(1), notes: "Sample par replenishment" }, suggestions.map((row) => ({ itemId: row.item.id, orderedQuantity: row.suggestedQuantity, unitId: row.unitId, estimatedUnitCost: InventoryService.getPurchaseUnitCost(row.item) })));
    }

    localStorage.setItem(markerKey, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("sample-data:loaded"));
    return { items: Object.keys(items).length, recipes: 3, menuItems: menuItems.length };
  }

  function isLoaded() {
    return Boolean(localStorage.getItem(markerKey));
  }

  window.SampleDataService = { load, isLoaded };
})();
