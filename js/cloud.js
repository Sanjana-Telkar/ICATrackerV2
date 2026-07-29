/* ==========================================================================
   ICA Usage Tracker — Cloud Sync (disabled — data lives in git)
   JSONbin.io has been removed. Data is now served directly from
   data/tracker-data.js which is committed to the GitHub repo and loaded
   as a plain <script> tag. No server, no API keys, no CORS issues.

   This file is kept as a no-op shim so none of the other JS files need
   to change their Cloud.* call-sites.
   ========================================================================== */

const Cloud = (() => {
  function isConfigured() { return false; }
  async function syncFromCloud() { return false; }
  async function pushAfterUpload() { /* no-op */ }
  return { isConfigured, syncFromCloud, pushAfterUpload };
})();
