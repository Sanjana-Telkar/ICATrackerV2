// =============================================================================
//  ICA Tracker — Google Apps Script
//  Paste this entire file into script.google.com → New project → Code.gs
//  Then deploy as a Web App (see setup guide).
// =============================================================================

var SHEET_NAME = "ICA_Submissions";

// ---------------------------------------------------------------------------
//  Column headers written on first run
// ---------------------------------------------------------------------------
var HEADERS = ["timestamp", "dateKey", "sourceColumn", "email",
               "name", "team", "fte", "assistants", "uploadedAt"];

// ---------------------------------------------------------------------------
//  GET  — fetch all rows for a given dateKey
//  Called by the frontend: fetch(URL + "?dateKey=2026-07-28")
// ---------------------------------------------------------------------------
function doGet(e) {
  var dateKey = e && e.parameter && e.parameter.dateKey ? e.parameter.dateKey : null;
  var sheet   = getOrCreateSheet();
  var rows    = getAllRows(sheet);

  if (dateKey) {
    rows = rows.filter(function(r) { return r.dateKey === dateKey; });
  }

  return jsonResponse({ ok: true, rows: rows });
}

// ---------------------------------------------------------------------------
//  POST — upsert a single person's usage for a date
//  Body (JSON): { dateKey, sourceColumn, uploadedAt, record: { email, name, team, fte, assistants } }
//
//  If a row already exists for (dateKey + email), it is deleted first,
//  then the new row is appended — so re-submitting always overwrites cleanly.
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var dateKey      = body.dateKey;
    var sourceColumn = body.sourceColumn || dateKey;
    var uploadedAt   = body.uploadedAt   || new Date().toISOString();
    var rec          = body.record;

    if (!dateKey || !rec || !rec.email) {
      return jsonResponse({ ok: false, error: "Missing dateKey or record.email." });
    }

    var sheet = getOrCreateSheet();

    // Delete only this person's existing row for this date (upsert behaviour)
    deleteRowForPersonOnDate(sheet, dateKey, rec.email);

    // Append the new row
    sheet.appendRow([
      new Date().toISOString(),   // timestamp
      dateKey,
      sourceColumn,
      rec.email        || "",
      rec.name         || "",
      rec.team         || "",
      rec.fte          != null ? rec.fte : 1,
      JSON.stringify(rec.assistants || []),
      uploadedAt
    ]);

    return jsonResponse({ ok: true });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
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

// Delete only the row where dateKey AND email both match (case-insensitive email)
function deleteRowForPersonOnDate(sheet, dateKey, email) {
  var data        = sheet.getDataRange().getValues();
  var dateColIdx  = data[0].indexOf("dateKey");
  var emailColIdx = data[0].indexOf("email");
  if (dateColIdx === -1 || emailColIdx === -1) return;

  var emailLower = email.toLowerCase();
  // Iterate backwards so row deletion doesn't shift indices
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][dateColIdx] === dateKey &&
        String(data[i][emailColIdx]).toLowerCase() === emailLower) {
      sheet.deleteRow(i + 1);
    }
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
