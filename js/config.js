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
  SHEETS_URL: "https://script.google.com/macros/s/AKfycbzTasBPCwkjmC91eWVnkOcy8Jn58XyX6koGTC6mR6YpxmuEmQzpkXZW5W9UOuQk2YZi/exec",

  // ── Source workbook (SharePoint) ─────────────────────────────────────────
  // Link to the Excel workbook shared on SharePoint — included in manager emails.
  WORKBOOK_URL: "https://ibm-my.sharepoint.com/:x:/r/personal/pakulkar_in_ibm_com/_layouts/15/Doc.aspx?sourcedoc=%7BE115E08A-EF89-44DC-988F-0BFB78E224D5%7D&file=Procurement%20team%20for%20ICA%20Statistics.xlsx&action=default&mobileredirect=true",

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
    "pakulkar@in.ibm.com",              // Pavan Kulkarni
    "jeroen.de.knegt@nl.ibm.com"        // Jeroen De Knegt
  ],

  // ── Fixed BCC recipients on every reminder / team-report email ───────────
  BCC_EMAILS: [
    "sanjana.s4@ibm.com"                // Sanjana S — moved from CC to BCC
  ],

  // ── Team → Manager email mapping ─────────────────────────────────────────
  // Keys MUST match the team names used in js/data.js (ROSTER) exactly.
  TEAM_MANAGERS: {
    "Central Led+SF":    "kiran.bodla@in.ibm.com",           // Central Led+SF → Kiran Bodla
    "HeiKey":            "athulya.nair@ibm.com",             // HeiKey → Athulya Nair
    "IronClad":          "pallavitumbde@in.ibm.com",         // IronClad → Pallavi Tumbde
    "SSE+HeiCF":         "athulya.nair@ibm.com",             // SSE+HeiCF → Athulya Nair (TODO: confirm)
    "OCP+POSM":          "rajgurra@in.ibm.com",              // OCP+POSM → Raja Sekhar
    "POSM":              "odhatrak@in.ibm.com",              // POSM → Omprakash Dhatrak
    "PPO":               "jeroen.de.knegt@nl.ibm.com",       // PPO → Jeroen De Knegt
    "SRM":               "ragumbal@in.ibm.com",              // SRM → Ramandeep Budania
    "Zycus-BaU":         "athulya.nair@ibm.com",             // Zycus-BaU → Athulya Nair
    "Zycus-Deployment":  "sanjayup@in.ibm.com",              // Zycus-Deployment → Sanjay
    "Zycus-Devops":      "madhuri.nimmaka@ibm.com"           // Zycus-Devops → Madhuri Nimmaka
  },

  // ── Extra manager emails to always include in TO (not tied to a team) ────
  // These managers appear in the TO even if no team in the data maps to them.
  // Source: latest manager distribution list provided by the team.
  EXTRA_MANAGER_EMAILS: [
    "athulya.nair@ibm.com",            // Athulya Nair
    "sanjayup@in.ibm.com",             // Sanjay
    "savitha.kanakaraju@in.ibm.com",   // Savitha Kanakaraju
    "ubalakum@in.ibm.com",             // Uma Balakumar
    "vidya.venkat@ibm.com",            // Vidya Venkat
    "saurust1@in.ibm.com",             // Saurabh Rustagi
    "venender.kompally@ibm.com",       // Venender Kompally
    "madhuri.nimmaka@ibm.com",         // Madhuri Nimmaka
    "anupakri@in.ibm.com",             // Anupama
    "ragumbal@in.ibm.com",             // Ramandeep Budania
    "shilpa.mathur@ibm.com",           // Shilpa Mathur
    "anshu.mishra@ibm.com",            // Anshu Mishra
    "poonam.singh1@ibm.com"            // Poonam Singh
  ]
};
