(function () {
  const key = "sops";

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function write(values) {
    localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("sops:changed"));
    return values;
  }

  function nextId(values) {
    const highest = values.reduce((max, value) => {
      const match = /^SOP-(\d+)$/.exec(value.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `SOP-${String(highest + 1).padStart(6, "0")}`;
  }

  function getSops() { return read(); }
  function getSopById(id) { return getSops().find((sop) => sop.id === id) || null; }

  function createSop(values) {
    const now = new Date().toISOString();
    const sops = getSops();
    const sop = { id: nextId(sops), title: values.title, category: values.category || "Other", version: 1, status: values.status || "ACTIVE", content: values.content || "", tags: String(values.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean), relatedEquipmentIds: values.relatedEquipmentIds || [], relatedInventoryItemIds: values.relatedInventoryItemIds || [], createdBy: values.createdBy || localStorage.getItem("currentManager") || "Jordan Lee", createdAt: now, updatedAt: now };
    write([...sops, sop]);
    window.recordActivity?.({ action: "SOP_CREATED", entityType: "SOP", entityId: sop.id, description: `SOP created: ${sop.title}` });
    return sop;
  }

  function search(query = "", category = "") {
    const text = query.trim().toLowerCase();
    return getSops().filter((sop) => {
      const matchesText = !text || sop.title.toLowerCase().includes(text) || sop.content.toLowerCase().includes(text) || (sop.tags || []).some((tag) => tag.toLowerCase().includes(text));
      return matchesText && (!category || sop.category === category);
    }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  window.SopService = { getSops, getSopById, createSop, search };
})();
