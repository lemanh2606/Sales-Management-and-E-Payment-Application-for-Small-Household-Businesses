// utils/cloudinary.js
const { v2: cloudinary } = require("cloudinary");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, //  luôn là https
});

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
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh!"), false);
    }
  },
});

// 🧩 Hàm upload file
const uploadToCloudinary = async (filePath, folder = "refunds") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto", // 👈 tự nhận ảnh hoặc video đủ mọi loại đuôi
    });
    return {
      url: result.secure_url,
      public_id: result.public_id,
      type: result.resource_type, // image / video
    };
  } catch (err) {
    console.error("❌ Upload Cloudinary fail:", err);
    throw new Error("Lỗi upload Cloudinary");
  }
};

// 🧩 Hàm xóa file (nếu admin xóa đơn hoàn hàng chẳng hạn)
const deleteFromCloudinary = async (public_id) => {
  try {
    await cloudinary.uploader.destroy(public_id, { resource_type: "auto" });
    console.log(`🧹 Đã xóa file Cloudinary: ${public_id}`);
  } catch (err) {
    console.error("❌ Xóa Cloudinary fail:", err);
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadProductImage,
};
