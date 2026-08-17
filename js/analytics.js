/* ==========================================================================
   ICA Usage Tracker — Analytics view
   Sections:
     1. Daily adoption bar chart  (last 7 days, gradient bars, animated)
     2. Weekly avg trend line     (smooth cubic bezier curve)
     3. Monthly adoption trend    (smooth cubic bezier curve)
     4. Top ICA power users       (leaderboard with progress bar)
     5. Top assistants this week  (horizontal gradient bars)
   ========================================================================== */

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function isoWeekLabel(dateKey) {
  const d    = new Date(dateKey + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const sow  = new Date(jan4);
  sow.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const wn   = Math.floor((d - sow) / (7 * 86400000)) + 1;
  return `W${String(wn).padStart(2, "0")}`;
}

function monthLabel(dateKey) {
  return new Date(dateKey + "T00:00:00")
    .toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function shortDate(dateKey) {
  return new Date(dateKey + "T00:00:00")
    .toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Build a smooth SVG cubic-bezier path through a set of [x,y] points. */
function smoothPath(pts) {
  if (pts.length < 2) return pts.map(p => `L${p[0]},${p[1]}`).join(" ");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx  = (prev[0] + curr[0]) / 2;
    d += ` C${cpx},${prev[1]} ${cpx},${curr[1]} ${curr[0]},${curr[1]}`;
  }
  return d;
}

/* ── Colour helper ── */
function adoptionColor(pct) {
  return pct >= 70 ? "#16c964" : pct >= 40 ? "#ffb000" : "#ff5a5f";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main render
   ═══════════════════════════════════════════════════════════════════════════ */
function renderAnalytics() {
  const container = document.getElementById("analytics-content");
  if (!container) return;

  const dates   = Storage.getAllDatesSorted();
  const history = Storage.getHistory();

  if (!dates.length) {
    container.innerHTML = emptyStateHTML(
      "No data yet",
      "Upload at least one workbook to start seeing analytics."
    );
    return;
  }

  /* ── Per-day summaries ── */
  const daySummaries = dates.map(dk => {
    const records = (history[dk] && history[dk].records) || [];
    const active  = records.filter(r => !r.onLeave);
    const used    = active.filter(r => r.used).length;
    const total   = active.length;
    const pct     = total ? Math.round((used / total) * 100) : 0;

    const asstCounts = {};
    active.forEach(r => (r.assistants || []).forEach(a => {
      const k = a.trim().toLowerCase();
      asstCounts[k] = (asstCounts[k] || 0) + 1;
    }));

    const personUses = {};
    active.forEach(r => {
      if (!r.used) return;
      const key = r.email || r.name;
      if (!personUses[key]) personUses[key] = { name: r.name, team: r.team, count: 0 };
      personUses[key].count += (r.assistants || []).length || 1;
    });

    return { dk, label: shortDate(dk), used, total, pct, asstCounts, personUses };
  });

  const last7 = daySummaries.slice(-7);

  /* ── Weekly buckets ── */
  const weekBuckets = {};
  daySummaries.forEach(d => {
    const wk = isoWeekLabel(d.dk);
    if (!weekBuckets[wk]) weekBuckets[wk] = { used: 0, total: 0 };
    weekBuckets[wk].used  += d.used;
    weekBuckets[wk].total += d.total;
  });
  const weekLabels = Object.keys(weekBuckets).sort().slice(-8);
  const weekData   = weekLabels.map(wk => {
    const b = weekBuckets[wk];
    return b.total ? Math.round((b.used / b.total) * 100) : 0;
  });

  /* ── Monthly buckets ── */
  const monthBuckets = {};
  daySummaries.forEach(d => {
    const mo = monthLabel(d.dk);
    if (!monthBuckets[mo]) monthBuckets[mo] = { used: 0, total: 0 };
    monthBuckets[mo].used  += d.used;
    monthBuckets[mo].total += d.total;
  });
  const monthLabels = Object.keys(monthBuckets);
  const monthData   = monthLabels.map(mo => {
    const b = monthBuckets[mo];
    return b.total ? Math.round((b.used / b.total) * 100) : 0;
  });

  /* ── All-time top users ── */
  const allPersonUses = {};
  daySummaries.forEach(d => {
    Object.entries(d.personUses).forEach(([key, v]) => {
      if (!allPersonUses[key]) allPersonUses[key] = { name: v.name, team: v.team, count: 0, days: 0 };
      allPersonUses[key].count += v.count;
      allPersonUses[key].days  += 1;
    });
  });
  const topUsers = Object.values(allPersonUses)
    .sort((a, b) => b.count - a.count || b.days - a.days)
    .slice(0, 10);

  /* ── This week's assistants ── */
  const thisWeekAsstCounts = {};
  last7.forEach(d => {
    Object.entries(d.asstCounts).forEach(([k, n]) => {
      thisWeekAsstCounts[k] = (thisWeekAsstCounts[k] || 0) + n;
    });
  });
  const topWeekAssts = Object.entries(thisWeekAsstCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  /* ── Overall stats for KPI strip ── */
  const avgPct    = daySummaries.length
    ? Math.round(daySummaries.reduce((s, d) => s + d.pct, 0) / daySummaries.length)
    : 0;
  const bestDay   = daySummaries.reduce((b, d) => d.pct > b.pct ? d : b, daySummaries[0]);
  const totalUses = daySummaries.reduce((s, d) =>
    s + Object.values(d.asstCounts).reduce((a, n) => a + n, 0), 0);
  const streak    = (() => {
    let n = 0;
    for (let i = daySummaries.length - 1; i >= 0; i--) {
      if (daySummaries[i].pct >= 70) n++; else break;
    }
    return n;
  })();

  /* ─────────────────────────────────────────────────────────────────────────
     HTML skeleton
     ───────────────────────────────────────────────────────────────────────── */
  container.innerHTML = `

    <!-- KPI strip -->
    <div class="an-kpi-strip">
      ${_kpi("Avg Adoption", avgPct + "%", adoptionColor(avgPct), "All time")}
      ${_kpi("Best Day", bestDay.pct + "%", "#c084fc", bestDay.label)}
      ${_kpi("Total Interactions", totalUses, "#4589ff", "All assistants, all time")}
      ${_kpi("🔥 High-rate Streak", streak ? streak + " day" + (streak !== 1 ? "s" : "") : "—", "#ffb000", "≥70% adoption in a row")}
    </div>

    <!-- Daily bar chart -->
    <div class="card an-card" style="margin-bottom:16px;">
      <div class="card-head">
        <h3>
          <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="14" width="4" height="8" rx="1"/>
            <rect x="9" y="9" width="4" height="13" rx="1"/>
            <rect x="16" y="4" width="4" height="18" rx="1"/>
          </svg>
          Daily Adoption — Last 7 Days
        </h3>
        <div class="an-legend">
          <span class="an-leg-dot" style="background:#16c964;"></span><span>≥ 70%</span>
          <span class="an-leg-dot" style="background:#ffb000;"></span><span>≥ 40%</span>
          <span class="an-leg-dot" style="background:#ff5a5f;"></span><span>&lt; 40%</span>
        </div>
      </div>
      <div id="an-weekly-bars" class="an-bar-chart"></div>
    </div>

    <!-- Trend lines -->
    <div class="grid grid-split" style="margin-bottom:16px;">
      <div class="card an-card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Weekly Avg Adoption
          </h3>
          <span class="hint">last ${weekLabels.length} weeks</span>
        </div>
        <div id="an-weekly-line"></div>
      </div>
      <div class="card an-card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            Monthly Trend
          </h3>
          <span class="hint">${monthLabels.length} month${monthLabels.length !== 1 ? "s" : ""}</span>
        </div>
        <div id="an-monthly-line"></div>
      </div>
    </div>

    <!-- Leaderboard + assistants -->
    <div class="grid grid-split" style="margin-bottom:16px;">
      <div class="card an-card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Top ICA Power Users
          </h3>
          <span class="hint">all-time · total uses</span>
        </div>
        <div id="an-top-users"></div>
      </div>
      <div class="card an-card">
        <div class="card-head">
          <h3>
            <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
            Top Assistants This Week
          </h3>
          <span class="hint">last 7 days · interactions</span>
        </div>
        <div id="an-week-assts"></div>
      </div>
    </div>
  `;

  /* ── Charts ── */
  _renderDailyBarChart("an-weekly-bars", last7);
  _renderSmoothLineChart("an-weekly-line",  weekLabels,  weekData,  "#4589ff");
  _renderSmoothLineChart("an-monthly-line", monthLabels, monthData, "#c084fc");

  /* ── Top users leaderboard ── */
  const usersEl  = document.getElementById("an-top-users");
  const medals   = ["🥇", "🥈", "🥉"];
  const maxCount = topUsers[0] ? topUsers[0].count : 1;
  usersEl.innerHTML = topUsers.length
    ? topUsers.map((u, i) => {
        const barW  = Math.round((u.count / maxCount) * 100);
        const bColor = i === 0 ? "#ffb000" : i === 1 ? "#b0b0b0" : i === 2 ? "#c87533" : "#4589ff";
        return `
          <div class="an-user-row ${i < 3 ? "an-podium-" + (i + 1) : ""}">
            <span class="an-rank">${medals[i] || `<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-faint);">#${i + 1}</span>`}</span>
            <div class="an-user-info">
              <div class="an-user-name">${escapeHTML(u.name)}</div>
              <div class="an-user-team">${escapeHTML(u.team)}</div>
              <div class="an-user-bar-track">
                <div class="an-user-bar-fill" data-w="${barW}"
                     style="width:0%;background:linear-gradient(90deg,${bColor}99,${bColor});"></div>
              </div>
            </div>
            <div class="an-user-stats">
              <span class="an-uses-badge" style="border-color:${bColor}55;color:${bColor};background:${bColor}18;">${u.count} uses</span>
              <span class="an-days-badge">${u.days}d</span>
            </div>
          </div>`;
      }).join("")
    : `<div class="text-faint" style="font-size:12.5px;padding:16px 0;">No usage data yet.</div>`;

  requestAnimationFrame(() => {
    document.querySelectorAll("#an-top-users .an-user-bar-fill").forEach(el => {
      el.style.width = el.dataset.w + "%";
    });
  });

  /* ── Top assistants this week ── */
  const asstEl = document.getElementById("an-week-assts");
  if (topWeekAssts.length) {
    const maxA = topWeekAssts[0][1];
    asstEl.innerHTML = topWeekAssts.map(([key, count], i) => {
      const display = key.replace(/\b\w/g, c => c.toUpperCase());
      const w       = Math.round((count / maxA) * 100);
      const colors  = [
        ["#16c964","#4589ff"],
        ["#4589ff","#c084fc"],
        ["#ffb000","#16c964"],
        ["#c084fc","#4589ff"],
      ];
      const [c1, c2] = colors[i % colors.length];
      return `
        <div class="an-asst-row">
          <div class="an-asst-name" title="${escapeHTML(display)}">${escapeHTML(display)}</div>
          <div class="an-asst-track">
            <div class="an-asst-fill" data-w="${w}"
                 style="width:0%;background:linear-gradient(90deg,${c1},${c2});"></div>
          </div>
          <div class="an-asst-count">${count}</div>
        </div>`;
    }).join("");
    requestAnimationFrame(() => {
      document.querySelectorAll("#an-week-assts .an-asst-fill").forEach(el => {
        el.style.width = el.dataset.w + "%";
      });
    });
  } else {
    asstEl.innerHTML = `<div class="text-faint" style="font-size:12.5px;padding:16px 0;">No usage data in the last 7 days.</div>`;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   KPI card helper
   ───────────────────────────────────────────────────────────────────────────── */
function _kpi(label, value, color, sub) {
  return `
    <div class="an-kpi">
      <div class="an-kpi-label">${label}</div>
      <div class="an-kpi-value" style="color:${color};">${escapeHTML(String(value))}</div>
      <div class="an-kpi-sub">${escapeHTML(sub)}</div>
      <div class="an-kpi-glow" style="background:${color};"></div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Daily vertical bar chart  —  gradient fills + animate-in
   ───────────────────────────────────────────────────────────────────────────── */
function _renderDailyBarChart(containerId, days) {
  const el = document.getElementById(containerId);
  if (!el || !days.length) return;

  const W      = el.clientWidth || 680;
  const H      = 200;
  const padL   = 40;
  const padR   = 16;
  const padT   = 28;   // extra room for value pill above bar
  const padB   = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n      = days.length;
  const gap    = 10;
  const barW   = Math.max(20, Math.floor(chartW / n) - gap);

  /* unique gradient ids per bar */
  const defs = days.map((d, i) => {
    const c1 = adoptionColor(d.pct);
    const c2 = c1 === "#16c964" ? "#4589ff"
             : c1 === "#ffb000" ? "#ff8c00"
             : "#cc1a20";
    return `
      <linearGradient id="bg${containerId}${i}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${c1}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0.55"/>
      </linearGradient>`;
  }).join("");

  const bars = days.map((d, i) => {
    const x    = padL + i * (barW + gap) + gap / 2;
    const bH   = Math.max(3, (d.pct / 100) * chartH);
    const y    = padT + chartH - bH;
    const cx   = x + barW / 2;
    const glowColor = adoptionColor(d.pct);

    /* value pill above bar */
    const pill = `
      <rect x="${(cx - 17).toFixed(1)}" y="${(y - 22).toFixed(1)}"
            width="34" height="17" rx="8"
            fill="${glowColor}" fill-opacity="0.15"
            stroke="${glowColor}" stroke-opacity="0.4" stroke-width="1"/>
      <text x="${cx.toFixed(1)}" y="${(y - 10).toFixed(1)}"
            fill="${glowColor}" font-size="10" font-weight="700"
            text-anchor="middle" font-family="IBM Plex Mono,monospace">${d.pct}%</text>`;

    return `
      <g class="an-bar-group" data-idx="${i}">
        <!-- glow shadow -->
        <rect x="${(x + 2).toFixed(1)}" y="${(y + 4).toFixed(1)}"
              width="${barW - 4}" height="${bH}"
              rx="6" fill="${glowColor}" fill-opacity="0.18" filter="url(#blur${containerId})"/>
        <!-- main bar -->
        <rect class="an-bar-rect" x="${x.toFixed(1)}" y="${(padT + chartH).toFixed(1)}"
              width="${barW}" height="0"
              rx="6" fill="url(#bg${containerId}${i})"
              data-y="${y.toFixed(1)}" data-h="${bH.toFixed(1)}">
          <title>${d.dk}: ${d.pct}% (${d.used}/${d.total})</title>
        </rect>
        <!-- sheen line -->
        <rect x="${(x + barW * 0.15).toFixed(1)}" y="${(padT + chartH).toFixed(1)}"
              width="${(barW * 0.12).toFixed(1)}" height="0"
              rx="3" fill="rgba(255,255,255,0.18)"
              class="an-bar-sheen" data-y="${y.toFixed(1)}" data-h="${bH.toFixed(1)}"/>
        ${pill}
        <!-- x label -->
        <text x="${cx.toFixed(1)}" y="${(H - 4).toFixed(1)}"
              fill="#8aa399" font-size="10" text-anchor="middle"
              font-family="IBM Plex Mono,monospace">${escapeHTML(d.label)}</text>
      </g>`;
  }).join("");

  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = (padT + chartH - (v / 100) * chartH).toFixed(1);
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
            stroke="rgba(255,255,255,0.055)" stroke-width="1"
            ${v > 0 ? 'stroke-dasharray="4,6"' : ""}/>
      <text x="${padL - 6}" y="${(parseFloat(y) + 4).toFixed(1)}"
            fill="#8aa399" font-size="9" text-anchor="end"
            font-family="IBM Plex Mono,monospace">${v}%</text>`;
  }).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;">
      <defs>
        ${defs}
        <filter id="blur${containerId}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
      </defs>
      ${gridLines}
      ${bars}
    </svg>`;

  /* animate bars growing up from baseline */
  requestAnimationFrame(() => {
    el.querySelectorAll(".an-bar-rect").forEach((r, idx) => {
      const targetY = parseFloat(r.dataset.y);
      const targetH = parseFloat(r.dataset.h);
      setTimeout(() => {
        r.style.transition = "y 0.55s cubic-bezier(.22,1,.36,1), height 0.55s cubic-bezier(.22,1,.36,1)";
        r.setAttribute("y", targetY);
        r.setAttribute("height", targetH);
      }, idx * 60);
    });
    el.querySelectorAll(".an-bar-sheen").forEach((r, idx) => {
      const targetY = parseFloat(r.dataset.y);
      const targetH = parseFloat(r.dataset.h);
      setTimeout(() => {
        r.style.transition = "y 0.55s cubic-bezier(.22,1,.36,1), height 0.55s cubic-bezier(.22,1,.36,1)";
        r.setAttribute("y", targetY);
        r.setAttribute("height", targetH);
      }, idx * 60 + 80);
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Smooth curve line chart  —  cubic bezier + gradient area fill
   ───────────────────────────────────────────────────────────────────────────── */
function _renderSmoothLineChart(containerId, labels, values, lineColor) {
  const el = document.getElementById(containerId);
  if (!el || !values.length) return;

  const W      = el.clientWidth || 340;
  const H      = 170;
  const padL   = 38;
  const padR   = 16;
  const padT   = 14;
  const padB   = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n      = values.length;

  const xPos = i => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yPos = v  => padT + chartH - (v / 100) * chartH;

  const pts      = values.map((v, i) => [xPos(i), yPos(v)]);
  const linePath = smoothPath(pts);
  const areaPath = `M${pts[0][0]},${padT + chartH} ${linePath} L${pts[n-1][0]},${padT + chartH} Z`;

  const gradId  = `anGrad_${containerId}`;
  const glowId  = `anGlow_${containerId}`;

  const gridLines = [0, 50, 100].map(v => {
    const y = yPos(v).toFixed(1);
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
            stroke="rgba(255,255,255,0.055)" stroke-width="1"
            ${v > 0 ? 'stroke-dasharray="4,6"' : ""}/>
      <text x="${padL - 6}" y="${(parseFloat(y) + 4).toFixed(1)}"
            fill="#8aa399" font-size="9" text-anchor="end"
            font-family="IBM Plex Mono,monospace">${v}%</text>`;
  }).join("");

  const labelStep = Math.max(1, Math.ceil(n / 6));
  const xLabels   = labels.map((lbl, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return "";
    return `<text x="${xPos(i).toFixed(1)}" y="${H - 4}"
                  fill="#8aa399" font-size="9" text-anchor="middle"
                  font-family="IBM Plex Mono,monospace">${escapeHTML(lbl)}</text>`;
  }).join("");

  const dots = values.map((v, i) => {
    const c  = adoptionColor(v);
    const cx = xPos(i).toFixed(1);
    const cy = yPos(v).toFixed(1);
    return `
      <circle cx="${cx}" cy="${cy}" r="6" fill="${lineColor}" fill-opacity="0.15"/>
      <circle cx="${cx}" cy="${cy}" r="4" fill="${c}" stroke="#121917" stroke-width="2">
        <title>${labels[i]}: ${v}%</title>
      </circle>`;
  }).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${lineColor}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${lineColor}" stop-opacity="0.01"/>
        </linearGradient>
        <filter id="${glowId}">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#${gradId})"/>
      <path d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="2.5"
            stroke-linejoin="round" stroke-linecap="round" filter="url(#${glowId})"/>
      ${xLabels}
      ${dots}
    </svg>`;
}
