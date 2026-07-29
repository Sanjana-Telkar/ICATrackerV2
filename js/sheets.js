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

  try {
    const url  = `${CONFIG.SHEETS_URL}?dateKey=${encodeURIComponent(dateKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) return;

    const json = await resp.json();
    if (!json.ok || !Array.isArray(json.rows) || json.rows.length === 0) return;

    const first   = json.rows[0];
    const records = json.rows.map(row => ({
      email:      row.email,
      name:       row.name,
      team:       row.team,
      fte:        parseFloat(row.fte) || 1,
      assistants: Array.isArray(row.assistants) ? row.assistants : []
    }));

    // Only overwrite localStorage if Sheets data is newer
    const existing = Storage.getDay(dateKey);
    const sheetTs  = new Date(first.uploadedAt || 0).getTime();
    const localTs  = existing && existing.uploadedAt
                       ? new Date(existing.uploadedAt).getTime() : 0;

    if (sheetTs >= localTs) {
      Storage.saveDay(dateKey, records.map(normaliseRecord), {
        sourceColumn: first.sourceColumn || dateKey,
        fte_total:    records.reduce((s, r) => s + (parseFloat(r.fte) || 1), 0)
      });
    }
  } catch (err) {
    console.warn("[Sheets] fetchFromSheets failed:", err.message);
  }
}

// ---------------------------------------------------------------------------
//  POST a single person's usage (upsert — overwrites if already submitted)
// ---------------------------------------------------------------------------
async function postToSheets(payload) {
  // payload = { dateKey, sourceColumn, uploadedAt, record: { email, name, team, fte, assistants } }
  const resp = await fetch(CONFIG.SHEETS_URL, {
    method:  "POST",
    headers: { "Content-Type": "text/plain" }, // avoids CORS pre-flight
    body:    JSON.stringify(payload)
  });
  const json = await resp.json();
  if (!json.ok) throw new Error(json.error || "Unknown error from Apps Script.");
  return json;
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

  const today = new Date().toISOString().slice(0, 10);

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
    nameOptions += `<option
      value="${escapeHTML(p.email)}"
      data-name="${escapeHTML(p.name)}"
      data-team="${escapeHTML(p.team)}"
      data-fte="${p.fte}">${escapeHTML(p.name)}</option>`;
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

    <!-- Step 2 — Assistants -->
    <div class="card" style="margin-top:16px;">
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

    // Check if this person already submitted for the selected date
    checkAlreadySubmitted(opt.value, dateKey);
  });

  // Also re-check when the date changes
  document.getElementById("sub-date").addEventListener("change", function() {
    const select = document.getElementById("sub-name-select");
    const opt    = select.options[select.selectedIndex];
    if (opt.value) checkAlreadySubmitted(opt.value, this.value);
  });

  // Quick-add chips
  document.getElementById("sub-chips").addEventListener("click", function(e) {
    const chip = e.target.closest(".sub-chip");
    if (!chip) return;
    const inp = document.getElementById("sub-assistants");
    const val = inp.value.trim();
    inp.value = val ? val + ", " + chip.dataset.val : chip.dataset.val;
    inp.focus();
  });

  document.getElementById("sub-submit-btn").addEventListener("click", handleSelfSubmit);
}

// ---------------------------------------------------------------------------
//  Lock / unlock the form based on whether the person already submitted
// ---------------------------------------------------------------------------
function checkAlreadySubmitted(email, dateKey) {
  if (!email || !dateKey) return;

  const btn       = document.getElementById("sub-submit-btn");
  const statusEl  = document.getElementById("sub-status");
  const asstInput = document.getElementById("sub-assistants");

  if (hasSubmittedToday(dateKey, email)) {
    // Find what they submitted (from localStorage records)
    const day = Storage.getDay(dateKey);
    const rec = day && day.records
      ? day.records.find(r => r.email.toLowerCase() === email.toLowerCase())
      : null;
    const submitted = rec && rec.assistants && rec.assistants.length > 0
      ? rec.assistants.join(", ")
      : "(none / not used)";

    // Pre-fill the field so they can see what was recorded
    if (asstInput) asstInput.value = submitted;

    // Lock the form
    if (asstInput) asstInput.disabled = true;
    if (btn) {
      btn.disabled   = true;
      btn.innerHTML  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:7px;vertical-align:middle;"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>Already Submitted`;
    }
    setSubStatus("warn",
      `⚠️ <strong>Already submitted for ${dateKey}.</strong><br>Recorded: <em>${escapeHTML(submitted)}</em><br><span style="font-size:12px;opacity:0.8;">Contact admin if you need a correction.</span>`);
  } else {
    // Unlock the form
    if (asstInput) {
      asstInput.disabled = false;
      asstInput.value    = "";
    }
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:7px;vertical-align:middle;"><path d="M5 12l5 5L20 7"/></svg>Submit My Usage`;
    }
    setSubStatus("", "");
  }
}

async function handleSelfSubmit() {
  const btn     = document.getElementById("sub-submit-btn");
  const statusEl = document.getElementById("sub-status");

  const select  = document.getElementById("sub-name-select");
  const opt     = select.options[select.selectedIndex];
  const email   = opt.value;
  const name    = opt.dataset && opt.dataset.name  ? opt.dataset.name  : "";
  const team    = opt.dataset && opt.dataset.team  ? opt.dataset.team  : "";
  const fte     = opt.dataset && opt.dataset.fte   ? parseFloat(opt.dataset.fte) : 1;
  const dateKey = document.getElementById("sub-date").value.trim();
  const rawAsst = document.getElementById("sub-assistants").value.trim();

  // Validate
  if (!email) {
    setSubStatus("error", "⛔ Please select your name.");
    return;
  }
  if (!dateKey) {
    setSubStatus("error", "⛔ Please select a date.");
    return;
  }

  const assistants = rawAsst === ""
    ? []
    : rawAsst.split(",").map(s => s.trim()).filter(Boolean);

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
    // Merge this single person's record into the existing day's data.
    const existing    = Storage.getDay(dateKey);
    const existingRecs = (existing && existing.records) ? existing.records : [];
    // Replace this person's record if present, otherwise append
    const emailLower  = email.toLowerCase();
    const merged      = existingRecs.filter(r => r.email.toLowerCase() !== emailLower);
    merged.push(normaliseRecord({ email, name, team, fte, assistants }));
    Storage.saveDay(dateKey, merged, {
      sourceColumn: existing ? existing.sourceColumn : dateKey,
      fte_total:    merged.reduce((s, r) => s + (parseFloat(r.fte) || 1), 0)
    });

    // Mark as submitted in localStorage so the form locks immediately
    markSubmittedToday(dateKey, email);

    setSubStatus("ok", `✅ <strong>${escapeHTML(name)}</strong>'s usage saved for ${dateKey}.`);
    showToast(`${name}'s usage saved!`, "ok");

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
