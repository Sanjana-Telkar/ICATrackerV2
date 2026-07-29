# ICA Usage Tracker

A dark-mode dashboard for daily IBM Consulting Advantage (ICA) adoption
tracking — team & individual leaderboards, a workbook upload flow, a
today's-report table with filters/export, and a rule-based insights chatbot.
Pure HTML/CSS/JS, so it hosts directly on **GitHub Pages** with no build step.

## How the data flow works

1. Every day at 6 PM you upload the same tracker workbook (`.xlsx`) you've
   been using — the one with `Practitioner Email / Name / Scrum Team` plus
   one column per date (e.g. `Wed-22-Jul-26`).
2. The app finds **today's** date column automatically. If the workbook
   also contains older, already-used columns, they're ignored — only the
   most recent matching (or most recent past) date is used, so re-uploading
   the same running workbook every day works fine.
3. The parsed data is written to the browser's `localStorage`, so it
   persists across refreshes/restarts **until the next upload overwrites
   it** (a full day-by-day history is also kept for chatbot trend
   questions).
4. Uploading requires the passkey — default **184118**, set in
   `js/config.js`.

> **Where the data lives:** localStorage is per-browser. If several people
> need to see the same live dashboard, whoever uploads the workbook needs
> to do it from the shared URL everyone opens, or you point `EMAIL_METHOD`
> at the optional backend and additionally sync storage server-side later.
> For a single admin uploading once a day and a team viewing read-only,
> this is exactly what static hosting supports without a database.

## Roster

The 73-person practitioner list (email, name, team, FTE) is embedded as
static data in `js/data.js`, per your requirement. To add/remove people,
edit that file and push — no re-upload needed for roster changes, only for
daily usage.

## Sections

1. **Dashboard** — a "pour gauge" adoption meter, KPI tiles, team-wise
   adoption bars, and an individual leaderboard.
2. **Upload Workbook** — drag-and-drop `.xlsx`, passkey-gated publish.
3. **Today's Report** — every practitioner for today's date with email,
   team, and assistants used; filters by team/status/search; **Export
   Excel** and **Export Doc**; passkey-gated **Send Reminders** for anyone
   who hasn't used ICA.
4. **Floating chatbot** (bottom-right, any section) — ask things like
   "who hasn't used ICA?", "top team", "most used assistant", "trend this
   week". It's a rule-based analyzer over whatever's currently loaded —
   no external API key required, so it works out of the box.

## Automated reminder emails — please read

You mentioned sending real automated mail through a Gmail address + app
password. Important: **a static site hosted on GitHub Pages cannot hold
that password safely or open an SMTP connection from the browser** —
anything shipped to a static site is public, and browsers can't speak SMTP
directly. So there are three delivery modes, switchable in `js/config.js`
via `EMAIL_METHOD`:

| Mode | Setup effort | What happens |
|---|---|---|
| `"mailto"` (default) | None | Send Reminders opens the user's own mail app with all non-users BCC'd and a drafted message — one click to actually send. Works immediately, everywhere, no secrets exposed. |
| `"backend"` | ~10 min, free tier | Calls a tiny Node server (in `server/`) that uses your Gmail app password via Nodemailer to send real, fully automated emails. This is the closest to what you described — see `server/README.md`. |
| `"emailjs"` | ~10 min, free tier | Sends straight from the browser via [EmailJS](https://www.emailjs.com), no server to host. You connect Gmail inside EmailJS's dashboard (no password ever touches this repo). Fill in `EMAILJS_*` values in `js/config.js`. |

Either `backend` or `emailjs` gives you real one-click automated sending;
`mailto` is the safe zero-setup fallback already wired up.

## Deploying to GitHub Pages

1. Create a new GitHub repo and push this folder's contents to it.
2. Repo → **Settings → Pages** → Source: `Deploy from a branch` → Branch:
   `main`, folder `/ (root)` → Save.
3. Your dashboard is live at `https://<username>.github.io/<repo>/` within
   a minute or two.
4. (Optional) If you set up the `server/` backend for reminders, deploy it
   separately (see `server/README.md`) and update `BACKEND_URL` in
   `js/config.js`, then push again.

## Changing the passkey

Update `PASSKEY` in `js/config.js` (and `REMINDER_PASSKEY` in the backend's
environment variables if you use the `backend` email mode — they must
match).

## File map

```
index.html          Page shell, all three sections + modal + chatbot markup
css/style.css        Design system (Heineken green/red x IBM Carbon dark, IBM Plex type)
js/config.js         Passkey + email delivery settings — edit this first
js/data.js           Static roster + reference assistant list
js/storage.js        localStorage persistence (current day + history)
js/excel.js          Workbook parsing, today's-date column detection
js/dashboard.js      Dashboard rendering (gauge, KPIs, team bars, leaderboard)
js/report.js         Today's Report table, filters, Excel/Doc export
js/email.js          Reminder dispatch (mailto / backend / EmailJS)
js/chatbot.js        Rule-based insights chatbot
js/app.js            Navigation, passkey modal, upload flow, bootstrap
server/              Optional Node/Nodemailer backend for real automated email
```
