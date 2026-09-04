const equipmentMetrics = document.getElementById("equipmentMetrics");
const equipmentList = document.getElementById("equipmentList");
const equipmentForm = document.getElementById("equipmentForm");
const maintenanceForm = document.getElementById("maintenanceForm");
const maintenanceEquipment = document.getElementById("maintenanceEquipment");

function renderEquipment() {
  const equipment = EquipmentService.getEquipment();
  const maintenance = EquipmentService.getMaintenance();
  equipmentMetrics.innerHTML = [
    ["Active Equipment", equipment.filter((item) => item.active !== false).length],
    ["Operational", equipment.filter((item) => item.status === "OPERATIONAL").length],
    ["Attention", equipment.filter((item) => item.status === "ATTENTION").length],
    ["Out of Service", equipment.filter((item) => item.status === "OUT_OF_SERVICE").length],
    ["Maintenance Records", maintenance.length]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  maintenanceEquipment.innerHTML = equipment.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  equipmentList.innerHTML = equipment.length ? equipment.map((item) => `<button class="inventory-row" data-equipment-id="${item.id}"><strong>${item.name}<small>${item.category} · ${item.location}</small></strong><span>${item.status.replaceAll("_", " ")}</span><span>${item.manufacturer || "Not provided"}</span><span>${item.model || "Not provided"}</span><span>${maintenance.filter((record) => record.equipmentId === item.id).length} maintenance</span></button>`).join("") : `<div class="empty-state"><p>No equipment has been added.</p></div>`;
  equipmentList.querySelectorAll("[data-equipment-id]").forEach((row) => row.onclick = () => {
    EquipmentService.createIssue(row.dataset.equipmentId);
    renderEquipment();
    showToast("Equipment issue created.");
  });
}

equipmentForm.onsubmit = (event) => {
  event.preventDefault();
  EquipmentService.createEquipment(Object.fromEntries(new FormData(equipmentForm)));
  equipmentForm.reset();
  renderEquipment();
  showToast("Equipment added.");
};

maintenanceForm.onsubmit = (event) => {
  event.preventDefault();
  EquipmentService.createMaintenance(Object.fromEntries(new FormData(maintenanceForm)));
  maintenanceForm.reset();
  renderEquipment();
  showToast("Maintenance saved.");
};

renderEquipment();
