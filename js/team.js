const teamMetrics = document.getElementById("teamMetrics");
const teamForm = document.getElementById("teamForm");
const teamList = document.getElementById("teamList");
const skillMatrix = document.getElementById("skillMatrix");
const skills = SettingsService.getSettings().trainingSkills;

function renderTeam() {
  const summary = TeamService.summary();
  const members = TeamService.getMembers();
  const training = TeamService.getTraining();
  teamMetrics.innerHTML = [
    ["Active Employees", summary.activeEmployees],
    ["Managers", summary.managers],
    ["Training Needed", summary.trainingNeeded],
    ["Multi-Skilled", summary.multiSkilled]
  ].map(([label, value]) => `<article class="metric-card"><p>${label}</p><h2>${value}</h2></article>`).join("");
  teamList.innerHTML = members.length ? members.map((member) => `<div class="inventory-row"><strong>${member.name}<small>${member.role}</small></strong><span>${member.status}</span><span>${(member.positions || []).join(", ") || "No positions"}</span><span>${member.phone || "No phone"}</span></div>`).join("") : `<div class="empty-state"><p>No team members yet.</p></div>`;
  skillMatrix.innerHTML = members.length ? `<div class="skill-grid"><strong>Team Member</strong>${skills.map((skill) => `<strong>${skill}</strong>`).join("")}${members.map((member) => `<span>${member.name}</span>${skills.map((skill) => {
    const status = training.find((record) => record.memberId === member.id && record.skill === skill)?.status || "NOT_TRAINED";
    return `<button class="skill-cell ${status.toLowerCase()}" data-member="${member.id}" data-skill="${skill}">${status.replaceAll("_", " ")}</button>`;
  }).join("")}`).join("")}</div>` : `<div class="empty-state"><p>Add team members to build the skill matrix.</p></div>`;
  skillMatrix.querySelectorAll("[data-member]").forEach((button) => button.onclick = () => {
    const order = ["NOT_TRAINED", "TRAINING", "QUALIFIED", "TRAINER"];
    const current = order.find((value) => button.textContent.replaceAll(" ", "_") === value) || "NOT_TRAINED";
    TeamService.saveSkill(button.dataset.member, button.dataset.skill, order[(order.indexOf(current) + 1) % order.length]);
    renderTeam();
  });
}

teamForm.onsubmit = (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(teamForm));
  values.positions = values.positions.split(",").map((item) => item.trim()).filter(Boolean);
  TeamService.createMember(values);
  teamForm.reset();
  renderTeam();
  showToast("Team member added.");
};

renderTeam();
