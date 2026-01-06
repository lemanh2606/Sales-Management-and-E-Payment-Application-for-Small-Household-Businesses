// controllers/operatingExpenseController.js
const OperatingExpense = require("../models/OperatingExpense");
const { Decimal128 } = require("mongodb");

// ========== CREATE: Thêm mới chi phí ngoài cho 1 kỳ báo cáo ==========
const create = async (req, res) => {
  try {
    const { storeId, periodType, periodKey, items } = req.body;
    const userId = req.user?._id;

    if (!storeId || !periodType || !periodKey || !Array.isArray(items)) {
      return res.status(400).json({
        message: "Thiếu dữ liệu bắt buộc: storeId, periodType, periodKey hoặc danh sách items",
      });
    }
    if (!["month", "quarter", "year"].includes(periodType)) {
      return res.status(400).json({
        message: "periodType không hợp lệ, chỉ chấp nhận: month, quarter, year",
      });
    }
    if (periodType === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
      return res.status(400).json({
        message: "Định dạng periodKey theo tháng phải là YYYY-MM (ví dụ: 2025-12)",
      });
    }
    if (periodType === "quarter" && !/^\d{4}-Q[1-4]$/.test(periodKey)) {
      return res.status(400).json({
        message: "Định dạng periodKey theo quý phải là YYYY-Qn (n từ 1 đến 4, ví dụ: 2025-Q4)",
      });
    }
    if (periodType === "year" && !/^\d{4}$/.test(periodKey)) {
      return res.status(400).json({
        message: "Định dạng periodKey theo năm phải là YYYY (ví dụ: 2025)",
      });
    }

    const mappedItems = items.map((it) => ({
      amount: Number(it.amount) || 0,
      note: it.note || "",
      isSaved: true,
    }));

    const doc = await OperatingExpense.findOneAndUpdate(
      { storeId, periodType, periodKey }, // key theo kỳ
      {
        $set: {
          storeId,
          periodType,
          periodKey,
          items: mappedItems,
          status: "active",
          isDeleted: false,
          updatedBy: userId,
        },
        $setOnInsert: { createdBy: userId },
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error("operatingExpenseController.create(upsert):", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== READ: Lấy chi phí ngoài cho 1 kỳ báo cáo ==========
const getByPeriod = async (req, res) => {
  try {
    const { storeId, periodType, periodKey } = req.query;

    if (!storeId || !periodType || !periodKey) {
      return res.status(400).json({ message: "storeId, periodType, periodKey required" });
    }

    const doc = await OperatingExpense.findOne({
      storeId,
      periodType,
      periodKey,
      isDeleted: false,
    });

    if (!doc) {
      return res.status(404).json({ message: "Operating expense not found" });
    }

    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error("operatingExpenseController.getByPeriod:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== READ: Lấy tất cả chi phí cho 1 store (có filter) ==========
const getAll = async (req, res) => {
  try {
    const { storeId, periodType, status } = req.query;
    let filter = { isDeleted: false };

    if (storeId) filter.storeId = storeId;
    if (periodType) filter.periodType = periodType;
    if (status && ["active", "archived"].includes(status)) filter.status = status;

    const docs = await OperatingExpense.find(filter).sort({ createdAt: -1 }).lean();

    return res.json({ success: true, data: docs, total: docs.length });
  } catch (error) {
    console.error("operatingExpenseController.getAll:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== UPDATE: Sửa chi phí ngoài (thay toàn bộ items hoặc thêm 1 item) ==========
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, status } = req.body;
    const userId = req.user?._id;

    const doc = await OperatingExpense.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Không tìm thấy chi phí ngoài." });
    }

    if (doc.isDeleted) {
      return res.status(410).json({ message: "Bản ghi đã bị xoá" });
    }

    // Update items nếu có
    if (Array.isArray(items)) {
      doc.items = items.map((it) => ({ amount: it.amount || 0, note: it.note || "" }));
    }

    // Update status nếu có
    if (status && ["active", "archived"].includes(status)) {
      doc.status = status;
    }

    doc.updatedBy = userId;
    await doc.save();

    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error("operatingExpenseController.update:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== DELETE: Xoá 1 item trong danh sách ==========
const deleteItem = async (req, res) => {
  try {
    const { id, itemIndex } = req.params;
    const userId = req.user?._id;

    const doc = await OperatingExpense.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Không tìm thấy chi phí ngoài" });
    }

    if (doc.isDeleted) {
      return res.status(410).json({ message: "Bản ghi đã bị xoá" });
    }

    const idx = parseInt(itemIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= doc.items.length) {
      return res.status(400).json({ message: "Item index không hợp lệ" });
    }

    doc.items.splice(idx, 1);
    doc.updatedBy = userId;
    await doc.save();

    return res.json({ success: true, message: "Item đã xoá", data: doc });
  } catch (error) {
    console.error("operatingExpenseController.deleteItem:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== DELETE: Xoá nhiều items trong danh sách theo _id ==========
const deleteItemWithCheckbox = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemIds } = req.body; // array of item _id
    const userId = req.user?._id;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: "Danh sách itemIds không hợp lệ" });
    }

    const doc = await OperatingExpense.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Không tìm thấy chi phí ngoài" });
    }

    if (doc.isDeleted) {
      return res.status(410).json({ message: "Bản ghi đã bị xoá" });
    }

    const beforeCount = doc.items.length;

    // Xoá theo _id (CHUẨN)
    doc.items = doc.items.filter((it) => !itemIds.includes(it._id.toString()));

    const deletedCount = beforeCount - doc.items.length;

    if (deletedCount === 0) {
      return res.status(400).json({ message: "Không có item nào hợp lệ để xoá" });
    }

    doc.updatedBy = userId;
    await doc.save();

    return res.json({
      success: true,
      message: `Đã xoá ${deletedCount} khoản chi`,
      data: doc,
    });
  } catch (error) {
    console.error("operatingExpenseController.deleteItemWithCheckbox:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== DELETE: Hard delete toàn bộ record ==========
const hardDelete = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await OperatingExpense.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy chi phí ngoài" });
    }

    return res.json({ success: true, message: "Đã xoá hẳn bản ghi", data: deleted });
  } catch (error) {
    console.error("operatingExpenseController.hardDelete:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== UTILITY: Tính tổng chi phí ngoài cho 1 kỳ ==========
const getTotalByPeriod = async (req, res) => {
  try {
    const { storeId, periodType, periodKey } = req.query;

    if (!storeId || !periodType || !periodKey) {
      return res.status(400).json({ message: "storeId, periodType, periodKey là bắt buộc" });
    }

    const doc = await OperatingExpense.findOne({
      storeId,
      periodType,
      periodKey,
      isDeleted: false,
    });

    const total = doc ? doc.totalAmount : 0;

    return res.json({ success: true, total });
  } catch (error) {
    console.error("operatingExpenseController.getTotalByPeriod:", error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  create,
  getByPeriod,
  getAll,
  update,
  deleteItem,
  deleteItemWithCheckbox,
  hardDelete,
  getTotalByPeriod,
};
