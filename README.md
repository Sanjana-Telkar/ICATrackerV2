# ICA Usage Tracker

A dark-mode dashboard for daily IBM Consulting Advantage (ICA) adoption tracking — team & individual leaderboards, a workbook upload flow, a today's-report table with filters/export, and a rule-based insights chatbot.
Pure HTML/CSS/JS — hosts directly on **GitHub Pages** with **zero build step** and **no server required**.

---

## 🚀 Hosting on GitHub Pages (free, 5 minutes)

> ⚠️ **Use the files at the repo root** (`index.html`, `js/`, `css/`, `data/`, `google-apps-script/` — the ones this README lives next to). There is an older, unmaintained duplicate in the `ica-tracker/` subfolder and a duplicate `server/` folder — **ignore or delete both**; they don't have the Google Sheets integration and pushing them instead is the most common reason this stops "working."

1. Create a new **public** GitHub repo.
2. Copy the root-level contents of this project (everything except `ica-tracker/`) into the repo root, so `index.html` is at the repo root.
3. Push to `main`.
4. Go to **Settings → Pages → Source**: `Deploy from a branch` → Branch: `main`, folder `/ (root)` → **Save**.
5. Your dashboard is live at `https://<username>.github.io/<repo>/` within ~2 minutes.

> **Tip:** Every time you push changes (roster updates, config edits), GitHub Pages auto-redeploys in ~60 seconds.

---

## 📡 Real-time backend: Google Sheets (Apps Script)

This is now the **primary** data path — every "Submit Usage" entry writes straight to a Google Sheet, and every open dashboard polls that sheet every 20 seconds so new submissions show up for everyone automatically, no page refresh needed.

### One-time setup

1. Create (or reuse) a Google Sheet — any sheet, the Apps Script will create a tab called `ICA_Submissions` in it automatically.
2. In that Sheet: **Extensions → Apps Script**.
3. Delete any starter code, paste in the full contents of `google-apps-script/Code.gs` from this repo.
4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (this is required — it's what lets the public GitHub Pages site call it without a login prompt; the sheet itself stays private, only the Apps Script endpoint is exposed)
5. Click **Deploy**, authorize the requested permissions, then copy the **Web app URL** (ends in `/exec`).
6. Paste that URL into `js/config.js` → `CONFIG.SHEETS_URL`.
7. Push to GitHub. Done — submissions and dashboard refreshes now go through Sheets in real time.

### If it stops working
- **Re-deploy after editing `Code.gs`**: Apps Script URLs don't auto-update on save — you must "Manage deployments → Edit → New version" (or create a new deployment) each time you change the script, then make sure `SHEETS_URL` in `config.js` still points at the right URL.
- **Access = Anyone**: if this was left as "Only myself" or "Anyone with a Google account," requests from the browser will silently fail (you'll see 401/302 errors in the browser console).
- **Wrong folder deployed**: see the warning above — the `ica-tracker/` subfolder does not have `js/sheets.js` at all.

---

## 🔒 Passkey

All reminder / team-report actions require the passkey: **`184118`**

Change it in `js/config.js` → `PASSKEY`.

---

## 📋 On Leave detection

The tracker detects "on leave" in a wide range of formats in the Excel cell:

| Excel cell value | Detected as On Leave? |
|---|---|
| `On Leave` | ✅ |
| `ON LEAVE` | ✅ |
| `on leave` | ✅ |
| `on leava` (typo) | ✅ |
| `on_leave` | ✅ |
| `vacation` | ✅ |
| `annual leave` | ✅ |
| `holiday` | ✅ |
| `OOO` / `out of office` | ✅ |
| `leave` | ✅ |

---

## 📊 Sections

### 1. Dashboard
- **Pour gauge** — animated circular adoption meter (green/amber/red by threshold)
- **Sparkline** — 7-day adoption trend line next to the date
- **Day-over-day delta pill** — ▲/▼ vs yesterday
- **3 KPI tiles** — top assistant, total uses, days of history
- **Team rings** — mini donut ring per team, colour-coded, clickable (jumps to Report filtered by that team)
- **Team adoption bars** — sorted by adoption rate
- **Individual leaderboard** — top 8 by number of assistants used
- **Assistant breakdown** — top 8 assistants used today with bars
- **Not-yet-used watchlist** — everyone who hasn't logged usage
- **Adoption history chart** — bar chart for all uploaded days

### 2. Upload Workbook
- Bulk-loads a full day's data by editing `data/tracker-data.js` and pushing to GitHub (for backfilling history / large batch loads)

### 5. Submit Usage
- Self-service, open to everyone, **no passkey** — pick your name, list the assistants you used, hit submit
- Writes straight to Google Sheets and appears for every viewer within ~20 seconds
- Locks after you submit for the day so you can't accidentally double-submit (contact admin for corrections)

### 3. Today's Report
- Full table with team / status / search filters
- **Export Excel** — filtered report as `.xlsx`
- **Export Doc** — Word-compatible `.doc`
- **📊 Team Reports to Managers** *(new)* — generates one Excel workbook per team (Summary + Detail sheets) and opens a pre-filled mailto draft per manager. Configure manager emails in `js/config.js` → `TEAM_MANAGERS`.
- **🔒 Send Reminders** — passkey-gated, emails everyone who hasn't used ICA today

### 4. Insights Chatbot
- Floating bottom-right button
- Ask: "who hasn't used ICA?", "top team", "most used assistant", "trend this week", "summary"

---

## 📧 Team reports to managers

In `js/config.js`, update `TEAM_MANAGERS` with real manager emails:

```js
TEAM_MANAGERS: {
  "SRM":              "real.srm.manager@ibm.com",
  "Zycus-Devops":     "real.devops.manager@ibm.com",
  // ... one entry per team
}
```

When you click **Team Reports to Managers** (passkey required):
1. One `.xlsx` workbook is downloaded per team (Summary + Detail sheets).
2. Your mail client opens one draft per team with the manager pre-filled and a formatted summary in the body.
3. Attach the downloaded file and click Send.

---

## 📧 Reminder emails

Three modes (set `EMAIL_METHOD` in `js/config.js`):

| Mode | Setup | What happens |
|---|---|---|
| `"mailto"` (default) | None | Opens mail client with non-users in TO |
| `"emailjs"` | ~10 min, free | Sends from browser via emailjs.com |
| `"backend"` | ~10 min, free | Calls the Node/Nodemailer server in `server/` |

CC / BCC on every reminder and team-report email are set in `js/config.js`:

```js
CC_EMAILS:  ["pakulkar@in.ibm.com", "jeroen.de.knegt@nl.ibm.com"],
BCC_EMAILS: ["sanjana.s4@ibm.com"]
```

---

## 📁 File map

```
index.html                    Page shell, all sections + modal + chatbot markup
css/style.css                 Design system (Heineken × IBM Carbon dark)
js/config.js                  Passkey + Sheets URL + CC/BCC + manager config — edit this first
js/data.js                    Static roster + known assistants list
js/storage.js                 localStorage persistence (local cache of the latest data)
js/cloud.js                   No-op shim (legacy JSONbin removed) — kept so other files don't break
js/sheets.js                  Google Sheets integration: Submit Usage view + fetch/post to Apps Script
js/excel.js                   Workbook parsing, fuzzy on-leave detection
js/dashboard.js               Dashboard rendering (gauge, rings, trends, leaderboard)
js/report.js                  Today's Report table, filters, exports, team reports
js/email.js                   Reminder dispatch (mailto / backend / EmailJS)
js/chatbot.js                 Rule-based insights chatbot
js/app.js                     Navigation, passkey modal, upload flow, real-time polling, bootstrap
google-apps-script/Code.gs    Apps Script backend — deploy this as a Web App (see setup above)
data/tracker-data.js          Historical/bulk-loaded day snapshots, committed to the repo
server/                       Optional Node/Nodemailer backend for automated email (not needed for mailto mode)
ica-tracker/                  ⚠️ Old duplicate copy without Sheets integration — do not deploy this one
```
