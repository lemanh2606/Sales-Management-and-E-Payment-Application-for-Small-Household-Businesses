// backend/models/File.js
const mongoose = require("mongoose");
const fileSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    name: { type: String, required: true, trim: true }, // Tên file
    url: { type: String, required: true }, // Đường dẫn truy cập file
    public_id: { type: String, required: true }, // ID nội bộ Cloudinary không thể thiếu
    type: { type: String, required: true }, // MIME type (vd: image/png)
    size: { type: Number, required: true }, // Dung lượng bytes
    resource_type: { type: String, default: "raw" },
    extension: { type: String, lowercase: true }, // Đuôi file: jpg, pdf,...
    category: { type: String, enum: ["image", "document", "video", "other"], default: "other" },
    folder: { type: String, default: "root" }, // Thư mục chứa (nếu có)
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Ai upload
  },
  {
    timestamps: true,
    collection: "files",
  }
);
//thêm các thể loại index tìm kiếm nhanh
fileSchema.index({ name: "text", tags: "text", extension: 1, category: 1 });

module.exports = mongoose.model("File", fileSchema);
