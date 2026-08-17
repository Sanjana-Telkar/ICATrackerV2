/* ==========================================================================
   ICA Usage Tracker — Configuration
   Edit the values below to match your environment. See README.md for the
   full setup guide (especially the "Automated reminder emails" section).
   ========================================================================== */

const CONFIG = {
  // Passkey required to upload a workbook and to send reminder emails.
  PASSKEY: "184118",

  // --- Reminder email delivery -------------------------------------------
  // "backend"  -> calls your own small mail server (server/ folder in this
  //               repo) that uses Nodemailer + the Gmail account/app
  //               password you provide. Recommended: real automated send.
  // "emailjs"  -> uses emailjs.com from the browser only, no server needed.
  // "mailto"   -> works with zero setup: opens the user's mail client with
  //               a pre-filled message. Not automatic, but always works.
  EMAIL_METHOD: "mailto",

  BACKEND_URL: "https://YOUR-BACKEND-URL.example.com/send-reminders",

  EMAILJS_PUBLIC_KEY: "",
  EMAILJS_SERVICE_ID: "",
  EMAILJS_TEMPLATE_ID: "",

  // Sender identity shown in reminder emails (used by the backend / EmailJS
  // templates — see server/README.md).
  FROM_NAME: "ICA Adoption Tracker",
  FROM_EMAIL: "automationtestingcheck@gmail.com"
};
