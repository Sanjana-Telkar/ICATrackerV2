// =============================================================================
//  ICA Tracker — Google Apps Script
//  Deploy as Web App:
//    Execute as:     Me
//    Who has access: Anyone (no sign-in required)
// =============================================================================

var SHEET_NAME = "ICA_Submissions";

var HEADERS = ["timestamp", "dateKey", "sourceColumn", "email",
               "name", "team", "fte", "assistants", "uploadedAt"];

// ---------------------------------------------------------------------------
//  GET — supports both plain JSON and JSONP (callback param)
//  Plain:  fetch(URL + "?dateKey=2026-08-14")
//  JSONP:  <script src="URL?dateKey=2026-08-14&callback=myFn">
// ---------------------------------------------------------------------------
function doGet(e) {
  var callback = e && e.parameter && e.parameter.callback ? e.parameter.callback : null;

  try {
    var action = e && e.parameter && e.parameter.action ? e.parameter.action : "get";

    // ── POST-via-GET: action=post&data={...}&callback=fn ──────────────────
    // Corporate networks block fetch() to script.google.com, so the client
    // encodes the POST body as a ?data= query param and uses a <script> tag.
    if (action === "post") {
      var raw  = e && e.parameter && e.parameter.data ? e.parameter.data : null;
      if (!raw) {
        return jsonpResponse(callback, { ok: false, error: "Missing data parameter." });
      }
      var body         = JSON.parse(raw);
      var dateKey      = body.dateKey;
      var sourceColumn = body.sourceColumn || dateKey;
      var uploadedAt   = body.uploadedAt   || new Date().toISOString();
      var rec          = body.record;

      if (!dateKey || !rec || !rec.email) {
        return jsonpResponse(callback, { ok: false, error: "Missing dateKey or record.email." });
      }

      var sheet = getOrCreateSheet();
      deleteRowForPersonOnDate(sheet, dateKey, rec.email);
      sheet.appendRow([
        new Date().toISOString(),
        dateKey,
        sourceColumn,
        rec.email  || "",
        rec.name   || "",
        rec.team   || "",
        rec.fte    != null ? rec.fte : 1,
        JSON.stringify(rec.assistants || []),
        uploadedAt
      ]);

      return jsonpResponse(callback, { ok: true });
    }

    // ── GET: ?dateKey=YYYY-MM-DD&callback=fn ─────────────────────────────
    var dateKey  = e && e.parameter && e.parameter.dateKey ? e.parameter.dateKey : null;
    var sheet    = getOrCreateSheet();
    var rows     = getAllRows(sheet);

    if (dateKey) {
      rows = rows.filter(function(r) { return r.dateKey === dateKey; });
    }

    return jsonpResponse(callback, { ok: true, rows: rows });

  } catch (err) {
    return jsonpResponse(callback, { ok: false, error: err.message });
  }
}

// Unified JSONP/JSON responder
function jsonpResponse(callback, obj) {
  var payload = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + payload + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
//  POST — still supported for non-corporate networks / direct API use
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    var body         = JSON.parse(e.postData.contents);
    var dateKey      = body.dateKey;
    var sourceColumn = body.sourceColumn || dateKey;
    var uploadedAt   = body.uploadedAt   || new Date().toISOString();
    var rec          = body.record;

    if (!dateKey || !rec || !rec.email) {
      return jsonpResponse(null, { ok: false, error: "Missing dateKey or record.email." });
    }

    var sheet = getOrCreateSheet();
    deleteRowForPersonOnDate(sheet, dateKey, rec.email);

    sheet.appendRow([
      new Date().toISOString(),
      dateKey,
      sourceColumn,
      rec.email  || "",
      rec.name   || "",
      rec.team   || "",
      rec.fte    != null ? rec.fte : 1,
      JSON.stringify(rec.assistants || []),
      uploadedAt
    ]);

    return jsonpResponse(null, { ok: true });

  } catch (err) {
    return jsonpResponse(null, { ok: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
function getOrCreateSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAllRows(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    // dateKey may be stored as a Date object by Sheets — normalise to YYYY-MM-DD string
    if (obj.dateKey instanceof Date) {
      var d = obj.dateKey;
      obj.dateKey = d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
    } else {
      obj.dateKey = String(obj.dateKey || "").trim();
    }
    try { obj.assistants = JSON.parse(obj.assistants); } catch(e) { obj.assistants = []; }
    return obj;
  });
}

function deleteRowForPersonOnDate(sheet, dateKey, email) {
  var data        = sheet.getDataRange().getValues();
  var dateColIdx  = data[0].indexOf("dateKey");
  var emailColIdx = data[0].indexOf("email");
  if (dateColIdx === -1 || emailColIdx === -1) return;

  var emailLower = email.toLowerCase();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][dateColIdx] === dateKey &&
        String(data[i][emailColIdx]).toLowerCase() === emailLower) {
      sheet.deleteRow(i + 1);
    }
  }
}

