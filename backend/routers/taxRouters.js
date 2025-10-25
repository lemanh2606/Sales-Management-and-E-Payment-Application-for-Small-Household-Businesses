// routes/taxRouters.js
const express = require("express");
const router = express.Router();

const {
  previewSystemRevenue,
  createTaxDeclaration,
  updateTaxDeclaration,
  cloneTaxDeclaration,
  deleteTaxDeclaration,
  listDeclarations,
  exportDeclaration,
} = require("../controllers/tax/taxController");

const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
  isManager,
} = require("../middlewares/authMiddleware");

/*
  ROUTES QUẢN LÝ TỜ KHAI / THUẾ
  - Mục tiêu:
      + Hỗ trợ preview doanh thu (chưa lưu), tạo/sửa/clone/delete tờ khai, list theo kỳ, export.
      + Tất cả thao tác gắn với cửa hàng => cần checkStoreAccess để xác định context store (req.store, req.storeRole).
      + Sử dụng requirePermission(...) để kiểm tra quyền chi tiết dựa trên user.menu.
  - Quy ước permission gợi ý (lưu trong user.menu):
      * tax:preview               -> xem preview doanh thu (chưa lưu)
      * tax:create                -> tạo tờ khai thuế
      * tax:update                -> cập nhật tờ khai
      * tax:clone                 -> clone / sao chép tờ khai
      * tax:delete                -> xóa tờ khai (nhạy cảm, thường manager/owner)
      * tax:list                  -> liệt kê tờ khai theo cửa hàng/kỳ
      * tax:export                -> xuất tờ khai (csv/pdf)
  - Lưu ý:
      * Manager có thể được override theo requirePermission (mặc định MANAGER được phép nếu bạn muốn).
      * Nếu muốn chỉ OWNER mới làm một số việc (ví dụ xóa), bạn có thể giữ isManager hoặc kiểm tra req.storeRole === "OWNER" trong controller/middleware.
*/

/*
  1) PREVIEW: GET /api/tax/preview
     - Mục đích: Xem tổng doanh thu hệ thống theo kỳ (chưa tạo bản lưu DB)
     - Middleware: verifyToken, checkStoreAccess, requirePermission("tax:preview")
     - Lưu ý: preview dựa trên dữ liệu realtime của store được xác định bởi checkStoreAccess
*/
router.get(
  "/preview",
  verifyToken,
  checkStoreAccess,
  requirePermission("tax:preview"),
  previewSystemRevenue
);

/*
  2) CREATE: POST /api/tax
     - Mục đích: Tạo tờ khai thuế mới (bản gốc) cho cửa hàng hiện hành
     - Middleware: verifyToken, checkStoreAccess, requirePermission("tax:create")
*/
router.post(
  "/",
  verifyToken,
  checkStoreAccess,
  requirePermission("tax:create"),
  createTaxDeclaration
);

/*
  3) UPDATE: PUT /api/tax/:id
     - Mục đích: Cập nhật tờ khai (thông tin, số liệu, note...)
     - Middleware: verifyToken, checkStoreAccess, requirePermission("tax:update")
     - Ghi chú: Bạn có thể bổ sung kiểm tra thêm (ví dụ chỉ được update khi trạng thái tờ khai còn 'draft')
*/
router.put(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("tax:update"),
  updateTaxDeclaration
);

/*
  4) CLONE: POST /api/tax/:id/clone
     - Mục đích: Tạo bản sao từ tờ khai cũ (ví dụ copy để chỉnh sửa cho kỳ tiếp theo)
     - Middleware: verifyToken, checkStoreAccess, requirePermission("tax:clone")
*/
router.post(
  "/:id/clone",
  verifyToken,
  checkStoreAccess,
  requirePermission("tax:clone"),
  cloneTaxDeclaration
);

/*
  5) DELETE: DELETE /api/tax/:id
     - Mục đích: Xóa tờ khai
     - Middleware: verifyToken, checkStoreAccess, isManager, requirePermission("tax:delete")
     - Ghi chú:
         + Đây là hành động nhạy cảm, do đó yêu cầu isManager (hoặc bạn có thể kiểm tra req.storeRole === "OWNER")
         + requirePermission dùng để granular nếu bạn muốn quản lý quyền xóa qua menu
*/
router.delete(
  "/:id",
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission("tax:delete"),
  deleteTaxDeclaration
);

/*
  6) LIST: GET /api/tax
     - Mục đích: Lấy danh sách tờ khai theo cửa hàng / kỳ
     - Query params gợi ý: ?shopId=...&periodType=month|quarter|year&periodKey=2025-10
     - Middleware: verifyToken, checkStoreAccess, requirePermission("tax:list")
*/
router.get(
  "/",
  verifyToken,
  checkStoreAccess,
  requirePermission("tax:list"),
  listDeclarations
);

/*
  7) EXPORT: GET /api/tax/:id/export
     - Mục đích: Xuất tờ khai ra CSV / PDF
     - Query params: ?format=csv OR ?format=pdf
     - Middleware: verifyToken, checkStoreAccess, requirePermission("tax:export")
     - Gợi ý: export là action nhạy cảm (dữ liệu rời khỏi hệ thống), cân nhắc ghi audit log khi export
*/
router.get(
  "/:id/export",
  verifyToken,
  checkStoreAccess,
  requirePermission("tax:export"),
  exportDeclaration
);

module.exports = router;
