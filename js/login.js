/* ==========================================================================
   ICA Usage Tracker — Login
   Username : email (case-insensitive, must exist in ROSTER)
   Password : their name exactly as in ROSTER (e.g. "Sanjana S")
   Session  : stored in sessionStorage — cleared when tab is closed.
   ========================================================================== */

const LOGIN_KEY = "ica_logged_in_v1";

/* ── Check if already logged in this session ── */
function isLoggedIn() {
  try {
    return !!sessionStorage.getItem(LOGIN_KEY);
  } catch (e) { return false; }
}

/* ── Save session ── */
function setLoggedIn(email, name) {
  try {
    sessionStorage.setItem(LOGIN_KEY, JSON.stringify({ email, name }));
  } catch (e) {}
}

/* ── Get logged-in user ── */
function getLoggedInUser() {
  try {
    return JSON.parse(sessionStorage.getItem(LOGIN_KEY));
  } catch (e) { return null; }
}

/* ── Log out ── */
function logout() {
  try { sessionStorage.removeItem(LOGIN_KEY); } catch (e) {}
  showLoginScreen();
}

/* ── Validate credentials against ROSTER ── */
function validateLogin(emailInput, passwordInput) {
  const email = emailInput.trim().toLowerCase();
  const pass  = passwordInput.trim();

  const match = ROSTER.find(r => r.email.toLowerCase() === email);
  if (!match) return { ok: false, msg: "Email not found. Please check and try again." };
  if (match.name !== pass) return { ok: false, msg: "Incorrect password. Use your full name exactly as registered." };
  return { ok: true, user: match };
}

/* ── Show the login screen (hides app shell) ── */
function showLoginScreen() {
  document.getElementById("app-shell-wrap").style.display = "none";
  document.getElementById("login-screen").style.display  = "flex";
  setTimeout(() => {
    document.getElementById("login-screen").classList.add("visible");
  }, 10);
  document.getElementById("login-email").value    = "";
  document.getElementById("login-password").value = "";
  document.getElementById("login-error").textContent = "";
  document.getElementById("login-email").focus();
}

/* ── Show the app (hides login screen) ── */
function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-shell-wrap").style.display = "";

  // Show logged-in user name in sidebar
  const user = getLoggedInUser();
  const el   = document.getElementById("sidebar-user");
  if (el && user) {
    el.textContent = user.name;
    el.style.display = "";
  }
}

/* ── Handle login form submit ── */
function handleLogin() {
  const emailInput = document.getElementById("login-email").value;
  const passInput  = document.getElementById("login-password").value;
  const errorEl    = document.getElementById("login-error");
  const btn        = document.getElementById("login-btn");

  errorEl.textContent = "";

  const result = validateLogin(emailInput, passInput);
  if (!result.ok) {
    errorEl.textContent = result.msg;
    document.getElementById("login-password").value = "";
    document.getElementById("login-password").focus();
    // Shake animation
    const card = document.getElementById("login-card");
    card.classList.remove("login-shake");
    void card.offsetWidth;
    card.classList.add("login-shake");
    return;
  }

  // Success
  setLoggedIn(result.user.email, result.user.name);
  btn.textContent = "Welcome back! ✓";
  btn.disabled = true;
  setTimeout(() => {
    showApp();
  }, 600);
}

/* ── Init login system ── */
function initLogin() {
  document.getElementById("login-btn").addEventListener("click", handleLogin);
  document.getElementById("login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") handleLogin();
  });
  document.getElementById("login-email").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("login-password").focus();
  });

  // Eye toggle — show/hide password
  document.getElementById("login-eye").addEventListener("click", () => {
    const inp  = document.getElementById("login-password");
    const icon = document.getElementById("eye-icon");
    if (inp.type === "password") {
      inp.type = "text";
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      inp.type = "password";
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  });

  if (isLoggedIn()) {
    showApp();
  } else {
    showLoginScreen();
  }
}
