module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/unit", "<rootDir>/integration"],
  testMatch: ["**/*.test.js"],

  // Coverage configuration
  collectCoverageFrom: [
    "../../controllers/**/*.js",
    "../../models/**/*.js",
    "../../utils/**/*.js",
    "../../services/**/*.js",
    "../../middlewares/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
    "!**/coverage/**",
  ],
  coverageDirectory: "./coverage",
  coverageReporters: ["text", "text-summary", "lcov", "html", "json"],

  // Jest HTML Reporters configuration
  reporters: [
    "default",
    [
      "jest-html-reporters",
      {
        publicPath: "./test-results/html-report",
        filename: "test-report.html",
        expand: true,
        pageTitle: "Sales Management Test Report",
        hideIcon: false,
        includeFailureMsg: true,
        includeSuiteFailure: true,
        includeConsoleLog: true,
        includeObsoleteSnapshots: true,
        openReport: false,
        testCommand: "npm test",
        duration: true,
        sort: "status",
        executionTimeWarningThreshold: 5,
        customInfos: [
          { title: "Environment", value: process.env.NODE_ENV },
          { title: "Test Date", value: new Date().toLocaleString() },
          { title: "Node Version", value: process.version },
        ],
      },
    ],
  ],

  setupFilesAfterEnv: ["<rootDir>/setupTests.js"],
  verbose: true,
  forceExit: true,
  clearMocks: true,
};
