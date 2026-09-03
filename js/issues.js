(function () {
  const storageKey = "issues";
  const openStatuses = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING"];

  function getIssues() {
    try {
      const storedIssues = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(storedIssues) ? storedIssues : [];
    } catch (error) {
      return [];
    }
  }

  function saveIssues(issues) {
    localStorage.setItem(storageKey, JSON.stringify(issues));
    window.dispatchEvent(new CustomEvent("issues:changed"));
    return issues;
  }

  function nextIssueId() {
    const highestNumber = getIssues().reduce((highest, issue) => {
      const match = /^ISS-(\d+)$/.exec(issue.id || "");
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);

    return `ISS-${String(highestNumber + 1).padStart(6, "0")}`;
  }

  function createIssue(values) {
    const now = new Date().toISOString();
    const issue = {
      id: nextIssueId(),
      category: values.category || "OTHER",
      title: values.title,
      description: values.description,
      priority: values.priority || "MEDIUM",
      operationalImpact: values.operationalImpact || "MODERATE",
      status: "OPEN",
      reportedBy: values.reportedBy || localStorage.getItem("currentManager") || "Jordan Lee",
      assignedTo: values.assignedTo || "Jordan Lee",
      immediateAction: values.immediateAction || "",
      source: values.source || null,
      relatedEquipmentId: values.relatedEquipmentId || null,
      relatedInventoryItemId: values.relatedInventoryItemId || null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      closedAt: null,
      resolution: ""
    };

    saveIssues([...getIssues(), issue]);
    return issue;
  }

  function getIssueById(id) {
    return getIssues().find((issue) => issue.id === id) || null;
  }

  function updateIssue(id, changes) {
    const now = new Date().toISOString();
    const updatedIssues = getIssues().map((issue) =>
      issue.id === id ? { ...issue, ...changes, updatedAt: now } : issue
    );
    saveIssues(updatedIssues);
    return getIssueById(id);
  }

  function getOpenIssues() {
    return getIssues().filter((issue) => openStatuses.includes(issue.status));
  }

  function resolveIssue(id, resolution) {
    if (!resolution || !resolution.trim()) {
      throw new Error("A resolution note is required.");
    }
    const now = new Date().toISOString();
    return updateIssue(id, { status: "RESOLVED", resolution: resolution.trim(), resolvedAt: now });
  }

  function closeIssue(id) {
    const now = new Date().toISOString();
    return updateIssue(id, { status: "CLOSED", closedAt: now });
  }

  window.IssueService = {
    getIssues,
    saveIssues,
    createIssue,
    getIssueById,
    updateIssue,
    getOpenIssues,
    resolveIssue,
    closeIssue
  };
})();