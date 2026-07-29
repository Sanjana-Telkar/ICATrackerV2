/* ==========================================================================
   ICA Usage Tracker — History view
   Renders adoption trend, team heatmap, and assistant usage charts
   using pure SVG (no external charting library needed).
   ========================================================================== */

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

  // ── Build per-day summaries ──────────────────────────────────────────────
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
      assistantCounts[a] = (assistantCounts[a] || 0) + 1;
    }));
    const totalUses = Object.values(assistantCounts).reduce((s, n) => s + n, 0);

    const byTeam = {};
    active.forEach(r => {
      if (!byTeam[r.team]) byTeam[r.team] = { total: 0, used: 0 };
      byTeam[r.team].total++;
      if (r.used) byTeam[r.team].used++;
    });

    const niceDate = new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return { dateKey, niceDate, used, total, onLeave, pct, totalUses, assistantCounts, byTeam };
  });

  // ── Aggregate assistant totals across all days ───────────────────────────
  const allAssistants = {};
  daySummaries.forEach(d => {
    Object.entries(d.assistantCounts).forEach(([a, n]) => {
      allAssistants[a] = (allAssistants[a] || 0) + n;
    });
  });
  const topAssistants = Object.entries(allAssistants)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // ── Aggregate team totals across all days ────────────────────────────────
  const allTeams = {};
  daySummaries.forEach(d => {
    Object.entries(d.byTeam).forEach(([team, v]) => {
      if (!allTeams[team]) allTeams[team] = { totalUsed: 0, totalActive: 0 };
      allTeams[team].totalUsed += v.used;
      allTeams[team].totalActive += v.total;
    });
  });
  const teamRankings = Object.entries(allTeams)
    .map(([team, v]) => ({ team, avgPct: v.totalActive ? Math.round((v.totalUsed / v.totalActive) * 100) : 0, totalUsed: v.totalUsed }))
    .sort((a, b) => b.avgPct - a.avgPct);

  container.innerHTML = `
    <!-- ── Summary strip ── -->
    <div class="grid grid-4" style="margin-bottom:16px;">
      ${histKpiCard("📅 Days Tracked", dates.length, "workbooks uploaded")}
      ${histKpiCard("📊 Avg Adoption", Math.round(daySummaries.reduce((s, d) => s + d.pct, 0) / daySummaries.length) + "%", "across all days")}
      ${histKpiCard("🤖 Total Uses", daySummaries.reduce((s, d) => s + d.totalUses, 0), "assistant interactions")}
      ${histKpiCard("🏆 Best Day", daySummaries.reduce((best, d) => d.pct > best.pct ? d : best, daySummaries[0]).niceDate + " — " + daySummaries.reduce((best, d) => d.pct > best.pct ? d : best, daySummaries[0]).pct + "%", "highest adoption")}
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

    <!-- ── Per-day history table ── -->
    <div class="card">
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
            <tr>
              <th>Date</th>
              <th>Active</th>
              <th>Used ICA</th>
              <th>Not Used</th>
              <th>On Leave</th>
              <th>Adoption %</th>
              <th>Asst Uses</th>
            </tr>
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
  `;

  // ── Render adoption trend line chart (SVG) ───────────────────────────────
  renderAdoptionLineChart("hist-adoption-chart", daySummaries);

  // ── Team avg bars ────────────────────────────────────────────────────────
  const teamBarsEl = document.getElementById("hist-team-bars");
  const maxTeamPct = teamRankings[0] ? teamRankings[0].avgPct : 100;
  teamBarsEl.innerHTML = teamRankings.map(({ team, avgPct }) => {
    const barClass = avgPct >= 70 ? "bar-high" : avgPct >= 40 ? "bar-mid" : "bar-low";
    const pctColor = avgPct >= 70 ? "var(--heineken-green-bright)" : avgPct >= 40 ? "var(--amber)" : "#ff7b7f";
    return `
      <div class="team-row">
        <div class="name">${escapeHTML(team)}</div>
        <div class="bar-track"><div class="bar-fill ${barClass}" data-w="${avgPct}" style="width:0%"></div></div>
        <div class="pct" style="color:${pctColor}">${avgPct}%</div>
      </div>`;
  }).join("") || `<div class="text-faint" style="font-size:12.5px;">No team data.</div>`;
  requestAnimationFrame(() => {
    document.querySelectorAll("#hist-team-bars .bar-fill").forEach(el => { el.style.width = el.dataset.w + "%"; });
  });

  // ── Assistant bars ───────────────────────────────────────────────────────
  const asstBarsEl = document.getElementById("hist-asst-bars");
  const maxAsstCount = topAssistants[0] ? topAssistants[0][1] : 1;
  asstBarsEl.innerHTML = topAssistants.map(([name, count]) => {
    const w = Math.round((count / maxAsstCount) * 100);
    return `
      <div class="asst-row">
        <div class="asst-name" title="${escapeHTML(name)}">${escapeHTML(name)}</div>
        <div class="asst-bar-track"><div class="asst-bar-fill" data-w="${w}" style="width:0%"></div></div>
        <div class="asst-count">${count}</div>
      </div>`;
  }).join("") || `<div class="text-faint" style="font-size:12.5px;">No assistant data.</div>`;
  requestAnimationFrame(() => {
    document.querySelectorAll("#hist-asst-bars .asst-bar-fill").forEach(el => { el.style.width = el.dataset.w + "%"; });
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

  // x positions
  const xPos = i => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yPos = pct => padT + chartH - (pct / 100) * chartH;

  // Build polyline points
  const points = daySummaries.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.pct).toFixed(1)}`).join(" ");

  // Build fill area path
  const fillPath = [
    `M ${xPos(0).toFixed(1)},${(padT + chartH).toFixed(1)}`,
    ...daySummaries.map((d, i) => `L ${xPos(i).toFixed(1)},${yPos(d.pct).toFixed(1)}`),
    `L ${xPos(n - 1).toFixed(1)},${(padT + chartH).toFixed(1)}`,
    "Z"
  ].join(" ");

  // Y axis grid lines at 0, 25, 50, 75, 100
  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = yPos(v).toFixed(1);
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border-soft)" stroke-width="1" stroke-dasharray="${v === 0 ? 'none' : '4,4'}"/>
      <text x="${padL - 6}" y="${parseFloat(y) + 4}" fill="var(--text-faint)" font-size="10" text-anchor="end" font-family="IBM Plex Mono,monospace">${v}%</text>
    `;
  }).join("");

  // X axis labels (show max 7 to avoid crowding)
  const labelStep = Math.max(1, Math.ceil(n / 7));
  const xLabels = daySummaries.map((d, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return "";
    return `<text x="${xPos(i).toFixed(1)}" y="${H - 6}" fill="var(--text-faint)" font-size="10" text-anchor="middle" font-family="IBM Plex Mono,monospace">${escapeHTML(d.niceDate)}</text>`;
  }).join("");

  // Dots + tooltips
  const dots = daySummaries.map((d, i) => {
    const cx = xPos(i).toFixed(1);
    const cy = yPos(d.pct).toFixed(1);
    const dotColor = d.pct >= 70 ? "#16c964" : d.pct >= 40 ? "#ffb000" : "#ff5a5f";
    return `
      <circle cx="${cx}" cy="${cy}" r="5" fill="${dotColor}" stroke="var(--surface)" stroke-width="2" class="hist-dot">
        <title>${d.dateKey}: ${d.pct}% (${d.used}/${d.total})</title>
      </circle>`;
  }).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;">
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#16c964" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#16c964" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${fillPath}" fill="url(#lineAreaGrad)"/>
      <polyline points="${points}" fill="none" stroke="#16c964" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${xLabels}
      ${dots}
    </svg>
  `;
}

/* ── Helper: small KPI card for history strip ────────────────────────────── */
function histKpiCard(label, value, sub) {
  return `
    <div class="card kpi">
      <div class="top">
        <div>
          <div class="title" style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-faint);margin-bottom:8px;">${label}</div>
          <div class="value" style="font-family:var(--font-mono);font-size:26px;font-weight:700;color:var(--ibm-blue);">${escapeHTML(String(value))}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div style="font-size:11px;color:var(--text-faint);">${escapeHTML(sub)}</div>
    </div>`;
}
