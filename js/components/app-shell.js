(function () {
  const groups = [
    ['COMMAND CENTER', [['Dashboard', 'index.html']]],
    ['OPERATIONS', [['Shifts', 'opening.html'], ['Tasks', 'tasks.html'], ['Issues', 'issues.html'], ['History', 'history.html']]],
    ['INVENTORY', [['Inventory', 'inventory.html'], ['Counts', 'inventory-count.html'], ['Receiving', 'receiving.html'], ['Purchasing', 'purchasing.html'], ['Waste', 'waste.html'], ['Variance', 'inventory-variance.html'], ['Recipes', 'recipes.html'], ['Menu', 'menu.html'], ['Production', 'production.html'], ['Cost Analysis', 'menu-analysis.html']]],
    ['PERFORMANCE', [['Sales', 'sales.html'], ['Daily Report', 'daily-report.html'], ['Business Performance', 'business-performance.html'], ['Food Cost', 'food-cost.html']]],
    ['RESTAURANT', [['Equipment', 'equipment.html'], ['Team', 'team.html'], ['SOP Library', 'sops.html']]],
    ['SYSTEM', [['Activity Log', 'activity.html'], ['Settings', 'settings.html']]]
  ];
  const page = location.pathname.split('/').pop() || 'index.html';
  const parents = { 'mid-shift.html': 'opening.html', 'closing.html': 'opening.html', 'handover.html': 'opening.html', 'recipe-builder.html': 'recipes.html', 'recipe-details.html': 'recipes.html', 'purchase-order.html': 'purchasing.html', 'maintenance.html': 'equipment.html', 'sop-detail.html': 'sops.html' };
  const active = parents[page] || page;
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = '<div class="brand"><h2>Restaurant OS</h2><p>Harbor Grill</p></div><nav aria-label="Restaurant sections">' + groups.map(([title, links]) => `<p class="nav-section">${title}</p>${links.map(([label, href]) => `<a class="nav-item${active === href ? ' active' : ''}" href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}`).join('') + '</nav>';
  const selected = sidebar.querySelector('[aria-current]');
  if (matchMedia('(max-width: 700px)').matches && selected) sidebar.querySelector('nav').scrollLeft = selected.offsetLeft - 16;
})();
