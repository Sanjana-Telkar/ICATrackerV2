/* ==========================================================================
   ICA Usage Tracker — Storage
   On every page load, data/tracker-data.js (the file you edit daily at
   6 PM) is merged into localStorage. localStorage entries for the same
   date-key are overwritten by the file, so a git-push is all it takes to
   share the latest data with everyone on GitHub Pages.
   ========================================================================== */

const STORE_KEYS = {
  HISTORY: "ica_history_v1",       // { "YYYY-MM-DD": { records: [...], uploadedAt } }
  CURRENT_DATE: "ica_current_date_v1",
  LAST_UPLOAD_META: "ica_last_upload_meta_v1"
};

const Storage = {
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEYS.HISTORY)) || {};
    } catch (e) {
      return {};
    }
  },

  saveDay(dateKey, records, meta) {
    const history = this.getHistory();
    history[dateKey] = {
      records,                 // [{email, name, team, assistants:[...], used}]
      uploadedAt: new Date().toISOString(),
      sourceColumn: meta && meta.sourceColumn,
      fte_total: meta && meta.fte_total
    };
    localStorage.setItem(STORE_KEYS.HISTORY, JSON.stringify(history));
    localStorage.setItem(STORE_KEYS.CURRENT_DATE, dateKey);
    localStorage.setItem(STORE_KEYS.LAST_UPLOAD_META, JSON.stringify({
      dateKey, uploadedAt: new Date().toISOString(), sourceColumn: meta && meta.sourceColumn
    }));
  },

  getCurrentDateKey() {
    return localStorage.getItem(STORE_KEYS.CURRENT_DATE);
  },

  getDay(dateKey) {
    const history = this.getHistory();
    return history[dateKey] || null;
  },

  getLastUploadMeta() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEYS.LAST_UPLOAD_META));
    } catch (e) {
      return null;
    }
  },

  getAllDatesSorted() {
    return Object.keys(this.getHistory()).sort();
  },

  clearAll() {
    localStorage.removeItem(STORE_KEYS.HISTORY);
    localStorage.removeItem(STORE_KEYS.CURRENT_DATE);
    localStorage.removeItem(STORE_KEYS.LAST_UPLOAD_META);
  },

  exportBackup() {
    return JSON.stringify({
      _v: 1,
      exportedAt: new Date().toISOString(),
      history: localStorage.getItem(STORE_KEYS.HISTORY),
      currentDate: localStorage.getItem(STORE_KEYS.CURRENT_DATE),
      lastUploadMeta: localStorage.getItem(STORE_KEYS.LAST_UPLOAD_META)
    });
  },

  importBackup(jsonString) {
    const obj = JSON.parse(jsonString);
    if (!obj || obj._v !== 1) throw new Error("Unrecognised backup format.");
    if (obj.history)        localStorage.setItem(STORE_KEYS.HISTORY, obj.history);
    if (obj.currentDate)    localStorage.setItem(STORE_KEYS.CURRENT_DATE, obj.currentDate);
    if (obj.lastUploadMeta) localStorage.setItem(STORE_KEYS.LAST_UPLOAD_META, obj.lastUploadMeta);
  }
};

/**
 * Seed localStorage from the global TRACKER_DATA variable that is declared
 * in data/tracker-data.js (loaded as a plain <script> before this file).
 *
 * Strategy: TRACKER_DATA wins for every date key it contains.
 * Any date keys that only exist in localStorage (e.g. uploaded via the
 * manual xlsx flow) are kept as-is.
 *
 * Call this once, before any rendering, on DOMContentLoaded.
 */
/**
 * Derive `used` and `onLeave` from the `assistants` array so that
 * tracker-data.js only needs to supply the assistants list.
 * - assistants has real entries          → used=true,  onLeave=false
 * - assistants is exactly ["On Leave"]   → used=false, onLeave=true
 * - assistants is []                     → used=false, onLeave=false
 */
function normaliseRecord(r) {
  const isOnLeave = r.assistants.length === 1 &&
    r.assistants[0].trim().toLowerCase() === "on leave";
  return Object.assign({}, r, {
    onLeave: isOnLeave,
    used:    !isOnLeave && r.assistants.length > 0
  });
}

function loadFromTrackerData() {
  if (typeof TRACKER_DATA === "undefined" || !TRACKER_DATA) return;

  const local = Storage.getHistory();
  let latestDate = null;

  Object.entries(TRACKER_DATA).forEach(([dk, entry]) => {
    // Normalise: ensure the records array has the right shape
    if (!entry || !Array.isArray(entry.records)) return;

    // Only overwrite a locally-stored entry if the file's uploadedAt is newer
    // than (or equal to) what is already in localStorage.  This lets a
    // manually-uploaded xlsx for the same date survive a page reload while
    // still ensuring that a fresh git-push of tracker-data.js wins.
    const fileTs  = entry.uploadedAt ? new Date(entry.uploadedAt).getTime() : 0;
    const localTs = local[dk] && local[dk].uploadedAt
      ? new Date(local[dk].uploadedAt).getTime()
      : 0;

    if (fileTs >= localTs) {
      local[dk] = {
        records:      entry.records.map(normaliseRecord),
        uploadedAt:   entry.uploadedAt || new Date().toISOString(),
        sourceColumn: entry.sourceColumn || dk
      };
    }

    if (!latestDate || dk > latestDate) latestDate = dk;
  });

  try {
    localStorage.setItem(STORE_KEYS.HISTORY, JSON.stringify(local));
    if (latestDate) {
      // Only overwrite currentDate if the file has a newer entry than what
      // is currently set (so a manually uploaded xlsx for today wins).
      const existing = Storage.getCurrentDateKey();
      if (!existing || latestDate >= existing) {
        localStorage.setItem(STORE_KEYS.CURRENT_DATE, latestDate);
        const entry = TRACKER_DATA[latestDate];
        localStorage.setItem(STORE_KEYS.LAST_UPLOAD_META, JSON.stringify({
          dateKey:      latestDate,
          uploadedAt:   entry.uploadedAt || new Date().toISOString(),
          sourceColumn: entry.sourceColumn || latestDate
        }));
      }
    }
  } catch (e) {
    console.warn("[Storage] loadFromTrackerData: localStorage write failed.", e.message);
  }
}
