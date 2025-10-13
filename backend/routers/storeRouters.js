// backend/routers/storeRouters.js
const express = require("express");
const router = express.Router();

const storeController = require("../controllers/storeController");
const auth = require("../middlewares/authMiddleware"); // import toàn bộ để tránh nhầm tên

// Kiểm tra các hàm có tồn tại (debug - có thể bỏ sau khi chạy OK)
if (process.env.NODE_ENV !== "production") {
  // nếu 1 trong các handler bị undefined thì log ra để dễ debug
  console.log("auth middleware keys:", Object.keys(auth));
}

// Ánh xạ rõ ràng các middleware/handler
const { verifyToken, isManager, checkStoreAccess } = auth;

// Route: đảm bảo user có store (create default nếu chưa có)
router.post("/ensure-store", verifyToken, storeController.ensureStore);

// Tạo store (chỉ Manager)
router.post("/", verifyToken, isManager, storeController.createStore);

// Lấy stores của Manager
router.get("/", verifyToken, isManager, storeController.getStoresByManager);

// Chọn store hiện tại (Manager hoặc staff được gán)
router.post("/select/:storeId", verifyToken, storeController.selectStore);

// Dashboard data (phải có quyền trên store)
router.get("/:storeId/dashboard", verifyToken, checkStoreAccess, storeController.getStoreDashboard);

// Gán staff cho store (owner thực hiện) — controller kiểm tra owner bên trong
router.post("/:storeId/assign-staff", verifyToken, checkStoreAccess, storeController.assignStaffToStore);

module.exports = router;
