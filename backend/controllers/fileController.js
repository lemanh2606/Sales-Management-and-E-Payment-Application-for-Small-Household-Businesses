// controllers/fileController.js
const fs = require("fs");
const File = require("../models/File");
const Store = require("../models/Store");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary");
const logActivity = require("../utils/logActivity");

const uploadFile = async (req, res) => {
  try {
    const { storeId } = req.body;
    const userId = req.user?._id;

    if (!storeId || !req.file) {
      return res.status(400).json({ message: "Thiếu storeId hoặc file upload" });
    }

    const store = await Store.findById(storeId).populate("owner_id", "username fullname email");
    if (!store) return res.status(404).json({ message: "Không tìm thấy cửa hàng" });

    // Xác định resource_type chuẩn
    let resourceType = "raw";
    if (req.file.mimetype.startsWith("image")) resourceType = "image";
    else if (req.file.mimetype.startsWith("video")) resourceType = "video";

    const ownerId = store.owner_id?._id;
    const localPath = req.file.path;
    const fileExt = req.file.originalname.split(".").pop().toLowerCase();
    const disallowedExt = ["exe", "bat", "cmd", "sh", "dll", "msi", "php", "json"];
    if (disallowedExt.includes(fileExt)) {
      return res.status(400).json({ message: `File có đuôi ".${fileExt}" không được phép tải lên!` });
    }

    const documentExt = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"];
    const category = req.file.mimetype.startsWith("image")
      ? "image"
      : req.file.mimetype.startsWith("video")
      ? "video"
      : documentExt.includes(fileExt)
      ? "document"
      : "other";

    // ✅ luôn dùng resource_type="auto" để Cloudinary tự phân loại
    const result = await uploadToCloudinary(localPath, `uploads/${ownerId}/${storeId}`, resourceType);
    if (!result || !result.secure_url || !result.public_id) {
      return res.status(500).json({ message: "Cloudinary upload failed" });
    }
    console.log("☁️ Uploaded Cloudinary:", {
      public_id: result.public_id,
      format: result.format,
      resource_type: result.resource_type,
    });

    // ✅ 5️⃣ Lưu đúng resource_type thật sự mà Cloudinary trả về
    const newFile = await File.create({
      storeId,
      name: req.file.originalname,
      originalName: req.file.originalname,
      url: result.secure_url,
      public_id: result.public_id,
      type: req.file.mimetype,
      resource_type: result.resource_type || "raw",
      size: req.file.size,
      extension: fileExt,
      category,
      uploadedBy: userId || null,
    });
    //ghi log
    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "File",
      entityId: newFile._id,
      entityName: newFile.name,
      req,
      description: `Người dùng ${req.user.username || req.user.email} đã tải lên tệp mới "${newFile.name}" (${
        newFile.extension
      }) cho cửa hàng ${store?.name || "không xác định"}`,
    });

    res.status(201).json({ message: "Upload file thành công!", file: newFile });
  } catch (err) {
    console.error(" Lỗi upload file:", err);
    res.status(500).json({ message: "Lỗi upload file", error: err.message });
  }
};

const getFilesByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const files = await File.find({ storeId }).populate("uploadedBy", "username email").sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    console.error(" Lỗi getFilesByStore:", err);
    res.status(500).json({ message: "Lỗi lấy danh sách file", error: err.message });
  }
};

const getFileById = async (req, res) => {
  try {
    const file = await File.findById(req.params.id).populate("uploadedBy", "username email");
    if (!file) return res.status(404).json({ message: "Không tìm thấy file" });
    res.json(file);
  } catch (err) {
    console.error(" Lỗi getFileById:", err);
    res.status(500).json({ message: "Lỗi lấy file", error: err.message });
  }
};

const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "Không tìm thấy file" });

    console.log("🧹 Bắt đầu xoá file Cloudinary...");
    console.log("➡️ public_id:", file.public_id);
    console.log("➡️ url:", file.url);

    // Gọi xoá Cloudinary, thêm log chi tiết
    const deleteResult = await deleteFromCloudinary(file.public_id, file.resource_type);
    console.log("🧩 Kết quả xoá Cloudinary:", deleteResult);

    // Nếu Cloudinary trả result khác "ok" thì cảnh báo
    if (!deleteResult || deleteResult.result !== "ok") {
      console.warn("⚠️ Cloudinary không xoá được:", deleteResult);
    }

    // Xoá khỏi MongoDB
    await file.deleteOne();
    const store = await Store.findById(file.storeId).select("name");
    //ghi log
    await logActivity({
      user: req.user,
      store: { _id: file.storeId },
      action: "delete",
      entity: "File",
      entityId: file._id,
      entityName: file.name,
      req,
      description: `Người dùng ${req.user.username || req.user.email} đã xoá tệp "${file.name}" khỏi cửa hàng ${
        store?.name || "không xác định"
      }`,
    });

    console.log("✅ Đã xoá file khỏi MongoDB:", file._id);

    res.json({ message: "Đã xóa file thành công" });
  } catch (err) {
    console.error(" Lỗi xóa file:", err);
    res.status(500).json({ message: "Lỗi xóa file", error: err.message });
  }
};

module.exports = {
  uploadFile,
  getFilesByStore,
  getFileById,
  deleteFile,
};
