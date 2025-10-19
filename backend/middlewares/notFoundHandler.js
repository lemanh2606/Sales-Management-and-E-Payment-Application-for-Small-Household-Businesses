
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `🔍 Không tìm thấy endpoint: ${req.originalUrl}`,
  });
};

module.exports = notFoundHandler;
