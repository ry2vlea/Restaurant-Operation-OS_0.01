const params = new URLSearchParams(location.search);
const sop = SopService.getSopById(params.get("id"));
document.getElementById("sopDetail").innerHTML = sop ? `
  <section class="report-hero"><div><p class="report-eyebrow">${sop.category}</p><h2>${sop.title}</h2><p>Version ${sop.version} · ${sop.status} · Updated ${new Date(sop.updatedAt).toLocaleDateString()}</p></div></section>
  <section class="recipe-panel sop-content">${sop.content.split("\n").map((line) => `<p>${line || "&nbsp;"}</p>`).join("")}</section>
  <section class="recipe-panel"><h2>Tags</h2><p>${(sop.tags || []).join(", ") || "No tags"}</p></section>` :
  `<div class="empty-state"><h3>SOP not found</h3><p>The requested knowledge record is unavailable.</p></div>`;
