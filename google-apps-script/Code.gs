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
  try {
    var dateKey  = e && e.parameter && e.parameter.dateKey   ? e.parameter.dateKey  : null;
    var callback = e && e.parameter && e.parameter.callback  ? e.parameter.callback : null;
    var sheet    = getOrCreateSheet();
    var rows     = getAllRows(sheet);

    if (dateKey) {
      rows = rows.filter(function(r) { return r.dateKey === dateKey; });
    }

    var payload = JSON.stringify({ ok: true, rows: rows });

    // JSONP mode — wraps response in callback function call
    // This bypasses corporate network fetch() blocks
    if (callback) {
      return ContentService
        .createTextOutput(callback + "(" + payload + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errPayload = JSON.stringify({ ok: false, error: err.message });
    return ContentService
      .createTextOutput(errPayload)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
//  POST — upsert a single person's usage for a date
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    var body         = JSON.parse(e.postData.contents);
    var dateKey      = body.dateKey;
    var sourceColumn = body.sourceColumn || dateKey;
    var uploadedAt   = body.uploadedAt   || new Date().toISOString();
    var rec          = body.record;

    if (!dateKey || !rec || !rec.email) {
      return buildResponse({ ok: false, error: "Missing dateKey or record.email." });
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

    return buildResponse({ ok: true });

  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
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

function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
