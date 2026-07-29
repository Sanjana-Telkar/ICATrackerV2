# ICA Usage Tracker

A dark-mode dashboard for daily IBM Consulting Advantage (ICA) adoption tracking — team & individual leaderboards, a workbook upload flow, a today's-report table with filters/export, and a rule-based insights chatbot.
Pure HTML/CSS/JS — hosts directly on **GitHub Pages** with **zero build step** and **no server required**.

---

## 🚀 Hosting on GitHub Pages (free, 5 minutes)

1. Create a new **public** GitHub repo.
2. Copy the entire `ica-tracker/` folder contents into the repo root (so `index.html` is at the root).
3. Push to `main`.
4. Go to **Settings → Pages → Source**: `Deploy from a branch` → Branch: `main`, folder `/ (root)` → **Save**.
5. Your dashboard is live at `https://<username>.github.io/<repo>/` within ~2 minutes.

> **Tip:** Every time you push changes (roster updates, config edits), GitHub Pages auto-redeploys in ~60 seconds.

---

## 🌐 Sharing data across ALL users (critical for team use)

By default, uploaded workbook data is stored in the **uploader's browser only** (localStorage).
To make uploads visible to everyone on the same GitHub Pages URL, configure the free **JSONbin.io** cloud store:

### Setup (free, 2 minutes)

1. Sign up at **https://jsonbin.io** (free tier — 10,000 req/month, plenty for daily use).
2. Dashboard → **Create a Bin** → paste `{}` → Save. Copy the **Bin ID**.
3. Dashboard → **API Keys** → Create a key → Copy it.
4. Open `js/config.js` and fill in:

```js
JSONBIN_BIN_ID:  "YOUR_BIN_ID_HERE",
JSONBIN_API_KEY: "YOUR_API_KEY_HERE",
```

5. Push to GitHub. Now when anyone uploads a workbook, all other users will see the updated data on their next page refresh (or immediately if they have the page open and refresh).

### How it works
- On page load: the app fetches the latest data from JSONbin and merges it into local cache so the dashboard renders instantly.
- On upload: after the local save, the full history is pushed to JSONbin.
- Every re-upload overwrites the existing cloud data — latest upload always wins.
- If JSONbin is unconfigured, the app falls back silently to localStorage (existing behaviour).

---

## 🔒 Passkey

All uploads and reminder/report actions require the passkey: **`184418`**

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
- Drag-and-drop `.xlsx` upload, passkey-gated
- Cloud sync status badge (shows if JSONbin is active)
- Backup / restore JSON export

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
| `"mailto"` (default) | None | Opens mail client with non-users BCC'd |
| `"emailjs"` | ~10 min, free | Sends from browser via emailjs.com |
| `"backend"` | ~10 min, free | Calls the Node/Nodemailer server in `server/` |

---

## 📁 File map

```
index.html              Page shell, all sections + modal + chatbot markup
css/style.css           Design system (Heineken × IBM Carbon dark)
js/config.js            Passkey + JSONbin + email + manager config — edit this first
js/data.js              Static roster + known assistants list
js/storage.js           localStorage persistence
js/cloud.js             JSONbin.io shared cloud sync (new)
js/excel.js             Workbook parsing, fuzzy on-leave detection
js/dashboard.js         Dashboard rendering (gauge, rings, trends, leaderboard)
js/report.js            Today's Report table, filters, exports, team reports
js/email.js             Reminder dispatch (mailto / backend / EmailJS)
js/chatbot.js           Rule-based insights chatbot
js/app.js               Navigation, passkey modal, upload flow, backup, bootstrap
server/                 Optional Node/Nodemailer backend for automated email
```
