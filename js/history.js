/* ==========================================================================
   ICA Usage Tracker — History view
   ========================================================================== */

/* ── Filter state for the per-day detail tables ── */
let histFilterState = { team: "all", status: "all", q: "" };

/* ── KPI card colour styles (cycles through 4) ── */
const HIST_KPI_STYLES = [
  { color: "#4589ff", bg: "rgba(69,137,255,0.10)",  border: "rgba(69,137,255,0.35)",  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>` },
  { color: "#16c964", bg: "rgba(22,201,100,0.10)",  border: "rgba(22,201,100,0.35)",  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>` },
  { color: "#ffb000", bg: "rgba(255,176,0,0.10)",   border: "rgba(255,176,0,0.35)",   icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"/></svg>` },
  { color: "#c084fc", bg: "rgba(192,132,252,0.10)", border: "rgba(192,132,252,0.35)", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9H4.5a2.5 2.5 0 000 5H6"/><path d="M18 9h1.5a2.5 2.5 0 010 5H18"/><path d="M8 9h8v7a4 4 0 01-8 0V9z"/></svg>` },
];
let _histKpiIdx = 0;

function renderHistory() {
  const container = document.getElementById("history-content");
  if (!container) return;

  const history = Storage.getHistory();
  const dates = Storage.getAllDatesSorted();

  if (dates.length === 0) {
    container.innerHTML = emptyStateHTML(
      "No history yet",
      "Upload at least one workbook to start building your adoption history."
    );
    return;
  }

  // ── Per-day summaries ────────────────────────────────────────────────────
  const daySummaries = dates.map(dateKey => {
    const day = history[dateKey];
    const records = day.records || [];
    const onLeave = records.filter(r => r.onLeave).length;
    const active = records.filter(r => !r.onLeave);
    const used = active.filter(r => r.used).length;
    const total = active.length;
    const pct = total ? Math.round((used / total) * 100) : 0;
    const assistantCounts = {};
    active.forEach(r => (r.assistants || []).forEach(a => {
      const key = a.trim().toLowerCase();
      assistantCounts[key] = (assistantCounts[key] || 0) + 1;
    }));
    const totalUses = Object.values(assistantCounts).reduce((s, n) => s + n, 0);
    const byTeam = {};
    active.forEach(r => {
      if (!byTeam[r.team]) byTeam[r.team] = { total: 0, used: 0 };
      byTeam[r.team].total++;
      if (r.used) byTeam[r.team].used++;
    });
    const niceDate = new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { dateKey, niceDate, used, total, onLeave, pct, totalUses, assistantCounts, byTeam, records };
  });

  // ── All-time aggregates ──────────────────────────────────────────────────
  const allAssistants = {};
  daySummaries.forEach(d => Object.entries(d.assistantCounts).forEach(([a, n]) => {
    allAssistants[a] = (allAssistants[a] || 0) + n;
  }));
  const topAssistants = Object.entries(allAssistants).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const allTeams = {};
  daySummaries.forEach(d => Object.entries(d.byTeam).forEach(([team, v]) => {
    if (!allTeams[team]) allTeams[team] = { totalUsed: 0, totalActive: 0 };
    allTeams[team].totalUsed += v.used;
    allTeams[team].totalActive += v.total;
  }));
  const teamRankings = Object.entries(allTeams)
    .map(([team, v]) => ({ team, avgPct: v.totalActive ? Math.round((v.totalUsed / v.totalActive) * 100) : 0 }))
    .sort((a, b) => b.avgPct - a.avgPct);

  const bestDay = daySummaries.reduce((best, d) => d.pct > best.pct ? d : best, daySummaries[0]);
  const avgAdoption = Math.round(daySummaries.reduce((s, d) => s + d.pct, 0) / daySummaries.length);
  const totalAllUses = daySummaries.reduce((s, d) => s + d.totalUses, 0);
  _histKpiIdx = 0;

  // ── All unique teams across history (for filter dropdown) ────────────────
  const histTeams = [...new Set(
    daySummaries.flatMap(d => d.records.map(r => r.team))
  )].sort();

  container.innerHTML = `
    <!-- ── Summary strip ── -->
    <div class="grid grid-4" style="margin-bottom:16px;">
      ${histKpiCard("📅 Days Tracked", dates.length, "Workbooks Uploaded")}
      ${histKpiCard("📊 Avg Adoption", avgAdoption + "%", "Across All Days")}
      ${histKpiCard("🤖 Total Uses", totalAllUses, "Assistant Interactions")}
      ${histKpiCard("🏆 Best Day", bestDay.niceDate + " — " + bestDay.pct + "%", "Highest Adoption")}
    </div>

    <!-- ── Adoption trend line chart ── -->
    <div class="card" style="margin-bottom:16px;">
      <div class="card-head">
        <h3>
          <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Daily Adoption Rate Trend
        </h3>
        <span class="hint">${dates.length} data point${dates.length !== 1 ? "s" : ""}</span>
      </div>
      <div id="hist-adoption-chart"></div>
    </div>

    <!-- ── Team avg + Assistant totals ── -->
    <div class="grid grid-split" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Team Avg Adoption (All Time)
          </h3>
          <span class="hint">sorted by avg rate</span>
        </div>
        <div id="hist-team-bars"></div>
      </div>
      <div class="card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Top Assistants (All Time)
          </h3>
          <span class="hint">top ${topAssistants.length} by total uses</span>
        </div>
        <div id="hist-asst-bars"></div>
      </div>
    </div>

    <!-- ── Per-day history summary table ── -->
    <div class="card" style="margin-bottom:16px;">
      <div class="card-head">
        <h3>
          <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2h6l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"/><path d="M9 12h6M9 16h6M9 8h2"/></svg>
          Workbook Upload History
        </h3>
        <span class="hint">${dates.length} entries · most recent first</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Active</th><th>Used ICA</th><th>Not Used</th><th>On Leave</th><th>Adoption %</th><th>Asst Uses</th></tr>
          </thead>
          <tbody>
            ${[...daySummaries].reverse().map(d => {
              const pctColor = d.pct >= 70 ? "var(--heineken-green-bright)" : d.pct >= 40 ? "var(--amber)" : "#ff7b7f";
              const pctBg = d.pct >= 70 ? "rgba(22,201,100,0.12)" : d.pct >= 40 ? "rgba(255,176,0,0.12)" : "rgba(237,28,36,0.12)";
              return `<tr>
                <td style="font-family:var(--font-mono);font-size:12px;">${d.dateKey}</td>
                <td>${d.total}</td>
                <td style="color:var(--heineken-green-bright);font-weight:600;">${d.used}</td>
                <td style="color:#ff7b7f;">${d.total - d.used}</td>
                <td style="color:#8baaf7;">${d.onLeave}</td>
                <td><span style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:${pctColor};background:${pctBg};padding:3px 10px;border-radius:20px;">${d.pct}%</span></td>
                <td style="font-family:var(--font-mono);">${d.totalUses}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Per-day user detail section ── -->
    <div class="card" id="hist-detail-card">
      <div class="card-head" style="flex-wrap:wrap;gap:12px;">
        <h3>
          <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          Practitioner Detail — All Days
        </h3>
        <button class="btn primary sm" id="histExportAll" style="margin-left:auto;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export All Days (.xlsx)
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-bar" id="hist-filters" style="margin-bottom:12px;">
        <div class="field search">
          <label>Search</label>
          <input type="search" id="histSearch" placeholder="Name or email…" value="${histFilterState.q}">
        </div>
        <div class="field">
          <label>Team</label>
          <select id="histTeam">
            <option value="all">All teams</option>
            ${histTeams.map(t => `<option value="${t}" ${histFilterState.team === t ? "selected" : ""}>${escapeHTML(t)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Status</label>
          <select id="histStatus">
            <option value="all"      ${histFilterState.status === "all"      ? "selected" : ""}>All</option>
            <option value="used"     ${histFilterState.status === "used"     ? "selected" : ""}>Used ICA</option>
            <option value="not_used" ${histFilterState.status === "not_used" ? "selected" : ""}>Not Used</option>
            <option value="on_leave" ${histFilterState.status === "on_leave" ? "selected" : ""}>On Leave</option>
          </select>
        </div>
        <button class="btn ghost sm" id="histReset">Reset</button>
      </div>

      <!-- Per-day collapsible tables -->
      <div id="hist-detail-tables"></div>
    </div>
  `;

  // ── Wire charts ──────────────────────────────────────────────────────────
  renderAdoptionLineChart("hist-adoption-chart", daySummaries);

  // Team avg bars
  const teamBarsEl = document.getElementById("hist-team-bars");
  teamBarsEl.innerHTML = teamRankings.map(({ team, avgPct }) => {
    const barClass = avgPct >= 70 ? "bar-high" : avgPct >= 40 ? "bar-mid" : "bar-low";
    const pctColor = avgPct >= 70 ? "var(--heineken-green-bright)" : avgPct >= 40 ? "var(--amber)" : "#ff7b7f";
    return `<div class="team-row">
      <div class="name">${escapeHTML(team)}</div>
      <div class="bar-track"><div class="bar-fill ${barClass}" data-w="${avgPct}" style="width:0%"></div></div>
      <div class="pct" style="color:${pctColor}">${avgPct}%</div>
    </div>`;
  }).join("") || `<div class="text-faint" style="font-size:12.5px;">No data.</div>`;
  requestAnimationFrame(() => {
    document.querySelectorAll("#hist-team-bars .bar-fill").forEach(el => { el.style.width = el.dataset.w + "%"; });
  });

  // Assistant bars
  const asstBarsEl = document.getElementById("hist-asst-bars");
  const maxAsstCount = topAssistants[0] ? topAssistants[0][1] : 1;
  asstBarsEl.innerHTML = topAssistants.map(([name, count]) => {
    const w = Math.round((count / maxAsstCount) * 100);
    const display = name.replace(/\b\w/g, c => c.toUpperCase());
    return `<div class="asst-row">
      <div class="asst-name" title="${escapeHTML(display)}">${escapeHTML(display)}</div>
      <div class="asst-bar-track"><div class="asst-bar-fill" data-w="${w}" style="width:0%"></div></div>
      <div class="asst-count">${count}</div>
    </div>`;
  }).join("") || `<div class="text-faint" style="font-size:12.5px;">No data.</div>`;
  requestAnimationFrame(() => {
    document.querySelectorAll("#hist-asst-bars .asst-bar-fill").forEach(el => { el.style.width = el.dataset.w + "%"; });
  });

  // ── Render detail tables (filtered) ─────────────────────────────────────
  function renderDetailTables() {
    const wrap = document.getElementById("hist-detail-tables");
    if (!wrap) return;
    const q = histFilterState.q.toLowerCase();

    const reversed = [...daySummaries].reverse();
    wrap.innerHTML = reversed.map(d => {
      const rows = d.records.filter(r => {
        if (histFilterState.team !== "all" && r.team !== histFilterState.team) return false;
        if (histFilterState.status === "used"      && !r.used)              return false;
        if (histFilterState.status === "not_used"  && (r.used || r.onLeave)) return false;
        if (histFilterState.status === "on_leave"  && !r.onLeave)            return false;
        if (q && !r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
        return true;
      });

      if (!rows.length) return "";

      const pctColor = d.pct >= 70 ? "var(--heineken-green-bright)" : d.pct >= 40 ? "var(--amber)" : "#ff7b7f";
      const niceDate = new Date(d.dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });

      const tableRows = rows.map(r => `
        <tr>
          <td class="cell-name">${escapeHTML(r.name)}</td>
          <td class="cell-email">${escapeHTML(r.email)}</td>
          <td><span class="tag-team">${escapeHTML(r.team)}</span></td>
          <td>${r.assistants && r.assistants.length
            ? `<div class="chip-row">${r.assistants.map(a => `<span class="chip">${escapeHTML(a)}</span>`).join("")}</div>`
            : `<span class="text-faint">—</span>`}</td>
          <td>${r.onLeave
            ? `<span class="badge on-leave">On Leave</span>`
            : r.used
              ? `<span class="badge used">Used</span>`
              : `<span class="badge not-used">Not used</span>`}</td>
        </tr>`).join("");

      return `
        <details class="hist-day-block">
          <summary class="hist-day-summary">
            <span class="hist-day-date">${niceDate}</span>
            <span class="hist-day-sep"></span>
            <span class="hist-day-stat">
              <span class="hist-day-stat-val" style="color:${pctColor}">${d.pct}%</span>
              <span class="hist-day-stat-lbl">adoption</span>
            </span>
            <span class="hist-day-divider"></span>
            <span class="hist-day-stat">
              <span class="hist-day-stat-val" style="color:var(--heineken-green-bright)">${d.used}</span>
              <span class="hist-day-stat-lbl">used ICA</span>
            </span>
            <span class="hist-day-divider"></span>
            <span class="hist-day-stat">
              <span class="hist-day-stat-val" style="color:${d.total - d.used > 0 ? '#ff7b7f' : 'var(--text-faint)'}">${d.total - d.used}</span>
              <span class="hist-day-stat-lbl">not used</span>
            </span>
            ${d.onLeave > 0 ? `
            <span class="hist-day-divider"></span>
            <span class="hist-day-stat">
              <span class="hist-day-stat-val" style="color:#8baaf7">${d.onLeave}</span>
              <span class="hist-day-stat-lbl">on leave</span>
            </span>` : ""}
            <span class="hist-day-divider"></span>
            <span class="hist-day-stat">
              <span class="hist-day-stat-val" style="color:var(--text-dim)">${d.total}</span>
              <span class="hist-day-stat-lbl">total active</span>
            </span>
          </summary>
          <div class="table-wrap" style="margin-top:0;">
            <table class="data-table">
              <thead><tr>
                <th>Practitioner</th><th>Email</th><th>Team</th><th>Assistants Used</th><th>Status</th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </details>`;
    }).join("");

    if (!wrap.innerHTML.trim()) {
      wrap.innerHTML = `<div class="text-faint" style="padding:20px 0;font-size:12.5px;">No results match the current filters.</div>`;
    }
  }

  renderDetailTables();

  // ── Filter listeners ─────────────────────────────────────────────────────
  document.getElementById("histSearch").addEventListener("input", e => {
    histFilterState.q = e.target.value; renderDetailTables();
  });
  document.getElementById("histTeam").addEventListener("change", e => {
    histFilterState.team = e.target.value; renderDetailTables();
  });
  document.getElementById("histStatus").addEventListener("change", e => {
    histFilterState.status = e.target.value; renderDetailTables();
  });
  document.getElementById("histReset").addEventListener("click", () => {
    histFilterState = { team: "all", status: "all", q: "" };
    document.getElementById("histSearch").value = "";
    document.getElementById("histTeam").value = "all";
    document.getElementById("histStatus").value = "all";
    renderDetailTables();
  });

  // ── Export All Days (.xlsx) ───────────────────────────────────────────────
  document.getElementById("histExportAll").addEventListener("click", () => {
    if (typeof XLSX === "undefined") { showToast("Excel engine not loaded.", "err"); return; }
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [["Date", "Active", "Used ICA", "Not Used", "On Leave", "Adoption %", "Asst Uses"]];
    daySummaries.forEach(d => {
      summaryData.push([d.dateKey, d.total, d.used, d.total - d.used, d.onLeave, d.pct + "%", d.totalUses]);
    });
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 13 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // One sheet per day (most recent first)
    [...daySummaries].reverse().forEach(d => {
      const rows = d.records.map(r => ({
        "Name":            r.name,
        "Email":           r.email,
        "Team":            r.team,
        "Assistants Used": (r.assistants || []).join(", "),
        "Status":          r.onLeave ? "On Leave" : r.used ? "Used" : "Not used",
        "Date":            d.dateKey
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 26 }, { wch: 34 }, { wch: 20 }, { wch: 50 }, { wch: 11 }, { wch: 12 }];
      const sheetName = d.dateKey.replace(/-/g, "").slice(2);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `ICA_History_All_Days.xlsx`);
    showToast(`✅ Exported ${daySummaries.length} days to Excel.`, "ok");
  });
}

/* ── SVG line chart ──────────────────────────────────────────────────────── */
function renderAdoptionLineChart(containerId, daySummaries) {
  const el = document.getElementById(containerId);
  if (!el || daySummaries.length === 0) return;

  const W = el.clientWidth || 700;
  const H = 200;
  const padL = 44, padR = 20, padT = 16, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = daySummaries.length;

  const xPos = i => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yPos = pct => padT + chartH - (pct / 100) * chartH;

  const points = daySummaries.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.pct).toFixed(1)}`).join(" ");

  const fillPath = [
    `M ${xPos(0).toFixed(1)},${(padT + chartH).toFixed(1)}`,
    ...daySummaries.map((d, i) => `L ${xPos(i).toFixed(1)},${yPos(d.pct).toFixed(1)}`),
    `L ${xPos(n - 1).toFixed(1)},${(padT + chartH).toFixed(1)}`,
    "Z"
  ].join(" ");

  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = yPos(v).toFixed(1);
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="${v === 0 ? 'none' : '4,4'}"/>
      <text x="${padL - 6}" y="${parseFloat(y) + 4}" fill="#8aa399" font-size="10" text-anchor="end" font-family="IBM Plex Mono,monospace">${v}%</text>`;
  }).join("");

  const labelStep = Math.max(1, Math.ceil(n / 7));
  const xLabels = daySummaries.map((d, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return "";
    return `<text x="${xPos(i).toFixed(1)}" y="${H - 6}" fill="#8aa399" font-size="10" text-anchor="middle" font-family="IBM Plex Mono,monospace">${escapeHTML(d.niceDate)}</text>`;
  }).join("");

  const dots = daySummaries.map((d, i) => {
    const cx = xPos(i).toFixed(1);
    const cy = yPos(d.pct).toFixed(1);
    const dotColor = d.pct >= 70 ? "#16c964" : d.pct >= 40 ? "#ffb000" : "#ff5a5f";
    return `<circle cx="${cx}" cy="${cy}" r="5" fill="${dotColor}" stroke="#121917" stroke-width="2" class="hist-dot">
      <title>${d.dateKey}: ${d.pct}% (${d.used}/${d.total})</title>
    </circle>`;
  }).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;">
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#16c964" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#16c964" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${fillPath}" fill="url(#lineAreaGrad)"/>
      <polyline points="${points}" fill="none" stroke="#16c964" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${xLabels}
      ${dots}
    </svg>`;
}

/* ── Helper: styled KPI card ─────────────────────────────────────────────── */
function histKpiCard(label, value, sub) {
  const s = HIST_KPI_STYLES[_histKpiIdx++ % HIST_KPI_STYLES.length];
  return `
    <div class="card" style="padding:16px 18px;display:flex;flex-direction:column;gap:6px;border-left:3px solid ${s.border};background:linear-gradient(135deg,${s.bg},transparent);">
      <div style="display:flex;align-items:center;gap:7px;color:${s.color};">
        ${s.icon}
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.9px;font-weight:600;">${label}</span>
      </div>
      <div style="font-family:var(--font-mono);font-size:28px;font-weight:700;color:${s.color};line-height:1.1;">${escapeHTML(String(value))}</div>
      <div style="font-size:11.5px;color:var(--text-dim);">${escapeHTML(sub)}</div>
    </div>`;
}
