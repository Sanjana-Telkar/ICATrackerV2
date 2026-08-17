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

  // Re-apply formatting after every write so new rows/columns stay styled
  formatSheet(sheet);
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
//  Formatting — called after every write
// ---------------------------------------------------------------------------
function formatSheet(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return;

  var headers = getHeaders(sheet);

  // ── D: Bold + background on header row ───────────────────────────────────
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setBackground("#d9e1f2");        // soft blue-grey
  headerRange.setFontColor("#1a1a2e");
  headerRange.setVerticalAlignment("middle");
  headerRange.setHorizontalAlignment("center");
  headerRange.setWrap(false);

  if (lastRow < 2) return;  // no data rows yet

  var dataRows  = lastRow - 1;
  var dataRange = sheet.getRange(2, 1, dataRows, lastCol);

  // ── E: Alternate row banding (odd = white, even = very light grey) ───────
  for (var r = 2; r <= lastRow; r++) {
    var rowBg = (r % 2 === 0) ? "#f5f7fa" : "#ffffff";
    sheet.getRange(r, 1, 1, META_COL_COUNT).setBackground(rowBg);
  }

  // ── A: Meta columns — slightly warmer tint to distinguish from date cols ─
  if (lastRow > 1) {
    sheet.getRange(2, 1, dataRows, META_COL_COUNT)
      .setFontColor("#2c3e50")
      .setFontWeight("normal");
  }

  // ── B + C: Date columns — weekend tint on header + cell status colors ────
  for (var c = META_COL_COUNT + 1; c <= lastCol; c++) {
    var dateStr = String(headers[c - 1] || "");
    var isWeekend = false;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      var parts   = dateStr.split("-");
      var dateObj = new Date(
        parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])
      );
      var day = dateObj.getDay(); // 0=Sun, 6=Sat
      isWeekend = (day === 0 || day === 6);
    }

    // B: Date column header tint
    var colHeaderBg = isWeekend ? "#e8e8e8" : "#dce6f1";  // grey for weekend, blue for weekday
    sheet.getRange(1, c).setBackground(colHeaderBg);

    // C: Cell status colors for data rows
    for (var r = 2; r <= lastRow; r++) {
      var cell    = sheet.getRange(r, c);
      var val     = String(cell.getValue() || "").trim().toLowerCase();
      var rowBg   = (r % 2 === 0) ? "#f5f7fa" : "#ffffff";  // default banding

      if (val === "") {
        // Not submitted
        cell.setBackground(isWeekend ? "#eeeeee" : rowBg);
        cell.setFontColor("#999999");
      } else if (val === "on leave") {
        // OOO — soft amber
        cell.setBackground("#fff8e1");
        cell.setFontColor("#b8860b");
        cell.setFontWeight("normal");
      } else {
        // Has assistants — light green
        cell.setBackground("#e8f5e9");
        cell.setFontColor("#2e7d32");
        cell.setFontWeight("normal");
      }
    }
  }

  // ── Auto-resize meta columns for readability ──────────────────────────────
  for (var mc = 1; mc <= META_COL_COUNT; mc++) {
    sheet.autoResizeColumn(mc);
  }
  // Date columns: fixed narrow width
  if (lastCol > META_COL_COUNT) {
    sheet.setColumnWidths(META_COL_COUNT + 1, lastCol - META_COL_COUNT, 160);
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

// ---------------------------------------------------------------------------
//  Run this manually from the Apps Script editor to format existing data:
//  Select this function in the editor dropdown → click Run
// ---------------------------------------------------------------------------
function applyFormatting() {
  var sheet = getOrCreateSheet();
  formatSheet(sheet);
}

