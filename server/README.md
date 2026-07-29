# ICA Tracker — Reminder Mail Server (optional)

This is the piece that actually sends automated reminder emails. GitHub
Pages (or any static host) can serve the dashboard, but it **cannot** run
server code or safely store your Gmail app password — anything shipped to
a static site is publicly downloadable. So sending real email needs this
tiny server running somewhere else.

## 1. Get a Gmail app password
1. Turn on 2-Step Verification on the sending Gmail account.
2. Go to **Google Account → Security → App passwords**.
3. Create one for "Mail" and copy the 16-character password.

## 2. Configure environment variables
Copy `.env.example` to `.env` for local testing, or set the same variables
in your host's dashboard:

- `FROM_EMAIL` — the Gmail address reminders are sent from
- `GMAIL_APP_PASSWORD` — the app password from step 1
- `REMINDER_PASSKEY` — must match `CONFIG.PASSKEY` in `js/config.js` (184118 by default)
- `FROM_NAME` — display name on outgoing mail

**Never commit `.env` to GitHub.** `.gitignore` already excludes it.

## 3. Run locally
```
cd server
npm install
npm start
```
Server runs on `http://localhost:3001`.

## 4. Deploy for free
Any Node host works — Render, Railway, Fly.io, Cyclic, etc. General steps
(example: Render):
1. Push this repo to GitHub.
2. On Render: New → Web Service → point at this repo, root directory `server`.
3. Build command: `npm install` · Start command: `npm start`.
4. Add the environment variables from step 2 in Render's dashboard.
5. Deploy — you'll get a URL like `https://ica-tracker-mail.onrender.com`.

## 5. Point the frontend at it
In `js/config.js`:
```js
EMAIL_METHOD: "backend",
BACKEND_URL: "https://ica-tracker-mail.onrender.com/send-reminders",
```
Commit and push — GitHub Pages will pick up the change.

## API
`POST /send-reminders`
```json
{
  "passkey": "184118",
  "date": "2026-07-22",
  "recipients": [{ "name": "Jane Doe", "email": "jane@ibm.com", "team": "SRM" }]
}
```
Returns `{ ok, sent, results: [{ email, status, error? }] }`.
