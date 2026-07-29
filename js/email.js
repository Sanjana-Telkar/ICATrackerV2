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

  // CC: Sanjana + Pavan (from config)
  const cc = (CONFIG.CC_EMAILS || []).join(";");

  const subject = encodeURIComponent(`Reminder: log your ICA usage for ${dateKey}`);

  // Build a simple numbered list — works in any font (no monospace alignment needed)
  const table = notUsed.map((r, i) => `${i + 1}. ${r.name} (${r.team})`).join("\n");

  const body = encodeURIComponent(
    `Hi,\n\n` +
    `Our records indicate that the following practitioners have not logged any ICA usage for ${dateKey}:\n\n` +
    `${table}\n\n` +
    `We encourage you to make use of the IBM Consulting Assistant (ICA) for your daily work activities and productivity needs.\n\n` +
    `Access ICA here:\nhttps://remea.ica.ibm.com/ica/curatorai/apps/ui/new-chat\n\n` +
    `After using ICA, please update your usage in the tracker:\nhttps://pages.github.ibm.com/Sanjana-S4/ICATracker/\n\n` +
    `View the team usage dashboard:\nhttps://pages.github.ibm.com/Sanjana-S4/ICATracker/\n\n` +
    `Even a single ICA interaction per day helps us track adoption and identify valuable use cases across teams.\n\n` +
    `---\n` +
    `Disclaimer: This email is generated automatically based on an AI-generated usage report. While every effort is made to ensure accuracy, the report may occasionally contain errors or omissions.\n\n` +
    `Please do not reply to this email, as this mailbox is not monitored.\n\n` +
    `Thank you for your cooperation.`
  );

  // Open Outlook (or any local mail client) with TO, CC and body pre-filled
  window.open(`mailto:${to}?cc=${cc}&subject=${subject}&body=${body}`, "_blank");
}
