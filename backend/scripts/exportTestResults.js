// // scripts/exportTestResults.js
// // Version 3.0 - Simple + Enhanced export, stable paths, CLI options

// const fs = require("fs");
// const path = require("path");
// const { execSync } = require("child_process");

// function ensureDir(p) {
//   if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
// }

// function runTestsAndExport() {
//   console.log("🧪 Running tests...\n");
//   try {
//     execSync("npm test -- --json --outputFile=test-results/jest-output.json", {
//       encoding: "utf-8",
//       stdio: "inherit",
//     });
//     console.log("\n Tests completed!");
//   } catch (error) {
//     console.log("\n⚠️ Some tests failed, continuing export...");
//   }
//   const outDir = path.join(process.cwd(), "test-results");
//   ensureDir(outDir);
//   const jestOutputPath = path.join(outDir, "jest-output.json");
//   if (!fs.existsSync(jestOutputPath)) {
//     console.error(" Jest output file not found at:", jestOutputPath);
//     return;
//   }
//   processJestOutput(jestOutputPath, outDir);
// }

// function processJestOutput(jestOutputPath, outDir) {
//   const data = JSON.parse(fs.readFileSync(jestOutputPath, "utf-8"));

//   // Grouped simple: { func: [{ testName, status, duration }] }
//   const simple = {};
//   // Enhanced: { func: [{...rich...}] }
//   const enhanced = {};

//   (data.testResults || []).forEach((file) => {
//     (file.assertionResults || []).forEach((test) => {
//       const titles = test.ancestorTitles || [];
//       const funcName = titles[titles.length - 1] || "Unknown";
//       const status = test.status === "passed" ? "Pass" : "Fail";
//       const duration = test.duration || 0;

//       if (!simple[funcName]) simple[funcName] = [];
//       if (!enhanced[funcName]) enhanced[funcName] = [];

//       const base = {
//         testName: test.title,
//         status,
//         duration,
//       };
//       simple[funcName].push(base);

//       enhanced[funcName].push({
//         ...base,
//         fullName: test.fullName || "",
//         condition: inferCondition(test.title),
//         precondition: inferPrecondition(test.title),
//         testData: inferTestData(test.title),
//         expected: inferExpected(test.title),
//         result: status,
//         failureDetails: (test.failureMessages || []).join("\n"),
//       });
//     });
//   });

//   const simplePath = path.join(outDir, "google-sheets-export.json");
//   const enhancedPath = path.join(outDir, "google-sheets-export-enhanced.json");
//   fs.writeFileSync(simplePath, JSON.stringify(simple, null, 2));
//   fs.writeFileSync(enhancedPath, JSON.stringify(enhanced, null, 2));

//   // Stats
//   let total = 0,
//     passed = 0,
//     failed = 0;
//   Object.values(simple).forEach((list) => {
//     list.forEach((t) => {
//       total++;
//       if (t.status === "Pass") passed++;
//       else failed++;
//     });
//   });

//   console.log("\n============================================================");
//   console.log("📊 TEST RESULTS EXPORTED");
//   console.log("============================================================");
//   console.log("📁 Simple:", simplePath);
//   console.log("📁 Enhanced:", enhancedPath);
//   console.log(" Functions:", Object.keys(simple).length);
//   console.log(" Total tests:", total);
//   console.log(
//     ` Passed: ${passed} (${Math.round((passed / Math.max(1, total)) * 100)}%)`
//   );
//   console.log(
//     ` Failed: ${failed} (${Math.round((failed / Math.max(1, total)) * 100)}%)`
//   );
//   console.log("============================================================\n");
// }

// function inferCondition(title) {
//   const s = title.toLowerCase();
//   if (s.includes("valid")) return "Valid input";
//   if (s.includes("missing")) return "Missing fields";
//   if (s.includes("invalid")) return "Invalid format";
//   if (s.includes("unauthorized")) return "Unauthorized";
//   if (s.includes("not found")) return "Resource not found";
//   if (s.includes("locked")) return "Locked/Blocked";
//   if (s.includes("error")) return "Server error";
//   return "Standard";
// }

// function inferPrecondition(title) {
//   const s = title.toLowerCase();
//   if (s.includes("valid")) return "All required fields provided";
//   if (s.includes("missing")) return "Some required fields missing";
//   if (s.includes("invalid")) return "Fields provided but invalid";
//   if (s.includes("unauthorized")) return "No authentication context";
//   if (s.includes("not found")) return "Target resource does not exist";
//   if (s.includes("locked")) return "Account is locked";
//   return "N/A";
// }

// function inferTestData(title) {
//   const s = title.toLowerCase();
//   const td = {};
//   if (s.includes("username")) td.username = "(see test)";
//   if (s.includes("password")) td.password = "(see test)";
//   if (s.includes("email")) td.email = "(see test)";
//   if (s.includes("otp")) td.otp = "(see test)";
//   return td;
// }

// function inferExpected(title) {
//   const s = title.toLowerCase();
//   if (s.includes("success") || s.includes("successfully"))
//     return "200/201 Success";
//   if (s.includes("400")) return "400 Bad Request";
//   if (s.includes("401")) return "401 Unauthorized";
//   if (s.includes("403")) return "403 Forbidden";
//   if (s.includes("404")) return "404 Not Found";
//   if (s.includes("423")) return "423 Locked";
//   if (s.includes("500") || s.includes("error")) return "500 Server Error";
//   return "OK";
// }

// function quickExport() {
//   const outDir = path.join(process.cwd(), "test-results");
//   const jestOutputPath = path.join(outDir, "jest-output.json");
//   if (!fs.existsSync(jestOutputPath)) {
//     console.error(" No jest-output.json found. Run test:export first.");
//     return;
//   }
//   processJestOutput(jestOutputPath, outDir);
// }

// if (require.main === module) {
//   const args = process.argv.slice(2);
//   if (args.includes("--quick") || args.includes("-q")) {
//     quickExport();
//   } else {
//     runTestsAndExport();
//   }
// }

// module.exports = { runTestsAndExport, quickExport };
