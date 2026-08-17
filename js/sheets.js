/* ==========================================================================
   ICA Usage Tracker — Google Sheets Integration (self-service mode)
   ─────────────────────────────────────────────────────────────────────────
   HOW IT WORKS:
     • On every page load, fetchFromSheets() GETs today's rows from the Apps
       Script endpoint and merges them into localStorage so the dashboard
       always shows the latest collective data.

     • The "Submit Usage" view lets each team member log their own assistants.
       They pick their name from a dropdown, enter their assistants, and hit
       Submit. Once submitted for today, the form locks for that person —
       they cannot resubmit. Submission state is stored in localStorage.

   CONFIG.SHEETS_URL must be set to your deployed Apps Script URL.
   ========================================================================== */

// ---------------------------------------------------------------------------
//  Submitted-today tracking  (localStorage key: "ica_submitted_YYYY-MM-DD")
//  Value: JSON array of lowercase email strings that have submitted today.
// ---------------------------------------------------------------------------
function getSubmittedToday(dateKey) {
  try {
    return JSON.parse(localStorage.getItem("ica_submitted_" + dateKey)) || [];
  } catch (e) { return []; }
}

function markSubmittedToday(dateKey, email) {
  const list = getSubmittedToday(dateKey);
  if (!list.includes(email.toLowerCase())) {
    list.push(email.toLowerCase());
    localStorage.setItem("ica_submitted_" + dateKey, JSON.stringify(list));
  }
}

function hasSubmittedToday(dateKey, email) {
  return getSubmittedToday(dateKey).includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
//  Fetch today's data from Google Sheets and merge into localStorage
// ---------------------------------------------------------------------------
async function fetchFromSheets(dateKey) {
  if (!CONFIG.SHEETS_URL) return;

  return new Promise(resolve => {
    // Use JSONP to bypass corporate network fetch() blocks.
    // A <script> tag is injected; Apps Script wraps the response in the
    // callback function name, which the browser executes directly.
    const callbackName = "_icaCb_" + Date.now();
    const script       = document.createElement("script");
    let   settled      = false;

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    };

    // Timeout after 8 seconds
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      console.warn("[Sheets] fetchFromSheets timed out.");
      resolve();
    }, 8000);

    window[callbackName] = function(json) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();

      console.log("[Sheets] fetchFromSheets response:", JSON.stringify(json).slice(0, 300));

      try {
        if (!json.ok) { console.warn("[Sheets] json.ok is false:", json); resolve(); return; }

        const today    = new Date().toISOString().slice(0, 10);
        const existing = Storage.getDay(dateKey);

        console.log("[Sheets] dateKey:", dateKey, "| rows:", json.rows ? json.rows.length : "n/a", "| existing in localStorage:", !!existing);

        // If the sheet has rows for this date, merge them in (sheet wins when
        // its timestamp is newer, or when this is today's date).
        if (Array.isArray(json.rows) && json.rows.length > 0) {
          const first     = json.rows[0];
          const rosterMap = {};
          ROSTER.forEach(p => { rosterMap[p.email.toLowerCase()] = p; });
          const sheetRows = json.rows.map(row => {
            const rp = rosterMap[row.email.toLowerCase()] || {};
            return {
              email:      row.email,
              name:       row.name  || rp.name  || "",
              team:       row.team  || rp.team  || "",
              fte:        parseFloat(row.fte) || rp.fte || 1,
              assistants: Array.isArray(row.assistants) ? row.assistants : []
            };
          });

          const sheetTs = new Date(first.uploadedAt || 0).getTime();
          const localTs = existing && existing.uploadedAt
                            ? new Date(existing.uploadedAt).getTime() : 0;

          console.log("[Sheets] sheetTs:", sheetTs, "| localTs:", localTs, "| will merge:", dateKey === today || sheetTs >= localTs);

          if (dateKey === today || sheetTs >= localTs) {
            const recordMap = {};
            sheetRows.forEach(r => { recordMap[r.email.toLowerCase()] = normaliseRecord(r); });
            ROSTER.forEach(p => {
              const k = p.email.toLowerCase();
              if (!recordMap[k]) {
                recordMap[k] = normaliseRecord({ email: p.email, name: p.name, team: p.team, fte: p.fte, assistants: [] });
              }
            });
            const records = Object.values(recordMap);
            Storage.saveDay(dateKey, records, {
              sourceColumn: first.sourceColumn || dateKey,
              fte_total:    records.reduce((s, r) => s + (parseFloat(r.fte) || 1), 0)
            });
          }
        } else if (!existing) {
          // Sheet has no submissions yet for this date AND localStorage is also
          // empty (e.g. private/incognito window). Seed the ROSTER baseline so
          // the dashboard shows correct headcount and adoption % from the start.
          const recordMap = {};
          ROSTER.forEach(p => {
            recordMap[p.email.toLowerCase()] = normaliseRecord({
              email: p.email, name: p.name, team: p.team, fte: p.fte, assistants: []
            });
          });
          const records = Object.values(recordMap);
          Storage.saveDay(dateKey, records, {
            sourceColumn: dateKey,
            fte_total:    records.reduce((s, r) => s + (parseFloat(r.fte) || 1), 0)
          });
        }
      } catch (err) {
        console.warn("[Sheets] fetchFromSheets parse error:", err.message);
      }
      resolve();
    };

    script.src = `${CONFIG.SHEETS_URL}?dateKey=${encodeURIComponent(dateKey)}&callback=${callbackName}`;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      console.warn("[Sheets] fetchFromSheets script load failed.");
      resolve();
    };
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
//  POST a single person's usage via JSONP-over-GET
//  (corporate networks block fetch() to script.google.com; a <script> tag
//   is the only reliable cross-origin transport available)
// ---------------------------------------------------------------------------
async function postToSheets(payload) {
  // payload = { dateKey, sourceColumn, uploadedAt, record: { email, name, team, fte, assistants } }
  return new Promise((resolve, reject) => {
    const callbackName = "_icaPost_" + Date.now();
    const script       = document.createElement("script");
    let   settled      = false;

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Submission timed out. Please check your connection and try again."));
    }, 20000);

    window[callbackName] = function(json) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      console.log("[Sheets] postToSheets response:", JSON.stringify(json));
      if (json && json.ok) {
        resolve(json);
      } else {
        reject(new Error((json && json.error) || "Unknown error from Apps Script."));
      }
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      console.error("[Sheets] postToSheets script load failed — URL was:", script.src.slice(0, 120));
      reject(new Error("Submission failed — network error. Please try again."));
    };

    const data = encodeURIComponent(JSON.stringify(payload));
    const url  = `${CONFIG.SHEETS_URL}?action=post&data=${data}&callback=${callbackName}`;
    console.log("[Sheets] postToSheets sending to:", url.slice(0, 120));
    script.src = url;
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
//  Build the "Submit Usage" view — self-service, one person at a time
// ---------------------------------------------------------------------------
function renderSubmitView() {
  const container = document.getElementById("submit-content");
  if (!container) return;

  if (!CONFIG.SHEETS_URL) {
    container.innerHTML = `
      <div class="card">
        <p class="text-dim" style="padding:16px;">
          ⚙️ <strong>Not configured yet.</strong><br>
          Set <code>CONFIG.SHEETS_URL</code> in <code>js/config.js</code> to your deployed
          Apps Script URL to enable live submissions.
        </p>
      </div>`;
    return;
  }

  const today      = new Date().toISOString().slice(0, 10);
  const loggedUser = getLoggedInUser(); // from login.js — null if not logged in

  // Build name options sorted by team then name
  const sorted = [...ROSTER].sort((a, b) =>
    a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  let nameOptions = `<option value="">— Select your name —</option>`;
  let currentTeam = null;
  sorted.forEach(p => {
    if (p.team !== currentTeam) {
      if (currentTeam !== null) nameOptions += `</optgroup>`;
      nameOptions += `<optgroup label="${escapeHTML(p.team)}">`;
      currentTeam = p.team;
    }
    const selected = loggedUser && p.email.toLowerCase() === loggedUser.email.toLowerCase()
      ? "selected" : "";
    nameOptions += `<option
      value="${escapeHTML(p.email)}"
      data-name="${escapeHTML(p.name)}"
      data-team="${escapeHTML(p.team)}"
      data-fte="${p.fte}" ${selected}>${escapeHTML(p.name)}</option>`;
  });
  if (currentTeam !== null) nameOptions += `</optgroup>`;

  container.innerHTML = `
    <style>
      /* ── Submit Usage page local styles ── */
      .sub-identity-card {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        align-items: end;
      }
      @media (max-width: 700px) { .sub-identity-card { grid-template-columns: 1fr; } }

      .sub-field label {
        display: block;
        font-size: 11.5px;
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--text-faint);
        margin-bottom: 7px;
      }
      .sub-field select,
      .sub-field input[type="text"] {
        width: 100%;
        background: var(--surface-3);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        color: var(--text);
        font-family: var(--font-body);
        font-size: 14px;
        padding: 10px 12px;
        transition: border-color .18s;
        appearance: none;
        -webkit-appearance: none;
      }
      .sub-field select:focus,
      .sub-field input[type="text"]:focus {
        outline: none;
        border-color: var(--heineken-green-bright);
      }
      .sub-field select:disabled,
      .sub-field input[type="text"]:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .sub-field select option { background: var(--surface-2); }
      .sub-field select optgroup { color: var(--text-faint); font-size: 11px; }

      .sub-team-badge {
        display: inline-block;
        padding: 6px 14px;
        background: rgba(0,166,80,0.12);
        border: 1px solid rgba(0,166,80,0.28);
        border-radius: 20px;
        font-size: 13px;
        color: var(--heineken-green-bright);
        font-family: var(--font-mono);
        letter-spacing: 0.3px;
        margin-top: 4px;
      }

      .sub-date-badge {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--heineken-green-bright);
        letter-spacing: 1px;
        background: rgba(22,201,100,0.08);
        border: 1px solid rgba(22,201,100,0.18);
        border-radius: 6px;
        padding: 3px 10px;
        display: inline-block;
        margin-left: 8px;
        vertical-align: middle;
      }

      .sub-chips-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 10px;
      }
      .sub-chip {
        font-size: 12px;
        padding: 4px 12px;
        border: 1px solid var(--border);
        border-radius: 20px;
        background: var(--surface-3);
        cursor: pointer;
        color: var(--text-dim);
        font-family: var(--font-body);
        transition: background .15s, border-color .15s, color .15s;
        white-space: nowrap;
      }
      .sub-chip:hover {
        background: rgba(0,166,80,0.14);
        border-color: rgba(0,166,80,0.4);
        color: var(--heineken-green-bright);
      }
      .sub-chip.active {
        background: rgba(0,166,80,0.18);
        border-color: var(--heineken-green-bright);
        color: var(--heineken-green-bright);
      }

      /* ── OOO toggle banner ── */
      .sub-ooo-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 20px;
        border-radius: var(--radius-md);
        border: 1.5px dashed rgba(69,137,255,0.35);
        background: rgba(69,137,255,0.06);
        margin-top: 16px;
        cursor: pointer;
        transition: border-color .2s, background .2s;
        user-select: none;
      }
      .sub-ooo-banner:hover {
        border-color: rgba(69,137,255,0.6);
        background: rgba(69,137,255,0.10);
      }
      .sub-ooo-banner.active {
        border-style: solid;
        border-color: #4589ff;
        background: rgba(69,137,255,0.13);
      }
      .sub-ooo-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .sub-ooo-icon {
        font-size: 24px;
        line-height: 1;
        flex-shrink: 0;
      }
      .sub-ooo-title {
        font-size: 14px;
        font-weight: 600;
        color: #8cb4ff;
      }
      .sub-ooo-sub {
        font-size: 11.5px;
        color: var(--text-faint);
        margin-top: 2px;
      }
      /* pill toggle switch */
      .sub-ooo-toggle {
        width: 44px;
        height: 24px;
        border-radius: 12px;
        background: var(--surface-3);
        border: 1.5px solid var(--border);
        position: relative;
        flex-shrink: 0;
        transition: background .2s, border-color .2s;
      }
      .sub-ooo-toggle::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--text-faint);
        transition: transform .2s, background .2s;
      }
      .sub-ooo-banner.active .sub-ooo-toggle {
        background: #4589ff;
        border-color: #4589ff;
      }
      .sub-ooo-banner.active .sub-ooo-toggle::after {
        transform: translateX(20px);
        background: #fff;
      }

      /* usage card collapsed when OOO */
      #sub-usage-card {
        transition: opacity .25s, max-height .3s;
        max-height: 600px;
        overflow: hidden;
      }
      #sub-usage-card.sub-ooo-collapsed {
        opacity: 0.35;
        pointer-events: none;
        max-height: 0;
      }

      #sub-submit-btn {
        margin-top: 4px;
        padding: 11px 28px;
        font-size: 14px;
        letter-spacing: 0.2px;
      }
      #sub-submit-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      #sub-submit-btn.sub-ooo-btn {
        background: linear-gradient(135deg, #2d4fa0, #4589ff);
        border-color: #4589ff;
      }

      .sub-status-bar {
        margin-top: 14px;
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        font-size: 13.5px;
        line-height: 1.5;
        display: none;
      }
      .sub-status-bar.show { display: block; }
      .sub-status-bar.ok   { background: rgba(22,201,100,0.10); border: 1px solid rgba(22,201,100,0.30); color: var(--heineken-green-bright); }
      .sub-status-bar.warn { background: rgba(255,176,0,0.10);  border: 1px solid rgba(255,176,0,0.30);  color: var(--amber); }
      .sub-status-bar.ooo  { background: rgba(69,137,255,0.10); border: 1px solid rgba(69,137,255,0.30); color: #8cb4ff; }
      .sub-status-bar.error{ background: rgba(237,28,36,0.10);  border: 1px solid rgba(237,28,36,0.30);  color: #ff7b7f; }
    </style>

    <!-- Step 1 — Identity -->
    <div class="card">
      <div class="card-head">
        <h3>
          <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Who are you?
        </h3>
      </div>
      <div class="sub-identity-card">
        <div class="sub-field">
          <label>Your name</label>
          <select id="sub-name-select">
            ${nameOptions}
          </select>
        </div>
        <div id="sub-team-display" style="display:none;">
          <div style="font-size:11.5px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.8px;color:var(--text-faint);margin-bottom:7px;">Team</div>
          <span class="sub-team-badge" id="sub-team-val">—</span>
        </div>
      </div>
    </div>

    <!-- OOO toggle banner -->
    <div class="sub-ooo-banner" id="sub-ooo-banner" role="checkbox" aria-checked="false" tabindex="0">
      <div class="sub-ooo-left">
        <span class="sub-ooo-icon">✈️</span>
        <div>
          <div class="sub-ooo-title">Out of Office today</div>
          <div class="sub-ooo-sub">On leave, travelling, or otherwise unavailable? Toggle this on — no ICA usage needed.</div>
        </div>
      </div>
      <div class="sub-ooo-toggle" aria-hidden="true"></div>
    </div>

    <!-- Step 2 — Assistants -->
    <div class="card" id="sub-usage-card" style="margin-top:16px;">
      <div class="card-head">
        <h3>
          <svg class="ch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M8 8h5M8 16h3"/></svg>
          Today's ICA Usage
        </h3>
        <span class="sub-date-badge">${today}</span>
      </div>
      <input type="hidden" id="sub-date" value="${today}">

      <div class="sub-field">
        <label>Assistants used <span style="text-transform:none;letter-spacing:0;font-size:11px;color:var(--text-faint);">— comma-separated</span></label>
        <input type="text" id="sub-assistants" placeholder="e.g. Email Generator, Notes Analyzer">
      </div>

      <div style="margin-top:14px;">
        <div style="font-size:11.5px;color:var(--text-faint);margin-bottom:8px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.8px;">Quick add</div>
        <div class="sub-chips-wrap" id="sub-chips">
          ${KNOWN_ASSISTANTS.slice(0, 16).map(a =>
            `<button type="button" class="sub-chip" data-val="${escapeHTML(a)}">${escapeHTML(a)}</button>`
          ).join("")}
        </div>
      </div>
    </div>

    <!-- Submit -->
    <div class="card" style="margin-top:16px;">
      <button class="btn primary" id="sub-submit-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:7px;vertical-align:middle;"><path d="M5 12l5 5L20 7"/></svg>
        Submit My Usage
      </button>
      <div class="sub-status-bar" id="sub-status"></div>
    </div>`;

  // Wire up team display + already-submitted lock when name is selected
  document.getElementById("sub-name-select").addEventListener("change", function() {
    const opt     = this.options[this.selectedIndex];
    const dateKey = document.getElementById("sub-date").value.trim();
    const teamInput   = document.getElementById("sub-team-val");
    const teamDisplay = document.getElementById("sub-team-display");

    if (opt.value) {
      teamInput.textContent     = opt.dataset.team || "—";
      teamDisplay.style.display = "";
    } else {
      teamInput.textContent     = "—";
      teamDisplay.style.display = "none";
    }

    checkAlreadySubmitted(opt.value, dateKey);
  });

  // Also re-check when the date changes
  document.getElementById("sub-date").addEventListener("change", function() {
    const select = document.getElementById("sub-name-select");
    const opt    = select.options[select.selectedIndex];
    if (opt.value) checkAlreadySubmitted(opt.value, this.value);
  });

  // ── OOO toggle ──
  const oooBanner = document.getElementById("sub-ooo-banner");
  oooBanner.addEventListener("click", _toggleOOO);
  oooBanner.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); _toggleOOO(); } });

  // Quick-add chips — toggle on/off, keep chip highlights in sync with input
  function syncChipStates() {
    const inp  = document.getElementById("sub-assistants");
    if (!inp) return;
    const active = inp.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    document.querySelectorAll("#sub-chips .sub-chip").forEach(c => {
      c.classList.toggle("active", active.includes(c.dataset.val.toLowerCase()));
    });
  }

  document.getElementById("sub-chips").addEventListener("click", function(e) {
    const chip = e.target.closest(".sub-chip");
    if (!chip) return;
    const inp    = document.getElementById("sub-assistants");
    const active = inp.value.split(",").map(s => s.trim()).filter(Boolean);
    const val    = chip.dataset.val;
    const idx    = active.findIndex(s => s.toLowerCase() === val.toLowerCase());
    if (idx === -1) {
      // Add
      active.push(val);
    } else {
      // Remove (toggle off)
      active.splice(idx, 1);
    }
    inp.value = active.join(", ");
    syncChipStates();
    inp.focus();
  });

  // Keep chips in sync as user types manually
  document.getElementById("sub-assistants").addEventListener("input", syncChipStates);

  // Highlight chips that match the pre-filled value on load
  syncChipStates();

  document.getElementById("sub-submit-btn").addEventListener("click", handleSelfSubmit);
}

function _isOOO() {
  const b = document.getElementById("sub-ooo-banner");
  return b && b.classList.contains("active");
}

function _toggleOOO() {
  const banner    = document.getElementById("sub-ooo-banner");
  const usageCard = document.getElementById("sub-usage-card");
  const submitBtn = document.getElementById("sub-submit-btn");
  if (!banner) return;

  const nowOOO = !banner.classList.contains("active");
  banner.classList.toggle("active", nowOOO);
  banner.setAttribute("aria-checked", nowOOO ? "true" : "false");

  if (usageCard) usageCard.classList.toggle("sub-ooo-collapsed", nowOOO);

  if (submitBtn) {
    if (nowOOO) {
      submitBtn.classList.add("sub-ooo-btn");
      submitBtn.innerHTML = `<span style="margin-right:8px;font-size:15px;">✈️</span>Mark as Out of Office`;
    } else {
      submitBtn.classList.remove("sub-ooo-btn");
      submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:7px;vertical-align:middle;"><path d="M5 12l5 5L20 7"/></svg>Submit My Usage`;
    }
  }
}

// ---------------------------------------------------------------------------
//  Lock / unlock the form based on whether the person already submitted
// ---------------------------------------------------------------------------
function checkAlreadySubmitted(email, dateKey) {
  if (!email || !dateKey) return;

  const btn       = document.getElementById("sub-submit-btn");
  const asstInput = document.getElementById("sub-assistants");
  const oooBanner = document.getElementById("sub-ooo-banner");
  const usageCard = document.getElementById("sub-usage-card");

  if (hasSubmittedToday(dateKey, email)) {
    const day = Storage.getDay(dateKey);
    const rec = day && day.records
      ? day.records.find(r => r.email.toLowerCase() === email.toLowerCase())
      : null;

    const wasOOO = rec && rec.onLeave;
    const submitted = rec && rec.assistants && rec.assistants.length > 0 && !wasOOO
      ? rec.assistants.join(", ")
      : wasOOO ? "Out of Office" : "(none / not used)";

    // Reflect OOO state visually
    if (oooBanner) {
      oooBanner.classList.toggle("active", wasOOO);
      oooBanner.setAttribute("aria-checked", wasOOO ? "true" : "false");
    }
    if (usageCard) usageCard.classList.toggle("sub-ooo-collapsed", !!wasOOO);
    if (asstInput) {
      asstInput.value    = wasOOO ? "" : submitted;
      asstInput.disabled = true;
      // Highlight chips matching the already-submitted assistants
      const active = asstInput.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      document.querySelectorAll("#sub-chips .sub-chip").forEach(c => {
        c.classList.toggle("active", active.includes(c.dataset.val.toLowerCase()));
      });
    }
    if (btn) {
      btn.disabled = true;
      if (wasOOO) {
        btn.classList.add("sub-ooo-btn");
        btn.innerHTML = `<span style="margin-right:8px;font-size:15px;">✈️</span>Marked as Out of Office`;
      } else {
        btn.classList.remove("sub-ooo-btn");
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:7px;vertical-align:middle;"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>Already Submitted`;
      }
    }
    setSubStatus(wasOOO ? "ooo" : "warn",
      wasOOO
        ? `✈️ <strong>Marked as Out of Office for ${dateKey}.</strong><br><span style="font-size:12px;opacity:0.8;">Contact admin if you need a correction.</span>`
        : `⚠️ <strong>Already submitted for ${dateKey}.</strong><br>Recorded: <em>${escapeHTML(submitted)}</em><br><span style="font-size:12px;opacity:0.8;">Contact admin if you need a correction.</span>`);
  } else {
    // Unlock the form — pre-fill from localStorage/Sheet data if available
    if (asstInput) {
      asstInput.disabled = false;

      // Look up whatever is already recorded for this person today
      const day    = Storage.getDay(dateKey);
      const rec    = day && day.records
        ? day.records.find(r => r.email.toLowerCase() === email.toLowerCase())
        : null;
      const isOOO  = rec && rec.onLeave;
      const prefill = rec && !isOOO && rec.assistants && rec.assistants.length > 0
        ? rec.assistants.join(", ")
        : "";

      asstInput.value = prefill;

      // Sync chip highlights to pre-filled value
      const active = prefill.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      document.querySelectorAll("#sub-chips .sub-chip").forEach(c => {
        c.classList.toggle("active", active.includes(c.dataset.val.toLowerCase()));
      });

      // Pre-fill OOO toggle if they were marked OOO in the sheet
      if (oooBanner) {
        oooBanner.classList.toggle("active", !!isOOO);
        oooBanner.setAttribute("aria-checked", isOOO ? "true" : "false");
      }
      if (usageCard) usageCard.classList.toggle("sub-ooo-collapsed", !!isOOO);
    }
    if (!asstInput) {
      if (oooBanner) { oooBanner.classList.remove("active"); oooBanner.setAttribute("aria-checked", "false"); }
      if (usageCard) usageCard.classList.remove("sub-ooo-collapsed");
    }
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("sub-ooo-btn");
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:7px;vertical-align:middle;"><path d="M5 12l5 5L20 7"/></svg>Submit My Usage`;
    }
    setSubStatus("", "");
  }
}

async function handleSelfSubmit() {
  const btn     = document.getElementById("sub-submit-btn");

  const select  = document.getElementById("sub-name-select");
  const opt     = select.options[select.selectedIndex];
  const email   = opt.value;
  const name    = opt.dataset && opt.dataset.name  ? opt.dataset.name  : "";
  const team    = opt.dataset && opt.dataset.team  ? opt.dataset.team  : "";
  const fte     = opt.dataset && opt.dataset.fte   ? parseFloat(opt.dataset.fte) : 1;
  const dateKey = document.getElementById("sub-date").value.trim();
  const ooo     = _isOOO();
  const rawAsst = ooo ? "" : document.getElementById("sub-assistants").value.trim();

  // Validate
  if (!email) {
    setSubStatus("error", "⛔ Please select your name.");
    return;
  }
  if (!dateKey) {
    setSubStatus("error", "⛔ Please select a date.");
    return;
  }

  // OOO submits the special "On Leave" sentinel that normaliseRecord picks up
  const assistants = ooo
    ? ["On Leave"]
    : rawAsst === "" ? [] : rawAsst.split(",").map(s => s.trim()).filter(Boolean);

  btn.disabled    = true;
  btn.textContent = "Submitting…";
  setSubStatus("", "");

  try {
    const now = new Date().toISOString();
    const payload = {
      dateKey,
      sourceColumn: dateKey,   // individuals don't track the Excel column label
      uploadedAt:   now,
      record: { email, name, team, fte, assistants }
    };

    await postToSheets(payload);

    // Update localStorage immediately so the dashboard reflects this right away.
    // Base = full ROSTER (so adoption % is always out of total headcount, not
    // just the number of people who have submitted so far).
    const existing     = Storage.getDay(dateKey);
    const existingRecs = (existing && existing.records) ? existing.records : [];

    // Build a map of already-saved records keyed by lowercase email
    const savedMap = {};
    existingRecs.forEach(r => { savedMap[r.email.toLowerCase()] = r; });

    // Overwrite with the new submission
    const emailLower = email.toLowerCase();
    savedMap[emailLower] = normaliseRecord({ email, name, team, fte, assistants });

    // Fill the rest of the ROSTER as "not yet used" if not already present
    ROSTER.forEach(p => {
      const k = p.email.toLowerCase();
      if (!savedMap[k]) {
        savedMap[k] = normaliseRecord({ email: p.email, name: p.name, team: p.team, fte: p.fte, assistants: [] });
      }
    });

    const merged = Object.values(savedMap);
    Storage.saveDay(dateKey, merged, {
      sourceColumn: existing ? existing.sourceColumn : dateKey,
      fte_total:    merged.reduce((s, r) => s + (parseFloat(r.fte) || 1), 0)
    });

    // Mark as submitted in localStorage so the form locks immediately
    markSubmittedToday(dateKey, email);

    setSubStatus(ooo ? "ooo" : "ok",
      ooo
        ? `✈️ <strong>${escapeHTML(name)}</strong> marked as Out of Office for ${dateKey}.`
        : `✅ <strong>${escapeHTML(name)}</strong>'s usage saved for ${dateKey}.`);
    showToast(ooo ? `${name} marked as Out of Office.` : `${name}'s usage saved!`, "ok");

    // Lock the form right away
    checkAlreadySubmitted(email, dateKey);

    // Refresh dashboard / report if visible
    if (document.getElementById("view-dashboard").classList.contains("active")) renderDashboard();
    if (document.getElementById("view-report").classList.contains("active"))    renderReport();

  } catch (err) {
    setSubStatus("error", `⛔ Failed: ${err.message}`);
    showToast("Submission failed — see status message.", "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Submit My Usage";
  }
}

function setSubStatus(type, message) {
  const el = document.getElementById("sub-status");
  if (!el) return;
  el.className = "sub-status-bar" + (type ? " show " + type : "");
  el.innerHTML  = message || "";
}

// ---------------------------------------------------------------------------
//  On page load — pull today's data from Sheets into localStorage
// ---------------------------------------------------------------------------
async function initSheets() {
  if (!CONFIG.SHEETS_URL) return;
  const today = new Date().toISOString().slice(0, 10);
  await fetchFromSheets(today);
}
