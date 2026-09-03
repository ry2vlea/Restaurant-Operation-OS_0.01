(function () {
  const storageKey = "handovers";

  function getHandovers() {
    try {
      const handovers = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(handovers) ? handovers : [];
    } catch (error) { return []; }
  }

  function saveHandovers(handovers) {
    localStorage.setItem(storageKey, JSON.stringify(handovers));
    window.dispatchEvent(new CustomEvent("handovers:changed"));
    return handovers;
  }

  function nextHandoverId() {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const prefix = `HO-${date}-`;
    const highest = getHandovers().reduce((value, handover) => {
      const match = new RegExp(`^${prefix}(\\d+)$`).exec(handover.id || "");
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  }

  function getHandoverForShift(fromShiftId, toShiftType) {
    return getHandovers().find((handover) => handover.fromShiftId === fromShiftId && handover.toShiftType === toShiftType) || null;
  }

  function createHandover(values) {
    const existing = getHandoverForShift(values.fromShiftId, values.toShiftType);
    if (existing) return existing;
    const now = new Date().toISOString();
    const handover = {
      id: nextHandoverId(), date: now.slice(0, 10), fromShiftId: values.fromShiftId,
      fromShiftType: values.fromShiftType, toShiftType: values.toShiftType,
      fromManager: values.fromManager, toManager: null, status: "DRAFT",
      staffingNotes: "", productNotes: "", equipmentNotes: "", guestNotes: "", operationalNotes: "",
      nextPriority: "", selectedIssueIds: [], selectedTaskIds: [], createdAt: now, updatedAt: now, acceptedAt: null
    };
    saveHandovers([...getHandovers(), handover]);
    return handover;
  }

  function updateHandover(id, changes) {
    const handovers = getHandovers().map((handover) => handover.id === id ? { ...handover, ...changes, updatedAt: new Date().toISOString() } : handover);
    saveHandovers(handovers);
    return getHandoverById(id);
  }

  function getHandoverById(id) { return getHandovers().find((handover) => handover.id === id) || null; }
  function getPendingHandovers() { return getHandovers().filter((handover) => handover.status === "READY"); }
  function acceptHandover(id, toManager) { return updateHandover(id, { status: "ACCEPTED", toManager, acceptedAt: new Date().toISOString() }); }

  window.HandoverService = { getHandovers, saveHandovers, createHandover, updateHandover, getHandoverById, getHandoverForShift, getPendingHandovers, acceptHandover };
})();