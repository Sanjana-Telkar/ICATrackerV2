/* ==========================================================================
   ICA Usage Tracker — Dashboard rendering
   ========================================================================== */

function computeSummary(records) {
  const onLeaveRecords = records.filter(r => r.onLeave);
  const active = records.filter(r => !r.onLeave);  // exclude on-leave from all metrics

  const total = active.length;
  const used = active.filter(r => r.used).length;
  const notUsed = total - used;
  const pct = total ? Math.round((used / total) * 100) : 0;

  const assistantCounts = {};
  active.forEach(r => r.assistants.forEach(a => {
    assistantCounts[a] = (assistantCounts[a] || 0) + 1;
  }));
  const topAssistant = Object.entries(assistantCounts).sort((a, b) => b[1] - a[1])[0];
  const totalAssistantUses = Object.values(assistantCounts).reduce((s, n) => s + n, 0);

  const byTeam = {};
  TEAMS.forEach(t => { byTeam[t] = { total: 0, used: 0 }; });
  active.forEach(r => {
    if (!byTeam[r.team]) byTeam[r.team] = { total: 0, used: 0 };
    byTeam[r.team].total++;
    if (r.used) byTeam[r.team].used++;
  });

  const notUsedRecords = active.filter(r => !r.used);

  return { total, used, notUsed, pct, assistantCounts, topAssistant, totalAssistantUses, byTeam, notUsedRecords, onLeaveRecords };
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

  // Gauge color: green ≥70%, amber 40–69%, red <40%
  const gaugeColor = s.pct >= 70 ? "#16c964" : s.pct >= 40 ? "#ffb000" : "#ff5a5f";
  const gaugeStop1 = s.pct >= 70 ? "#4589ff" : s.pct >= 40 ? "#cc8800" : "#b3151b";
  const gaugeStop2 = gaugeColor;

  // Top assistants sorted
  const topAssistants = Object.entries(s.assistantCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxAsstCount = topAssistants[0] ? topAssistants[0][1] : 1;

  // Unique teams that have everyone used
  const perfectTeams = Object.entries(s.byTeam).filter(([, v]) => v.total > 0 && v.used === v.total);

  // Unique team count (deduplicated from ROSTER)
  const uniqueTeamCount = TEAMS.length;
  const totalRoster = ROSTER.length;

  container.innerHTML = `

    <!-- ── ROW 0: Roster summary card ── -->
    <div class="grid grid-4" style="margin-bottom:16px;">
      <div class="card kpi roster-card">
        <div class="top">
          <div>
            <div class="title" style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-faint);margin-bottom:8px;">👥 Total Users</div>
            <div class="value" style="font-family:var(--font-mono);font-size:32px;font-weight:700;color:var(--ibm-blue)" id="rosterCountup">0</div>
          </div>
          <div class="icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
        </div>
        <div class="divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--heineken-green-bright)" id="activeCountup">0</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:3px;">Active today</div>
          </div>
          <div>
            <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:#8baaf7" id="leaveCountup">0</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:3px;">🏖️ On leave</div>
          </div>
        </div>
      </div>

      <div class="card kpi">
        <div class="top">
          <div>
            <div class="title" style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-faint);margin-bottom:8px;">✅ Used ICA Today</div>
            <div class="value" style="font-family:var(--font-mono);font-size:32px;font-weight:700;color:var(--heineken-green-bright)" id="usedBigCountup">0</div>
          </div>
          <div class="icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div>
        </div>
        <div class="divider"></div>
        <div>
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${s.pct >= 70 ? 'var(--heineken-green-bright)' : s.pct >= 40 ? 'var(--amber)' : '#ff7b7f'}" id="pctBigCountup">0%</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:3px;">Adoption rate</div>
        </div>
      </div>

      <div class="card kpi">
        <div class="top">
          <div>
            <div class="title" style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-faint);margin-bottom:8px;">🤖 Assistant Uses</div>
            <div class="value" style="font-family:var(--font-mono);font-size:32px;font-weight:700;color:var(--amber)" id="taCountup">0</div>
          </div>
          <div class="icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"/></svg></div>
        </div>
        <div class="divider"></div>
        <div>
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--ibm-blue)">${uniqueTeamCount}</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:3px;">Teams tracked</div>
        </div>
      </div>

      <div class="card kpi">
        <div class="top">
          <div>
            <div class="title" style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-faint);margin-bottom:8px;">⭐ Top Assistant</div>
            <div class="value" style="font-size:13px;font-weight:600;line-height:1.4;max-width:140px;">${s.topAssistant ? escapeHTML(s.topAssistant[0]) : "—"}</div>
          </div>
          <div class="icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M9 17L7.5 22M15 17l1.5 5M12 17v5"/></svg></div>
        </div>
        <div class="divider"></div>
        <div>
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--amber)" id="kuCountup">0</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:3px;">Uses today</div>
        </div>
      </div>
    </div>

    <!-- ── ROW 1: Hero gauge + adoption stats ── -->
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
          <div class="hero-date">📅 ${niceDate}</div>
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
          ${s.onLeaveRecords.length ? `<div style="font-size:11.5px;color:var(--text-faint);margin-top:2px;">🏖️ On leave: <strong style="color:#8baaf7">${s.onLeaveRecords.length}</strong></div>` : ""}
        </div>
      </div>

      <div class="card kpi" style="justify-content:space-between;">
        <div class="top">
          <div>
            <div class="title" style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-faint);margin-bottom:8px;">⭐ Top Assistant Detail</div>
            <div class="value" style="font-size:17px;font-weight:600;line-height:1.3;">${s.topAssistant ? escapeHTML(s.topAssistant[0]) : "—"}</div>
          </div>
          <div class="icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"/></svg></div>
        </div>
        <div class="divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px;">
          <div>
            <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--amber)" id="kuCountup2">0</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:3px;">Top uses today</div>
          </div>
          <div>
            <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--ibm-blue)" id="taCountup2">0</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:3px;">Total assistant uses</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── ROW 2: Team bars + Leaderboard ── -->
    <div class="grid grid-split" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Adoption by team
          </h3>
          <span class="hint">${TEAMS.length} teams · sorted by rate</span>
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

    <!-- ── ROW 3: Assistant breakdown + Not-yet-used watchlist ── -->
    <div class="grid grid-split">
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
  `;

  // ── Animate gauge + hero counters ──
  requestAnimationFrame(() => {
    const fill = document.getElementById("gaugeFill");
    if (fill) fill.style.strokeDashoffset = offset;
    animateCount(document.getElementById("gaugeNum"), s.pct, "%");
    document.querySelectorAll(".countup").forEach(el => animateCount(el, parseInt(el.dataset.to, 10)));
    // KPI row counters
    animateCount(document.getElementById("rosterCountup"), totalRoster);
    animateCount(document.getElementById("activeCountup"), s.total);
    animateCount(document.getElementById("leaveCountup"), s.onLeaveRecords.length);
    animateCount(document.getElementById("usedBigCountup"), s.used);
    animateCount(document.getElementById("pctBigCountup"), s.pct, "%");
    animateCount(document.getElementById("taCountup"), s.totalAssistantUses);
    animateCount(document.getElementById("kuCountup"), s.topAssistant ? s.topAssistant[1] : 0);
    animateCount(document.getElementById("kuCountup2"), s.topAssistant ? s.topAssistant[1] : 0);
    animateCount(document.getElementById("taCountup2"), s.totalAssistantUses);
  });

  // ── Team bars ──
  const teamBarsEl = document.getElementById("teamBars");
  const teamRows = Object.entries(s.byTeam)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => (b[1].used / b[1].total) - (a[1].used / a[1].total));
  teamBarsEl.innerHTML = teamRows.map(([team, v]) => {
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
