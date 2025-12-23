// tools/updateManagerPermissions.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js"; // đi lên 1 cấp rồi vào models/User.js

dotenv.config();

// Các quyền mới cần thêm
const NEW_REPORT_PERMISSIONS = [
  // "warehouses:view",
  // "warehouses:create",
  // "warehouses:update",
  // "warehouses:delete",
  // "warehouses:restore",
  // "warehouses:set-default",
  "inventory:voucher:view",
  //thêm nếu có cái mới hoặc nghĩ ra cái mới
];

async function updateManagerPermissions() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Đã kết nối MongoDB Atlas");

    // Lấy danh sách tất cả MANAGER
    const managers = await User.find({ role: "MANAGER" });
    console.log(`🔍 Tìm thấy ${managers.length} tài khoản MANAGER`);

    for (const user of managers) {
      const currentMenu = user.menu || [];

      // Gộp menu cũ + mới, loại trùng
      const updatedMenu = Array.from(new Set([...currentMenu, ...NEW_REPORT_PERMISSIONS]));

      if (updatedMenu.length !== currentMenu.length) {
        user.menu = updatedMenu;
        await user.save();
        console.log(`✅ Cập nhật quyền mới cho: ${user.username}`);
      } else {
        console.log(`ℹ️ ${user.username} đã có đủ quyền, bỏ qua`);
      }
    }

    console.log("🎉 Hoàn tất cập nhật tất cả MANAGER!");
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối MongoDB");
  }
}

updateManagerPermissions();
