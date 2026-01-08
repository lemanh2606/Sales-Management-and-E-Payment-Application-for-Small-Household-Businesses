// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Store = require("../models/Store");
const mongoose = require("mongoose");

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_change_in_env";

/*
  verifyToken
  - Kiểm tra header Authorization có token dạng "Bearer <token>" hay không.
  - Giải mã JWT (xác thực token).
  - Dựa vào payload (kỳ vọng có trường id) để load thông tin user từ database.
  - Gán object user (đã loại bỏ password_hash) vào req.user để các middleware/route sau đó dùng.
  - Trả về 401 nếu token thiếu, sai định dạng, không hợp lệ, hết hạn, hoặc user không tồn tại.
  - Trả về 500 nếu lỗi server khi đọc DB.
*/
async function verifyToken(req, res, next) {
  try {
    // Lấy header Authorization (hỗ trợ cả "authorization" và "Authorization")
    const authHeader =
      req.headers["authorization"] || req.headers["Authorization"];
    
    let token = null;
    if (authHeader) {
      // Kiểm tra định dạng: phải là "Bearer <token>"
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    // Nếu không có header, thử lấy từ query param (hữu ích cho download file)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Không tìm thấy token, vui lòng đăng nhập" });
    }
    let decoded;
    try {
      // Xác thực token bằng secret
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Xử lý token không hợp lệ hoặc hết hạn
      console.error("JWT verify error:", err);
      return res
        .status(401)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    // payload phải có id, nếu thiếu coi như token không hợp lệ
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Token không hợp lệ (thiếu id)" });
    }

    try {
      // Load user thực tế từ DB để có các trường như menu, store_roles, current_store...
      // .select("-password_hash") để không trả về hash mật khẩu
      // .lean() để trả về plain object, dễ thao tác và nhẹ hơn
      const user = await User.findById(decoded.id)
        .select("-password_hash")
        .lean();
      if (!user || user.isDeleted) {
        // Nếu user bị xóa hoặc không tồn tại thì không hợp lệ
        return res
          .status(401)
          .json({ message: "Người dùng không tồn tại hoặc đã bị xóa" });
      }

      // Gán user cho request để middleware/route sau có thể dùng
      req.user = user;
      return next();
    } catch (err) {
      // Lỗi khi truy vấn DB
      console.error("Error loading user from DB in verifyToken:", err);
      return res
        .status(500)
        .json({ message: "Lỗi server khi lấy thông tin người dùng" });
    }
  } catch (err) {
    // Bắt các lỗi không lường trước
    console.error("verifyToken error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

/*
  isManager
  - Middleware đơn giản kiểm tra role của req.user có phải "MANAGER" hay không.
  - Nếu đúng thì next(), ngược lại trả 403.
  - Trả 500 nếu có lỗi bất ngờ.
*/
function isManager(req, res, next) {
  try {
    if (req.user && req.user.role === "MANAGER") return next();
    return res.status(403).json({ message: "Chỉ Manager mới có quyền này" });
  } catch (err) {
    console.error("isManager error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

/*
  isStaff
  - Middleware kiểm tra role của req.user có phải "STAFF" hay không.
  - Nếu đúng thì next(), ngược lại trả 403.
  - Trả 500 nếu có lỗi bất ngờ.
*/
function isStaff(req, res, next) {
  try {
    if (req.user && req.user.role === "STAFF") return next();
    return res.status(403).json({ message: "Chỉ Staff mới có quyền này" });
  } catch (err) {
    console.error("isStaff error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
}

/*
  checkStoreAccess (Multi-Tenant)
  Mục tiêu:
  - Xác định cửa hàng (storeId) từ nhiều nguồn: query (shopId/storeId), params, hoặc body.
  - Nếu không truyền storeId thì fallback sang req.user.current_store (nếu user đã load).
  - Kiểm tra store tồn tại.
  - Nếu req.user.role === "MANAGER": chỉ cho phép truy cập nếu user là owner của store (so sánh store.owner_id với userId).
  - Nếu req.user.role === "STAFF": kiểm tra user.store_roles để xác định user có quyền với store đó hay không.
  - Nếu hợp lệ, gán req.store (object store) và req.storeRole (OWNER/STAFF) để dùng tiếp.
  - Trả 400/401/403/404/500 tương ứng với các lỗi liên quan.
*/
async function checkStoreAccess(req, res, next) {
  try {
    // userId có thể ở req.user.id || req.user._id (payload trước) hoặc req.user._id (object DB)
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "User chưa xác thực" });
    }

    // Lấy storeId từ các nguồn khác nhau (ưu tiên query params, sau đó params, body)
    let storeId =
      req.query.shopId ||
      req.query.storeId ||
      req.params.storeId ||
      req.body?.storeId ||
      req.body?.shopId ||
      null;

    // Nếu chưa có storeId từ request, dùng current_store của user (nếu có)
    const userData = req.user || (await User.findById(userId).lean());
    if (!storeId && userData?.current_store) {
      storeId = String(userData.current_store);
    }

    // Nếu vẫn không xác định được storeId thì trả lỗi
    if (!storeId) {
      return res.status(400).json({
        message: "Thiếu storeId/shopId (không xác định được cửa hàng)",
      });
    }

    // Kiểm tra định dạng ObjectId
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    // Lấy thông tin store từ DB
    const store = await Store.findById(storeId).lean();
    if (!store) {
      return res.status(404).json({
        message: "Cửa hàng không tồn tại hoặc đã bị xóa",
      });
    }

    // PHÂN QUYỀN THEO ROLE

    // CASE: MANAGER -> chỉ được truy cập nếu là owner của store
    if (req.user.role === "MANAGER") {
      if (String(store.owner_id) === String(userId)) {
        req.store = store;
        req.storeRole = "OWNER";
        return next();
      } else {
        // Nếu manager không phải owner thì không cho phép
        console.log("MANAGER TRUY CẬP STORE KHÔNG PHẢI OWNER");
        return res.status(403).json({
          message: "Manager không sở hữu cửa hàng này",
        });
      }
    }

    // CASE: STAFF -> kiểm tra mapping store_roles trong userData
    if (req.user.role === "STAFF") {
      // store_roles là mảng các object dạng { store: ObjectId, role: "OWNER"/"STAFF" }
      const roleMapping =
        (userData.store_roles || []).find(
          (r) => String(r.store) === String(store._id)
        ) || null;

      if (roleMapping) {
        // Nếu có mapping thì cho phép và gán req.storeRole theo mapping
        console.log("STAFF ĐƯỢC GÁN STORE → ALLOW");
        req.store = store;
        req.storeRole = roleMapping.role; // có thể là OWNER hoặc STAFF theo schema bạn dùng
        return next();
      }
      // Nếu không có mapping cho store này thì deny
      console.log("STAFF TRUY CẬP STORE KHÔNG ĐƯỢC GÁN");
      return res.status(403).json({
        message: "Nhân viên không có quyền tại cửa hàng này",
      });
    }

    // Nếu role không phải MANAGER hoặc STAFF thì không có quyền truy cập store
    return res.status(403).json({
      message: "Role không hợp lệ để truy cập cửa hàng",
    });
  } catch (err) {
    // Lỗi không lường trước trong quá trình kiểm tra store access
    console.error("checkStoreAccess error:", err);
    return res.status(500).json({ message: "Lỗi server ở checkStoreAccess" });
  }
}

/*
  requirePermission(permission, options)
  Mục đích:
  - Kiểm tra xem req.user.menu có chứa permission cần thiết hay không.
  - Hỗ trợ nhiều dạng permission:
      * Global resource-action, ví dụ "orders:view"
      * Global wildcard, ví dụ "orders:*"
      * Scoped to store, ví dụ "store:<storeId>:orders:view" hoặc "store:<storeId>:orders:*"
      * Toàn quyền: "*" hoặc "*:*" hoặc "all"
  - Nếu options.allowManager không bị set thành false thì role MANAGER sẽ override và luôn được cho phép.
  - Nếu req.store tồn tại thì middleware cũng sẽ kiểm tra các permission scoped theo store.
  Trả 401 nếu user chưa xác thực, 403 nếu thiếu permission, 500 nếu lỗi server.
*/
function requirePermission(permission, options = {}) {
  // options giữ lại để sau cần cấu hình gì thêm thì dùng, hiện tại không còn allowManager
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Lấy menu từ user (danh sách permission dạng string)
      const menu = Array.isArray(user.menu)
        ? user.menu.map((p) => String(p).trim())
        : [];

      if (!menu.length) {
        return res
          .status(403)
          .json({ message: "Access denied (no permissions)" });
      }

      const perm = String(permission).trim();
      const [resource, action] = perm.split(":");

      // 1. Match chính xác
      if (menu.includes(perm)) {
        return next();
      }

      // 2. Wildcard global: *, *:*, all, resource:*
      if (
        menu.includes(`${resource}:*`) ||
        menu.includes("*") ||
        menu.includes("*:*") ||
        menu.includes("all")
      ) {
        return next();
      }

      // 3. Store-scoped permissions nếu req.store có dữ liệu
      if (req.store && req.store._id) {
        const sid = String(req.store._id);

        // store:<storeId>:permission hoặc store:<storeId>:resource:*
        if (
          menu.includes(`store:${sid}:${perm}`) ||
          menu.includes(`store:${sid}:${resource}:*`)
        ) {
          return next();
        }
      }

      // 4. Wildcard scoped nếu permission dạng store:<id>:resource:action
      if (perm.startsWith("store:")) {
        const parts = perm.split(":"); // ["store", "<id>", "resource", "action"]
        if (parts.length >= 3) {
          const sid = parts[1];
          const resName = parts[2];

          if (menu.includes(`store:${sid}:${resName}:*`)) {
            return next();
          }
        }
      }

      // Nếu tới đây vẫn không match permission nào
      return res
        .status(403)
        .json({ message: "Truy cập bị từ chối (không đủ quyền)" });
    } catch (err) {
      console.error("requirePermission error:", err);
      return res
        .status(500)
        .json({ message: "Server error in requirePermission" });
    }
  };
}
const requireRole =
  (...roles) =>
  (req, res, next) => {
    const userRole = req.user?.role; // bạn chỉnh lại theo payload token (vd: req.user.userType)
    if (!userRole || !roles.includes(userRole)) {
      return res
        .status(403)
        .json({ message: "Không đủ quyền (role) để thực hiện thao tác này" });
    }
    next();
  };

module.exports = {
  verifyToken,
  checkStoreAccess,
  requirePermission,
  requireRole,
};
