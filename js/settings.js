const settings = SettingsService.getSettings();
const settingsForm = document.getElementById("settingsForm");
const backupOutput = document.getElementById("backupOutput");
const restoreInput = document.getElementById("restoreInput");

settingsForm.restaurantName.value = settings.profile.restaurantName;
settingsForm.locationName.value = settings.profile.locationName;
settingsForm.address.value = settings.profile.address;
settingsForm.phone.value = settings.profile.phone;
settingsForm.operatingHours.value = settings.profile.operatingHours;
settingsForm.foodCostPercent.value = settings.targets.foodCostPercent;
settingsForm.laborPercent.value = settings.targets.laborPercent;
settingsForm.wasteAlertThreshold.value = settings.targets.wasteAlertThreshold;
settingsForm.varianceAlertThreshold.value = settings.targets.varianceAlertThreshold;

settingsForm.onsubmit = (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(settingsForm));
  SettingsService.saveSettings({
    profile: { restaurantName: values.restaurantName, locationName: values.locationName, address: values.address, phone: values.phone, operatingHours: values.operatingHours },
    targets: { foodCostPercent: Number(values.foodCostPercent), laborPercent: Number(values.laborPercent), wasteAlertThreshold: Number(values.wasteAlertThreshold), varianceAlertThreshold: Number(values.varianceAlertThreshold) }
  });
  showToast("Settings saved.");
};

document.getElementById("exportBackup").onclick = () => {
  backupOutput.value = JSON.stringify(SettingsService.exportBackup(), null, 2);
  showToast("Backup exported.");
};

document.getElementById("restoreBackup").onclick = async () => {
  try {
    const backup = JSON.parse(restoreInput.value);
    if (!SettingsService.validateBackup(backup)) throw new Error("Invalid Restaurant OS backup.");
    const keys = Object.keys(backup.data || {}).join(", ");
    const confirmed = await showConfirm({ title: "Restore Backup?", message: `Restore backup with these keys: ${keys}. Current data will change.`, confirmLabel: "Restore", danger: true });
    if (!confirmed) return;
    SettingsService.restoreBackup(backup);
    showToast("Backup restored.");
  } catch (error) {
    showToast(error.message, "error");
  }
};
