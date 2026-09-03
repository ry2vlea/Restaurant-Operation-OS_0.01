(function () {
  const storageKey = "shifts";
  const types = ["OPENING", "MID_SHIFT", "CLOSING"];

  function today() { return new Date().toISOString().slice(0, 10); }
  function getShifts() {
    let shifts = [];
    try { shifts = JSON.parse(localStorage.getItem(storageKey)) || []; } catch (error) { shifts = []; }
    if (!Array.isArray(shifts)) shifts = [];
    const legacy = JSON.parse(localStorage.getItem("openingShift") || "null");
    if (legacy && !shifts.some((shift) => shift.type === "OPENING" && shift.date === (legacy.date || today()))) {
      shifts.push({ id: legacy.id || `SHIFT-${today().replaceAll("-", "")}-OPENING-001`, date: legacy.date || today(), type: "OPENING", manager: legacy.manager || "Jordan Lee", status: legacy.status || "IN_PROGRESS", overallStatus: "NORMAL", startedAt: legacy.startedAt || new Date().toISOString(), completedAt: legacy.completedAt || null, checklist: legacy.checklist || {}, notes: "", exceptions: [], createdAt: legacy.startedAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      localStorage.setItem(storageKey, JSON.stringify(shifts));
    }
    return shifts.filter((shift) => types.includes(shift.type));
  }
  function saveShifts(shifts) { localStorage.setItem(storageKey, JSON.stringify(shifts)); window.dispatchEvent(new CustomEvent("shifts:changed")); return shifts; }
  function getShiftById(id) { return getShifts().find((shift) => shift.id === id) || null; }
  function getTodayShift(type) { return getShifts().find((shift) => shift.type === type && shift.date === today()) || null; }
  function createShift(type, manager) {
    const now = new Date().toISOString();
    const prefix = `SHIFT-${today().replaceAll("-", "")}-${type}`;
    const count = getShifts().filter((shift) => shift.id?.startsWith(prefix)).length + 1;
    const shift = { id: `${prefix}-${String(count).padStart(3, "0")}`, date: today(), type, manager: manager || localStorage.getItem("currentManager") || "Jordan Lee", status: "IN_PROGRESS", overallStatus: "NORMAL", startedAt: now, completedAt: null, checklist: {}, notes: "", exceptions: [], createdAt: now, updatedAt: now };
    saveShifts([...getShifts(), shift]);
    return shift;
  }
  function startShift(type, manager) { return getTodayShift(type) || createShift(type, manager); }
  function updateShiftChecklist(id, checklist) { return updateShift(id, { checklist }); }
  function updateShift(id, changes) { const shifts = getShifts().map((shift) => shift.id === id ? { ...shift, ...changes, updatedAt: new Date().toISOString() } : shift); saveShifts(shifts); return getShiftById(id); }
  function calculateShiftProgress(shift, total) { const completed = Object.values(shift?.checklist || {}).filter(Boolean).length; return { completed, total, percentage: total ? Math.round(completed / total * 100) : 0 }; }
  function completeShift(id, exceptionNotes) { const status = exceptionNotes ? "COMPLETED_WITH_EXCEPTIONS" : "COMPLETED"; return updateShift(id, { status, overallStatus: exceptionNotes ? "ATTENTION" : "NORMAL", exceptions: exceptionNotes ? [exceptionNotes] : [], notes: exceptionNotes || "", completedAt: new Date().toISOString() }); }
  window.ShiftService = { getShifts, saveShifts, createShift, getShiftById, getTodayShift, startShift, updateShift, updateShiftChecklist, calculateShiftProgress, completeShift };
})();