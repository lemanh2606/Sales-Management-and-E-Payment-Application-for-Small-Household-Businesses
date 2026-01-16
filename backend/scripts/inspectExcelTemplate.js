/* eslint-disable no-console */
// Usage (PowerShell):
//   node scripts/inspectExcelTemplate.js "..\Mau bao cao doanh thu\Báo cáo doanh thu bán hàng tổng hợp.xlsx"
// Or inspect all templates in folder:
//   node scripts/inspectExcelTemplate.js "..\Mau bao cao doanh thu"

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

function isExcelFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".xlsx" || ext === ".xls";
}

function listExcelFiles(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return [inputPath];

  const entries = fs.readdirSync(inputPath);
  return entries
    .map((name) => path.join(inputPath, name))
    .filter((p) => {
      try {
        return fs.statSync(p).isFile() && isExcelFile(p);
      } catch {
        return false;
      }
    });
}

function to2DArray(ws) {
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
}

function normalizeHeaderCell(v) {
  return String(v || "")
    .replace(/\s+/g, " ")
    .trim();
}

// Heuristic: find the first row that looks like a header (>=3 non-empty distinct cells)
function detectHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i] || [];
    const cells = row.map(normalizeHeaderCell).filter(Boolean);
    const unique = Array.from(new Set(cells));
    if (unique.length >= 3) return i;
  }
  return -1;
}

function getHeaderRows(rows, headerRowIndex) {
  if (headerRowIndex < 0) return [];

  // Some templates have multi-line headers. Merge up to 2 rows starting at detected header.
  const rowA = rows[headerRowIndex] || [];
  const rowB = rows[headerRowIndex + 1] || [];

  const maxLen = Math.max(rowA.length, rowB.length);
  const merged = [];

  for (let c = 0; c < maxLen; c++) {
    const a = normalizeHeaderCell(rowA[c]);
    const b = normalizeHeaderCell(rowB[c]);
    const v = a && b ? `${a} - ${b}` : a || b;
    merged.push(v);
  }

  // If merging makes things worse (too many blanks), fall back to single row
  const mergedNonEmpty = merged.filter(Boolean).length;
  const aNonEmpty = rowA.map(normalizeHeaderCell).filter(Boolean).length;

  if (mergedNonEmpty >= aNonEmpty) return merged;
  return rowA.map(normalizeHeaderCell);
}

function inspectWorkbook(filePath) {
  console.log("\n============================================================");
  console.log("FILE:", filePath);

  const wb = XLSX.readFile(filePath, {
    cellDates: true,
    raw: false,
  });

  console.log("Sheets:", wb.SheetNames.join(", ") || "(none)");

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = to2DArray(ws);
    const headerRowIndex = detectHeaderRowIndex(rows);
    const header = getHeaderRows(rows, headerRowIndex);

    console.log("\n--- SHEET:", sheetName);
    console.log("Detected header row:", headerRowIndex >= 0 ? headerRowIndex + 1 : "(not found)");

    const headerClean = header.map(normalizeHeaderCell).filter(Boolean);
    console.log("Columns (detected):");
    headerClean.forEach((col, idx) => {
      console.log(`  ${idx + 1}. ${col}`);
    });

    // Print a couple sample rows after header for context
    const sampleStart = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const sample = rows.slice(sampleStart, sampleStart + 3);
    if (sample.length) {
      console.log("Sample rows:");
      sample.forEach((r) => {
        const cells = (r || []).map((v) => normalizeHeaderCell(v)).filter(Boolean);
        console.log("  -", cells.slice(0, 12).join(" | "));
      });
    }
  });
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Missing path argument.");
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), input);
  if (!fs.existsSync(resolved)) {
    console.error("Path not found:", resolved);
    process.exit(1);
  }

  const files = listExcelFiles(resolved);
  if (!files.length) {
    console.error("No .xlsx/.xls files found at:", resolved);
    process.exit(1);
  }

  files.forEach(inspectWorkbook);
}

main();
