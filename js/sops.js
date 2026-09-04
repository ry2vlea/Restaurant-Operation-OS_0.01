const sopSearch = document.getElementById("sopSearch");
const sopCategory = document.getElementById("sopCategory");
const sopForm = document.getElementById("sopForm");
const sopList = document.getElementById("sopList");

function renderSops() {
  const categories = SettingsService.getSettings().sopCategories;
  sopCategory.innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option>${category}</option>`).join("")}`;
  const rows = SopService.search(sopSearch.value, sopCategory.value);
  sopList.innerHTML = rows.length ? rows.map((sop) => `<button class="inventory-row" data-sop-id="${sop.id}"><strong>${sop.title}<small>${(sop.tags || []).join(", ") || "No tags"}</small></strong><span>${sop.category}</span><span>v${sop.version}</span><span>${sop.status}</span><span>${new Date(sop.updatedAt).toLocaleDateString()}</span></button>`).join("") : `<div class="empty-state"><p>No SOPs found.</p></div>`;
  sopList.querySelectorAll("[data-sop-id]").forEach((button) => button.onclick = () => location.href = `sop-detail.html?id=${button.dataset.sopId}`);
}

sopForm.onsubmit = (event) => {
  event.preventDefault();
  SopService.createSop(Object.fromEntries(new FormData(sopForm)));
  sopForm.reset();
  renderSops();
  showToast("SOP saved.");
};
sopSearch.addEventListener("input", renderSops);
sopCategory.addEventListener("input", renderSops);
renderSops();
