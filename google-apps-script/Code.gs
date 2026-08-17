// =============================================================================
//  ICA Tracker — Google Apps Script
//  Deploy as Web App:
//    Execute as:     Me
//    Who has access: Anyone (no sign-in required)
//
//  Sheet layout (ICA_Usage):
//    Row 1  — headers: email | name | team | 2026-08-17 | 2026-08-18 | …
//    Row 2+ — one row per person; date columns hold comma-separated assistants
//             or "On Leave" for OOO days; empty = not yet submitted
// =============================================================================

var SHEET_NAME   = "ICA_Usage";
var META_COLS    = ["email", "name", "team"];  // fixed left columns
var META_COL_COUNT = META_COLS.length;

// ---------------------------------------------------------------------------
//  GET — fetch all submissions for a given dateKey
//  JSONP: <script src="URL?dateKey=YYYY-MM-DD&callback=myFn">
// ---------------------------------------------------------------------------
function doGet(e) {
  var callback = e && e.parameter && e.parameter.callback ? e.parameter.callback : null;

  try {
    var action = e && e.parameter && e.parameter.action ? e.parameter.action : "get";

    // ── POST-via-GET: action=post&data={...}&callback=fn ──────────────────
    if (action === "post") {
      var raw = e && e.parameter && e.parameter.data ? e.parameter.data : null;
      if (!raw) {
        return jsonpResponse(callback, { ok: false, error: "Missing data parameter." });
      }
      var body = JSON.parse(raw);
      writeSubmission(body);
      return jsonpResponse(callback, { ok: true });
    }

    // ── GET: ?dateKey=YYYY-MM-DD&callback=fn ─────────────────────────────
    var dateKey = e && e.parameter && e.parameter.dateKey ? e.parameter.dateKey : null;
    if (!dateKey) {
      return jsonpResponse(callback, { ok: false, error: "Missing dateKey parameter." });
    }

    var rows = getRowsForDate(dateKey);
    return jsonpResponse(callback, { ok: true, rows: rows });

  } catch (err) {
    return jsonpResponse(callback, { ok: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
//  POST — standard HTTP POST (non-corporate networks)
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    writeSubmission(body);
    return jsonpResponse(null, { ok: true });
  } catch (err) {
    return jsonpResponse(null, { ok: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
//  Core write — upserts one person's assistants into the pivot sheet
// ---------------------------------------------------------------------------
function writeSubmission(body) {
  var dateKey    = body.dateKey;
  var uploadedAt = body.uploadedAt || new Date().toISOString();
  var rec        = body.record;

  if (!dateKey || !rec || !rec.email) {
    throw new Error("Missing dateKey or record.email.");
  }

  var sheet   = getOrCreateSheet();
  var headers = getHeaders(sheet);      // ["email","name","team","2026-08-17",...]

  // ── Ensure the date column exists ────────────────────────────────────────
  var dateColIdx = headers.indexOf(dateKey);
  if (dateColIdx === -1) {
    // Append a new date column, inserting it in chronological order
    dateColIdx = insertDateColumn(sheet, headers, dateKey);
    headers = getHeaders(sheet); // refresh after insert
    dateColIdx = headers.indexOf(dateKey);
  }

  // ── Find or create the person's row ──────────────────────────────────────
  var emailLower = rec.email.toLowerCase();
  var data       = sheet.getDataRange().getValues();
  var rowIdx     = -1;  // 0-based index into data[]

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === emailLower) {
      rowIdx = i;
      break;
    }
  }

  var assistantStr = Array.isArray(rec.assistants) && rec.assistants.length > 0
    ? rec.assistants.join(", ")
    : "";

  if (rowIdx === -1) {
    // New person — append a full row
    var newRow = new Array(headers.length).fill("");
    newRow[0] = rec.email || "";
    newRow[1] = rec.name  || "";
    newRow[2] = rec.team  || "";
    newRow[dateColIdx] = assistantStr;
    sheet.appendRow(newRow);
  } else {
    // Existing person — update only the date cell
    var sheetRow = rowIdx + 1;
    var sheetCol = dateColIdx + 1;  // 1-based
    sheet.getRange(sheetRow, sheetCol).setValue(assistantStr);

    // Also refresh name/team in case they changed
    sheet.getRange(sheetRow, 1).setValue(rec.email || "");
    sheet.getRange(sheetRow, 2).setValue(rec.name  || "");
    sheet.getRange(sheetRow, 3).setValue(rec.team  || "");
  }
}

// ---------------------------------------------------------------------------
//  Read all rows for a given dateKey — returns array of record objects
// ---------------------------------------------------------------------------
function getRowsForDate(dateKey) {
  var sheet   = getOrCreateSheet();
  var headers = getHeaders(sheet);
  var dateColIdx = headers.indexOf(dateKey);

  if (dateColIdx === -1) return [];  // no submissions for this date yet

  var data = sheet.getDataRange().getValues();
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row          = data[i];
    var email        = String(row[0] || "").trim();
    if (!email) continue;

    var assistantStr = String(row[dateColIdx] || "").trim();
    var assistants   = assistantStr === "" ? [] : assistantStr.split(",").map(function(s) { return s.trim(); });

    rows.push({
      email:      email,
      name:       String(row[1] || "").trim(),
      team:       String(row[2] || "").trim(),
      assistants: assistants,
      uploadedAt: new Date().toISOString()
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
//  Insert a date column in chronological order (after existing date cols)
// ---------------------------------------------------------------------------
function insertDateColumn(sheet, headers, newDateKey) {
  // Find the right insertion position — after all existing date cols that are
  // chronologically earlier, but before any that are later.
  var insertAfter = META_COL_COUNT - 1;  // default: right after meta cols
  for (var i = META_COL_COUNT; i < headers.length; i++) {
    if (headers[i] <= newDateKey) {
      insertAfter = i;
    }
  }
  var insertColPos = insertAfter + 2;  // 1-based, +1 for after, +1 for 1-based

  // If the new date should go at the end, just append
  if (insertAfter === headers.length - 1 || headers.length === META_COL_COUNT) {
    sheet.getRange(1, headers.length + 1).setValue(newDateKey);
    return headers.length;  // 0-based index of new column
  }

  // Otherwise insert a column at the right position
  sheet.insertColumnAfter(insertAfter + 1);  // 1-based
  sheet.getRange(1, insertAfter + 2).setValue(newDateKey);
  return insertAfter + 1;  // 0-based index
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
function getOrCreateSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(META_COLS);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(META_COL_COUNT);
  }
  return sheet;
}

function getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return META_COLS.slice();
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    // Date headers may be stored as Date objects by Sheets
    if (h instanceof Date) {
      return h.getFullYear() + "-" +
        String(h.getMonth() + 1).padStart(2, "0") + "-" +
        String(h.getDate()).padStart(2, "0");
    }
    return String(h || "").trim();
  });
}

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
