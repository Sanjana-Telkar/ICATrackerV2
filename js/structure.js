/* ==========================================================================
   ICA Usage Tracker — Team Structure renderer
   Reads STREAM_STRUCTURE from data.js and builds the Section 04 view.
   No server, no backend — edit STREAM_STRUCTURE in data.js and git-push.
   ========================================================================== */

/* Stream accent colours — cycling through the design-system palette */
const STREAM_COLORS = [
  { bg: "rgba(0,166,80,0.12)",    border: "rgba(0,166,80,0.30)",    text: "#16c964" },   // green
  { bg: "rgba(69,137,255,0.11)",  border: "rgba(69,137,255,0.28)",  text: "#4589ff" },   // blue
  { bg: "rgba(255,176,0,0.11)",   border: "rgba(255,176,0,0.28)",   text: "#ffb000" },   // amber
  { bg: "rgba(200,100,255,0.10)", border: "rgba(200,100,255,0.25)", text: "#c87eff" },   // purple
  { bg: "rgba(0,200,220,0.10)",   border: "rgba(0,200,220,0.25)",   text: "#00c8dc" },   // teal
  { bg: "rgba(237,100,36,0.11)",  border: "rgba(237,100,36,0.28)",  text: "#f07040" },   // orange
  { bg: "rgba(22,201,100,0.10)",  border: "rgba(22,201,100,0.22)",  text: "#16c964" },   // bright-green
  { bg: "rgba(140,180,255,0.10)", border: "rgba(140,180,255,0.24)", text: "#8cb4ff" },   // periwinkle
];

function renderStructure() {
  const container = document.getElementById("structure-content");
  if (!container) return;

  if (typeof STREAM_STRUCTURE === "undefined") {
    container.innerHTML = `<div class="card empty-state"><div style="font-size:14px;color:var(--text-faint);">STREAM_STRUCTURE not found in data.js.</div></div>`;
    return;
  }

  const streams = Object.entries(STREAM_STRUCTURE);
  const totalTeams   = streams.reduce((s, [, v]) => s + v.length, 0);
  const ibmLed       = streams.reduce((s, [, v]) => s + v.filter(r => r.lead !== "IBM not involved" && r.lead !== "TBD").length, 0);
  const notInvolved  = streams.reduce((s, [, v]) => s + v.filter(r => r.lead === "IBM not involved").length, 0);
  const tbd          = streams.reduce((s, [, v]) => s + v.filter(r => r.lead === "TBD").length, 0);

  // ── Summary KPI bar ──
  const summaryHTML = `
    <div class="str-summary">
      <div class="str-kpi">
        <div class="str-kpi-val">${streams.length}</div>
        <div class="str-kpi-lbl">Streams</div>
      </div>
      <div class="str-kpi-div"></div>
      <div class="str-kpi">
        <div class="str-kpi-val">${totalTeams}</div>
        <div class="str-kpi-lbl">Product Teams</div>
      </div>
      <div class="str-kpi-div"></div>
      <div class="str-kpi">
        <div class="str-kpi-val" style="color:var(--heineken-green-bright)">${ibmLed}</div>
        <div class="str-kpi-lbl">IBM Led</div>
      </div>
      <div class="str-kpi-div"></div>
      <div class="str-kpi">
        <div class="str-kpi-val" style="color:var(--text-faint)">${notInvolved}</div>
        <div class="str-kpi-lbl">IBM Not Involved</div>
      </div>
      ${tbd ? `<div class="str-kpi-div"></div>
      <div class="str-kpi">
        <div class="str-kpi-val" style="color:var(--amber)">${tbd}</div>
        <div class="str-kpi-lbl">TBD</div>
      </div>` : ""}
    </div>`;

  // ── Stream cards grid ──
  const cardsHTML = streams.map(([streamName, teams], idx) => {
    const color  = STREAM_COLORS[idx % STREAM_COLORS.length];
    const ibmCount = teams.filter(r => r.lead !== "IBM not involved" && r.lead !== "TBD").length;

    const rows = teams.map(r => {
      const notInv = r.lead === "IBM not involved";
      const isTBD  = r.lead === "TBD";
      return `
        <div class="str-row ${notInv ? "str-row-dim" : ""}">
          <div class="str-team-name">${escapeHTML(r.team)}</div>
          <div class="str-lead ${notInv ? "str-lead-nil" : isTBD ? "str-lead-tbd" : ""}">
            ${notInv
              ? `<span class="str-badge-nil">IBM not involved</span>`
              : isTBD
                ? `<span class="str-badge-tbd">TBD</span>`
                : `<span class="str-lead-avatar">${r.lead.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</span>${escapeHTML(r.lead)}`
            }
          </div>
        </div>`;
    }).join("");

    return `
      <div class="str-card" style="--stream-bg:${color.bg};--stream-border:${color.border};--stream-text:${color.text};">
        <div class="str-card-head">
          <div class="str-stream-dot"></div>
          <h3 class="str-stream-name">${escapeHTML(streamName)}</h3>
          <span class="str-stream-count">${ibmCount} IBM lead${ibmCount !== 1 ? "s" : ""} · ${teams.length} team${teams.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="str-header-row">
          <div class="str-col-hd">Product Team</div>
          <div class="str-col-hd">IBM Lead</div>
        </div>
        <div class="str-rows">${rows}</div>
      </div>`;
  }).join("");

  container.innerHTML = summaryHTML + `<div class="str-grid">${cardsHTML}</div>`;
}
