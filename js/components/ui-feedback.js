(function () {
  function ensureToastRegion() {
    let region = document.getElementById("toastRegion");
    if (!region) {
      region = document.createElement("div");
      region.id = "toastRegion";
      region.className = "toast-region";
      document.body.appendChild(region);
    }
    return region;
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `<strong>${type === "success" ? "Saved" : type === "error" ? "Action needed" : "Notice"}</strong><span>${message}</span>`;
    ensureToastRegion().appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function showConfirm({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `<div class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle"><div class="modal-header"><div><p class="eyebrow">CONFIRMATION</p><h2 id="confirmTitle">${title}</h2></div><button class="icon-button" data-cancel aria-label="Close">×</button></div><p class="confirm-message">${message}</p><div class="modal-actions"><button class="secondary-button" data-cancel>${cancelLabel}</button><button class="${danger ? "danger-button" : "primary-button"}" data-confirm>${confirmLabel}</button></div></div>`;
      const previousFocus = document.activeElement;
      document.body.appendChild(backdrop);
      let finished = false;
      const finish = (value) => {
        if (finished) return;
        finished = true;
        document.removeEventListener("keydown", onKeydown);
        backdrop.remove();
        previousFocus?.focus();
        resolve(value);
      };
      backdrop.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", () => finish(false)));
      backdrop.querySelector("[data-confirm]").addEventListener("click", () => finish(true));
      backdrop.addEventListener("click", (event) => { if (event.target === backdrop) finish(false); });
      const onKeydown = (event) => {
        if (event.key === "Escape") finish(false);
        if (event.key === "Tab") {
          const focusable = [...backdrop.querySelectorAll("button")];
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener("keydown", onKeydown);
      backdrop.querySelector("[data-confirm]").focus();
    });
  }

  window.showToast = showToast;
  window.showConfirm = showConfirm;
})();
