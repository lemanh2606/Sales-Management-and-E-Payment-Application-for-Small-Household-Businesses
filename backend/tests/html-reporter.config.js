module.exports = {
  publicPath: "./test-results/html-report",
  filename: "test-report.html",

  // 📊 Hiển thị
  expand: true, // Mở rộng tất cả test suites
  pageTitle: "🏪 Sales Management - Test Results",
  logoImgPath: undefined, // Có thể thêm logo công ty

  // 🔍 Nội dung chi tiết
  hideIcon: false, // Hiển thị icon status
  includeFailureMsg: true, // Hiển thị thông báo lỗi
  includeSuiteFailure: true, // Hiển thị suite bị lỗi
  includeConsoleLog: true, // Bao gồm console.log trong test
  includeObsoleteSnapshots: true, // Snapshots cũ

  // ⚙️ Tuỳ chỉnh hành vi
  openReport: false, // Tự động mở report sau khi test
  testCommand: "npm test", // Hiển thị command đã chạy

  // 📈 Metrics
  duration: true, // Hiển thị thời gian chạy test
  sort: "status", // Sắp xếp: status, duration, alphabet
  executionTimeWarningThreshold: 5, // Cảnh báo test chậm (giây)

  // ℹ️ Thông tin custom
  customInfos: [
    { title: "Environment", value: process.env.NODE_ENV },
    { title: "Test Date", value: new Date().toLocaleString() },
    { title: "Node Version", value: process.version },
    { title: "Jest Version", value: require("jest/package.json").version },
    { title: "Project", value: "Sales Management System" },
  ],

  // 🎨 Tuỳ chỉnh giao diện
  styleOverridePath: undefined, // CSS custom
  useCssFile: false, // Tách CSS riêng
};
