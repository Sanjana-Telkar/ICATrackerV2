/* ==========================================================================
   ICA Usage Tracker — Storage
   Everything persists in the browser's localStorage so the last uploaded
   workbook survives refreshes/reboots until the next 6 PM upload overwrites
   it. History (one entry per uploaded date) is kept too, so the dashboard
   can show trends across days.
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
  }
};
