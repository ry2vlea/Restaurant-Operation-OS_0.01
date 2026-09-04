(function () {
  const equipmentKey = "equipment";
  const maintenanceKey = "maintenanceRecords";

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function write(key, values) {
    localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("equipment:changed"));
    return values;
  }

  function nextId(prefix, values) {
    const highest = values.reduce((max, value) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(6, "0")}`;
  }

  function getEquipment() { return read(equipmentKey); }
  function getMaintenance() { return read(maintenanceKey); }
  function getEquipmentById(id) { return getEquipment().find((item) => item.id === id) || null; }

  function saveEquipment(values) { return write(equipmentKey, values); }

  function createEquipment(values) {
    const now = new Date().toISOString();
    const record = {
      id: nextId("EQ", getEquipment()),
      name: values.name,
      category: values.category || "OTHER",
      location: values.location || "",
      manufacturer: values.manufacturer || "",
      model: values.model || "",
      serialNumber: values.serialNumber || "",
      status: values.status || "OPERATIONAL",
      purchaseDate: values.purchaseDate || null,
      warrantyExpiration: values.warrantyExpiration || null,
      notes: values.notes || "",
      active: values.active !== false,
      createdAt: now,
      updatedAt: now
    };
    saveEquipment([...getEquipment(), record]);
    window.recordActivity?.({ action: "EQUIPMENT_CREATED", entityType: "EQUIPMENT", entityId: record.id, description: `Equipment added: ${record.name}` });
    return record;
  }

  function updateEquipment(id, changes) {
    const existing = getEquipmentById(id);
    if (!existing) throw new Error("Equipment not found.");
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    saveEquipment(getEquipment().map((item) => item.id === id ? updated : item));
    window.recordActivity?.({ action: "EQUIPMENT_STATUS_CHANGED", entityType: "EQUIPMENT", entityId: id, description: `${updated.name} status: ${updated.status}` });
    return updated;
  }

  function createMaintenance(values) {
    const equipment = getEquipmentById(values.equipmentId);
    if (!equipment) throw new Error("Select valid equipment.");
    const now = new Date().toISOString();
    const record = {
      id: nextId("MNT", getMaintenance()),
      equipmentId: equipment.id,
      type: values.type || "PREVENTIVE",
      status: values.status || "SCHEDULED",
      scheduledDate: values.scheduledDate || now.slice(0, 10),
      completedDate: values.completedDate || null,
      vendor: values.vendor || "",
      cost: Number(values.cost || 0),
      performedBy: values.performedBy || "",
      notes: values.notes || "",
      createdAt: now
    };
    write(maintenanceKey, [...getMaintenance(), record]);
    if (record.status === "COMPLETED") updateEquipment(equipment.id, { status: "OPERATIONAL" });
    window.recordActivity?.({ action: "MAINTENANCE_CREATED", entityType: "MAINTENANCE", entityId: record.id, description: `Maintenance ${record.status}: ${equipment.name}` });
    return record;
  }

  function createIssue(id, values = {}) {
    const equipment = getEquipmentById(id);
    if (!equipment || !window.IssueService) throw new Error("Equipment issue cannot be created.");
    const issue = IssueService.createIssue({
      title: values.title || `${equipment.name} needs attention`,
      description: values.description || equipment.notes || "Equipment requires manager review.",
      category: "EQUIPMENT",
      priority: values.priority || "HIGH",
      operationalImpact: values.operationalImpact || "HIGH",
      assignedTo: values.assignedTo || "Jordan Lee",
      relatedEquipmentId: equipment.id,
      source: { type: "EQUIPMENT", id: equipment.id }
    });
    updateEquipment(id, { status: "ATTENTION" });
    return issue;
  }

  window.EquipmentService = { getEquipment, getMaintenance, getEquipmentById, createEquipment, updateEquipment, createMaintenance, createIssue };
})();
