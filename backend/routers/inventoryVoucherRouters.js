const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const { checkSubscriptionExpiry } = require("../middlewares/subscriptionMiddleware");
const inventoryVoucherController = require("../controllers/inventoryVoucherController");
const { verifyToken, checkStoreAccess, requirePermission } = auth;

/*
  ROUTES NHẬP / XUẤT KHO (Inventory Vouchers)
  --------------------------------------------------
  Rule nghiệp vụ theo role:
    - STAFF: chỉ tạo/sửa/xóa phiếu DRAFT, xem danh sách/chi tiết, cancel (tùy chính sách)
    - MANAGER: được approve/post/reverse (và làm được tất cả nếu có permission)
*/

// ===================== ROLE MIDDLEWARE =====================
const getUserRole = (req) => String(req.user?.role || "").toUpperCase();

const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    const role = getUserRole(req);
    const allow = allowedRoles.map((r) => String(r).toUpperCase());

    if (!role || !allow.includes(role)) {
      return res.status(403).json({
        message: "Không đủ quyền (role) để thực hiện thao tác này",
        role: role || null,
        allowedRoles: allow,
      });
    }
    next();
  };

// ===================== CRUD =====================

// Create voucher (DRAFT) - STAFF được tạo (nhưng phải chờ MANAGER duyệt)
router.post(
  "/:storeId/inventory-vouchers",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:create"),
  inventoryVoucherController.createInventoryVoucher
);

// List vouchers
router.get(
  "/:storeId/inventory-vouchers",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:view"),
  inventoryVoucherController.getInventoryVouchers
);

// Get voucher by id
router.get(
  "/:storeId/inventory-vouchers/:voucherId",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:view"),
  inventoryVoucherController.getInventoryVoucherById
);

// Update voucher (only DRAFT)
router.put(
  "/:storeId/inventory-vouchers/:voucherId",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:update"),
  inventoryVoucherController.updateInventoryVoucher
);

// Delete voucher (only DRAFT) - hard delete
router.delete(
  "/:storeId/inventory-vouchers/:voucherId",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:delete"),
  inventoryVoucherController.deleteInventoryVoucher
);

// ===================== ACTIONS =====================

// Approve (DRAFT -> APPROVED) - chỉ MANAGER
router.post(
  "/:storeId/inventory-vouchers/:voucherId/approve",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:approve"),
  requireRole("MANAGER"),
  inventoryVoucherController.approveInventoryVoucher
);

// Post / Ghi sổ (-> POSTED) - chỉ MANAGER
router.post(
  "/:storeId/inventory-vouchers/:voucherId/post",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:post"),
  requireRole("MANAGER"),
  inventoryVoucherController.postInventoryVoucher
);

// Cancel (DRAFT/APPROVED -> CANCELLED)
// Nếu muốn STAFF chỉ được cancel phiếu do mình tạo, bạn thêm check created_by trong controller.
router.post(
  "/:storeId/inventory-vouchers/:voucherId/cancel",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:cancel"),
  inventoryVoucherController.cancelInventoryVoucher
);

// Reverse (POSTED -> tạo phiếu đảo POSTED) - chỉ MANAGER
router.post(
  "/:storeId/inventory-vouchers/:voucherId/reverse",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:reverse"),
  requireRole("MANAGER"),
  inventoryVoucherController.reverseInventoryVoucher
);

// Xử lý hàng hết hạn chuyên dùng (Hủy/Trả hàng) - chỉ MANAGER
router.post(
  "/:storeId/inventory-vouchers/process-expired",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("inventory:voucher:post"),
  requireRole("MANAGER"),
  inventoryVoucherController.processExpiredGoods
);

module.exports = router;
