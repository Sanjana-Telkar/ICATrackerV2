// =============================================================================
//  ICA Tracker — Google Apps Script
//  Paste this entire file into script.google.com → New project → Code.gs
//  Then deploy as a Web App:
//    Execute as:     Me
//    Who has access: Anyone (no sign-in required)
// =============================================================================

var SHEET_NAME = "ICA_Submissions";

var HEADERS = ["timestamp", "dateKey", "sourceColumn", "email",
               "name", "team", "fte", "assistants", "uploadedAt"];

// ---------------------------------------------------------------------------
//  GET — fetch all rows for a given dateKey
//  Called by: fetch(URL + "?dateKey=2026-08-14")
// ---------------------------------------------------------------------------
function doGet(e) {
  try {
    var dateKey = e && e.parameter && e.parameter.dateKey
                  ? e.parameter.dateKey : null;
    var sheet = getOrCreateSheet();
    var rows  = getAllRows(sheet);

    if (dateKey) {
      rows = rows.filter(function(r) { return r.dateKey === dateKey; });
    }

    return buildResponse({ ok: true, rows: rows });
  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
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
      rec.email     || "",
      rec.name      || "",
      rec.team      || "",
      rec.fte       != null ? rec.fte : 1,
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

// Use TextOutput with CORS-friendly mime type
function buildResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
