// backend/routers/storeRouters.js
const express = require("express");
const router = express.Router();
const storeController = require("../controllers/storeController");
const auth = require("../middlewares/authMiddleware"); // import toàn bộ để tránh nhầm tên

// Kiểm tra các hàm có tồn tại (debug - có thể bỏ sau khi chạy OK)
if (process.env.NODE_ENV !== "production") {
  // nếu 1 trong các handler bị undefined thì log ra để dễ debug
  //console.log("auth middleware keys:", Object.keys(auth)); //đã log đầy đủ các hàm
}

// Ánh xạ rõ ràng các middleware/handler
const { verifyToken, isManager, checkStoreAccess } = auth;

router.post("/ensure-store", verifyToken, storeController.ensureStore); // Route: đảm bảo user có store (create default nếu chưa có)

router.post("/", verifyToken, isManager, storeController.createStore); // Tạo store (chỉ Manager)

router.get("/", verifyToken, isManager, storeController.getStoresByManager); // Lấy stores của Manager

router.post("/select/:storeId", verifyToken, storeController.selectStore); // Chọn store hiện tại (Manager hoặc staff được gán)

router.get("/:storeId/dashboard", verifyToken, checkStoreAccess, storeController.getStoreDashboard); // Dashboard data (phải có quyền trên store)

router.post("/:storeId/assign-staff", verifyToken, checkStoreAccess, storeController.assignStaffToStore); // Gán staff cho store (owner thực hiện) — controller kiểm tra owner bên trong

// Routes employee bind store (URL: /api/stores/:storeId/employees)
router.post("/:storeId/employees", verifyToken, checkStoreAccess, isManager, storeController.createEmployee); // Tạo nhân viên cho store

router.get("/:storeId/employees", verifyToken, checkStoreAccess, isManager, storeController.getEmployeesByStore); // List nhân viên theo store

router.get("/:storeId/employees/:id", verifyToken, checkStoreAccess, isManager, storeController.getEmployeeById); // Chi tiết nhân viên (thêm /:id)

router.put("/:storeId/employees/:id", verifyToken, checkStoreAccess, isManager, storeController.updateEmployee); // Update nhân viên

module.exports = router;
