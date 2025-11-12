// middlewares/uploadMedia.js
const multer = require("multer");

// 🧠 Dùng memoryStorage để upload thẳng Cloudinary bằng file.buffer
const storage = multer.memoryStorage();

const uploadMedia = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB cho cả video
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh hoặc video!"), false);
    }
  },
});

module.exports = uploadMedia;
