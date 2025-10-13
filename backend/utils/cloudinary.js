// utils/cloudinary.js
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // 👈 luôn là https
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

module.exports = { uploadToCloudinary, deleteFromCloudinary};
