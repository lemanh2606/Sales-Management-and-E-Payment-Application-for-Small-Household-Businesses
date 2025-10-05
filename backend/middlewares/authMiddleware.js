// backend/middleware/authMiddleware.js
/**
 * Middleware xác thực & quyền:
 * - verifyToken: verify JWT, gắn req.user = { id, role, ... }
 * - isManager: chỉ phép MANAGER
 * - isStaff: chỉ phép STAFF
 * - checkStoreAccess: kiểm tra quyền truy cập một store (owner hoặc staff assigned)
 *
 * Ghi chú:
 * - Cần đặt process.env.JWT_SECRET trong .env
 * - Cần models User & Store ở ../models
 * - Sử dụng cùng cấu trúc User/Store như project
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Store = require("../models/Store");
const mongoose = require("mongoose");

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_change_in_env";

/**
 * verifyToken: middleware đọc header Authorization: Bearer <token>
 * Nếu hợp lệ -> gắn req.user = decoded payload
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Không tìm thấy token, vui lòng đăng nhập" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ message: "Token sai định dạng (phải là 'Bearer <token>')" });
    }

    const token = parts[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // decoded thường chứa { id, role, iat, exp }
      req.user = decoded;
      return next();
    } catch (err) {
      console.error("JWT verify error:", err);
      return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }
  } catch (err) {
    console.error("verifyToken error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

/**
 * isManager: allow only users with global role MANAGER
 */
function isManager(req, res, next) {
  try {
    if (req.user && req.user.role === "MANAGER") return next();
    return res.status(403).json({ message: "🚫 Chỉ Manager mới có quyền này" });
  } catch (err) {
    console.error("isManager error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

/**
 * isStaff: allow only users with global role STAFF
 */
function isStaff(req, res, next) {
  try {
    if (req.user && req.user.role === "STAFF") return next();
    return res.status(403).json({ message: "🚫 Chỉ Staff mới có quyền này" });
  } catch (err) {
    console.error("isStaff error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

/**
 * checkStoreAccess:
 * - Xác định storeId từ: req.params.storeId || req.body.storeId || user.current_store
 * - Kiểm tra:
 *    + Nếu user là MANAGER và owner_id === userId -> OK
 *    + Nếu user có mapping trong user.store_roles -> OK (role OWNER/STAFF)
 * - Gắn req.store và req.storeRole rồi next()
 */
async function checkStoreAccess(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "User chưa xác thực" });

    let storeId = req.params?.storeId || req.body?.storeId || null;

    // Nếu chưa có storeId, lấy từ DB user.current_store
    if (!storeId) {
      const user = await User.findById(userId).lean();
      if (user && user.current_store) storeId = String(user.current_store);
    }

    if (!storeId) {
      return res.status(400).json({ message: "storeId không được cung cấp" });
    }

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: "Cửa hàng không tồn tại" });

    // Nếu là owner (MANAGER) và trùng owner_id
    if (req.user.role === "MANAGER" && String(store.owner_id) === String(userId)) {
      req.store = store;
      req.storeRole = "OWNER";
      return next();
    }

    // Kiểm tra mapping trong user.store_roles (nếu user được gán là STAFF trên store)
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: "User không tồn tại" });

    const mapping = (user.store_roles || []).find((r) => String(r.store) === String(store._id));
    if (mapping) {
      req.store = store;
      req.storeRole = mapping.role === "OWNER" ? "OWNER" : "STAFF";
      return next();
    }

    // Nếu không đủ quyền
    return res.status(403).json({ message: "Bạn không có quyền truy cập cửa hàng này" });
  } catch (err) {
    console.error("checkStoreAccess error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

// Xuất các hàm để router import bằng destructuring
module.exports = {
  verifyToken,
  isManager,
  isStaff,
  checkStoreAccess,
};
