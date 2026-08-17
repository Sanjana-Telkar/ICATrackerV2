/* ==========================================================================
   ICA Usage Tracker — Reminder emails
   Opens the local Outlook client with a pre-filled draft:
     TO  → all practitioners who have not logged ICA usage today
     CC  → Sanjana S + Pavan Kulkarni
   ========================================================================== */

function getNotUsedToday() {
  const { records } = getTodayRecords();
  return records.filter(r => !r.used && !r.onLeave);
}

async function sendReminders() {
  const notUsed = getNotUsedToday();

  if (!notUsed.length) {
    showToast("Everyone has used ICA today — no reminders needed.", "ok");
    return;
  }

  try {
    sendViaMailto(notUsed);
    showToast(`Outlook draft opened for ${notUsed.length} practitioner(s).`, "ok");
  } catch (err) {
    console.error(err);
    showToast("Could not open mail client: " + err.message, "err");
  }
}

function sendViaMailto(notUsed) {
  const { dateKey } = getTodayRecords();

  // TO: all non-users
  const to = notUsed.map(r => r.email).join(";");

  // CC / BCC (from config)
  const cc  = (CONFIG.CC_EMAILS  || []).join(";");
  const bcc = (CONFIG.BCC_EMAILS || []).join(";");

  const niceDate = new Date(dateKey + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const subject = encodeURIComponent(`👋 Quick reminder: log your ICA usage for ${dateKey}`);

  // Numbered list of names + teams
  const nameList = notUsed.map((r, i) => `  ${i + 1}. ${r.name}  (${r.team})`).join("\n");

  const body = encodeURIComponent(
    `Hi there,\n\n` +
    `Hope your ${niceDate.split(",")[0]} is going well! 🙂\n\n` +
    `This is your friendly ICA bot pinging you with a gentle reminder:\n` +
    `according to our records, you haven't logged any ICA usage today yet.\n\n` +
    `No pressure — it takes just 2–5 minutes.\n` +
    `Open ICA, ask it one question, let it help you with something, and you're done.\n` +
    `Your future self (and your manager) will thank you.\n\n` +
    `────────────────────────────────────────\n` +
    `PRACTITIONERS WITH PENDING USAGE TODAY\n` +
    `────────────────────────────────────────\n` +
    `${nameList}\n` +
    `────────────────────────────────────────\n\n` +
    `Not sure what to use ICA for? Here are a few ideas:\n` +
    `  • Draft that email you've been putting off\n` +
    `  • Summarise a long document or meeting notes\n` +
    `  • Ask it to explain a complex topic in simple terms\n` +
    `  • Generate a status update for your project\n\n` +
    `Once you've used ICA, please update the tracker so we can mark you off the list:\n` +
    `  Tracker   : https://pages.github.ibm.com/Sanjana-S4/ICATracker/\n` +
    `  Access ICA: https://remea.ica.ibm.com/ica/curatorai/apps/ui/new-chat\n\n` +
    `────────────────────────────────────────\n` +
    `Thanks for being part of the ICA adoption journey — every interaction counts!\n\n` +
    `Warm regards,\n` +
    `ICA Adoption Tracker 🤖\n` +
    `(the bot that never sleeps, and clearly never stops sending reminders)\n` +
    `────────────────────────────────────────\n` +
    `Automated message — please do not reply directly to this email.\n` +
    `Disclaimer: Usage data is based on the latest uploaded workbook and may occasionally lag by a few minutes.`
  );

  // Open Outlook (or any local mail client) with TO, CC, BCC and body pre-filled
  const params = [`cc=${cc}`];
  if (bcc) params.push(`bcc=${bcc}`);
  params.push(`subject=${subject}`, `body=${body}`);
  window.open(`mailto:${to}?${params.join("&")}`, "_blank");
}
