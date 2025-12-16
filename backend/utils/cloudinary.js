// utils/cloudinary.js
const { v2: cloudinary } = require("cloudinary");
const multer = require("multer");
const mime = require("mime-types");
const path = require("path");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, //  luôn là https
});

const slugify = (str) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");

//  Cấu hình Multer Storage cho Cloudinary (dùng cho upload ảnh sản phẩm)
const productImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "products", // Thư mục lưu ảnh sản phẩm
    format: async (req, file) => "png", // Convert to PNG
    public_id: (req, file) => `product_${Date.now()}`, // Tạo tên file unique
  },
});

// 🧩 Multer middleware cho upload ảnh sản phẩm
const uploadProductImage = multer({
  storage: productImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh!"), false);
    }
  },
});

const uploadToCloudinary = async (filePath, folder = "uploads", resource_type = "auto") => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const baseName = fileName.replace(path.extname(fileName), "");
    const ext = path.extname(fileName).slice(1).toLowerCase();

    if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) {
      resource_type = "image";
    } else if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
      resource_type = "video";
    } else {
      resource_type = "raw";
    }

    console.log("🚀 Upload Cloudinary với resource_type:", resource_type);
    console.log("📂 Folder đích:", folder);

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type, public_id: baseName }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      fs.createReadStream(filePath).pipe(stream);
    });

    // ✅ Xoá file local sau khi upload xong
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn("⚠️ Không thể xoá file local:", err.message);
    }

    console.log("☁️ Uploaded:", {
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      resource_type: uploadResult.resource_type,
      url: uploadResult.secure_url,
    });

    return uploadResult;
  } catch (err) {
    console.error("❌ Upload Cloudinary fail:", err);
    throw new Error("Lỗi upload Cloudinary");
  }
};

// 🧩 Hàm xóa file (dùng đúng resource_type của Cloudinary)
const deleteFromCloudinary = async (public_id, resource_type = "raw") => {
  try {
    if (!public_id) throw new Error("Missing required parameter - public_id");

    console.log("🧹 Bắt đầu xoá file Cloudinary...");
    console.log("➡️ public_id:", public_id);
    console.log("➡️ resource_type:", resource_type);

    const result = await cloudinary.uploader.destroy(public_id, { resource_type });

    console.log("🧩 Kết quả xoá Cloudinary:", result);
    return result;
  } catch (err) {
    console.error("❌ Xóa Cloudinary thất bại:", err);
    throw err;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadProductImage,
};
