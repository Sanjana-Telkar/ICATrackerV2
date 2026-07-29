/* ==========================================================================
   ICA Usage Tracker — Configuration
   Edit the values below to match your environment.
   ========================================================================== */

const CONFIG = {
  // ── Passkey required to upload a workbook and to send reminder emails ──
  PASSKEY: "184118",

  // ── Google Apps Script Web App URL ───────────────────────────────────────
  // Set this to your deployed Apps Script URL after following the setup guide.
  // Leave as empty string "" to disable the Sheets integration.
  // Example: "https://script.google.com/macros/s/AKfy.../exec"
  SHEETS_URL: "https://script.google.com/macros/s/AKfycbxMgELvJeXJBDU0czEyGA0HV3iXgBxk-5E1_6LZZM2AymINBW6dlAs1_DaDwLolqvYJ/exec",

  // ── Reminder email delivery ──────────────────────────────────────────────
  // "mailto"   → opens Outlook (local mail client) — works with zero setup  ← ACTIVE
  // "backend"  → calls the Node/Nodemailer server in server/
  EMAIL_METHOD: "mailto",

  // Run: cd ica-tracker/server && npm install && npm start
  // Then open the tracker from the same machine (localhost).
  BACKEND_URL: "http://localhost:3001/send-reminders",

  FROM_NAME: "ICA Adoption Tracker",
  FROM_EMAIL: "automationtestingcheck@gmail.com",

  // ── Fixed CC recipients on every reminder / team-report email ────────────
  CC_EMAILS: [
    "sanjana.s4@ibm.com",               // Sanjana S
    "pakulkar@in.ibm.com",              // Pavan Kulkarni
    "jeroen.de.knegt@nl.ibm.com"        // Jeroen De Knegt
  ],

  // ── Team → Manager email mapping ─────────────────────────────────────────
  // Keys MUST match the team names used in tracker-data.js exactly.
  TEAM_MANAGERS: {
    "Central Led":       "kiran.bodla@in.ibm.com",           // Central Led → Kiran Bodla
    "HeiKey":            "athulya.nair@ibm.com",             // HeiKey → Athulya Nair
    "Hyperautomation":   "odhatrak@in.ibm.com",              // Hyperautomation → Omprakash Dhatrak
    "IronClad":          "pallavitumbde@in.ibm.com",         // IronClad → Pallavi Tumbde
    "OCP":               "rajgurra@in.ibm.com",              // OCP → Raja Sekhar
    "POSM":              "odhatrak@in.ibm.com",              // POSM → Omprakash Dhatrak
    "PPO":               "jeroen.de.knegt@nl.ibm.com",       // PPO → Jeroen De Knegt
    "SRM":               "ragumbal@in.ibm.com",              // SRM → Ramandeep Budania
    "Supplier finance":  "seema.ranojirao.varne@ibm.com",    // Supplier finance → Seema R Varne
    "Supplier Finance":  "seema.ranojirao.varne@ibm.com",    // Supplier Finance → Seema R Varne
    "Zycus-BaU":         "athulya.nair@ibm.com",             // Zycus-BaU → Athulya Nair
    "Zycus-Deployment":  "sanjayup@in.ibm.com",              // Zycus-Deployment → Sanjay Upadhyay
    "Zycus-Devops":      "madhuri.nimmaka@ibm.com"           // Zycus-Devops → Madhuri Nimmaka
  },

  // ── Extra manager emails to always include in TO (not tied to a team) ────
  // These managers appear in the TO even if no team in the data maps to them.
  EXTRA_MANAGER_EMAILS: [
    "sumedha.pandey@ibm.com",          // Sumedha Pandey
    "savitha.kanakaraju@in.ibm.com",   // Savitha Kanakaraju
    "ubalakum@in.ibm.com",             // Uma K Balakumar
    "sai.lakshmi.vanapalli@ibm.com",   // Sai Vanapalli
    "sadhanap@in.ibm.com",             // Saravanan Dhanapal
    "vidya.venkat@ibm.com",            // Vidya Venkat
    "saurust1@in.ibm.com",             // Saurabh Rustagi
    "pakulkar@in.ibm.com"              // Pavan Kulkarni
  ]
};
