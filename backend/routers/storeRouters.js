// backend/routers/storeRouters.js
const express = require("express");
const router = express.Router();
const storeController = require("../controllers/storeController");
const auth = require("../middlewares/authMiddleware"); 

const { verifyToken, isManager, checkStoreAccess } = auth;

// ------------------------- Store routes -------------------------
router.post("/ensure-store", verifyToken, storeController.ensureStore); 
router.post("/", verifyToken, isManager, storeController.createStore); 
router.get("/", verifyToken, isManager, storeController.getStoresByManager); 
router.get("/:storeId", verifyToken, checkStoreAccess, storeController.getStoreById); // Chi tiết store
router.put("/:storeId", verifyToken, checkStoreAccess, isManager, storeController.updateStore); // Update store
router.delete("/:storeId", verifyToken, checkStoreAccess, isManager, storeController.deleteStore); // Xóa store (soft delete nếu cần)

// ------------------------- Select / Dashboard -------------------------
router.post("/select/:storeId", verifyToken, storeController.selectStore); 
router.get("/:storeId/dashboard", verifyToken, checkStoreAccess, storeController.getStoreDashboard); 

// ------------------------- Staff assignment -------------------------
router.post("/:storeId/assign-staff", verifyToken, checkStoreAccess, storeController.assignStaffToStore); 

// ------------------------- Employee routes -------------------------
router.post("/:storeId/employees", verifyToken, checkStoreAccess, isManager, storeController.createEmployee); 
router.get("/:storeId/employees", verifyToken, checkStoreAccess, isManager, storeController.getEmployeesByStore); 
router.get("/:storeId/employees/:id", verifyToken, checkStoreAccess, isManager, storeController.getEmployeeById); 
router.put("/:storeId/employees/:id", verifyToken, checkStoreAccess, isManager, storeController.updateEmployee); 
// router.delete("/:storeId/employees/:id", verifyToken, checkStoreAccess, isManager, storeController.deleteEmployee); // Xóa nhân viên

module.exports = router;
