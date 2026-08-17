/* ==========================================================================
   ICA Usage Tracker — Reminder emails
   Finds everyone with no ICA usage recorded for today's uploaded date and
   sends (or drafts) a reminder to their email. See README.md +
   server/README.md for wiring up real automated sending.
   ========================================================================== */

function getNotUsedToday() {
  const { records } = getTodayRecords();
  return records.filter(r => !r.used);
}

async function sendReminders() {
  const notUsed = getNotUsedToday();

  if (!notUsed.length) {
    showToast("Everyone has used ICA today — no reminders needed.", "ok");
    return;
  }

  showToast(`Sending reminders to ${notUsed.length} practitioner(s)…`, "ok");

  try {
    if (CONFIG.EMAIL_METHOD === "backend") {
      await sendViaBackend(notUsed);
    } else if (CONFIG.EMAIL_METHOD === "emailjs") {
      await sendViaEmailJS(notUsed);
    } else {
      sendViaMailto(notUsed);
    }
    showToast(`Reminder flow started for ${notUsed.length} practitioner(s).`, "ok");
  } catch (err) {
    console.error(err);
    showToast("Could not send reminders: " + err.message, "err");
  }
}

async function sendViaBackend(notUsed) {
  const { dateKey } = getTodayRecords();
  const res = await fetch(CONFIG.BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      passkey: CONFIG.PASSKEY,
      date: dateKey,
      recipients: notUsed.map(r => ({ name: r.name, email: r.email, team: r.team }))
    })
  });
  if (!res.ok) throw new Error(`Backend responded with ${res.status}. Check server/README.md.`);
}

async function sendViaEmailJS(notUsed) {
  if (!window.emailjs || !CONFIG.EMAILJS_PUBLIC_KEY) {
    throw new Error("EmailJS is not configured yet. See README.md.");
  }
  const { dateKey } = getTodayRecords();
  for (const r of notUsed) {
    await emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID, {
      to_name: r.name,
      to_email: r.email,
      team: r.team,
      date: dateKey,
      from_name: CONFIG.FROM_NAME
    }, CONFIG.EMAILJS_PUBLIC_KEY);
  }
}

function sendViaMailto(notUsed) {
  const { dateKey } = getTodayRecords();
  const bcc = notUsed.map(r => r.email).join(",");
  const subject = encodeURIComponent(`Reminder: log your ICA usage for ${dateKey}`);
  const body = encodeURIComponent(
    `Hi,\n\nOur records show no ICA (Introducing Cognitive Assistants) usage logged for you today (${dateKey}).\n\nPlease make use of the available IBM Consulting Advantage assistants and ensure your usage is captured in tomorrow's tracker.\n\nThanks,\n${CONFIG.FROM_NAME}`
  );
  window.location.href = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;
}
