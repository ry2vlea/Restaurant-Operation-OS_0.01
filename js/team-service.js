(function () {
  const memberKey = "teamMembers";
  const trainingKey = "trainingRecords";

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
    window.dispatchEvent(new CustomEvent("team:changed"));
    return values;
  }

  function nextId(prefix, values) {
    const highest = values.reduce((max, value) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.id || "");
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(6, "0")}`;
  }

  function getMembers() { return read(memberKey); }
  function getTraining() { return read(trainingKey); }

  function createMember(values) {
    const now = new Date().toISOString();
    const member = { id: nextId("EMP", getMembers()), name: values.name, role: values.role || "", status: values.status || "ACTIVE", positions: values.positions || [], hireDate: values.hireDate || null, phone: values.phone || "", email: values.email || "", notes: values.notes || "", createdAt: now, updatedAt: now };
    write(memberKey, [...getMembers(), member]);
    window.recordActivity?.({ action: "TEAM_MEMBER_CREATED", entityType: "TEAM_MEMBER", entityId: member.id, description: `Team member added: ${member.name}` });
    return member;
  }

  function saveSkill(memberId, skill, status) {
    const records = getTraining();
    const existing = records.find((record) => record.memberId === memberId && record.skill === skill);
    const record = { ...(existing || { id: nextId("TRN", records), memberId, skill, createdAt: new Date().toISOString() }), status, updatedAt: new Date().toISOString() };
    write(trainingKey, existing ? records.map((value) => value.id === record.id ? record : value) : [...records, record]);
    return record;
  }

  function managerNames() {
    const managers = getMembers().filter((member) => member.status === "ACTIVE" && (member.role === "Manager" || member.positions?.includes("Manager"))).map((member) => member.name);
    return managers.length ? managers : ["Jordan Lee", "Alex Rivera", "Mia Torres"];
  }

  function summary() {
    const members = getMembers();
    const training = getTraining();
    const active = members.filter((member) => member.status === "ACTIVE");
    return {
      activeEmployees: active.length,
      managers: active.filter((member) => member.role === "Manager" || member.positions?.includes("Manager")).length,
      trainingNeeded: training.filter((record) => ["NOT_TRAINED", "TRAINING"].includes(record.status)).length,
      multiSkilled: active.filter((member) => (member.positions || []).length >= 3).length
    };
  }

  window.TeamService = { getMembers, getTraining, createMember, saveSkill, managerNames, summary };
})();
