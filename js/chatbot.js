/* ==========================================================================
   ICA Usage Tracker — Insights Chatbot
   Fully client-side, rule-based analysis over whatever data is currently
   loaded (no external API / key required). Ask about teams, laggards,
   top assistants, trends, etc.
   ========================================================================== */

const SUGGESTIONS = [
  "Today's summary",
  "Top team",
  "Who hasn't used ICA?",
  "Most used assistant",
  "Trend this week"
];

function chatAppend(role, html) {
  const body = document.getElementById("chatBody");
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = html;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function chatTyping(show) {
  let el = document.getElementById("typingIndicator");
  if (show) {
    if (el) return;
    el = document.createElement("div");
    el.id = "typingIndicator";
    el.className = "msg bot typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    document.getElementById("chatBody").appendChild(el);
    document.getElementById("chatBody").scrollTop = 9999;
  } else if (el) {
    el.remove();
  }
}

function answerInsight(query) {
  const q = query.toLowerCase();
  const { dateKey, records } = getTodayRecords();

  if (!dateKey || !records.length) {
    return `I don't have any workbook data loaded yet. Upload today's ICA tracker in the <b>Upload</b> section and I'll be able to analyze it.`;
  }

  const s = computeSummary(records);
  const niceDate = new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  if (/who.*(not|hasn|haven)|laggard|not used|reminder/.test(q)) {
    const list = records.filter(r => !r.used);
    if (!list.length) return `Everyone on the roster has used ICA today (${niceDate}). 🎉`;
    return `<b>${list.length} practitioner(s)</b> have no ICA usage logged for ${niceDate}:<ul>${list.slice(0, 12).map(r => `<li>${escapeHTML(r.name)} — ${escapeHTML(r.team)}</li>`).join("")}</ul>${list.length > 12 ? `…and ${list.length - 12} more. See the <b>Today's Report</b> section (filter: Not used).` : `You can send reminders from <b>Today's Report</b>.`}`;
  }

  if (/top team|best team|leading team/.test(q)) {
    const ranked = Object.entries(s.byTeam).filter(([, v]) => v.total > 0)
      .map(([t, v]) => [t, v.total ? v.used / v.total : 0, v]).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return "No team data available yet.";
    const [team, ratio, v] = ranked[0];
    return `<b>${escapeHTML(team)}</b> leads adoption today at <b>${Math.round(ratio * 100)}%</b> (${v.used}/${v.total} active). ${ranked[1] ? `Runner-up: ${escapeHTML(ranked[1][0])} at ${Math.round(ranked[1][1] * 100)}%.` : ""}`;
  }

  if (/lowest|worst|behind|struggl/.test(q)) {
    const ranked = Object.entries(s.byTeam).filter(([, v]) => v.total > 0)
      .map(([t, v]) => [t, v.total ? v.used / v.total : 0, v]).sort((a, b) => a[1] - b[1]);
    if (!ranked.length) return "No team data available yet.";
    const [team, ratio, v] = ranked[0];
    return `<b>${escapeHTML(team)}</b> currently has the lowest adoption at <b>${Math.round(ratio * 100)}%</b> (${v.used}/${v.total}). Might be worth a nudge.`;
  }

  if (/most used|popular|top assistant/.test(q)) {
    const top = Object.entries(s.assistantCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!top.length) return "No assistant usage has been logged yet today.";
    return `Top assistants today:<ul>${top.map(([a, c]) => `<li>${escapeHTML(a)} — ${c} use(s)</li>`).join("")}</ul>`;
  }

  if (/trend|week|history|compare/.test(q)) {
    const dates = Storage.getAllDatesSorted().slice(-5);
    if (dates.length < 2) return `I only have one day of data so far (${niceDate}). Upload a few more days and I'll show adoption trends.`;
    const lines = dates.map(d => {
      const day = Storage.getDay(d);
      const sm = computeSummary(day.records);
      return `<li>${d}: ${sm.pct}% (${sm.used}/${sm.total})</li>`;
    });
    return `Adoption trend, last ${dates.length} uploaded day(s):<ul>${lines.join("")}</ul>`;
  }

  if (/summary|overview|how are we doing|status/.test(q)) {
    return `On ${niceDate}: <b>${s.pct}%</b> adoption — ${s.used} of ${s.total} practitioners used ICA. ${s.topAssistant ? `Top assistant: <b>${escapeHTML(s.topAssistant[0])}</b>.` : ""} ${s.notUsed} practitioner(s) haven't logged usage yet.`;
  }

  // default fallback
  return `Here's where things stand for ${niceDate}: <b>${s.pct}%</b> adoption (${s.used}/${s.total}). Try asking me things like "who hasn't used ICA?", "top team", "most used assistant", or "trend this week".`;
}

function initChatbot() {
  const fab = document.getElementById("chatFab");
  const panel = document.getElementById("chatPanel");
  const closeBtn = document.getElementById("chatClose");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  const suggWrap = document.getElementById("chatSuggestions");

  suggWrap.innerHTML = SUGGESTIONS.map(s => `<button type="button">${s}</button>`).join("");
  suggWrap.querySelectorAll("button").forEach(b => b.addEventListener("click", () => runChat(b.textContent)));

  fab.addEventListener("click", () => {
    panel.classList.toggle("show");
    if (panel.classList.contains("show") && !document.getElementById("chatBody").dataset.greeted) {
      document.getElementById("chatBody").dataset.greeted = "1";
      chatAppend("bot", "Hi! I'm your ICA insights assistant. Ask me about today's adoption, top teams, or who still needs to log usage.");
    }
  });
  closeBtn.addEventListener("click", () => panel.classList.remove("show"));

  function runChat(text) {
    if (!text.trim()) return;
    chatAppend("user", escapeHTML(text));
    input.value = "";
    chatTyping(true);
    setTimeout(() => {
      chatTyping(false);
      chatAppend("bot", answerInsight(text));
    }, 500 + Math.random() * 400);
  }

  sendBtn.addEventListener("click", () => runChat(input.value));
  input.addEventListener("keydown", e => { if (e.key === "Enter") runChat(input.value); });
}
