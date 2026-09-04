const activityList = document.getElementById("activityList");
const activitySearch = document.getElementById("activitySearch");

function renderActivity() {
  const query = activitySearch.value.trim().toLowerCase();
  const records = ActivityService.getActivity().filter((record) => !query || [record.action, record.entityType, record.entityId, record.description, record.actor].join(" ").toLowerCase().includes(query)).slice(0, 100);
  activityList.innerHTML = records.length ? records.map((record) => `<div class="movement-row"><span>${new Date(record.timestamp).toLocaleString()}</span><strong>${record.action}<small>${record.entityType} ${record.entityId}${record.derived ? " · Derived" : ""}</small></strong><span>${record.description}</span><small>${record.actor || "System"}</small></div>`).join("") : `<div class="empty-state"><p>No activity found.</p></div>`;
}

activitySearch.addEventListener("input", renderActivity);
renderActivity();
