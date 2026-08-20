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

// ---------------------------------------------------------------------------
//  localStorage shim — falls back to an in-memory store when localStorage is
//  blocked (Edge/Chrome Tracking Prevention in private/InPrivate windows).
// ---------------------------------------------------------------------------
const _memStore = {};
function _lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return _memStore[key] || null; }
}
function _lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { _memStore[key] = val; }
}
function _lsRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { delete _memStore[key]; }
}

const Storage = {
  getHistory() {
    try {
      return JSON.parse(_lsGet(STORE_KEYS.HISTORY)) || {};
    } catch (e) {
      return {};
    }
  },

  saveDay(dateKey, records, meta) {
    const history = this.getHistory();
    history[dateKey] = {
      records,
      uploadedAt: new Date().toISOString(),
      sourceColumn: meta && meta.sourceColumn,
      fte_total: meta && meta.fte_total
    };
    _lsSet(STORE_KEYS.HISTORY, JSON.stringify(history));
    _lsSet(STORE_KEYS.CURRENT_DATE, dateKey);
    _lsSet(STORE_KEYS.LAST_UPLOAD_META, JSON.stringify({
      dateKey, uploadedAt: new Date().toISOString(), sourceColumn: meta && meta.sourceColumn
    }));
  },

  getCurrentDateKey() {
    return _lsGet(STORE_KEYS.CURRENT_DATE);
  },

  getDay(dateKey) {
    const history = this.getHistory();
    return history[dateKey] || null;
  },

  getLastUploadMeta() {
    try {
      return JSON.parse(_lsGet(STORE_KEYS.LAST_UPLOAD_META));
    } catch (e) {
      return null;
    }
  },

  getAllDatesSorted() {
    return Object.keys(this.getHistory()).sort();
  },

  clearAll() {
    _lsRemove(STORE_KEYS.HISTORY);
    _lsRemove(STORE_KEYS.CURRENT_DATE);
    _lsRemove(STORE_KEYS.LAST_UPLOAD_META);
  },

  exportBackup() {
    return JSON.stringify({
      _v: 1,
      exportedAt: new Date().toISOString(),
      history: _lsGet(STORE_KEYS.HISTORY),
      currentDate: _lsGet(STORE_KEYS.CURRENT_DATE),
      lastUploadMeta: _lsGet(STORE_KEYS.LAST_UPLOAD_META)
    });
  },

  importBackup(jsonString) {
    const obj = JSON.parse(jsonString);
    if (!obj || obj._v !== 1) throw new Error("Unrecognised backup format.");
    if (obj.history)        _lsSet(STORE_KEYS.HISTORY, obj.history);
    if (obj.currentDate)    _lsSet(STORE_KEYS.CURRENT_DATE, obj.currentDate);
    if (obj.lastUploadMeta) _lsSet(STORE_KEYS.LAST_UPLOAD_META, obj.lastUploadMeta);
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

// Dates on or after this key are managed exclusively by Google Sheets.
// tracker-data.js entries for these dates are ignored so the sheet always wins.
const TRACKER_DATA_CUTOVER = "2026-08-17";

function loadFromTrackerData() {
  if (typeof TRACKER_DATA === "undefined" || !TRACKER_DATA) return;

  const local = Storage.getHistory();
  let latestDate = null;

  Object.entries(TRACKER_DATA).forEach(([dk, entry]) => {
    // Dates from the cutover onward are owned by Google Sheets — skip them here.
    if (dk >= TRACKER_DATA_CUTOVER) return;

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

  _lsSet(STORE_KEYS.HISTORY, JSON.stringify(local));
  if (latestDate) {
    // Only overwrite currentDate if the file has a newer entry than what
    // is currently set (so a manually uploaded xlsx for today wins).
    const existing = Storage.getCurrentDateKey();
    if (!existing || latestDate >= existing) {
      _lsSet(STORE_KEYS.CURRENT_DATE, latestDate);
      const entry = TRACKER_DATA[latestDate];
      _lsSet(STORE_KEYS.LAST_UPLOAD_META, JSON.stringify({
        dateKey:      latestDate,
        uploadedAt:   entry.uploadedAt || new Date().toISOString(),
        sourceColumn: entry.sourceColumn || latestDate
      }));
    }
  }
}
