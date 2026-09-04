(function () {
  const storageKey = "ros:selectedDateRange";
  const presets = {
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    last7Days: "Last 7 Days",
    custom: "Custom Range"
  };

  let state = readRange() || presetRange("today");
  let root = null;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseDateOnly(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function formatDateOnly(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(value, days) {
    const date = parseDateOnly(value);
    if (!date) return value;
    date.setDate(date.getDate() + days);
    return formatDateOnly(date);
  }

  function daysBetween(startDate, endDate) {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end) return 1;
    return Math.round((end - start) / 86400000) + 1;
  }

  function todayString() {
    return formatDateOnly(new Date());
  }

  function presetRange(preset) {
    const today = parseDateOnly(todayString());
    if (preset === "yesterday") {
      const date = new Date(today);
      date.setDate(date.getDate() - 1);
      const value = formatDateOnly(date);
      return { startDate: value, endDate: value, preset };
    }
    if (preset === "thisWeek") {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { startDate: formatDateOnly(start), endDate: formatDateOnly(today), preset };
    }
    if (preset === "last7Days") {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { startDate: formatDateOnly(start), endDate: formatDateOnly(today), preset };
    }
    const value = formatDateOnly(today);
    return { startDate: value, endDate: value, preset: "today" };
  }

  function readRange() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (!value?.startDate || !value?.endDate) return null;
      if (!parseDateOnly(value.startDate) || !parseDateOnly(value.endDate)) return null;
      return normalizeRange(value.startDate, value.endDate, value.preset || "custom");
    } catch (error) {
      return null;
    }
  }

  function normalizeRange(startDate, endDate, preset) {
    if (startDate > endDate) return { startDate: endDate, endDate: startDate, preset };
    return { startDate, endDate, preset };
  }

  function saveRange(range) {
    state = normalizeRange(range.startDate, range.endDate, range.preset || "custom");
    localStorage.setItem(storageKey, JSON.stringify(state));
    return state;
  }

  function displayDate(value) {
    const date = parseDateOnly(value);
    if (!date) return value;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function rangeLabel() {
    const label = presets[state.preset] || presets.custom;
    const dates = state.startDate === state.endDate
      ? displayDate(state.startDate)
      : `${displayDate(state.startDate)} - ${displayDate(state.endDate)}`;
    return `${label} - ${dates}`;
  }

  function canMoveNext(nextRange) {
    return nextRange.endDate <= todayString();
  }

  function emitChange() {
    document.dispatchEvent(new CustomEvent("ros:datechange", { detail: { ...state } }));
  }

  function updateControls() {
    if (!root) return;
    const preset = root.querySelector("#appHeaderPreset");
    const start = root.querySelector("#appHeaderStartDate");
    const end = root.querySelector("#appHeaderEndDate");
    const label = root.querySelector("#appHeaderRangeLabel");
    const custom = root.querySelector("[data-app-header-custom]");
    const next = root.querySelector("[data-app-header-next]");
    if (preset) preset.value = state.preset;
    if (start) start.value = state.startDate;
    if (end) end.value = state.endDate;
    if (label) label.textContent = rangeLabel();
    if (custom) custom.hidden = state.preset !== "custom";
    if (next) {
      const length = daysBetween(state.startDate, state.endDate);
      next.disabled = !canMoveNext({ startDate: addDays(state.startDate, length), endDate: addDays(state.endDate, length) });
    }
  }

  function setRange(startDate, endDate, preset = "custom") {
    if (!parseDateOnly(startDate) || !parseDateOnly(endDate)) return getRange();
    saveRange({ startDate, endDate, preset });
    updateControls();
    emitChange();
    return getRange();
  }

  function moveRange(direction) {
    const length = daysBetween(state.startDate, state.endDate);
    const offset = direction === "next" ? length : -length;
    const nextRange = {
      startDate: addDays(state.startDate, offset),
      endDate: addDays(state.endDate, offset),
      preset: state.preset
    };
    if (direction === "next" && !canMoveNext(nextRange)) return;
    setRange(nextRange.startDate, nextRange.endDate, nextRange.preset);
  }

  function handlePresetChange(event) {
    const preset = event.target.value;
    if (preset === "custom") {
      setRange(state.startDate, state.endDate, "custom");
      return;
    }
    const range = presetRange(preset);
    setRange(range.startDate, range.endDate, range.preset);
  }

  function handleCustomChange() {
    const start = root.querySelector("#appHeaderStartDate")?.value;
    const end = root.querySelector("#appHeaderEndDate")?.value;
    if (!parseDateOnly(start) || !parseDateOnly(end)) return;
    setRange(start, end, "custom");
  }

  function actionHtml(options) {
    const actions = [];
    if (options.backHref) {
      actions.push(`<button class="back-button" type="button" data-app-header-back>${options.backLabel ? "&larr; " + options.backLabel : "&larr; Back"}</button>`);
    }
    const template = document.getElementById("appHeaderActions");
    if (template) actions.push(template.innerHTML.trim());
    return actions.join("");
  }

  function dateSelectorHtml() {
    return `
      <div class="app-date-selector" aria-label="Selected reporting period">
        <button class="date-step-button" type="button" data-app-header-prev aria-label="Previous period">&lsaquo;</button>
        <div class="date-selector-main">
          <span id="appHeaderRangeLabel">${rangeLabel()}</span>
          <select id="appHeaderPreset" aria-label="Date range preset">
            ${Object.entries(presets).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
          </select>
        </div>
        <button class="date-step-button" type="button" data-app-header-next aria-label="Next period">&rsaquo;</button>
        <div class="date-custom-fields" data-app-header-custom hidden>
          <label>Start Date<input id="appHeaderStartDate" type="date"></label>
          <label>End Date<input id="appHeaderEndDate" type="date"></label>
        </div>
      </div>
    `;
  }

  function bind(options) {
    root.querySelector("[data-app-header-back]")?.addEventListener("click", () => {
      window.location.href = options.backHref;
    });
    root.querySelector("[data-app-header-prev]")?.addEventListener("click", () => moveRange("prev"));
    root.querySelector("[data-app-header-next]")?.addEventListener("click", () => moveRange("next"));
    root.querySelector("#appHeaderPreset")?.addEventListener("change", handlePresetChange);
    root.querySelector("#appHeaderStartDate")?.addEventListener("change", handleCustomChange);
    root.querySelector("#appHeaderEndDate")?.addEventListener("change", handleCustomChange);
  }

  function init(options = {}) {
    root = document.getElementById("appHeader");
    if (!root) {
      console.warn("AppHeader: #appHeader was not found.");
      return;
    }
    const title = options.title || document.title || "Restaurant Operations OS";
    root.innerHTML = `
      <header class="app-header">
        <div class="app-header-copy">
          ${options.section ? `<p class="eyebrow">${options.section}</p>` : ""}
          <h1>${title}</h1>
          ${options.description ? `<p>${options.description}</p>` : ""}
        </div>
        <div class="app-header-controls">
          ${options.showDateSelector ? dateSelectorHtml() : ""}
          <div class="app-header-actions">${actionHtml(options)}</div>
        </div>
      </header>
    `;
    bind(options);
    updateControls();
  }

  function getRange() {
    return { ...state };
  }

  window.AppHeader = { init, getRange, setRange };
})();
