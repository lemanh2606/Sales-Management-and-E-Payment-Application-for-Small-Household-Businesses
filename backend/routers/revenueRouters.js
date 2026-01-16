// routes/revenueRouters.js
const express = require("express");
const router = express.Router();
const {
	getRevenueByPeriod,
	getRevenueByEmployee,
	exportRevenue,
	getRevenueSummaryByYear,
	exportRevenueSummaryByYear,
	getDailyProductSales,
	exportDailyProductSales,
	getYearlyCategoryCompare,
	exportYearlyCategoryCompare,
	getMonthlyRevenueByDay,
	exportMonthlyRevenueByDay,
	getMonthlyRevenueSummary,
	exportMonthlyRevenueSummary,
	getMonthlyTopProducts,
	exportMonthlyTopProducts,
	getQuarterlyRevenueByCategory,
	exportQuarterlyRevenueByCategory,
	getYearlyTopProducts,
	exportYearlyTopProducts,
	getYearlyProductGroupProductCompare,
	exportYearlyProductGroupProductCompare,
} = require("../controllers/revenueController");
const { verifyToken, requirePermission } = require("../middlewares/authMiddleware");

//GET http://localhost:9999/api/revenues?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10
router.get("/", verifyToken, requirePermission("reports:revenue:view"), getRevenueByPeriod);

//GET http://localhost:9999/api/revenues/employee?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10
router.get("/employee", verifyToken, requirePermission("reports:revenue:employee"), getRevenueByEmployee);

//router export ra file có 4 kiểu: total hoặc employee với dạng csv/pdf
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=pdf&type=employee
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=pdf&type=total
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=csv&type=employee
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=csv&type=total
router.get("/export", verifyToken, requirePermission("reports:revenue:export"), exportRevenue);

// ===== Template-based reports (XLSX) =====
// 1) Tổng hợp theo năm (bảng theo tháng)
// GET /api/revenues/summary?storeId=...&year=2025
router.get(
	"/summary",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getRevenueSummaryByYear
);

// GET /api/revenues/export-summary?storeId=...&year=2025&format=xlsx
router.get(
	"/export-summary",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportRevenueSummaryByYear
);

// 2) Báo cáo bán hàng theo ngày (theo sản phẩm)
// GET /api/revenues/daily-products?storeId=...&date=2025-12-27
router.get(
	"/daily-products",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getDailyProductSales
);

// GET /api/revenues/export-daily-products?storeId=...&date=2025-12-27&format=xlsx
router.get(
	"/export-daily-products",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportDailyProductSales
);

// 3) So sánh doanh số hằng năm theo danh mục
// GET /api/revenues/yearly-category-compare?storeId=...&year=2025
router.get(
	"/yearly-category-compare",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getYearlyCategoryCompare
);

// GET /api/revenues/export-yearly-category-compare?storeId=...&year=2025&format=xlsx
router.get(
	"/export-yearly-category-compare",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportYearlyCategoryCompare
);

// 4) Báo cáo theo tháng (theo ngày trong tháng)
// GET /api/revenues/monthly-by-day?storeId=...&month=2025-12
router.get(
	"/monthly-by-day",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getMonthlyRevenueByDay
);

// GET /api/revenues/export-monthly-by-day?storeId=...&month=2025-12&format=xlsx
router.get(
	"/export-monthly-by-day",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportMonthlyRevenueByDay
);

// 4b) Báo cáo tổng hợp theo tháng (1 dòng)
// GET /api/revenues/monthly-summary?storeId=...&month=2025-12
router.get(
	"/monthly-summary",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getMonthlyRevenueSummary
);

// GET /api/revenues/export-monthly-summary?storeId=...&month=2025-12&format=xlsx
router.get(
	"/export-monthly-summary",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportMonthlyRevenueSummary
);

// 4c) Báo cáo bán chạy theo sản phẩm (theo tháng)
// GET /api/revenues/monthly-top-products?storeId=...&month=2025-12
router.get(
	"/monthly-top-products",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getMonthlyTopProducts
);

// GET /api/revenues/export-monthly-top-products?storeId=...&month=2025-12&format=xlsx
router.get(
	"/export-monthly-top-products",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportMonthlyTopProducts
);

// 5) Báo cáo theo quý (theo danh mục, breakdown 3 tháng)
// GET /api/revenues/quarterly-category?storeId=...&quarter=2025-Q4
router.get(
	"/quarterly-category",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getQuarterlyRevenueByCategory
);

// GET /api/revenues/export-quarterly-category?storeId=...&quarter=2025-Q4&format=xlsx
router.get(
	"/export-quarterly-category",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportQuarterlyRevenueByCategory
);

// 6) Báo cáo theo năm (top sản phẩm)
// GET /api/revenues/yearly-top-products?storeId=...&year=2025&limit=5
router.get(
	"/yearly-top-products",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getYearlyTopProducts
);

// GET /api/revenues/export-yearly-top-products?storeId=...&year=2025&limit=5&format=xlsx
router.get(
	"/export-yearly-top-products",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportYearlyTopProducts
);

// 7) Báo cáo doanh thu hằng năm theo danh mục (productGroup -> sản phẩm)
// GET /api/revenues/yearly-productgroup-products?storeId=...&year=2025
router.get(
	"/yearly-productgroup-products",
	verifyToken,
	requirePermission("reports:revenue:view"),
	getYearlyProductGroupProductCompare
);

// GET /api/revenues/export-yearly-productgroup-products?storeId=...&year=2025&format=xlsx
router.get(
	"/export-yearly-productgroup-products",
	verifyToken,
	requirePermission("reports:revenue:export"),
	exportYearlyProductGroupProductCompare
);

module.exports = router;
