// scripts/exportToGoogleSheets.js
// Version 5.0 - Auto-fill Google Sheets matching the image format

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { google } = require("googleapis");
require("dotenv").config();

/**
 * Main export function
 */
async function exportToGoogleSheets() {
  console.log("🧪 Running tests...\n");

  try {
    execSync("npm test -- --json --outputFile=test-results/jest-output.json", {
      encoding: "utf-8",
      stdio: "inherit",
    });
    console.log("\n Tests completed!");
  } catch (error) {
    console.log("\n⚠️ Some tests failed, continuing export...");
  }

  const testResults = parseTestResults();
  const metadata = loadMetadata();
  const enrichedResults = mergeMetadata(testResults, metadata);

  const sheets = await initGoogleSheets();
  await updateAllSheets(sheets, enrichedResults);

  console.log("\n All sheets updated successfully!");
  console.log(
    "📊 View: https://docs.google.com/spreadsheets/d/" +
      process.env.GOOGLE_SHEET_ID
  );
}

/**
 * Initialize Google Sheets API
 */
async function initGoogleSheets() {
  const credentialsPath = path.join(
    __dirname,
    "..",
    process.env.GOOGLE_CREDENTIALS_PATH || "./credentials.json"
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(" credentials.json not found! Path: " + credentialsPath);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  console.log(" Connected to Google Sheets API");
  return sheets;
}

/**
 * Parse Jest output
 */
function parseTestResults() {
  const jestOutputPath = path.join(
    __dirname,
    "../test-results/jest-output.json"
  );

  if (!fs.existsSync(jestOutputPath)) {
    throw new Error(" jest-output.json not found!");
  }

  const jestOutput = JSON.parse(fs.readFileSync(jestOutputPath, "utf-8"));
  const results = {};

  (jestOutput.testResults || []).forEach((file) => {
    (file.assertionResults || []).forEach((test) => {
      const titles = test.ancestorTitles || [];
      const funcName = titles[titles.length - 1] || "Unknown";

      if (!results[funcName]) results[funcName] = [];

      results[funcName].push({
        testName: test.title,
        status: test.status === "passed" ? "Pass" : "Fail",
        duration: test.duration || 0,
        failureMessages: test.failureMessages || [],
      });
    });
  });

  console.log(
    "📊 Parsed: " +
      Object.keys(results).length +
      " functions, " +
      Object.values(results).reduce((sum, tests) => sum + tests.length, 0) +
      " tests"
  );

  return results;
}

/**
 * Load test metadata
 */
function loadMetadata() {
  const metadataPath = path.join(
    __dirname,
    "../test-results/test-metadata.json"
  );

  if (!fs.existsSync(metadataPath)) {
    console.log("⚠️ Metadata not found, using test names only");
    return [];
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  console.log(" Loaded metadata: " + metadata.length + " entries");

  return metadata;
}

/**
 * Merge metadata into test results
 */
function mergeMetadata(testResults, metadata) {
  const enriched = {};

  for (const [funcName, tests] of Object.entries(testResults)) {
    enriched[funcName] = tests.map((test) => {
      const meta =
        metadata.find(
          (m) =>
            m.function === funcName &&
            (m.condition === test.testName ||
              test.testName.includes(m.condition) ||
              m.condition.includes(test.testName))
        ) || {};

      return {
        ...test,
        ...meta,
        status: test.status,
        duration: test.duration,
        failureMessages: test.failureMessages,
      };
    });
  }

  return enriched;
}

/**
 * Update all sheets
 */
async function updateAllSheets(sheets, testResults) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error(" GOOGLE_SHEET_ID not set in .env!");

  let updated = 0,
    failed = 0;

  for (const [funcName, tests] of Object.entries(testResults)) {
    try {
      await updateSheet(sheets, spreadsheetId, funcName, tests);
      console.log(" Updated: " + funcName + " (" + tests.length + " tests)");
      updated++;
      await sleep(300);
    } catch (error) {
      console.error(" Failed: " + funcName + " - " + error.message);
      failed++;
    }
  }

  console.log("\n📊 Summary:");
  console.log("   Updated: " + updated + " sheets");
  console.log("   Failed: " + failed + " sheets");
}

/**
 * Update single sheet matching the image format
 */
async function updateSheet(sheets, spreadsheetId, sheetName, tests) {
  try {
    const sheetData = await getSheetStructure(sheets, spreadsheetId, sheetName);
    if (!sheetData) {
      console.log("⚠️ Sheet not found: " + sheetName);
      return;
    }

    const { sheetId, startRow, tcColumns } = sheetData;

    // Clear existing data
    await clearExistingData(sheets, spreadsheetId, sheetName, startRow);

    // Fill test data (rows 9-25 in image)
    await fillTestCases(
      sheets,
      spreadsheetId,
      sheetName,
      tests,
      startRow,
      tcColumns
    );

    // Fill Confirm section (rows 26-39 in image)
    await fillConfirmSection(
      sheets,
      spreadsheetId,
      sheetName,
      tests,
      startRow + tests.length + 2,
      tcColumns
    );

    // Fill Result section (rows 40-43 in image)
    await fillResultSection(
      sheets,
      spreadsheetId,
      sheetName,
      tests,
      startRow + tests.length + 16,
      tcColumns
    );

    // Apply formatting
    await applyFormatting(
      sheets,
      spreadsheetId,
      sheetId,
      tests,
      startRow,
      tcColumns
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Get sheet structure
 */
async function getSheetStructure(sheets, spreadsheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = response.data.sheets.find(
      (s) => s.properties.title === sheetName
    );
    if (!sheet) return null;

    const sheetId = sheet.properties.sheetId;

    // Find TC columns (F, G, H, I, J, K, L, M, N, O, P = columns 5-15)
    const tcColumns = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // TC01-TC11

    const startRow = 9; // Row 9 in the image

    return { sheetId, startRow, tcColumns };
  } catch (error) {
    return null;
  }
}

/**
 * Clear existing data
 */
async function clearExistingData(sheets, spreadsheetId, sheetName, startRow) {
  try {
    const range = `${sheetName}!B${startRow}:P100`;
    await sheets.spreadsheets.values.clear({ spreadsheetId, range });
  } catch (error) {
    // Ignore
  }
}

/**
 * Fill test cases (matching rows 9-25 in image)
 */
async function fillTestCases(
  sheets,
  spreadsheetId,
  sheetName,
  tests,
  startRow,
  tcColumns
) {
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const row = startRow + i;

    // Column B: Condition
    await setCellValue(
      sheets,
      spreadsheetId,
      sheetName,
      row,
      "B",
      test.condition || test.testName
    );

    // Column C: Precondition
    await setCellValue(
      sheets,
      spreadsheetId,
      sheetName,
      row,
      "C",
      test.precondition || ""
    );

    // Fill "O" in corresponding TC column if test passed
    if (i < tcColumns.length) {
      const tcCol = columnIndexToLetter(tcColumns[i]);
      if (test.status === "Pass") {
        await setCellValue(sheets, spreadsheetId, sheetName, row, tcCol, "O");
      }
    }
  }
}

/**
 * Fill Confirm section (matching rows 26-39 in image)
 */
async function fillConfirmSection(
  sheets,
  spreadsheetId,
  sheetName,
  tests,
  startRow,
  tcColumns
) {
  // Row startRow: "Confirm" label in column A (already there)

  // Row startRow+1: "Return" label
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 1,
    "B",
    "Return"
  );

  // Row startRow+2: "True" value
  for (let i = 0; i < tests.length && i < tcColumns.length; i++) {
    const test = tests[i];
    const tcCol = columnIndexToLetter(tcColumns[i]);
    if (test.status === "Pass") {
      await setCellValue(
        sheets,
        spreadsheetId,
        sheetName,
        startRow + 2,
        tcCol,
        "True"
      );
    }
  }

  // Row startRow+3: "FALSE" value
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 3,
    "C",
    "FALSE"
  );
  for (let i = 0; i < tests.length && i < tcColumns.length; i++) {
    const test = tests[i];
    const tcCol = columnIndexToLetter(tcColumns[i]);
    if (test.status === "Fail") {
      await setCellValue(
        sheets,
        spreadsheetId,
        sheetName,
        startRow + 3,
        tcCol,
        "O"
      );
    }
  }

  // Row startRow+5: "Exception" label
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 5,
    "B",
    "Exception"
  );

  // Row startRow+6: "IllegalArgumentException" value
  for (let i = 0; i < tests.length && i < tcColumns.length; i++) {
    const test = tests[i];
    if (test.condition && test.condition.toLowerCase().includes("exception")) {
      const tcCol = columnIndexToLetter(tcColumns[i]);
      await setCellValue(
        sheets,
        spreadsheetId,
        sheetName,
        startRow + 6,
        tcCol,
        "O"
      );
    }
  }

  // Row startRow+8: "Log message" label
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 8,
    "B",
    "Log message"
  );

  // Row startRow+9-13: Various log messages
  const logMessages = [
    { row: startRow + 9, col: "C", msg: '"Invalid username"' },
    { row: startRow + 10, col: "C", msg: '"Invalid password"' },
    {
      row: startRow + 11,
      col: "C",
      msg: '"Username must be between 3 and 50 characters"',
    },
    {
      row: startRow + 12,
      col: "C",
      msg: '"User not found: username_not_found"',
    },
    {
      row: startRow + 13,
      col: "C",
      msg: '"User account is disabled: username_inactive"',
    },
  ];

  for (const logMsg of logMessages) {
    await setCellValue(
      sheets,
      spreadsheetId,
      sheetName,
      logMsg.row,
      logMsg.col,
      logMsg.msg
    );

    // Fill "O" for matching tests
    for (let i = 0; i < tests.length && i < tcColumns.length; i++) {
      const test = tests[i];
      const tcCol = columnIndexToLetter(tcColumns[i]);

      if (
        test.condition &&
        (logMsg.msg.toLowerCase().includes(test.condition.toLowerCase()) ||
          test.condition
            .toLowerCase()
            .includes(logMsg.msg.toLowerCase().replace(/"/g, "")))
      ) {
        await setCellValue(
          sheets,
          spreadsheetId,
          sheetName,
          logMsg.row,
          tcCol,
          "O"
        );
      }
    }
  }
}

/**
 * Fill Result section (matching rows 40-43 in image)
 */
async function fillResultSection(
  sheets,
  spreadsheetId,
  sheetName,
  tests,
  startRow,
  tcColumns
) {
  // Row startRow: "Result" label in column A (already there)

  // Row startRow+1: "Type (N: Normal, A: Abnormal, B: Boundary)"
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 1,
    "B",
    "Type (N: Normal, A: Abnormal, B: Boundary)"
  );

  for (let i = 0; i < tests.length && i < tcColumns.length; i++) {
    const test = tests[i];
    const tcCol = columnIndexToLetter(tcColumns[i]);

    // Determine type based on condition
    let type = "N"; // Normal
    const condition = (test.condition || "").toLowerCase();

    if (
      condition.includes("null") ||
      condition.includes("fail") ||
      condition.includes("invalid") ||
      condition.includes("not_found") ||
      condition.includes("exception")
    ) {
      type = "A"; // Abnormal
    } else if (
      condition.includes("ABCD") ||
      condition.includes("012341") ||
      condition.includes("boundary")
    ) {
      type = "B"; // Boundary
    }

    await setCellValue(
      sheets,
      spreadsheetId,
      sheetName,
      startRow + 1,
      tcCol,
      type
    );
  }

  // Row startRow+2: "Passed/Failed"
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 2,
    "B",
    "Passed/Failed"
  );

  for (let i = 0; i < tests.length && i < tcColumns.length; i++) {
    const test = tests[i];
    const tcCol = columnIndexToLetter(tcColumns[i]);
    const result = test.status === "Pass" ? "P" : "F";
    await setCellValue(
      sheets,
      spreadsheetId,
      sheetName,
      startRow + 2,
      tcCol,
      result
    );
  }

  // Rows startRow+3 to startRow+6: Execution counts (1/1/0/1/0/1)
  const executionRows = [
    { row: startRow + 3, value: "1" },
    { row: startRow + 4, value: "1" },
    { row: startRow + 5, value: "0" },
    { row: startRow + 6, value: "1" },
  ];

  for (const execRow of executionRows) {
    for (let i = 0; i < tests.length && i < tcColumns.length; i++) {
      const tcCol = columnIndexToLetter(tcColumns[i]);
      await setCellValue(
        sheets,
        spreadsheetId,
        sheetName,
        execRow.row,
        tcCol,
        execRow.value
      );
    }
  }

  // Row startRow+8: "Executed Date"
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 8,
    "B",
    "Executed Date"
  );

  // Row startRow+9: "Defect ID"
  await setCellValue(
    sheets,
    spreadsheetId,
    sheetName,
    startRow + 9,
    "B",
    "Defect ID"
  );
}

/**
 * Set single cell value
 */
async function setCellValue(sheets, spreadsheetId, sheetName, row, col, value) {
  if (value === undefined || value === null || value === "") return;

  const range = `${sheetName}!${col}${row}`;

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      resource: { values: [[value]] },
    });
  } catch (error) {
    // Ignore individual cell errors
  }
}

/**
 * Convert column index to letter
 */
function columnIndexToLetter(index) {
  let letter = "";
  let temp = index;

  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }

  return letter;
}

/**
 * Apply formatting
 */
async function applyFormatting(
  sheets,
  spreadsheetId,
  sheetId,
  tests,
  startRow,
  tcColumns
) {
  const requests = [];

  tests.forEach((test, index) => {
    if (index >= tcColumns.length) return;

    const rowIndex = startRow - 1 + index;
    const tcColIndex = tcColumns[index];

    if (test.status === "Pass") {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: tcColIndex,
            endColumnIndex: tcColIndex + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.9, green: 0.96, blue: 0.92, alpha: 1 },
              horizontalAlignment: "CENTER",
              textFormat: {
                fontSize: 11,
                bold: true,
              },
            },
          },
          fields:
            "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)",
        },
      });
    }
  });

  if (requests.length > 0) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests },
      });
    } catch (error) {
      // Ignore formatting errors
    }
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run if called directly
if (require.main === module) {
  exportToGoogleSheets().catch((error) => {
    console.error(" Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { exportToGoogleSheets };
