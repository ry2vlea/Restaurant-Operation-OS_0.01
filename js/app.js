(function () {
  const $ = id => document.getElementById(id), esc = RecipeUI.escape, money = RecipeUI.money;
  const manager = $('managerSelect');
  let expanded = false;
  manager.innerHTML = TeamService.managerNames().map(name => `<option>${esc(name)}</option>`).join('');
  const saved = localStorage.getItem('currentManager');
  if ([...manager.options].some(option => option.value === saved)) manager.value = saved;
  manager.addEventListener('change', () => { localStorage.setItem('currentManager', manager.value); renderLive(); });
  function renderKPIs() {
    const { startDate, endDate } = AppHeader.getRange();
    const metrics = SalesService.calculateMetrics(startDate, endDate), recorded = SalesService.getRecordingStatus(startDate, endDate), labor = BusinessPerformanceService.getLaborSummary(startDate, endDate);
    $('dashboardRange').textContent = startDate === endDate ? startDate : `${startDate} — ${endDate}`;
    const cards = [
      ['Net Sales', recorded.salesRecorded ? money(metrics.netSales) : 'Not recorded', 'Recorded sales for this period', 'sales.html'],
      ['Transactions', recorded.transactionsRecorded ? metrics.transactions.toLocaleString() : 'Not recorded', 'From daily sales summaries', 'sales.html'],
      ['Food Cost', recorded.costsRecorded && metrics.netSales > 0 ? `${metrics.theoreticalFoodCostPercent.toFixed(1)}%` : 'Not recorded', 'Theoretical cost at time of sale', 'food-cost.html'],
      ['Labor', labor.recorded ? labor.laborPercent == null ? money(labor.laborDollars) : `${labor.laborPercent.toFixed(1)}%` : 'Not recorded', labor.recorded ? `${money(labor.laborDollars)} recorded labor` : 'Add labor in Business Performance', 'business-performance.html']
    ];
    $('dashboardKPIs').innerHTML = cards.map(([title, value, note, href]) => `<a class="metric-card dashboard-kpi" href="${href}"><p>${title}</p><h2>${value}</h2><span>${note}</span></a>`).join('');
  }
  const row = (label, value, href) => `<a class="dashboard-row" href="${href}"><span>${esc(label)}</span><strong>${esc(value)} <span aria-hidden="true">→</span></strong></a>`;
  function renderLive() {
    $('liveDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const balances = InventoryService.getAllInventoryBalances().map(entry => ({ ...entry, status: InventoryService.getStockStatus(entry.item, entry.quantity) }));
    const overdue = TaskService.getOverdueTasks(), pending = TaskService.getPendingTasks(), issues = IssueService.getOpenIssues();
    const alerts = [
      ...issues.map(issue => ({ type: issue.priority, title: issue.title, detail: issue.assignedTo || 'Unassigned', href: 'issues.html', rank: issue.priority === 'CRITICAL' ? 0 : 2 })),
      ...overdue.map(task => ({ type: 'OVERDUE', title: task.title, detail: `${task.assignedTo || 'Unassigned'} · ${task.dueDate}`, href: 'tasks.html', rank: 1 })),
      ...balances.filter(entry => ['CRITICAL', 'OUT_OF_STOCK'].includes(entry.status)).map(entry => ({ type: entry.status, title: entry.item.name, detail: `${entry.quantity} ${InventoryService.getUnitById(entry.item.baseUnitId)?.abbreviation || ''} on hand`, href: 'inventory.html', rank: 1 })),
      ...EquipmentService.getEquipment().filter(item => ['ATTENTION', 'OUT_OF_SERVICE'].includes(item.status)).map(item => ({ type: item.status, title: item.name, detail: 'Equipment follow-up', href: 'equipment.html', rank: 2 })),
      ...HandoverService.getPendingHandovers().map(item => ({ type: 'HANDOVER', title: `${item.fromShiftType.replaceAll('_', ' ')} → ${item.toShiftType.replaceAll('_', ' ')}`, detail: item.nextPriority || 'Review pending handover', href: `handover.html?id=${encodeURIComponent(item.id)}&review=true`, rank: 1 }))
    ];
    const variance = VarianceService.calculateLatest();
    if (variance?.totals?.significantExceptions) alerts.push({ type: 'VARIANCE', title: 'Inventory variance needs review', detail: `${money(variance.totals.netVariance)} net variance`, href: 'inventory-variance.html', rank: 2 });
    alerts.sort((a, b) => a.rank - b.rank);
    $('attentionCount').textContent = `(${alerts.length})`;
    $('attentionViewAll').hidden = alerts.length <= 4;
    $('attentionViewAll').textContent = expanded ? 'Show Less' : 'Show All';
    $('attentionViewAll').setAttribute('aria-expanded', String(expanded));
    $('attentionList').innerHTML = alerts.length ? (expanded ? alerts : alerts.slice(0, 4)).map(item => `<a class="attention-item" href="${item.href}"><span class="attention-label">${esc(item.type.replaceAll('_', ' '))}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><span class="attention-arrow">→</span></a>`).join('') : '<div class="attention-empty"><strong>All clear</strong><span>No urgent follow-up in your recorded operations.</span></div>';
    const counts = InventoryService.getCounts().filter(count => count.status === 'COMPLETED').sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    $('inventoryWatch').innerHTML = row('Out of stock', balances.filter(e => e.status === 'OUT_OF_STOCK').length, 'inventory.html') + row('Critical / low stock', balances.filter(e => ['CRITICAL', 'LOW'].includes(e.status)).length, 'inventory.html') + row('Open purchase orders', PurchasingService.getPurchaseOrders().filter(order => !['RECEIVED', 'CANCELLED'].includes(order.status)).length, 'purchasing.html') + row('Last completed count', counts[0]?.date || 'Not recorded', 'inventory-count.html');
    $('teamWatch').innerHTML = row('Manager on duty', manager.value || 'Not assigned', 'team.html') + row('Pending tasks', pending.length, 'tasks.html') + row('Overdue tasks', overdue.length, 'tasks.html') + row('Open issues', issues.length, 'issues.html');
    const report = DailyReportService.getReport();
    $('reportStatus').textContent = `Today's report: ${report ? report.status.replaceAll('_', ' ') : 'Not started'}`;
    renderShifts();
  }
  function renderShifts() {
    for (const [id, type, title, href] of [['openingShiftCard', 'OPENING', 'Opening', 'opening.html'], ['midShiftCard', 'MID_SHIFT', 'Mid-Shift', 'mid-shift.html'], ['closingShiftCard', 'CLOSING', 'Closing', 'closing.html']]) {
      const card = $(id), shift = ShiftService.getTodayShift(type);
      const progress = shift ? ShiftService.calculateShiftProgress(shift, Number(card.dataset.total)) : { completed: 0, total: Number(card.dataset.total), percentage: 0 };
      const complete = shift?.status.startsWith('COMPLETED');
      card.innerHTML = `<div class="card-top"><h3>${title}</h3><span class="status ${complete ? 'good' : 'neutral'}">${esc(shift?.status.replaceAll('_', ' ') || 'NOT STARTED')}</span></div><p>${esc(shift?.manager || 'Manager not assigned')}</p><div class="progress"><div class="progress-bar" style="width:${progress.percentage}%"></div></div><div class="dashboard-shift-bottom"><small>${progress.completed} / ${progress.total} complete</small><button class="secondary-button">${shift ? complete ? 'View' : 'Resume' : 'Start'} →</button></div>`;
      card.querySelector('button').onclick = async () => {
        if (!shift) {
          const previous = ShiftService.getTodayShift(type === 'MID_SHIFT' ? 'OPENING' : type === 'CLOSING' ? 'MID_SHIFT' : 'NONE');
          if (previous && !previous.status.startsWith('COMPLETED') && !await showConfirm({ title: 'Previous shift is still active', message: 'Start this shift with an exception?', confirmLabel: 'Start Anyway' })) return;
          ShiftService.startShift(type, manager.value);
        }
        location.href = href;
      };
    }
  }
  $('attentionViewAll').onclick = () => { expanded = !expanded; renderLive(); };
  $('sampleDataButton').onclick = () => { const result = SampleDataService.load(); render(); showToast(`Sample data loaded: ${result.items} items, ${result.recipes} recipes, ${result.menuItems} menu items.`); };
  function render() { renderKPIs(); renderLive(); }
  let queued = false;
  function refresh() { if (queued) return; queued = true; queueMicrotask(() => { queued = false; render(); }); }
  document.addEventListener('ros:datechange', renderKPIs);
  for (const event of ['sales:changed', 'business-performance:changed', 'inventory:changed', 'recipes:changed', 'menu:changed', 'issues:changed', 'tasks:changed', 'shifts:changed', 'handovers:changed', 'purchasing:changed', 'equipment:changed', 'storage']) window.addEventListener(event, refresh);
  render();
})();
