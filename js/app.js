/* ==========================================================================
   ICA Usage Tracker — App bootstrap
   ========================================================================== */

let passkeyContext = null; // "reminders" | "team_report"

function showToast(msg, type = "ok") {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, 3800);
}

/* ---------------- Navigation ---------------- */
function initNav() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
      if (view === "dashboard") renderDashboard();
      if (view === "report")    renderReport();
      if (view === "history")   renderHistory();
      if (view === "submit")    renderSubmitView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

/* ---------------- Passkey modal ---------------- */
function openPasskeyModal(context) {
  passkeyContext = context;
  const modal = document.getElementById("passkeyModal");
  const title = document.getElementById("pkTitle");
  const sub = document.getElementById("pkSub");
  document.getElementById("pkInput").value = "";
  document.getElementById("pkError").classList.remove("show");

  if (context === "team_report") {
    title.textContent = "Send team reports";
    sub.textContent = "Enter the passkey to export and email team-wise reports to managers.";
  } else {
    const notUsed = getNotUsedToday();
    title.textContent = "Send reminder emails";
    sub.textContent = `Enter the passkey to email ${notUsed.length} practitioner(s) who haven't used ICA today.`;
  }
  modal.classList.add("show");
  document.getElementById("pkInput").focus();
}

function closePasskeyModal() {
  document.getElementById("passkeyModal").classList.remove("show");
  passkeyContext = null;
}

function initPasskeyModal() {
  document.getElementById("pkCancel").addEventListener("click", closePasskeyModal);
  document.getElementById("pkConfirm").addEventListener("click", handlePasskeySubmit);
  document.getElementById("pkInput").addEventListener("keydown", e => { if (e.key === "Enter") handlePasskeySubmit(); });
}

function handlePasskeySubmit() {
  const val = document.getElementById("pkInput").value.trim();
  if (val !== CONFIG.PASSKEY) {
    document.getElementById("pkError").classList.add("show");
    return;
  }
  const ctx = passkeyContext;
  closePasskeyModal();
  if (ctx === "reminders") {
    sendReminders();
  } else if (ctx === "team_report") {
    exportTeamReports();
  }
}

/* ---------------- Upload flow (UI only — publishing is done via git) ---------------- */
function initUpload() {
  const dz = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");

  // The upload UI is decorative — data is published by editing tracker-data.js
  // in the repo and pushing. Dragging/clicking here does nothing on purpose.
  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("drag");
    // no-op — publishing happens via git, not the browser
  });
  fileInput.addEventListener("change", () => {
    fileInput.value = ""; // clear selection silently
  });
}

async function commitUpload() { /* no-op — data published via tracker-data.js */ }

function setUploadStatus(type, message) {
  const el = document.getElementById("uploadStatus");
  el.className = `upload-status show ${type}`;
  const icon = type === "ok" ? "✅" : type === "warn" ? "⚠️" : "⛔";
  el.innerHTML = `<span>${icon}</span><span>${message}</span>`;
}

function renderLastUploadInfo() {
  const meta = Storage.getLastUploadMeta();
  const el = document.getElementById("lastUploadInfo");
  if (!meta) { el.textContent = "No data loaded yet."; return; }
  const uploaded = new Date(meta.uploadedAt);
  el.innerHTML = `Last updated: <b>${meta.dateKey}</b> (source column "${escapeHTML(meta.sourceColumn || "")}") · ${uploaded.toLocaleString()}`;
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // Seed localStorage from data/tracker-data.js (the file you edit in GitHub).
  loadFromTrackerData();

  // Pull today's data from Google Sheets (if SHEETS_URL is configured).
  // This runs silently in the background and updates the dashboard once done.
  initSheets().then(() => {
    renderDashboard();
    renderReport();
  });

  initNav();
  initPasskeyModal();
  initUpload();
  initChatbot();

  renderDashboard();
  renderReport();
  renderHistory();
  renderLastUploadInfo();

  // Hide the cloud Refresh button (data comes from the script tag, not a server)
  const refreshBtn = document.getElementById("btnRefreshCloud");
  if (refreshBtn) refreshBtn.style.display = "none";
});
