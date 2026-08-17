/* ==========================================================================
   ICA Usage Tracker — "Today's Report" section: full table + filters +
   export + reminder flow + team-wise manager reports.
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
    <button class="btn sm" id="exportCSV">⬇ Export Excel</button>
    <button class="btn sm" id="exportDOC">⬇ Export Doc</button>
    <button class="btn blue sm" id="exportTeamReports">📊 Team Reports to Managers</button>
    <button class="btn danger sm" id="openReminderModal">🔒 Send Reminders</button>
  `;
  document.getElementById("reportSearch").addEventListener("input", e => { reportState.q = e.target.value; renderReportTable(); });
  document.getElementById("reportTeam").addEventListener("change", e => { reportState.team = e.target.value; renderReportTable(); });
  document.getElementById("reportStatus").addEventListener("change", e => { reportState.status = e.target.value; renderReportTable(); });
  document.getElementById("reportReset").addEventListener("click", () => { reportState = { team: "all", status: "all", q: "" }; renderReportFilters(); renderReportTable(); });
  document.getElementById("exportCSV").addEventListener("click", exportReportExcel);
  document.getElementById("exportDOC").addEventListener("click", exportReportDoc);
  document.getElementById("exportTeamReports").addEventListener("click", () => openPasskeyModal("team_report"));
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

/* ---------------- Export: Excel (.xlsx) — full filtered report ---------------- */
function exportReportExcel() {
  const rows = filteredReportRecords();
  const { dateKey } = getTodayRecords();
  if (!rows.length) { showToast("Nothing to export for the current filters.", "err"); return; }

  const data = rows.map(r => ({
    "Practitioner Name": r.name,
    "Email": r.email,
    "Scrum Team": r.team,
    "Assistants Used": r.assistants.join(", "),
    "Status": r.onLeave ? "On Leave" : r.used ? "Used" : "Not used",
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
      <td>${r.onLeave ? "On Leave" : r.used ? "Used" : "Not used"}</td>
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

/* ============================================================================
   Team-wise Reports → Managers
   - Downloads ONE combined Excel workbook (one sheet per team + a Summary sheet)
   - Opens ONE Outlook draft with ALL managers in TO, CC_EMAILS in CC
   - Body lists not-used practitioners grouped by team
   - Protected by the passkey modal (already wired in renderReportFilters)
   ============================================================================ */
function exportTeamReports() {
  const { records, dateKey } = getTodayRecords();
  if (!records || !records.length) {
    showToast("No data uploaded yet.", "err");
    return;
  }

  // ── Group records by team ────────────────────────────────────────────────
  const byTeam = {};
  records.forEach(r => {
    if (!byTeam[r.team]) byTeam[r.team] = [];
    byTeam[r.team].push(r);
  });
  const teamList = Object.keys(byTeam).sort();

  // ── Build ONE combined Excel workbook ────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // Sheet 1: Overall summary (one row per team)
  const summaryRows = [["Team", "Active", "Used ICA", "Not Used", "On Leave", "Adoption %"]];
  teamList.forEach(team => {
    const tr = byTeam[team];
    const active       = tr.filter(r => !r.onLeave);
    const usedCount    = active.filter(r => r.used).length;
    const totalCount   = active.length;
    const onLeaveCount = tr.filter(r => r.onLeave).length;
    const pct          = totalCount ? Math.round((usedCount / totalCount) * 100) : 0;
    summaryRows.push([team, totalCount, usedCount, totalCount - usedCount, onLeaveCount, pct + "%"]);
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // One detail sheet per team
  teamList.forEach(team => {
    const tr = byTeam[team];
    const detailData = tr.map(r => ({
      "Practitioner Name": r.name,
      "Email":             r.email,
      "Assistants Used":   r.assistants.join(", "),
      "Status":            r.onLeave ? "On Leave" : r.used ? "Used" : "Not used",
      "Date":              dateKey
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    wsDetail["!cols"] = [{ wch: 26 }, { wch: 34 }, { wch: 50 }, { wch: 12 }, { wch: 12 }];
    // Sheet names max 31 chars, strip special chars
    const sheetName = team.replace(/[:\\\/\?\*\[\]]/g, "").substring(0, 31);
    XLSX.utils.book_append_sheet(wb, wsDetail, sheetName);
  });

  XLSX.writeFile(wb, `ICA_TeamReport_All_${dateKey}.xlsx`);
  showToast(`✅ Combined Excel report downloaded (${teamList.length} teams).`, "ok");

  // ── Collect all unique manager emails for TO ─────────────────────────────
  const managerEmails = [];
  const addEmail = e => { if (e && !managerEmails.includes(e)) managerEmails.push(e); };
  teamList.forEach(team => addEmail(CONFIG.TEAM_MANAGERS && CONFIG.TEAM_MANAGERS[team]));
  (CONFIG.EXTRA_MANAGER_EMAILS || []).forEach(addEmail);

  if (!managerEmails.length) {
    showToast("💡 No manager emails configured in CONFIG.TEAM_MANAGERS — report downloaded only.", "warn");
    return;
  }

  // ── Build email body ──────────────────────────────────────────────────────
  const totalActive  = records.filter(r => !r.onLeave).length;
  const totalUsed    = records.filter(r => r.used).length;
  const totalNotUsed = records.filter(r => !r.used && !r.onLeave).length;
  const totalOnLeave = records.filter(r => r.onLeave).length;
  const overallPct   = totalActive ? Math.round((totalUsed / totalActive) * 100) : 0;

  // Not-used names grouped by team
  const notUsedSections = [];
  teamList.forEach(team => {
    const notUsed = byTeam[team].filter(r => !r.used && !r.onLeave);
    if (notUsed.length) {
      notUsedSections.push(
        `  ${team} (${notUsed.length}):\n` +
        notUsed.map((r, i) => `    ${i + 1}. ${r.name}`).join("\n")
      );
    }
  });

  const notUsedBlock = notUsedSections.length
    ? notUsedSections.join("\n\n")
    : `All active practitioners have used ICA today. No action required.`;

  const niceDate = new Date(dateKey + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  // Adoption-aware opener, mid-note & closing quip
  const opener = overallPct === 100
    ? `🎉 PERFECT SCORE ALERT! ICA adoption is at 100% today.\nEvery single active practitioner has used ICA. The bots are very pleased. You should be too.`
    : overallPct >= 80
    ? `📊 Daily ICA report is in — and honestly? Not bad at all.\n${overallPct}% adoption today. The team is mostly on board; just a few folks still warming up to their AI sidekick.`
    : overallPct >= 50
    ? `📊 Today's ICA adoption report has landed.\nWe're at ${overallPct}% — past the halfway line, but there's ground to cover. Think of it as a friendly half-time scoreboard.`
    : `📊 Your daily ICA adoption report is here, delivering numbers with full transparency.\nWe're at ${overallPct}% today. The trend is what matters — and with your help, tomorrow's number will be higher.`;

  const notUsedIntro = notUsedSections.length
    ? `These practitioners haven't logged an ICA interaction yet today.\nThey're not in trouble — they just need a gentle tap on the shoulder from someone they respect.\n(That's you, by the way.)`
    : null;

  const closingQuip = notUsedSections.length
    ? `Research shows* that a one-line message from a manager is worth approximately 47 automated reminder emails.\n(*not peer-reviewed, but we stand by it)\n\nThank you for keeping the team on track — ICA appreciates you, even if it can't say so itself.`
    : `Nothing to chase today — everyone showed up for ICA.\nGo enjoy your coffee. You've clearly been doing something right. ☕`;

  const body = encodeURIComponent(
    `Dear Managers,\n\n` +
    `${opener}\n\n` +
    `──────────────────────────────────────────\n` +
    `ADOPTION SUMMARY  —  ${niceDate}\n` +
    `──────────────────────────────────────────\n` +
    `  Total active practitioners : ${totalActive}\n` +
    `  Used ICA today             : ${totalUsed} (${overallPct}%) ${overallPct === 100 ? "🏆" : overallPct >= 80 ? "💪" : overallPct >= 50 ? "📈" : "👀"}\n` +
    `  Not yet used               : ${totalNotUsed}\n` +
    `  On leave                   : ${totalOnLeave}\n` +
    `──────────────────────────────────────────\n\n` +
    (notUsedSections.length
      ? `PRACTITIONERS YET TO USE ICA  (${totalNotUsed} remaining)\n` +
        `──────────────────────────────────────────\n` +
        `${notUsedIntro}\n\n` +
        `${notUsedBlock}\n\n` +
        `──────────────────────────────────────────\n\n`
      : `✅ All active practitioners have used ICA today. No action needed from your side!\n\n`) +
    `${closingQuip}\n\n` +
    `──────────────────────────────────────────\n` +
    `USEFUL LINKS\n` +
    `──────────────────────────────────────────\n` +
    `  Access ICA       : https://remea.ica.ibm.com/ica/curatorai/apps/ui/new-chat\n` +
    `  Live dashboard   : https://pages.github.ibm.com/Sanjana-S4/ICATracker/\n` +
    (CONFIG.WORKBOOK_URL ? `  Source workbook  : ${CONFIG.WORKBOOK_URL}\n` : ``) +
    `──────────────────────────────────────────\n\n` +
    `The full team-wise breakdown is attached to this email.\n\n` +
    `Warm regards,\n` +
    `ICA Adoption Tracker 🤖\n` +
    `(your friendly neighbourhood adoption bot)\n` +
    `──────────────────────────────────────────\n` +
    `Automated message — please do not reply directly.\n` +
    `The bot is very busy tracking numbers and does not check its inbox.`
  );

  const to      = managerEmails.join(";");
  const cc      = (CONFIG.CC_EMAILS  || []).join(";");
  const bcc     = (CONFIG.BCC_EMAILS || []).join(";");
  const subject = encodeURIComponent(`ICA Adoption Report — All Teams — ${dateKey}`);

  showToast(`📧 Opening Outlook draft for ${managerEmails.length} manager(s)…`, "ok");
  const params = [`cc=${cc}`];
  if (bcc) params.push(`bcc=${bcc}`);
  params.push(`subject=${subject}`, `body=${body}`);
  window.open(`mailto:${to}?${params.join("&")}`, "_blank");
}
