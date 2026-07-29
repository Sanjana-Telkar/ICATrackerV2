/* ==========================================================================
   ICA Usage Tracker — Excel Parsing
   Reads the daily tracker workbook (SheetJS), locates the column for
   "today" (or the most recent date <= today if today's column is missing —
   the sheet may still hold past days), and builds a record per roster user.
   ========================================================================== */

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

/** Parses headers like "Wed-22-Jul-26" -> Date object (or null). */
function parseHeaderDate(header) {
  if (!header) return null;
  if (header instanceof Date) return header;
  const s = String(header).trim();
  const m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  return new Date(year, mon, day);
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHeaderLabel(d) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getDay()]}-${String(d.getDate()).padStart(2,"0")}-${mons[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Parses an ArrayBuffer of the uploaded .xlsx into a result object:
 * { dateKey, headerLabel, records, warning }
 */
function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find(n => /sheet1/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (!rows.length) throw new Error("The workbook appears to be empty.");

  const header = rows[0];
  // Columns 0-2 = email, name, team. Columns 3+ = dated usage columns.
  const dateCols = [];
  for (let c = 3; c < header.length; c++) {
    const d = parseHeaderDate(header[c]);
    if (d) dateCols.push({ index: c, date: d, label: String(header[c]) });
  }
  if (!dateCols.length) {
    throw new Error("No date columns (e.g. \"Wed-22-Jul-26\") were found in row 1.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let chosen = dateCols.find(dc => dateKey(dc.date) === dateKey(today));
  let warning = null;
  if (!chosen) {
    const past = dateCols.filter(dc => dc.date.getTime() <= today.getTime());
    if (past.length) {
      chosen = past.sort((a, b) => b.date - a.date)[0];
      warning = `No column for today (${formatHeaderLabel(today)}) was found. Using the most recent available date: ${chosen.label}.`;
    } else {
      chosen = dateCols.sort((a, b) => a.date - b.date)[0];
      warning = `No column for today or earlier was found. Using the earliest column present: ${chosen.label}.`;
    }
  }

  // Build a lookup of email -> cell value for the chosen column.
  const usageByEmail = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const email = String(row[0] || "").trim().toLowerCase();
    if (!email) continue;
    usageByEmail[email] = row[chosen.index];
  }

  // Build one record per roster member (roster is the source of truth for
  // names/teams/emails; the workbook only supplies usage per date).
  const records = ROSTER.map(person => {
    const raw = usageByEmail[person.email.toLowerCase()];
    const rawStr = (raw === undefined || raw === null) ? "" : String(raw).trim();
    // Fuzzy "on leave" detection — catches variants like:
    //   "On Leave", "on leave", "ON LEAVE", "on leava", "on_leave", "vacation",
    //   "leave", "on leave today", "on-leave" etc.
    const onLeave = /\b(on[\s_-]?leav[a-z]*|vacation|annual[\s_-]?leave|holiday|out[\s_-]?of[\s_-]?office|ooo)\b/i.test(rawStr)
      || /^leave$/i.test(rawStr);
    const assistants = (!onLeave && rawStr)
      ? rawStr.split(/[,;\/\n]+/).map(a => a.trim()).filter(Boolean)
      : [];
    return {
      email: person.email,
      name: person.name,
      team: person.team,
      fte: person.fte,
      assistants,
      used: assistants.length > 0,
      onLeave
    };
  });

  return {
    dateKey: dateKey(chosen.date),
    headerLabel: chosen.label,
    records,
    warning
  };
}
