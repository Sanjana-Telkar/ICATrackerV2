/* ==========================================================================
   ICA Usage Tracker — Reminder Mail Server
   A tiny Express service that the static frontend calls to actually send
   reminder emails through a Gmail account + app password (kept only in
   environment variables — NEVER commit real credentials to GitHub).

   Deploy this separately from the static site (Render, Railway, Fly.io,
   a small VM, etc.) since GitHub Pages only serves static files and cannot
   run a server or hold secrets safely.
   ========================================================================== */

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

const PASSKEY = process.env.REMINDER_PASSKEY || "184118";
const FROM_EMAIL = process.env.FROM_EMAIL;       // e.g. automationtestingcheck@gmail.com
const APP_PASSWORD = process.env.GMAIL_APP_PASSWORD; // 16-char Gmail app password
const FROM_NAME = process.env.FROM_NAME || "ICA Adoption Tracker";

if (!FROM_EMAIL || !APP_PASSWORD) {
  console.warn("WARNING: FROM_EMAIL / GMAIL_APP_PASSWORD env vars are not set. /send-reminders will fail until configured.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: FROM_EMAIL, pass: APP_PASSWORD }
});

app.get("/", (req, res) => res.send("ICA Reminder Mail Server is running."));

app.post("/send-reminders", async (req, res) => {
  try {
    const { passkey, date, recipients, cc: ccList } = req.body || {};

    if (passkey !== PASSKEY) {
      return res.status(401).json({ error: "Invalid passkey." });
    }
    if (!Array.isArray(recipients) || !recipients.length) {
      return res.status(400).json({ error: "No recipients provided." });
    }

    // CC list comes from CONFIG.CC_EMAILS in the frontend (Pavan Kulkarni + Sanjana S)
    const cc = Array.isArray(ccList) && ccList.length ? ccList.join(", ") : undefined;

    const results = [];
    for (const r of recipients) {
      if (!r.email) continue;
      try {
        await transporter.sendMail({
          from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
          to: r.email,
          ...(cc && { cc }),
          subject: `Reminder: log your ICA usage for ${date || "today"}`,
          html: `
            <div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2328;max-width:560px;line-height:1.6;">
              <p>Hi ${r.name || ""},</p>
              <p>Our records indicate that no ICA usage has been logged for you on <strong>${date || "today"}</strong>${r.team ? ` (Team: <strong>${r.team}</strong>)` : ""}.</p>
              <p>We encourage you to make use of the IBM Consulting Assistant (ICA) for your daily work activities and productivity needs.</p>
              <p>
                <strong>Access ICA here:</strong><br>
                <a href="https://remea.ica.ibm.com/ica/curatorai/apps/ui/new-chat">https://remea.ica.ibm.com/ica/curatorai/apps/ui/new-chat</a>
              </p>
              <p>
                <strong>After using ICA, please update your usage in the tracker:</strong><br>
                <a href="https://ibm-my.sharepoint.com/:x:/r/personal/sanjana_s4_ibm_com/Documents/Microsoft%20Teams%20Chat%20Files/ICA%20tracker.xlsx?d=w31aee340853a48aeb2b884d2dbd08f59&csf=1&web=1&e=BhK1Co">ICA Usage Sheet</a>
              </p>
              <p>
                <strong>View the team usage dashboard:</strong><br>
                <a href="https://pages.github.ibm.com/Sanjana-S4/ICATracker/">https://pages.github.ibm.com/Sanjana-S4/ICATracker/</a>
              </p>
              <p>Even a single ICA interaction per day helps us track adoption and identify valuable use cases across teams.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="font-size:12px;color:#57606a;">
                <em>Disclaimer: This email is generated automatically based on an AI-generated usage report. While every effort is made to ensure accuracy, the report may occasionally contain errors or omissions.</em><br><br>
                <em>Please do not reply to this email, as this mailbox is not monitored.</em>
              </p>
              <p>Thank you for your cooperation.</p>
            </div>
          `
        });
        results.push({ email: r.email, status: "sent" });
      } catch (mailErr) {
        results.push({ email: r.email, status: "failed", error: mailErr.message });
      }
    }

    res.json({ ok: true, sent: results.filter(r => r.status === "sent").length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ICA reminder mail server listening on port ${PORT}`));
