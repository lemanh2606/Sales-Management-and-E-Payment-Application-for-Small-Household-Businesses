
const Store = require("../models/Store");
const User = require("../models/User");

// Tạo cửa hàng mới
exports.createStore = async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    const userId = req.user.id; // req.user được gắn sau này khi login

    // check user có tồn tại không
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo cửa hàng" });
    }

    const newStore = new Store({
      name,
      address,
      phone,
      owner_id: userId,
    });

    await newStore.save();
    res.status(201).json({ message: "Tạo cửa hàng thành công", store: newStore });
  } catch (error) {
    console.error("❌ Lỗi createStore:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// Lấy danh sách store của Manager
exports.getStoresByManager = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới xem được danh sách store" });
    }

    const stores = await Store.find({ owner_id: userId });
    res.status(200).json({ stores });
  } catch (error) {
    console.error("❌ Lỗi getStoresByManager:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
