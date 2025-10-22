// controllers/loyaltyController.js
const LoyaltySetting = require("../models/LoyaltySetting");

// POST /api/loyalty/config - Manager setup config tích điểm cho store (pointsPerVND, vndPerPoint, minOrderValue, isActive)
const setupLoyaltyConfig = async (req, res) => {
  try {
    const { storeId } = req.params; // StoreId từ params (checkStoreAccess middleware)
    const { pointsPerVND, vndPerPoint, minOrderValue, isActive } = req.body; // Input config (optional, update partial)

    // Validate quyền: Chỉ owner store (req.storeRole từ middleware)
    if (req.storeRole !== "OWNER") {
      return res.status(403).json({ message: "Chỉ chủ cửa hàng mới setup tích điểm" });
    }

    // Validate input (min 0, pointsPerVND >0 nếu active)
    if (isActive && (!pointsPerVND || pointsPerVND <= 0)) {
      return res.status(400).json({ message: "Tỉ lệ tích điểm phải lớn hơn 0 khi bật hệ thống" });
    }
    if (minOrderValue !== undefined && minOrderValue < 0) {
      return res.status(400).json({ message: "Giá trị đơn tối thiểu phải lớn hơn hoặc bằng 0" });
    }

    // Tìm hoặc tạo LoyaltySetting unique per store
    let loyalty = await LoyaltySetting.findOne({ storeId });
    if (!loyalty) {
      loyalty = new LoyaltySetting({ storeId }); // Tạo mới nếu ko có
    }

    // Update fields (partial)
    if (pointsPerVND !== undefined) loyalty.pointsPerVND = pointsPerVND;
    if (vndPerPoint !== undefined) loyalty.vndPerPoint = vndPerPoint;
    if (minOrderValue !== undefined) loyalty.minOrderValue = minOrderValue;
    if (isActive !== undefined) loyalty.isActive = isActive;

    await loyalty.save();

    console.log(`Setup config tích điểm thành công cho store ${storeId}, isActive: ${loyalty.isActive}`);
    res.status(200).json({
      message: "Setup tích điểm thành công",
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
    const { storeId } = req.params; // StoreId từ params

    // Validate quyền: Owner hoặc staff store (req.storeRole từ middleware)
    if (req.storeRole !== "OWNER" && req.storeRole !== "STAFF") {
      return res.status(403).json({ message: "Không có quyền xem config tích điểm" });
    }

    const loyalty = await LoyaltySetting.findOne({ storeId }).lean(); // Lấy config (ko có thì null)
    if (!loyalty) {
      return res.status(404).json({ message: "Chưa setup config tích điểm cho cửa hàng" });
    }

    console.log(`Lấy config tích điểm thành công cho store ${storeId}`);
    res.json({ message: "Lấy config thành công", config: loyalty });
  } catch (err) {
    console.error("Lỗi lấy config tích điểm:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy config tích điểm" });
  }
};

module.exports = { setupLoyaltyConfig, getLoyaltyConfig };
