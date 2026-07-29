/* ==========================================================================
   ICA Usage Tracker — "Today's Report" section: full table + filters +
   export + reminder flow.
   ========================================================================== */

let reportState = { team: "all", status: "all", q: "" };
// status values: "all" | "used" | "not_used" | "on_leave"

function getTodayRecords() {
  const dateKey = Storage.getCurrentDateKey();
  const day = dateKey ? Storage.getDay(dateKey) : null;
  return { dateKey, records: day ? day.records : [] };
}

function filteredReportRecords() {
  const { records } = getTodayRecords();
  return records.filter(r => {
    if (reportState.team !== "all" && r.team !== reportState.team) return false;
    if (reportState.status === "used"      && !r.used)            return false;
    if (reportState.status === "not_used"  && (r.used || r.onLeave)) return false;
    if (reportState.status === "on_leave"  && !r.onLeave)         return false;
    if (reportState.q) {
      const q = reportState.q.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderReportFilters() {
  const el = document.getElementById("report-filters");
  el.innerHTML = `
    <div class="field search">
      <label>Search</label>
      <input type="search" id="reportSearch" placeholder="Search name or email…" value="${reportState.q}">
    </div>
    <div class="field">
      <label>Team</label>
      <select id="reportTeam">
        <option value="all">All teams</option>
        ${TEAMS.map(t => `<option value="${t}" ${reportState.team === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label>Status</label>
      <select id="reportStatus">
        <option value="all"      ${reportState.status === "all"      ? "selected" : ""}>All</option>
        <option value="used"     ${reportState.status === "used"     ? "selected" : ""}>Used ICA</option>
        <option value="not_used" ${reportState.status === "not_used" ? "selected" : ""}>Not used</option>
        <option value="on_leave" ${reportState.status === "on_leave" ? "selected" : ""}>On Leave</option>
      </select>
    </div>
    <button class="btn ghost sm" id="reportReset">Reset</button>
    <div style="flex-grow:1;"></div>
    <button class="btn sm" id="exportCSV">Export Excel</button>
    <button class="btn sm" id="exportDOC">Export Doc</button>
    <button class="btn danger sm" id="openReminderModal">🔒 Send Reminders</button>
  `;
  document.getElementById("reportSearch").addEventListener("input", e => { reportState.q = e.target.value; renderReportTable(); });
  document.getElementById("reportTeam").addEventListener("change", e => { reportState.team = e.target.value; renderReportTable(); });
  document.getElementById("reportStatus").addEventListener("change", e => { reportState.status = e.target.value; renderReportTable(); });
  document.getElementById("reportReset").addEventListener("click", () => { reportState = { team: "all", status: "all", q: "" }; renderReportFilters(); renderReportTable(); });
  document.getElementById("exportCSV").addEventListener("click", exportReportExcel);
  document.getElementById("exportDOC").addEventListener("click", exportReportDoc);
  document.getElementById("openReminderModal").addEventListener("click", () => openPasskeyModal("reminders"));
}

function renderReportTable() {
  const { dateKey } = getTodayRecords();
  const tableWrap = document.getElementById("report-table-wrap");
  const meta = document.getElementById("report-meta");

  if (!dateKey) {
    tableWrap.innerHTML = emptyStateHTML("Nothing uploaded yet", "Upload today's workbook to see individual details here.");
    meta.textContent = "";
    return;
  }

  const rows = filteredReportRecords();
  const niceDate = new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  meta.textContent = `Showing ${rows.length} of ${getTodayRecords().records.length} practitioners · Data date: ${niceDate}`;

  if (!rows.length) {
    tableWrap.innerHTML = emptyStateHTML("No matches", "Try adjusting the filters above.");
    return;
  }

  tableWrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Practitioner</th><th>Email</th><th>Team</th><th>Assistants used</th><th>Status</th><th>Date</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="cell-name">${escapeHTML(r.name)}</td>
              <td class="cell-email">${escapeHTML(r.email)}</td>
              <td><span class="tag-team">${escapeHTML(r.team)}</span></td>
              <td>${r.assistants.length ? `<div class="chip-row">${r.assistants.map(a => `<span class="chip">${escapeHTML(a)}</span>`).join("")}</div>` : `<span class="text-faint">—</span>`}</td>
              <td>${r.onLeave ? `<span class="badge on-leave">On Leave</span>` : r.used ? `<span class="badge used">Used</span>` : `<span class="badge not-used">Not used</span>`}</td>
              <td class="mono text-faint">${dateKey}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReport() {
  renderReportFilters();
  renderReportTable();
}

/* ---------------- Export: Excel (.xlsx) ---------------- */
function exportReportExcel() {
  const rows = filteredReportRecords();
  const { dateKey } = getTodayRecords();
  if (!rows.length) { showToast("Nothing to export for the current filters.", "err"); return; }

  const data = rows.map(r => ({
    "Practitioner Name": r.name,
    "Email": r.email,
    "Scrum Team": r.team,
    "Assistants Used": r.assistants.join(", "),
    "Status": r.used ? "Used" : "Not used",
    "Date": dateKey
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 26 }, { wch: 34 }, { wch: 20 }, { wch: 46 }, { wch: 10 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ICA Report");
  XLSX.writeFile(wb, `ICA_Report_${dateKey}.xlsx`);
  showToast("Excel report downloaded.", "ok");
}

/* ---------------- Export: Word-compatible .doc ---------------- */
function exportReportDoc() {
  const rows = filteredReportRecords();
  const { dateKey } = getTodayRecords();
  if (!rows.length) { showToast("Nothing to export for the current filters.", "err"); return; }

  const tableRows = rows.map(r => `
    <tr>
      <td>${escapeHTML(r.name)}</td>
      <td>${escapeHTML(r.email)}</td>
      <td>${escapeHTML(r.team)}</td>
      <td>${escapeHTML(r.assistants.join(", ") || "—")}</td>
      <td>${r.used ? "Used" : "Not used"}</td>
    </tr>`).join("");

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>ICA Usage Report</title></head>
    <body style="font-family:Calibri,Arial,sans-serif;">
      <h2 style="color:#00A650;">ICA Usage Report — ${dateKey}</h2>
      <p>Generated by the ICA Usage Tracker.</p>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:#161616;color:#fff;">
            <th>Practitioner Name</th><th>Email</th><th>Scrum Team</th><th>Assistants Used</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ICA_Report_${dateKey}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Word report downloaded.", "ok");
}
