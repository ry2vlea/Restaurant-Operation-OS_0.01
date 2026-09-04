(function () {
  const key = "restaurantSettings";
  const dataKeys = [
    "inventoryItems", "inventoryCategories", "inventoryLocations", "inventoryUnits", "inventoryConversions", "inventoryMovements",
    "inventoryCounts", "inventoryCountLines", "deliveries", "deliveryLines", "wasteRecords", "inventoryVariances", "vendors",
    "recipes", "recipeIngredients", "menuItems", "menuSales", "productionBatches", "issues", "tasks", "shifts", "handovers",
    "dailyReports", "businessPerformance", "activityLog", "purchaseOrders", "purchaseOrderLines", "equipment", "maintenanceRecords",
    "teamMembers", "trainingRecords", "sops", "restaurantSettings"
  ];
  const defaults = {
    profile: { restaurantName: "Harbor Grill", locationName: "Main Location", address: "", phone: "", operatingHours: "" },
    targets: { foodCostPercent: 30, laborPercent: 22, wasteAlertThreshold: 75, varianceAlertThreshold: 50 },
    shiftSettings: { openingEnabled: true, midShiftEnabled: true, closingEnabled: true },
    menuCategories: ["Sandwiches", "Combos", "Chicken", "Sides", "Desserts", "Beverages", "Sauces", "Other"],
    recipeCategories: ["Menu", "Prep", "Sauce", "Batch", "Other"],
    sopCategories: ["Opening", "Closing", "Food Safety", "Equipment", "Cleaning", "Inventory", "Receiving", "Guest Service", "Management", "Emergency", "Other"],
    teamRoles: ["Manager", "Shift Lead", "Counter", "Production", "Prep", "Dish", "Maintenance"],
    trainingSkills: ["Counter", "Cashier", "Production", "Prep", "Fryer", "Grill", "Drive-Thru", "Closing", "Opening", "Inventory Count", "Manager"]
  };

  function read() {
    try {
      return { ...defaults, ...(JSON.parse(localStorage.getItem(key)) || {}) };
    } catch (error) {
      return defaults;
    }
  }

  function save(values) {
    const settings = { ...read(), ...values, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(settings));
    window.recordActivity?.({ action: "SETTINGS_CHANGED", entityType: "SETTINGS", entityId: key, description: "Restaurant settings updated" });
    window.dispatchEvent(new CustomEvent("settings:changed"));
    return settings;
  }

  function exportBackup() {
    const data = {};
    dataKeys.forEach((name) => {
      const raw = localStorage.getItem(name);
      if (raw != null) data[name] = JSON.parse(raw);
    });
    return { app: "Restaurant Operations OS", exportedAt: new Date().toISOString(), data };
  }

  function validateBackup(value) {
    return Boolean(value && value.app === "Restaurant Operations OS" && value.data && typeof value.data === "object");
  }

  function restoreBackup(backup) {
    if (!validateBackup(backup)) throw new Error("Invalid Restaurant OS backup.");
    localStorage.setItem(`restaurantOsRestoreBackup-${Date.now()}`, JSON.stringify(exportBackup()));
    Object.entries(backup.data).forEach(([name, value]) => {
      if (dataKeys.includes(name)) localStorage.setItem(name, JSON.stringify(value));
    });
    window.recordActivity?.({ action: "BACKUP_RESTORED", entityType: "SETTINGS", entityId: key, description: "System backup restored" });
    return true;
  }

  window.SettingsService = { getSettings: read, saveSettings: save, exportBackup, validateBackup, restoreBackup, dataKeys };
})();
