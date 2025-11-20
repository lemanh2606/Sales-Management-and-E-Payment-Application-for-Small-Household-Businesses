const multer = require("multer");

const storage = multer.memoryStorage();

const uploadInvoice = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB để tránh file PDF quá lớn
  },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      (file.originalname && file.originalname.toLowerCase().endsWith(".pdf"));
    if (!isPdf) {
      cb(new Error("Chỉ chấp nhận file PDF"));
    } else {
      cb(null, true);
    }
  },
});

module.exports = uploadInvoice;
