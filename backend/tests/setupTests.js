// tests/setupTests.js

/**
 * File thiết lập môi trường test cho Jest
 * Load các biến môi trường từ file .env chính của project
 */

const path = require("path");

// Thiết lập đường dẫn đến file .env chính
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

// Ghi đè NODE_ENV thành test cho môi trường test
process.env.NODE_ENV = "test";

// Fallback cho các biến môi trường nếu không có trong .env
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test_jwt_secret_change_in_production";
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "test_refresh_secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "2d";
process.env.REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || "7d";
process.env.REFRESH_TOKEN_EXPIRES_DAYS =
  process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7";
process.env.OTP_EXPIRE_MINUTES = process.env.OTP_EXPIRE_MINUTES || "5";
process.env.OTP_MAX_ATTEMPTS = process.env.OTP_MAX_ATTEMPTS || "5";
process.env.LOGIN_MAX_ATTEMPTS = process.env.LOGIN_MAX_ATTEMPTS || "5";
process.env.LOGIN_LOCK_MINUTES = process.env.LOGIN_LOCK_MINUTES || "15";
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || "10";
process.env.IMGBB_API_KEY = process.env.IMGBB_API_KEY || "test_imgbb_api_key";
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/sales_management_test";

// Global test timeout
jest.setTimeout(30000);

// Global beforeAll hook cho tất cả test suites
beforeAll(() => {
  console.log("🛠️  Setting up test environment...");
  console.log(`📁 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(
    `🔐 JWT_SECRET: ${process.env.JWT_SECRET ? "✓ Set" : "✗ Missing"}`
  );
  console.log(`🗄️  MONGODB_URI: ${process.env.MONGODB_URI}`);
});

// Global afterAll hook
afterAll(() => {
  console.log("🧹 Cleaning up test environment...");
});

// Global beforeEach hook
beforeEach(() => {
  // Reset tất cả mock functions trước mỗi test
  jest.clearAllMocks();
});

// Suppress console logs during tests để output test sạch hơn
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
