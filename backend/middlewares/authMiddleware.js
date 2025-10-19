// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Store = require("../models/Store");
const mongoose = require("mongoose");

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_change_in_env";

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

function isManager(req, res, next) {
  try {
    if (req.user && req.user.role === "MANAGER") return next();
    return res.status(403).json({ message: " Chỉ Manager mới có quyền này" });
  } catch (err) {
    console.error("isManager error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

function isStaff(req, res, next) {
  try {
    if (req.user && req.user.role === "STAFF") return next();
    return res.status(403).json({ message: " Chỉ Staff mới có quyền này" });
  } catch (err) {
    console.error("isStaff error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

/**
 * checkStoreAccess (phiên bản Multi-Tenant)
 * - Hỗ trợ cả shopId và storeId
 * - Manager chỉ được vào store thuộc quyền sở hữu (owner_id)
 * - Staff chỉ được vào store được phân trong store_roles
 * - Nếu không truyền storeId/shopId → dùng current_store trong User
 */
async function checkStoreAccess(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User chưa xác thực" });
    }

    // 1️ Lấy storeId từ nhiều nguồn (linh hoạt FE)
    let storeId =
      req.query.shopId ||
      req.query.storeId ||
      req.params.storeId ||
      req.body.storeId ||
      null;

    // 🔍 Load user thực từ DB
    const userData = await User.findById(userId).lean();
    if (!storeId && userData?.current_store) {
      storeId = String(userData.current_store);
    }

    if (!storeId) {
      return res.status(400).json({
        message: "Thiếu storeId/shopId (không xác định được cửa hàng)",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    // 2️ Lấy store
    const store = await Store.findById(storeId).lean();
    if (!store) {
      return res.status(404).json({
        message: "Cửa hàng không tồn tại hoặc đã bị xóa",
      });
    }
    // 3️ PHÂN QUYỀN
    //  MANAGER → chỉ được vào store mình sở hữu
    if (req.user.role === "MANAGER") {
      if (String(store.owner_id) === String(userId)) {
        console.log("Log này báo: MANAGER đã vào được store của mình");
        req.store = store;
        req.storeRole = "OWNER";
        return next();
      } else {
        console.log(" MANAGER TRUY CẬP STORE KHÔNG PHẢI OWNER");
        return res.status(403).json({
          message: "Manager không sở hữu cửa hàng này",
        });
      }
    }

    //  STAFF → Kiểm tra store_roles
    if (req.user.role === "STAFF") {
      const roleMapping =
        (userData.store_roles || []).find(
          (r) => String(r.store) === String(store._id)
        ) || null;

      if (roleMapping) {
        console.log(" STAFF ĐƯỢC GÁN STORE → ALLOW");
        req.store = store;
        req.storeRole = roleMapping.role; // OWNER / STAFF
        return next();
      }
      console.log(" STAFF TRUY CẬP STORE KHÔNG ĐƯỢC GÁN");
      return res.status(403).json({
        message: "Nhân viên không có quyền tại cửa hàng này",
      });
    }

    // Nếu không thuộc MANAGER / STAFF
    return res.status(403).json({
      message: "Role không hợp lệ để truy cập cửa hàng",
    });
  } catch (err) {
    console.error("checkStoreAccess error:", err);
    return res.status(500).json({ message: "Lỗi server ở checkStoreAccess" });
  }
}

module.exports = { verifyToken, isManager, isStaff, checkStoreAccess };