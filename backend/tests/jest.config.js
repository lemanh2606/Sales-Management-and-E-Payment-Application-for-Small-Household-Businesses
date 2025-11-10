module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/unit"],
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: [
    "../../controllers/**/*.js",
    "../../models/**/*.js",
    "../../utils/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/setupTests.js"],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
