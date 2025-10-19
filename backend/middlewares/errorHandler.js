const errorHandler = (err, req, res, next) => {
  console.error("🔥 Lỗi xảy ra:", err.stack || err.message);

  // Nếu đã có statusCode gắn vào err thì dùng, không thì mặc định 500
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Có lỗi xảy ra trên server",
  });
};

module.exports = errorHandler;