// scripts/selectTests.js
// Interactive CLI to select which tests to run

const { execSync } = require("child_process");
const readline = require("readline");

const availableTests = [
  {
    name: "registerManager",
    file: "tests/unit/userController/registerManager.test.js",
  },
  { name: "verifyOtp", file: "tests/unit/userController/verifyOtp.test.js" },
  { name: "login", file: "tests/unit/userController/login.test.js" },
  {
    name: "sendForgotPasswordOTP",
    file: "tests/unit/userController/sendForgotPasswordOTP.test.js",
  },
  {
    name: "forgotChangePassword",
    file: "tests/unit/userController/forgotChangePassword.test.js",
  },
  { name: "updateUser", file: "tests/unit/userController/updateUser.test.js" },
  {
    name: "changePassword",
    file: "tests/unit/userController/changePassword.test.js",
  },
  {
    name: "softDeleteUser",
    file: "tests/unit/userController/softDeleteUser.test.js",
  },
  {
    name: "restoreUser",
    file: "tests/unit/userController/restoreUser.test.js",
  },
  {
    name: "updateProfile",
    file: "tests/unit/userController/updateProfile.test.js",
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function showMenu() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 SELECT TESTS TO RUN");
  console.log("=".repeat(60));
  console.log("\nAvailable tests:");
  console.log("");

  availableTests.forEach((test, index) => {
    console.log(`  ${index + 1}. ${test.name}`);
  });

  console.log("");
  console.log("Options:");
  console.log("  - Enter numbers (e.g., 1,3,5) to run specific tests");
  console.log("  - Enter 'all' to run all tests");
  console.log("  - Enter 'q' to quit");
  console.log("");
}

function runTests(selectedIndices) {
  console.log("\n🚀 Running selected tests...\n");

  const selectedFiles = selectedIndices.map((i) => availableTests[i].file);
  const testPattern = selectedFiles.join("|");

  try {
    execSync(
      `npm test -- --testPathPattern="${testPattern}" --json --outputFile=test-results/jest-output.json`,
      {
        encoding: "utf-8",
        stdio: "inherit",
      }
    );

    console.log("\n✅ Tests completed!");
    console.log("\n📊 Do you want to export to Google Sheets? (y/n)");

    rl.question("", (answer) => {
      if (answer.toLowerCase() === "y") {
        console.log("\n📤 Exporting to Google Sheets...\n");
        execSync("npm run test:sheets", {
          encoding: "utf-8",
          stdio: "inherit",
        });
        console.log("\n✅ Export completed!");
      }
      rl.close();
    });
  } catch (error) {
    console.log("\n⚠️ Some tests failed. Check output above.");
    rl.close();
  }
}

function parseSelection(input) {
  if (input.toLowerCase() === "all") {
    return availableTests.map((_, i) => i);
  }

  if (input.toLowerCase() === "q") {
    return null;
  }

  const indices = input
    .split(",")
    .map((s) => parseInt(s.trim()) - 1)
    .filter((i) => i >= 0 && i < availableTests.length);

  return indices.length > 0 ? indices : null;
}

function main() {
  showMenu();

  rl.question("Enter your selection: ", (input) => {
    const selectedIndices = parseSelection(input);

    if (selectedIndices === null) {
      console.log("👋 Goodbye!");
      rl.close();
      return;
    }

    if (selectedIndices.length === 0) {
      console.log("❌ Invalid selection. Please try again.");
      rl.close();
      return;
    }

    console.log("\n📋 Selected tests:");
    selectedIndices.forEach((i) => {
      console.log(`  ✓ ${availableTests[i].name}`);
    });

    runTests(selectedIndices);
  });
}

main();
