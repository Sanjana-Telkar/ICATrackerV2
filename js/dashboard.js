/* ==========================================================================
   ICA Usage Tracker — Dashboard rendering (enhanced)
   ========================================================================== */

function computeSummary(records) {
  const onLeaveRecords = records.filter(r => r.onLeave);
  const active = records.filter(r => !r.onLeave);

  const total = active.length;
  const used = active.filter(r => r.used).length;
  const notUsed = total - used;
  const pct = total ? Math.round((used / total) * 100) : 0;

  const assistantCounts = {};
  const assistantDisplayName = {};
  active.forEach(r => r.assistants.forEach(a => {
    const key = a.trim().toLowerCase();
    assistantCounts[key] = (assistantCounts[key] || 0) + 1;
    // Keep the first-seen title-cased version as the display name
    if (!assistantDisplayName[key]) {
      assistantDisplayName[key] = a.trim().replace(/\b\w/g, c => c.toUpperCase());
    }
  }));
  // Remap counts back to display names
  const assistantCountsDisplay = {};
  Object.entries(assistantCounts).forEach(([key, count]) => {
    assistantCountsDisplay[assistantDisplayName[key]] = count;
  });
  const topAssistant = Object.entries(assistantCountsDisplay).sort((a, b) => b[1] - a[1])[0];
  const totalAssistantUses = Object.values(assistantCountsDisplay).reduce((s, n) => s + n, 0);

  // Merge legacy / variant team names into canonical names for display only.
  // Individual records are NOT modified — this only affects the byTeam counts.
  const TEAM_MERGE = {
    "central led":      "Central Led+SF",
    "supplier finance": "Central Led+SF",
    "posm":             "OCP+POSM",
    "ocp":              "OCP+POSM",
    "hyperautomation":  "OCP+POSM",
  };
  const canonTeam = t => TEAM_MERGE[t.trim().toLowerCase()] || t.trim();

  const byTeam = {};
  TEAMS.forEach(t => { byTeam[t] = { total: 0, used: 0 }; });
  active.forEach(r => {
    const t = canonTeam(r.team);
    if (!byTeam[t]) byTeam[t] = { total: 0, used: 0 };
    byTeam[t].total++;
    if (r.used) byTeam[t].used++;
  });

  const notUsedRecords = active.filter(r => !r.used);

  return { total, used, notUsed, pct, assistantCounts: assistantCountsDisplay, topAssistant, totalAssistantUses, byTeam, notUsedRecords, onLeaveRecords };
}

function animateCount(el, to, suffix = "") {
  const from = 0;
  const dur = 900;
  const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Sparkline SVG (mini trend line) ── */
function buildSparkline(values, color = "#16c964", w = 80, h = 28) {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
    <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${pts[pts.length-1].split(",")[0]}" cy="${pts[pts.length-1].split(",")[1]}" r="3" fill="${color}"/>
  </svg>`;
}

/* ── Team ring progress (donut mini-arc) ── */
function buildRing(pct, color, size = 36) {
  const r = (size / 2) - 3;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="3"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
  </svg>`;
}

function renderDashboard() {
  const dateKey = Storage.getCurrentDateKey();
  const day = dateKey ? Storage.getDay(dateKey) : null;
  const container = document.getElementById("dashboard-content");

  if (!day) {
    container.innerHTML = emptyStateHTML(
      "No workbook uploaded yet",
      "Head to the Upload section and drop in today's ICA tracker workbook to populate the dashboard."
    );
    return;
  }

  const records = day.records;
  const s = computeSummary(records);
  const niceDate = new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const circumference = 351;
  const offset = circumference - (s.pct / 100) * circumference;

  const gaugeColor = s.pct >= 70 ? "#16c964" : s.pct >= 40 ? "#ffb000" : "#ff5a5f";
  const gaugeStop1 = s.pct >= 70 ? "#4589ff" : s.pct >= 40 ? "#cc8800" : "#b3151b";
  const gaugeStop2 = gaugeColor;

  const topAssistants = Object.entries(s.assistantCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxAsstCount = topAssistants[0] ? topAssistants[0][1] : 1;

  // Trend data from history (last 7 days)
  const allDates = Storage.getAllDatesSorted().slice(-7);
  const trendPcts = allDates.map(d => {
    const dx = Storage.getDay(d);
    if (!dx) return 0;
    const sm = computeSummary(dx.records);
    return sm.pct;
  });
  const trendColor = s.pct >= 70 ? "#16c964" : s.pct >= 40 ? "#ffb000" : "#ff5a5f";
  const sparkSVG = buildSparkline(trendPcts, trendColor, 90, 32);

  // Day-over-day delta
  let delta = null;
  if (allDates.length >= 2) {
    const prev = Storage.getDay(allDates[allDates.length - 2]);
    if (prev) {
      const prevSm = computeSummary(prev.records);
      delta = s.pct - prevSm.pct;
    }
  }
  const deltaHtml = delta !== null
    ? `<span class="delta-pill ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}%</span>`
    : "";

  // Roster totals
  const totalRoster = ROSTER.length;
  const uniqueTeamCount = TEAMS.length;

  container.innerHTML = `

    <!-- ── ROW 0: Compact insight cards ── -->
    ${(() => {
      // Worst team today (lowest adoption rate, min 1 member)
      const worstTeam = Object.entries(s.byTeam)
        .filter(([,v]) => v.total > 0)
        .sort((a,b) => (a[1].used/a[1].total) - (b[1].used/b[1].total))[0];
      const worstTeamPct = worstTeam ? Math.round((worstTeam[1].used/worstTeam[1].total)*100) : 0;

      // Avg assistant uses per active practitioner who used ICA
      const avgUsesPerPerson = s.used > 0 ? (s.totalAssistantUses / s.used).toFixed(1) : "—";

      // History trend: avg adoption across all uploaded days
      const histDates = Storage.getAllDatesSorted();
      const histAvg = histDates.length > 1
        ? Math.round(histDates.reduce((sum, d) => {
            const dx = Storage.getDay(d); if (!dx) return sum;
            const sm = computeSummary(dx.records); return sum + sm.pct;
          }, 0) / histDates.length)
        : null;

      return `
      <div class="grid grid-4" style="margin-bottom:12px;">

        <!-- Card 1: Roster headcount — blue -->
        <div class="card compact-kpi" style="border-left:3px solid rgba(69,137,255,0.5);background:linear-gradient(135deg,rgba(69,137,255,0.08),transparent);">
          <div class="ck-row">
            <div class="ck-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
            <div class="ck-body">
              <div class="ck-label" style="color:#4589ff;">Roster</div>
              <div class="ck-val" id="rosterCountup" style="color:#4589ff;">0</div>
            </div>
          </div>
          <div class="ck-sub-row">
            <span><span id="activeCountup" style="color:var(--heineken-green-bright);font-weight:700;">0</span> active</span>
            <span><span id="leaveCountup" style="color:#8baaf7;font-weight:700;">0</span> on leave</span>
            <span style="color:var(--text-faint);">${uniqueTeamCount} teams</span>
          </div>
        </div>

        <!-- Card 2: Pending — red/green -->
        ${(() => {
          const c = s.notUsed === 0 ? { col:"#16c964", border:"rgba(22,201,100,0.5)", bg:"rgba(22,201,100,0.08)" }
                                     : { col:"#ff7b7f", border:"rgba(255,90,95,0.5)",  bg:"rgba(255,90,95,0.08)"  };
          return `<div class="card compact-kpi" style="border-left:3px solid ${c.border};background:linear-gradient(135deg,${c.bg},transparent);">
            <div class="ck-row">
              <div class="ck-icon" style="background:${c.bg};color:${c.col};width:36px;height:36px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;">
                ${s.notUsed === 0
                  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
              </div>
              <div class="ck-body">
                <div class="ck-label" style="color:${c.col};">Pending Today</div>
                <div class="ck-val" style="color:${c.col};">${s.notUsed === 0 ? "All done!" : s.notUsed}</div>
              </div>
            </div>
            <div class="ck-sub-row">
              ${worstTeam && s.notUsed > 0
                ? `<span>Lowest: <strong style="color:#ff7b7f">${escapeHTML(worstTeam[0])}</strong> <span style="color:var(--text-faint)">(${worstTeamPct}%)</span></span>`
                : `<span style="color:var(--heineken-green-bright);">🎉 100% adoption!</span>`}
            </div>
          </div>`;
        })()}

        <!-- Card 3: Avg uses / person — amber -->
        <div class="card compact-kpi" style="border-left:3px solid rgba(255,176,0,0.5);background:linear-gradient(135deg,rgba(255,176,0,0.08),transparent);">
          <div class="ck-row">
            <div class="ck-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
            <div class="ck-body">
              <div class="ck-label" style="color:var(--amber);">Avg Uses / Person</div>
              <div class="ck-val" style="color:var(--amber);">${avgUsesPerPerson}</div>
            </div>
          </div>
          <div class="ck-sub-row">
            <span>across <strong style="color:var(--text-dim)">${s.used}</strong> active users · <strong style="color:var(--text-dim)">${s.totalAssistantUses}</strong> total uses</span>
          </div>
        </div>

        <!-- Card 4: All-time avg — green/amber/blue by rate -->
        ${(() => {
          const avgCol  = histAvg !== null && histAvg >= 70 ? "#16c964" : histAvg !== null && histAvg >= 40 ? "#ffb000" : "#4589ff";
          const avgBord = histAvg !== null && histAvg >= 70 ? "rgba(22,201,100,0.5)" : histAvg !== null && histAvg >= 40 ? "rgba(255,176,0,0.5)" : "rgba(69,137,255,0.5)";
          const avgBg   = histAvg !== null && histAvg >= 70 ? "rgba(22,201,100,0.08)" : histAvg !== null && histAvg >= 40 ? "rgba(255,176,0,0.08)" : "rgba(69,137,255,0.08)";
          return `<div class="card compact-kpi" style="border-left:3px solid ${avgBord};background:linear-gradient(135deg,${avgBg},transparent);">
            <div class="ck-row">
              <div class="ck-icon" style="background:${avgBg};color:${avgCol};width:36px;height:36px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div class="ck-body">
                <div class="ck-label" style="color:${avgCol};">All-Time Avg</div>
                <div class="ck-val" style="color:${avgCol};">${histAvg !== null ? histAvg + "%" : "—"}</div>
              </div>
            </div>
            <div class="ck-sub-row">
              <span><strong style="color:var(--text-dim)">${histDates.length}</strong> day${histDates.length !== 1 ? 's' : ''} of history · ${delta !== null ? `<span style="color:${delta >= 0 ? 'var(--heineken-green-bright)' : '#ff7b7f'}">${delta >= 0 ? '▲' : '▼'}${Math.abs(delta)}% vs yesterday</span>` : 'first upload'}</span>
            </div>
          </div>`;
        })()}

      </div>`;
    })()}

    <!-- ── ROW 1: Hero gauge + KPI stats ── -->
    <div class="grid grid-3" style="margin-bottom:16px;">
      <div class="card hero">
        <div class="pour-gauge">
          <svg viewBox="0 0 130 130">
            <defs>
              <linearGradient id="pourGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${gaugeStop1}" />
                <stop offset="100%" stop-color="${gaugeStop2}" />
              </linearGradient>
            </defs>
            <circle class="track" cx="65" cy="65" r="56"></circle>
            <circle class="fill" id="gaugeFill" cx="65" cy="65" r="56" style="stroke-dashoffset:${circumference}"></circle>
          </svg>
          <div class="label">
            <span class="num" id="gaugeNum" style="color:${gaugeColor}">0%</span>
            <span class="sub">Adoption</span>
          </div>
        </div>

        <div class="hero-right">
          <div class="hero-date-row">
            <div class="hero-date">📅 ${niceDate}</div>
            ${sparkSVG ? `<div class="spark-wrap" title="Adoption trend (last ${allDates.length} days)">${sparkSVG}</div>` : ""}
          </div>
          <div class="hero-stats">
            <div class="stat green">
              <span class="k countup" data-to="${s.used}">0</span>
              <div class="l">✅ Used ICA today</div>
            </div>
            <div class="stat amber">
              <span class="k countup" data-to="${s.notUsed}">0</span>
              <div class="l">⏳ Not yet used</div>
            </div>
            <div class="stat blue">
              <span class="k countup" data-to="${s.total}">0</span>
              <div class="l">👥 Active roster</div>
            </div>
          </div>
          <div class="hero-foot">
            ${s.onLeaveRecords.length ? `<span class="leave-pill">🏖 ${s.onLeaveRecords.length} on leave</span>` : ""}
            ${deltaHtml}
          </div>
        </div>
      </div>

      <!-- KPI: Top assistant + total uses -->
      <div class="card kpi-stack">
        <div class="kpi-item">
          <div class="kpi-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"/></svg></div>
          <div class="kpi-body">
            <div class="kpi-label">Top Assistant</div>
            <div class="kpi-val" title="${s.topAssistant ? escapeHTML(s.topAssistant[0]) : "—"}">${s.topAssistant ? escapeHTML(s.topAssistant[0]) : "—"}</div>
            <div class="kpi-sub" id="kuCountup">0 uses today</div>
          </div>
        </div>
        <div class="kpi-divider"></div>
        <div class="kpi-item">
          <div class="kpi-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
          <div class="kpi-body">
            <div class="kpi-label">Total assistant uses</div>
            <div class="kpi-val mono" id="taCountup">0</div>
            <div class="kpi-sub">${uniqueTeamCount} teams tracked</div>
          </div>
        </div>
        <div class="kpi-divider"></div>
        <div class="kpi-item">
          <div class="kpi-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
          <div class="kpi-body">
            <div class="kpi-label">Days of history</div>
            <div class="kpi-val mono">${Storage.getAllDatesSorted().length}</div>
            <div class="kpi-sub">uploaded workbooks</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── ROW 3: Team bars + Leaderboard ── -->
    <div class="grid grid-split" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Adoption by team
          </h3>
          <span class="hint">sorted by rate</span>
        </div>
        <div id="teamBars"></div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--amber)"><path d="M6 9H4.5a2.5 2.5 0 000 5H6"/><path d="M18 9h1.5a2.5 2.5 0 010 5H18"/><path d="M8 9h8v7a4 4 0 01-8 0V9z"/><path d="M8 9V7a4 4 0 018 0v2"/></svg>
            Individual leaderboard
          </h3>
          <span class="hint">by assistants used today</span>
        </div>
        <div class="leader-list" id="leaderList"></div>
      </div>
    </div>

    <!-- ── ROW 4: Assistant breakdown + Not-yet-used watchlist ── -->
    <div class="grid grid-split" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Assistant usage breakdown
          </h3>
          <span class="hint">top ${topAssistants.length} today</span>
        </div>
        <div id="asstBars"></div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#ff7b7f"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Not yet used today
          </h3>
          <span class="hint" style="color:${s.notUsed > 0 ? '#ff7b7f' : 'var(--heineken-green-bright)'}">
            ${s.notUsed > 0 ? `${s.notUsed} practitioners pending` : "🎉 Everyone's in!"}
          </span>
        </div>
        <div class="watch-list" id="watchList"></div>
      </div>
    </div>

    <!-- ── ROW 5: Adoption history rich chart ── -->
    ${allDates.length >= 2 ? `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-head">
        <h3>
          <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          Adoption History
        </h3>
        <div style="display:flex;align-items:center;gap:14px;">
          <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-faint);"><span style="width:10px;height:10px;border-radius:2px;background:var(--heineken-green-bright);display:inline-block;opacity:0.85;"></span>Used ICA</span>
          <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-faint);"><span style="width:20px;height:2px;background:var(--heineken-green-bright);display:inline-block;border-radius:2px;opacity:0.6;"></span>Trend line</span>
          <span class="hint">last ${allDates.length} uploaded days</span>
        </div>
      </div>
      <div id="historyBars"></div>
    </div>` : ""}
  `;

  // ── Animate gauge + hero counters ──
  requestAnimationFrame(() => {
    const fill = document.getElementById("gaugeFill");
    if (fill) {
      fill.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)";
      fill.style.strokeDashoffset = offset;
    }
    animateCount(document.getElementById("gaugeNum"), s.pct, "%");
    document.querySelectorAll(".countup").forEach(el => animateCount(el, parseInt(el.dataset.to, 10)));
    const kuEl = document.getElementById("kuCountup");
    const taEl = document.getElementById("taCountup");
    if (kuEl) animateCount(kuEl, s.topAssistant ? s.topAssistant[1] : 0, " uses today");
    if (taEl) animateCount(taEl, s.totalAssistantUses);
    // Compact insight card counters
    animateCount(document.getElementById("rosterCountup"), totalRoster);
    animateCount(document.getElementById("activeCountup"), s.total);
    animateCount(document.getElementById("leaveCountup"), s.onLeaveRecords.length);
  });

  // ── Team bars ──
  const teamRingRows = Object.entries(s.byTeam)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => (b[1].used / b[1].total) - (a[1].used / a[1].total));

  const teamBarsEl = document.getElementById("teamBars");
  teamBarsEl.innerHTML = teamRingRows.map(([team, v]) => {
    const pct = v.total ? Math.round((v.used / v.total) * 100) : 0;
    const barClass = pct >= 70 ? "bar-high" : pct >= 40 ? "bar-mid" : "bar-low";
    const pctColor = pct >= 70 ? "var(--heineken-green-bright)" : pct >= 40 ? "var(--amber)" : "#ff7b7f";
    return `
      <div class="team-row">
        <div class="name">${escapeHTML(team)}<span class="sub">${v.used}/${v.total} active</span></div>
        <div class="bar-track"><div class="bar-fill ${barClass}" data-w="${pct}" style="width:0%"></div></div>
        <div class="pct" style="color:${pctColor}">${pct}%</div>
      </div>`;
  }).join("") || `<div class="text-faint" style="font-size:12.5px;">No team data.</div>`;
  requestAnimationFrame(() => {
    document.querySelectorAll("#teamBars .bar-fill").forEach(el => { el.style.width = el.dataset.w + "%"; });
  });

  // ── Leaderboard ──
  const TROPHIES = ["🥇", "🥈", "🥉"];
  const leaderList = document.getElementById("leaderList");
  const ranked = records.filter(r => r.used).sort((a, b) => b.assistants.length - a.assistants.length).slice(0, 8);
  leaderList.innerHTML = ranked.length ? ranked.map((r, i) => {
    const rankDisplay = i < 3
      ? `<span class="trophy">${TROPHIES[i]}</span>`
      : `<span class="rank-num">${i + 1}</span>`;
    return `
      <div class="leader-item r${i + 1}">
        <div class="rank">${rankDisplay}</div>
        <div class="who">${escapeHTML(r.name)}<span class="team">${escapeHTML(r.team)}</span></div>
        <div class="count">${r.assistants.length} used</div>
      </div>`;
  }).join("")
    : `<div class="text-faint" style="font-size:12.5px;padding:10px 0;">No usage recorded yet today.</div>`;

  // ── Assistant breakdown bars ──
  const asstBarsEl = document.getElementById("asstBars");
  if (topAssistants.length) {
    asstBarsEl.innerHTML = topAssistants.map(([name, count]) => {
      const w = Math.round((count / maxAsstCount) * 100);
      return `
        <div class="asst-row">
          <div class="asst-name" title="${escapeHTML(name)}">${escapeHTML(name)}</div>
          <div class="asst-bar-track"><div class="asst-bar-fill" data-w="${w}" style="width:0%"></div></div>
          <div class="asst-count">${count}</div>
        </div>`;
    }).join("");
    requestAnimationFrame(() => {
      document.querySelectorAll("#asstBars .asst-bar-fill").forEach(el => { el.style.width = el.dataset.w + "%"; });
    });
  } else {
    asstBarsEl.innerHTML = `<div class="text-faint" style="font-size:12.5px;padding:10px 0;">No assistant usage recorded yet today.</div>`;
  }

  // ── Not-yet-used watchlist ──
  const watchListEl = document.getElementById("watchList");
  if (s.notUsedRecords.length) {
    watchListEl.innerHTML = s.notUsedRecords
      .sort((a, b) => a.team.localeCompare(b.team))
      .map(r => {
        const initials = r.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        return `
          <div class="watch-item">
            <div class="wi-avatar">${initials}</div>
            <div class="wi-info">
              <div class="wi-name">${escapeHTML(r.name)}</div>
              <div class="wi-team">${escapeHTML(r.team)}</div>
            </div>
            <div class="wi-badge">No use</div>
          </div>`;
      }).join("");
  } else {
    watchListEl.innerHTML = `
      <div style="text-align:center;padding:28px 16px;">
        <div style="font-size:32px;margin-bottom:8px;">🎉</div>
        <div style="font-size:14px;font-weight:600;color:var(--heineken-green-bright);">100% adoption today!</div>
        <div style="font-size:12px;color:var(--text-faint);margin-top:4px;">Every practitioner has used ICA.</div>
      </div>`;
  }

  // ── History rich SVG chart ──
  const histEl = document.getElementById("historyBars");
  if (histEl && allDates.length >= 2) {
    const daySums = allDates.map(d => {
      const dx = Storage.getDay(d);
      if (!dx) return null;
      const sm = computeSummary(dx.records);
      return { date: d, label: d.slice(5), pct: sm.pct, used: sm.used, total: sm.total, notUsed: sm.notUsed, onLeave: sm.onLeaveRecords.length, isToday: d === dateKey };
    }).filter(Boolean);

    const W = histEl.clientWidth || 900;
    const H = 240;
    const padL = 36, padR = 16, padT = 24, padB = 48;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n = daySums.length;

    // bar width — fills ~60% of each slot
    const barW = Math.max(20, Math.min(48, Math.floor(chartW / n * 0.6)));
    const slotW = chartW / n;
    const xCenter = i => padL + slotW * i + slotW / 2;
    const yFromPct = pct => padT + chartH - (pct / 100) * chartH;
    const baseline = padT + chartH;

    // ── Filled area under the trend line ──────────────────────────────────
    const areaPath = [
      `M ${xCenter(0).toFixed(1)},${baseline}`,
      ...daySums.map((d, i) => `L ${xCenter(i).toFixed(1)},${yFromPct(d.pct).toFixed(1)}`),
      `L ${xCenter(n - 1).toFixed(1)},${baseline} Z`
    ].join(" ");

    // ── Grid lines ─────────────────────────────────────────────────────────
    const gridLines = [0, 25, 50, 75, 100].map(v => {
      const y = yFromPct(v).toFixed(1);
      return `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.055)" stroke-width="1" stroke-dasharray="${v === 0 ? 'none' : '3,4'}"/>
        <text x="${padL - 5}" y="${parseFloat(y) + 4}" fill="#6a8880" font-size="9.5" text-anchor="end" font-family="IBM Plex Mono,monospace">${v}%</text>`;
    }).join("");

    // ── Slim vertical bars (used only, colored by rate) ────────────────────
    const bars = daySums.map((d, i) => {
      const cx = xCenter(i);
      const usedColor = d.pct >= 70 ? "#16c964" : d.pct >= 40 ? "#ffb000" : "#ff5a5f";
      const totalBarH = chartH;
      const usedBarH = Math.max(2, (d.pct / 100) * totalBarH);
      const yBar = baseline - usedBarH;

      // Today: slightly wider + full brightness; others: normal
      const bw = d.isToday ? Math.min(barW * 1.2, slotW - 8) : barW;
      const op = d.isToday ? 1 : 0.55;

      return `
        <g opacity="${op}">
          <title>${d.date}  ${d.pct}% adoption  ·  ${d.used} used / ${d.total} active${d.notUsed > 0 ? `  ·  ${d.notUsed} not used` : ''}${d.onLeave > 0 ? `  ·  ${d.onLeave} on leave` : ''}</title>
          <rect x="${(cx - bw / 2).toFixed(1)}" y="${yBar.toFixed(1)}" width="${bw}" height="${usedBarH.toFixed(1)}" rx="3" fill="${usedColor}"/>
        </g>`;
    }).join("");

    // ── Smooth cubic bezier trend line ─────────────────────────────────────
    let smoothPath = "";
    if (n === 1) {
      smoothPath = `M ${xCenter(0)},${yFromPct(daySums[0].pct)}`;
    } else {
      const pts = daySums.map((d, i) => [xCenter(i), yFromPct(d.pct)]);
      smoothPath = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const cpX = (pts[i][0] + pts[i + 1][0]) / 2;
        smoothPath += ` C ${cpX.toFixed(1)},${pts[i][1].toFixed(1)} ${cpX.toFixed(1)},${pts[i + 1][1].toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
      }
    }

    // ── Trend dots ─────────────────────────────────────────────────────────
    const trendDots = daySums.map((d, i) => {
      const cx = xCenter(i).toFixed(1);
      const cy = yFromPct(d.pct).toFixed(1);
      const dotColor = d.pct >= 70 ? "#16c964" : d.pct >= 40 ? "#ffb000" : "#ff5a5f";
      if (d.isToday) {
        return `<circle cx="${cx}" cy="${cy}" r="5" fill="${dotColor}" stroke="var(--surface)" stroke-width="2"/>
                <circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${dotColor}" stroke-width="1" opacity="0.35"/>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="3" fill="${dotColor}" stroke="var(--surface)" stroke-width="1.5"/>`;
    }).join("");

    // ── % labels above each bar ────────────────────────────────────────────
    const pctLabels = daySums.map((d, i) => {
      const cx = xCenter(i).toFixed(1);
      const y = (yFromPct(d.pct) - 10).toFixed(1);
      const color = d.pct >= 70 ? "#16c964" : d.pct >= 40 ? "#ffb000" : "#ff5a5f";
      return `<text x="${cx}" y="${y}" fill="${d.isToday ? color : '#8aa399'}" font-size="${d.isToday ? 11 : 9.5}" font-weight="${d.isToday ? 700 : 400}" text-anchor="middle" font-family="IBM Plex Mono,monospace">${d.pct}%</text>`;
    }).join("");

    // ── X axis date labels ─────────────────────────────────────────────────
    const xLabels = daySums.map((d, i) => {
      const cx = xCenter(i).toFixed(1);
      return `<text x="${cx}" y="${H - 6}" fill="${d.isToday ? '#f0f5f2' : '#6a8880'}" font-size="${d.isToday ? 11 : 10}" font-weight="${d.isToday ? 700 : 400}" text-anchor="middle" font-family="IBM Plex Mono,monospace">${d.label}</text>`;
    }).join("");

    // ── Today column highlight ─────────────────────────────────────────────
    const todayIdx = daySums.findIndex(d => d.isToday);
    const todayHighlight = todayIdx >= 0
      ? `<rect x="${(xCenter(todayIdx) - slotW / 2).toFixed(1)}" y="${padT}" width="${slotW.toFixed(1)}" height="${chartH}" rx="6" fill="rgba(255,255,255,0.03)"/>`
      : "";

    histEl.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;display:block;">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#16c964" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#16c964" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${todayHighlight}
        ${gridLines}
        <path d="${areaPath}" fill="url(#areaGrad)"/>
        ${bars}
        <path d="${smoothPath}" fill="none" stroke="#16c964" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
        ${trendDots}
        ${pctLabels}
        ${xLabels}
      </svg>`;
  }
}

function emptyStateHTML(title, sub) {
  return `<div class="card empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-4M14 3h7v7M21 3l-9 9"/></svg>
    <div style="font-family:var(--font-display);font-size:16px;color:var(--text);margin-bottom:4px;">${title}</div>
    <div style="font-size:12.5px;">${sub}</div>
  </div>`;
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
