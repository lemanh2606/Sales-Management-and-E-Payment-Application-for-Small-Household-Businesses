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
    if (!authHeader) {
      return res
        .status(401)
        .json({ message: "Không tìm thấy token, vui lòng đăng nhập" });
    }

    // Kiểm tra định dạng: phải là "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res
        .status(401)
        .json({ message: "Token sai định dạng (phải là 'Bearer <token>')" });
    }

    const token = parts[1];
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
  checkStoreAccess
  - Xác định cửa hàng (storeId) từ nhiều nguồn: query (shopId/storeId), params, hoặc body.
  - Nếu không truyền storeId thì fallback sang req.user.current_store (nếu user đã load).
  - Kiểm tra store tồn tại.
  - Kiểm tra user có quyền với store này thông qua store_roles.
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
      req.body.storeId ||
      req.body.shopId ||
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

    // Kiểm tra user có quyền với store này không thông qua store_roles
    // store_roles là mảng các object dạng { store: ObjectId, role: "OWNER"/"STAFF" }
    const roleMapping =
      (userData.store_roles || []).find(
        (r) => String(r.store) === String(store._id)
      ) || null;

    if (roleMapping) {
      // Nếu có mapping thì cho phép và gán req.storeRole theo mapping
      req.store = store;
      req.storeRole = roleMapping.role; // có thể là OWNER hoặc STAFF
      return next();
    }

    // Nếu không có mapping cho store này thì deny
    console.log("User không có quyền với cửa hàng này");
    return res.status(403).json({
      message: "Bạn không có quyền truy cập cửa hàng này",
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
  - Nếu req.store tồn tại thì middleware cũng sẽ kiểm tra các permission scoped theo store.
  Trả 401 nếu user chưa xác thực, 403 nếu thiếu permission, 500 nếu lỗi server.
*/
function requirePermission(permission, options = {}) {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Chưa xác thực" });

      // Lấy menu từ user
      const menu = Array.isArray(user.menu)
        ? user.menu.map((p) => p.trim())
        : [];

      if (!menu.length) {
        return res
          .status(403)
          .json({ message: "Truy cập bị từ chối (không có quyền)" });
      }

      const perm = String(permission).trim();

      // Kiểm tra match chính xác
      if (menu.includes(perm)) return next();

      // Kiểm tra wildcard global: *, *:*, all
      if (menu.includes("*") || menu.includes("*:*") || menu.includes("all")) {
        return next();
      }

      // Kiểm tra resource wildcard: resource:*
      const [resource, action] = perm.split(":");
      if (resource && action && menu.includes(`${resource}:*`)) {
        return next();
      }

      // Kiểm tra store-scoped permissions nếu req.store có dữ liệu
      if (req.store && req.store._id) {
        const sid = String(req.store._id);
        // store:<storeId>:permission hoặc store:<storeId>:resource:*
        if (
          menu.includes(`store:${sid}:${perm}`) ||
          (resource && menu.includes(`store:${sid}:${resource}:*`))
        ) {
          return next();
        }
      }

      // Kiểm tra wildcard scoped nếu permission dạng store:<id>:resource:action
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

      return res
        .status(403)
        .json({ message: "Truy cập bị từ chối (thiếu quyền)" });
    } catch (err) {
      console.error("requirePermission error:", err);
      return res
        .status(500)
        .json({ message: "Lỗi server trong requirePermission" });
    }
  };
}

module.exports = {
  verifyToken,
  checkStoreAccess,
  requirePermission,
};
