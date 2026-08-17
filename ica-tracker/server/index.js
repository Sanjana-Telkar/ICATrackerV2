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
    const { passkey, date, recipients } = req.body || {};

    if (passkey !== PASSKEY) {
      return res.status(401).json({ error: "Invalid passkey." });
    }
    if (!Array.isArray(recipients) || !recipients.length) {
      return res.status(400).json({ error: "No recipients provided." });
    }

    const results = [];
    for (const r of recipients) {
      if (!r.email) continue;
      try {
        await transporter.sendMail({
          from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
          to: r.email,
          subject: `Reminder: log your ICA usage for ${date || "today"}`,
          html: `
            <p>Hi ${r.name || ""},</p>
            <p>Our records show no ICA (IBM Consulting Advantage assistant) usage logged for you on <b>${date || "today"}</b>${r.team ? ` (Team: ${r.team})` : ""}.</p>
            <p>Please make use of the available ICA assistants and ensure your usage is reflected in tomorrow's tracker.</p>
            <p>Thanks,<br>${FROM_NAME}</p>
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
