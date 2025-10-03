const jwt = require("jsonwebtoken");

// Middleware xác thực cơ bản (verify JWT + gắn user)
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "❌ Không có token trong header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "❌ Token không đúng định dạng (phải là Bearer <token>)" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: user._id, role: user.role }
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res.status(401).json({ message: "❌ Token không hợp lệ hoặc đã hết hạn" });
  }
};

// Middleware check role cụ thể
exports.isManager = (req, res, next) => {
  if (req.user && req.user.role === "MANAGER") {
    return next();
  }
  return res.status(403).json({ message: "🚫 Chỉ Manager mới có quyền này" });
};

exports.isStaff = (req, res, next) => {
  if (req.user && req.user.role === "STAFF") {
    return next();
  }
  return res.status(403).json({ message: "🚫 Chỉ Staff mới có quyền này" });
};
