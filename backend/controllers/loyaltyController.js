// controllers/loyaltyController.js
const LoyaltySetting = require("../models/LoyaltySetting");

// POST /api/loyalty/config - Manager setup config tích điểm cho store (pointsPerVND, vndPerPoint, minOrderValue, isActive)
const setupLoyaltyConfig = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { pointsPerVND, vndPerPoint, minOrderValue, isActive } = req.body;

    if (req.storeRole !== "OWNER") {
      return res.status(403).json({ message: "Chỉ chủ cửa hàng mới setup tích điểm" });
    }

    let loyalty = await LoyaltySetting.findOne({ storeId });

    // Nếu chưa có → tạo mới
    if (!loyalty) {
      loyalty = new LoyaltySetting({
        storeId,
        pointsPerVND: pointsPerVND || 0.00005,
        vndPerPoint: vndPerPoint || 100,
        minOrderValue: minOrderValue || 0,
        isActive: !!isActive,
      });
      await loyalty.save();
      return res.status(200).json({
        message: "Tạo mới cấu hình tích điểm thành công",
        config: loyalty,
      });
    }

    // ⚡ Nếu chỉ toggle on/off → không cần yêu cầu pointsPerVND
    if (isActive !== undefined) loyalty.isActive = isActive;
    if (pointsPerVND !== undefined) loyalty.pointsPerVND = pointsPerVND;
    if (vndPerPoint !== undefined) loyalty.vndPerPoint = vndPerPoint;
    if (minOrderValue !== undefined) loyalty.minOrderValue = minOrderValue;

    // ✅ Không check lỗi “phải có pointsPerVND” nếu chỉ toggle thôi
    if (loyalty.isActive && (!loyalty.pointsPerVND || loyalty.pointsPerVND <= 0)) {
      return res.status(400).json({
        message: "Tỉ lệ tích điểm phải lớn hơn 0 trước khi bật hệ thống",
      });
    }

    await loyalty.save();
    res.status(200).json({
      message: "Cập nhật cấu hình tích điểm thành công",
      config: {
        _id: loyalty._id,
        storeId: loyalty.storeId,
        pointsPerVND: loyalty.pointsPerVND,
        vndPerPoint: loyalty.vndPerPoint,
        minOrderValue: loyalty.minOrderValue,
        isActive: loyalty.isActive,
      },
    });
  } catch (err) {
    console.error("Lỗi setup tích điểm:", err.message);
    res.status(500).json({ message: "Lỗi server khi setup tích điểm" });
  }
};

// GET /api/loyalty/config - Lấy config tích điểm của store (cho staff/manager)
const getLoyaltyConfig = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (req.storeRole !== "OWNER" && req.storeRole !== "STAFF") {
      return res.status(403).json({ message: "Không có quyền xem config tích điểm" });
    }

    const loyalty = await LoyaltySetting.findOne({ storeId }).lean();

    if (!loyalty) {
      return res.status(200).json({
        message: "Bạn chưa cấu hình tích điểm cho cửa hàng này",
        isConfigured: false,
        config: null,
      });
    }

    console.log(`Lấy config tích điểm thành công cho store ${storeId}`);
    res.status(200).json({
      message: "Lấy config thành công",
      isConfigured: true,
      config: loyalty,
    });
  } catch (err) {
    console.error("Lỗi lấy config tích điểm:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy config tích điểm" });
  }
};

module.exports = { setupLoyaltyConfig, getLoyaltyConfig };
