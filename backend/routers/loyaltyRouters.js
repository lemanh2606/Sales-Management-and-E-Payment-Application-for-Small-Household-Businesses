// routes/loyaltyRouters.js
const express = require("express");
const router = express.Router();

const {
  setupLoyaltyConfig,
  getLoyaltyConfig,
} = require("../controllers/loyaltyController");

const {
  verifyToken,

  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

/*
  Mục tiêu phân quyền cho loyalty:
  - Thiết lập cấu hình (POST /config/:storeId)
    + Được phép nếu user là OWNER của cửa hàng (req.storeRole === "OWNER")
    + Hoặc được phép nếu user có permission "loyalty:manage" (global) hoặc "store:<storeId>:loyalty:manage" (scoped)
    + Manager global (role MANAGER) được allow bởi requirePermission trừ khi bạn set allowManager: false.
  - Lấy cấu hình (GET /config/:storeId)
    + Được phép nếu user có permission "loyalty:view" hoặc tương đương (scoped)
    + Hoặc nếu user là OWNER / STAFF có quyền truy cập store (checkStoreAccess đảm bảo họ thuộc store)
*/

/*
  Middleware helper: allowOwnerOrPermission(permission)
  - Nếu req.storeRole === "OWNER" => next()
  - Ngược lại => gọi middleware requirePermission(permission)
  Lưu ý: requirePermission mặc định cho phép MANAGER override (nếu bạn muốn tắt thì gọi requirePermission(permission, { allowManager: false }))
*/
function allowOwnerOrPermission(permission, options = {}) {
  // options sẽ được truyền xuống requirePermission nếu cần
  return (req, res, next) => {
    try {
      // Nếu checkStoreAccess đã gán req.storeRole và user là OWNER của store hiện hành -> cho phép
      if (req.storeRole && String(req.storeRole).toUpperCase() === "OWNER") {
        return next();
      }

      // Nếu không phải OWNER thì dùng requirePermission để kiểm tra user.menu
      // requirePermission trả về middleware, ta gọi nó ngay tại chỗ
      const permMiddleware = requirePermission(permission, options);
      return permMiddleware(req, res, next);
    } catch (err) {
      console.error("allowOwnerOrPermission error:", err);
      return res.status(500).json({ message: "Lỗi server khi kiểm tra quyền" });
    }
  };
}

/*
  Route: POST /api/loyalty/config/:storeId
  - Mục đích: Manager/Owner thiết lập cấu hình loyalty cho cửa hàng
  - Middleware:
    1) verifyToken - bắt buộc đăng nhập
    2) checkStoreAccess - xác định store context, gán req.store và req.storeRole
    3) allowOwnerOrPermission("loyalty:manage") - cho phép OWNER của store hoặc user có permission quản lý loyalty
    4) controller: setupLoyaltyConfig
*/
router.post(
  "/config/:storeId",
  verifyToken,
  checkStoreAccess,
  allowOwnerOrPermission("loyalty:manage"),
  setupLoyaltyConfig
);

/*
  Route: GET /api/loyalty/config/:storeId
  - Mục đích: Lấy cấu hình loyalty của cửa hàng
  - Middleware:
    1) verifyToken
    2) checkStoreAccess - xác định store context
    3) requirePermission("loyalty:view") - kiểm tra user.menu (ALLOW Manager override theo mặc định)
    4) controller: getLoyaltyConfig
  - Ghi chú: nếu bạn muốn mọi user có access khi đã được gán store (ví dụ STAFF chỉ cần được gán store để xem),
    bạn có thể thay requirePermission bằng middleware custom tương tự allowOwnerOrPermission nhưng chấp nhận storeRole === "STAFF" hoặc "OWNER".
*/
router.get(
  "/config/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("loyalty:view"),
  getLoyaltyConfig
);

module.exports = router;
