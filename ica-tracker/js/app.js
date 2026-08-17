/* ==========================================================================
   ICA Usage Tracker — App bootstrap
   ========================================================================== */

let pendingUploadBuffer = null;
let pendingUploadFileName = null;
let passkeyContext = null; // "upload" | "reminders"

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
      if (view === "report") renderReport();
      if (view === "history") renderHistory();
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

  if (context === "upload") {
    title.textContent = "Confirm upload";
    sub.textContent = "Enter the passkey to publish this workbook as today's data.";
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
  if (ctx === "upload") {
    commitUpload();
  } else if (ctx === "reminders") {
    sendReminders();
  }
}

/* ---------------- Upload flow ---------------- */
function initUpload() {
  const dz = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");

  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("drag");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", e => { if (e.target.files.length) handleFile(e.target.files[0]); });
}

function handleFile(file) {
  if (typeof XLSX === "undefined") {
    setUploadStatus("err", "The spreadsheet engine failed to load (js/vendor/xlsx.full.min.js). Make sure that file was uploaded along with the rest of the site, then refresh and try again.");
    showToast("Spreadsheet engine not loaded — see the Upload section for details.", "err");
    return;
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    setUploadStatus("err", "Please upload a .xlsx or .xls workbook.");
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    pendingUploadBuffer = e.target.result;
    pendingUploadFileName = file.name;
    openPasskeyModal("upload");
  };
  reader.onerror = () => setUploadStatus("err", "Could not read the file. Please try again.");
  reader.readAsArrayBuffer(file);
}

function commitUpload() {
  if (!pendingUploadBuffer) return;
  try {
    const result = parseWorkbook(pendingUploadBuffer);
    const fteTotal = result.records.reduce((sum, r) => sum + (r.fte || 0), 0);
    Storage.saveDay(result.dateKey, result.records, { sourceColumn: result.headerLabel, fte_total: fteTotal });

    if (result.warning) {
      setUploadStatus("warn", result.warning);
    } else {
      setUploadStatus("ok", `Loaded usage for ${result.headerLabel} — ${result.records.filter(r => r.used).length} of ${result.records.length} practitioners used ICA. Dashboard and report updated.`);
    }
    renderLastUploadInfo();
    showToast("Workbook published successfully.", "ok");
  } catch (err) {
    console.error(err);
    const msg = err.message || "Something went wrong while reading this workbook.";
    setUploadStatus("err", msg);
    showToast("Upload failed: " + msg, "err");
  } finally {
    pendingUploadBuffer = null;
  }
}

function setUploadStatus(type, message) {
  const el = document.getElementById("uploadStatus");
  el.className = `upload-status show ${type}`;
  const icon = type === "ok" ? "✅" : type === "warn" ? "⚠️" : "⛔";
  el.innerHTML = `<span>${icon}</span><span>${message}</span>`;
}

function renderLastUploadInfo() {
  const meta = Storage.getLastUploadMeta();
  const el = document.getElementById("lastUploadInfo");
  if (!meta) { el.textContent = "No workbook uploaded yet."; return; }
  const uploaded = new Date(meta.uploadedAt);
  el.innerHTML = `Last published: <b>${meta.dateKey}</b> (source column "${escapeHTML(meta.sourceColumn || "")}") · uploaded ${uploaded.toLocaleString()}`;
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initPasskeyModal();
  initUpload();
  initChatbot();
  renderDashboard();
  renderReport();
  renderHistory();
  renderLastUploadInfo();

  if (typeof XLSX === "undefined") {
    setUploadStatus("err", "The spreadsheet engine (js/vendor/xlsx.full.min.js) did not load. Check that the whole 'js/vendor' folder was uploaded to your host, then refresh.");
  }
});
