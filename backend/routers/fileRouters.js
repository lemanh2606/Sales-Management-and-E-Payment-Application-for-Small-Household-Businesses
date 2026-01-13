// routes/fileRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  uploadFile,
  getFilesByStore,
  getFileById,
  deleteFile,
} = require("../controllers/fileController");
const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

const router = express.Router();
// đảm bảo thư mục uploads tồn tại chỉ để đọc tạm
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 Đã tạo thư mục uploads/");
}
// ⚙️ cấu hình Multer storage để giữ nguyên tên file (slug) khi lưu local
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    cb(null, file.originalname); // ✅ giữ nguyên tên FE gửi (đã slug)
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post(
  "/upload",
  verifyToken,
  checkStoreAccess,
  requirePermission("files:upload"),
  (req, res, next) => {
    upload.single("file")(req, res, function (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "File quá lớn! Giới hạn tối đa là 20MB." });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadFile
);

router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("files:view"),
  getFilesByStore
);
router.get(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("files:view"),
  getFileById
);
router.delete(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("files:delete"),
  deleteFile
);

module.exports = router;
