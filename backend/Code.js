
// ==========================================
// COPY THIS CODE INTO GOOGLE APPS SCRIPT
// ==========================================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  // Wait for up to 30 seconds for other processes to finish.
  lock.tryLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Handle Data Storage (Hidden JSON Blob)
    // This is the source of truth for the App
    let dataSheet = ss.getSheetByName("_DATA");
    if (!dataSheet) {
      dataSheet = ss.insertSheet("_DATA");
      dataSheet.hideSheet();
    }

    // GET REQUEST: Return data to App
    if (!e || !e.postData) {
      const data = dataSheet.getRange("A1").getValue();
      return ContentService.createTextOutput(data || JSON.stringify({}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // POST REQUEST: Save data from App
    const rawData = e.postData.contents;
    if (!rawData) {
        return ContentService.createTextOutput(JSON.stringify({ error: "No data received" }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    const jsonData = JSON.parse(rawData);

    // Save raw blob (Source of Truth)
    dataSheet.getRange("A1").setValue(rawData);

    // 2. Update Human Readable Sheets (For Admins)
    updateReadableSheets(ss, jsonData);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function updateReadableSheets(ss, data) {
  // --- 1. MEMBERS VIEW ---
  let memSheet = ss.getSheetByName("Members View");
  if (!memSheet) memSheet = ss.insertSheet("Members View");
  memSheet.clear();
  
  if (data.members && data.members.length > 0) {
    const headers = ["ID", "First Name", "Last Name", "Role", "Years in BPLT"];
    const rows = data.members.map(m => [m.id, m.firstName, m.lastName, m.role, m.yearsInBPLT]);
    memSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#154734").setFontColor("white");
    memSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // --- 2. SCHEDULE VIEW ---
  let schSheet = ss.getSheetByName("Schedule View");
  if (!schSheet) schSheet = ss.insertSheet("Schedule View");
  schSheet.clear();

  if (data.games && data.games.length > 0) {
    // Sort games by date
    const sortedGames = data.games.sort((a, b) => new Date(a.date) - new Date(b.date));
    const gHeaders = ["Date", "Time", "Sport ID", "Opponent", "Location", "Bonus", "Description"];
    const gRows = sortedGames.map(g => [
      g.date, 
      g.time || '', 
      g.sportId,
      g.opponent, 
      g.location, 
      g.isBonus,
      g.description || ''
    ]);
    schSheet.getRange(1, 1, 1, gHeaders.length).setValues([gHeaders]).setFontWeight("bold").setBackground("#154734").setFontColor("white");
    schSheet.getRange(2, 1, gRows.length, gHeaders.length).setValues(gRows);
  }

  // --- 3. SPORTS VIEW ---
  let sportSheet = ss.getSheetByName("Sports View");
  if (!sportSheet) sportSheet = ss.insertSheet("Sports View");
  sportSheet.clear();

  if (data.sports && data.sports.length > 0) {
    const sHeaders = ["ID", "Sport Name"];
    const sRows = data.sports.map(s => [s.id, s.name]);
    sportSheet.getRange(1, 1, 1, sHeaders.length).setValues([sHeaders]).setFontWeight("bold").setBackground("#154734").setFontColor("white");
    sportSheet.getRange(2, 1, sRows.length, sHeaders.length).setValues(sRows);
  }

  // --- 4. ATTENDANCE MATRIX VIEW ---
  let attSheet = ss.getSheetByName("Attendance View");
  if (!attSheet) attSheet = ss.insertSheet("Attendance View");
  attSheet.clear();

  if (data.members && data.games && data.games.length > 0) {
    // Prepare Matrix
    // Cols: Games (sorted)
    // Rows: Members (sorted by name)
    
    const sortedGames = data.games.sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedMembers = data.members.sort((a, b) => a.firstName.localeCompare(b.firstName));

    // Header Row: [Member Name, ...Game Info]
    const matrixHeaders = ["Member Name", ...sortedGames.map(g => `${g.opponent} (${g.date})`)];
    
    // Data Rows
    const matrixRows = sortedMembers.map(m => {
      const row = [`${m.firstName} ${m.lastName}`];
      sortedGames.forEach(g => {
        const isPresent = data.attendance[g.id] && data.attendance[g.id][m.id];
        row.push(isPresent ? "1" : ""); // Using "1" for presence makes summing easier in Sheets
      });
      return row;
    });

    if (matrixRows.length > 0) {
        const range = attSheet.getRange(1, 1, matrixRows.length + 1, matrixHeaders.length);
        
        // Set Header
        attSheet.getRange(1, 1, 1, matrixHeaders.length)
            .setValues([matrixHeaders])
            .setFontWeight("bold")
            .setBackground("#FFB81C")
            .setFontColor("#154734")
            .setWrap(true);
            
        // Set Data
        attSheet.getRange(2, 1, matrixRows.length, matrixHeaders.length).setValues(matrixRows);
        
        // Formatting
        attSheet.setFrozenRows(1);
        attSheet.setFrozenColumns(1);
        attSheet.autoResizeColumns(1, 1); // Resize Name column
        // Set column widths for games to be narrow
        if (matrixHeaders.length > 1) {
           attSheet.setColumnWidths(2, matrixHeaders.length - 1, 100);
        }
    }
  }
}
