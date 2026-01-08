// controllers/operatingExpenseController.js
const OperatingExpense = require("../models/OperatingExpense");
const mongoose = require("mongoose");
const { Decimal128 } = require("mongodb");

const formatPeriodVN = (type, key) => {
  if (!type || !key) return "";

  if (type === "month") {
    const [y, m] = key.split("-");
    return `Tháng ${Number(m)}/${y}`;
  }

  if (type === "quarter") {
    const [y, q] = key.split("-Q");
    return `Quý ${q} năm ${y}`;
  }

  if (type === "year") {
    return `Năm ${key}`;
  }

  return `${type} ${key}`;
};

const periodTypeVN = (type) => {
  switch (type) {
    case "month":
      return "tháng";
    case "quarter":
      return "quý";
    case "year":
      return "năm";
    default:
      return type;
  }
};

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
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc: storeId, periodType, periodKey" });
    }

    const doc = await OperatingExpense.findOne({
      storeId,
      periodType,
      periodKey,
      isDeleted: false,
    });

    // ✅ Trả 200 thay vì 404, data = null nếu không có
    return res.json({
      success: true,
      data: doc || null,
    });
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
      return res.status(400).json({ message: "Vị trí khoản chi không hợp lệ" });
    }

    doc.items.splice(idx, 1);
    doc.updatedBy = userId;
    await doc.save();

    return res.json({ success: true, message: "Khoản chi đã xoá", data: doc });
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
      return res.status(400).json({ message: "Danh sách khoản chi được chọn không hợp lệ" });
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
      return res.status(400).json({ message: "Không có khoản chi hợp lệ để xoá" });
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

// ========== HELPER: Lấy danh sách tháng từ Quý ==========
const getMonthsFromQuarter = (quarter) => {
  const quarterMap = {
    Q1: ["01", "02", "03"],
    Q2: ["04", "05", "06"],
    Q3: ["07", "08", "09"],
    Q4: ["10", "11", "12"],
  };
  return quarterMap[quarter] || [];
};

// ========== SUGGEST: Gợi ý phân bổ chi phí ==========
const suggestAllocation = async (req, res) => {
  try {
    const { storeId, fromPeriodType, fromPeriodKey, toPeriodType } = req.query;

    if (!storeId || !fromPeriodType || !fromPeriodKey || !toPeriodType) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
    }

    // Lấy dữ liệu từ source period
    const fromDoc = await OperatingExpense.findOne({
      storeId,
      periodType: fromPeriodType,
      periodKey: fromPeriodKey,
      isDeleted: false,
    });

    // Nếu không có dữ liệu từ source → không thể phân bổ
    if (!fromDoc || !fromDoc.items || fromDoc.items.length === 0) {
      return res.json({
        success: true,
        canAllocate: false,
        message: `Không có dữ liệu chi phí ở ${fromPeriodType} ${fromPeriodKey}`,
        suggestions: [],
      });
    }

    const fromTotal = fromDoc.totalAmount;
    let suggestions = [];
    let message = "";
    let targetPeriods = [];
    let fromData = null;

    // ===== CASE 1: Year → Year (Aggregate 12 tháng) =====
    if (fromPeriodType === "year" && toPeriodType === "year") {
      const year = fromPeriodKey;
      let monthlyData = [];
      let totalAmount = 0;

      // Check tất cả 12 tháng
      for (let m = 1; m <= 12; m++) {
        const month = String(m).padStart(2, "0");
        const monthKey = `${year}-${month}`;
        const monthDoc = await OperatingExpense.findOne({
          storeId,
          periodType: "month",
          periodKey: monthKey,
          isDeleted: false,
        });

        const monthAmount = monthDoc ? monthDoc.totalAmount : 0;
        monthlyData.push({ monthKey, amount: monthAmount });
        totalAmount += monthAmount;
      }

      // Nếu có tháng nào có data → aggregate
      if (totalAmount > 0) {
        let detailText = monthlyData.map((m, idx) => `tháng ${String(idx + 1).padStart(2, "0")} = ${m.amount.toLocaleString("vi-VN")}`).join(", ");

        message = `Trong năm ${year}, ${detailText} → tổng: ${totalAmount.toLocaleString("vi-VN")} VND.`;

        fromData = {
          periodType: "year",
          periodKey: fromPeriodKey,
          totalAmount,
          itemsCount: monthlyData.filter((m) => m.amount > 0).length,
        };

        // Suggestion là tính tổng từ 12 tháng
        suggestions = [{ periodKey: fromPeriodKey, amount: totalAmount, note: "" }];

        return res.json({
          success: true,
          canAllocate: totalAmount > 0,
          message,
          fromData,
          suggestions,
        });
      } else {
        return res.json({
          success: true,
          canAllocate: false,
          message: `Năm ${year} không có dữ liệu chi phí từ các tháng`,
          suggestions: [],
        });
      }
    }

    // ===== CASE 2-4: Phân bổ từ period có sẵn =====
    if (fromPeriodType === "year" && toPeriodType === "quarter") {
      // Year → Quarter: chia 4 quý
      const year = fromPeriodKey;
      targetPeriods = ["Q1", "Q2", "Q3", "Q4"].map((q) => `${year}-${q}`);
      message = `${formatPeriodVN("year", year)} có tổng ${fromTotal.toLocaleString("vi-VN")} VND. Bạn có muốn phân bổ đều ra 4 quý không?`;
    } else if (fromPeriodType === "year" && toPeriodType === "month") {
      // Year → Month: chia 12 tháng
      const year = fromPeriodKey;
      for (let m = 1; m <= 12; m++) {
        const month = String(m).padStart(2, "0");
        targetPeriods.push(`${year}-${month}`);
      }
      message = `${formatPeriodVN("year", year)} có tổng ${fromTotal.toLocaleString("vi-VN")} VND. Bạn có muốn phân bổ đều ra 12 tháng không?`;
    }
    // ========== Case 3: Month → Year (Aggregation) ==========
    else if (fromPeriodType === "month" && toPeriodType === "year") {
      const [fromYear] = fromPeriodKey.split("-");
      const toYear = fromYear; // Year phải cùng năm

      // Fetch tất cả 12 tháng của năm đó
      const allMonths = [];
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${fromYear}-${String(m).padStart(2, "0")}`;
        allMonths.push(monthKey);
      }

      // Query tất cả expense records cho 12 tháng
      const monthRecords = await OperatingExpense.find({
        storeId: new mongoose.Types.ObjectId(storeId),
        periodType: "month",
        periodKey: { $in: allMonths },
        isDeleted: false,
      });

      // Tính tổng từ tất cả tháng (có hay không có tiền)
      let totalAmount = 0;
      const monthDetails = {};

      for (const monthKey of allMonths) {
        const record = monthRecords.find((r) => r.periodKey === monthKey);
        const monthTotal = record ? record.totalAmount : 0;
        totalAmount += monthTotal;
        monthDetails[monthKey] = monthTotal;
      }

      return res.json({
        canAllocate: true,
        message: `Gợi ý tổng hợp từ 12 tháng năm ${fromYear} lên năm ${toYear}. Tổng chi phí: ${totalAmount.toLocaleString("vi-VN")} VND`,
        suggestions: [
          {
            periodKey: toYear,
            amount: totalAmount,
            type: "aggregated",
          },
        ],
        monthDetails,
      });
    }
    // ========== Case 4: Month → Quarter (Aggregation) ==========
    else if (fromPeriodType === "month" && toPeriodType === "quarter") {
      const [fromYear, fromMonth] = fromPeriodKey.split("-");
      const monthNum = parseInt(fromMonth, 10);

      // Xác định quý từ tháng
      let quarterNum;
      if (monthNum <= 3) quarterNum = 1;
      else if (monthNum <= 6) quarterNum = 2;
      else if (monthNum <= 9) quarterNum = 3;
      else quarterNum = 4;

      const quarterKey = `${fromYear}-Q${quarterNum}`;
      const quarterMonths = getMonthsFromQuarter(`Q${quarterNum}`);
      const allMonthKeys = quarterMonths.map((m) => `${fromYear}-${m}`);

      // Query tất cả expense records cho 3 tháng của quý
      const monthRecords = await OperatingExpense.find({
        storeId: new mongoose.Types.ObjectId(storeId),
        periodType: "month",
        periodKey: { $in: allMonthKeys },
        isDeleted: false,
      });

      // Tính tổng từ 3 tháng
      let totalAmount = 0;
      const monthDetails = {};

      for (const monthKey of allMonthKeys) {
        const record = monthRecords.find((r) => r.periodKey === monthKey);
        const monthTotal = record ? record.totalAmount : 0;
        totalAmount += monthTotal;
        monthDetails[monthKey] = monthTotal;
      }

      return res.json({
        canAllocate: true,
        message: `Gợi ý tổng hợp từ 3 tháng (${allMonthKeys.join(", ")}) lên ${formatPeriodVN(
          "quarter",
          quarterKey
        )}. Tổng chi phí: ${totalAmount.toLocaleString("vi-VN")} VND`,
        suggestions: [
          {
            periodKey: quarterKey,
            amount: totalAmount,
            type: "aggregated",
          },
        ],
        monthDetails,
      });
    } else if (fromPeriodType === "quarter" && toPeriodType === "month") {
      // Quarter → Month: chia 3 tháng
      const match = fromPeriodKey.match(/^(\d{4})-(Q[1-4])$/);
      if (!match) {
        return res.status(400).json({ message: "Định dạng periodKey không hợp lệ" });
      }
      const year = match[1];
      const quarter = match[2];
      const months = getMonthsFromQuarter(quarter);
      targetPeriods = months.map((m) => `${year}-${m}`);
      message = `${formatPeriodVN("quarter", fromPeriodKey)} có tổng ${fromTotal.toLocaleString(
        "vi-VN"
      )} VND. Bạn có muốn phân bổ đều ra 3 tháng (${targetPeriods.join(", ")}) không?`;
    } else {
      // Không hỗ trợ phân bổ theo hướng này
      return res.json({
        success: true,
        canAllocate: false,
        message: `Không hỗ trợ phân bổ từ ${periodTypeVN(fromPeriodType)} sang ${periodTypeVN(toPeriodType)}`,
        suggestions: [],
      });
    }

    // ========== VALIDATION SCOPE: Kiểm tra periodKey hiện tại có nằm trong target range không ==========
    // Nếu không nằm trong → không gợi ý
    if (targetPeriods.length > 0 && !targetPeriods.includes(fromPeriodKey)) {
      return res.json({
        success: true,
        canAllocate: false,
        message: `${formatPeriodVN(fromPeriodType, fromPeriodKey)} không nằm trong phạm vi ${formatPeriodVN(
          toPeriodType,
          targetPeriods[0] || ""
        )}. Không thể gợi ý phân bổ.`,
        suggestions: [],
      });
    }

    // Tính suggestion: chia đều
    const perUnit = fromTotal / targetPeriods.length;
    suggestions = targetPeriods.map((period, idx) => {
      const amount =
        idx === targetPeriods.length - 1
          ? fromTotal - perUnit * (targetPeriods.length - 1) // Tháng cuối cộng phần dư
          : perUnit;
      return {
        periodKey: period,
        amount: Math.round(amount * 100) / 100, // Làm tròn 2 chữ số thập phân
        note: "",
      };
    });

    return res.json({
      success: true,
      canAllocate: true,
      message,
      fromData: fromData || {
        periodType: fromPeriodType,
        periodKey: fromPeriodKey,
        totalAmount: fromTotal,
        itemsCount: fromDoc.items.length,
      },
      suggestions,
    });
  } catch (error) {
    console.error("operatingExpenseController.suggestAllocation:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ========== EXECUTE: Thực hiện phân bổ chi phí ==========
const executeAllocation = async (req, res) => {
  try {
    const { storeId, fromPeriodType, fromPeriodKey, allocations } = req.body;
    const userId = req.user?._id;

    if (!storeId || !fromPeriodType || !fromPeriodKey || !Array.isArray(allocations)) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
    }

    // Lấy dữ liệu từ source period
    const fromDoc = await OperatingExpense.findOne({
      storeId,
      periodType: fromPeriodType,
      periodKey: fromPeriodKey,
      isDeleted: false,
    });

    if (!fromDoc) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu nguồn để phân bổ" });
    }

    const createdRecords = [];

    // ========== CASE 1: Month → Year (Aggregation) ==========
    if (fromPeriodType === "month" && allocations.length > 0) {
      // Check xem allocations có chứa year periodKey không (format YYYY)
      const yearAllocation = allocations.find((a) => /^\d{4}$/.test(a.periodKey));

      if (yearAllocation) {
        const [fromYear] = fromPeriodKey.split("-"); // "2025-01" → "2025"
        const targetYear = yearAllocation.periodKey; // "2025"

        if (fromYear === targetYear) {
          // Lấy hoặc tạo record cho năm đó
          let yearDoc = await OperatingExpense.findOne({
            storeId,
            periodType: "year",
            periodKey: targetYear,
            isDeleted: false,
          });

          if (!yearDoc) {
            yearDoc = new OperatingExpense({
              storeId,
              periodType: "year",
              periodKey: targetYear,
              items: [],
              status: "active",
              createdBy: userId,
              updatedBy: userId,
            });
          }

          // Add item aggregated từ 12 tháng
          yearDoc.items.push({
            amount: yearAllocation.amount,
            note: yearAllocation.note || `Tổng hợp từ 12 tháng năm ${targetYear}`,
            isSaved: true,
          });

          yearDoc.updatedBy = userId;
          await yearDoc.save();
          createdRecords.push(yearDoc);
        } else {
          return res.status(400).json({
            success: false,
            message: `Năm tổng hợp không khớp: ${fromYear} !== ${targetYear}`,
          });
        }
      }
    }

    // ========== CASE 2: Month → Quarter (Aggregation) ==========
    if (fromPeriodType === "month" && allocations.length > 0) {
      // Check xem allocations có chứa quarter periodKey không (format YYYY-Qn)
      const quarterAllocations = allocations.filter((a) => /^\d{4}-Q[1-4]$/.test(a.periodKey));

      for (const quarterAlloc of quarterAllocations) {
        const quarterKey = quarterAlloc.periodKey; // "2025-Q1"
        const [year, quarter] = quarterKey.split("-");
        const [fromYear] = fromPeriodKey.split("-");

        if (fromYear !== year) {
          continue; // Skip nếu năm không khớp
        }

        // Lấy hoặc tạo record cho quý đó
        let quarterDoc = await OperatingExpense.findOne({
          storeId,
          periodType: "quarter",
          periodKey: quarterKey,
          isDeleted: false,
        });

        if (!quarterDoc) {
          quarterDoc = new OperatingExpense({
            storeId,
            periodType: "quarter",
            periodKey: quarterKey,
            items: [],
            status: "active",
            createdBy: userId,
            updatedBy: userId,
          });
        }

        // Add item aggregated từ 3 tháng của quý
        quarterDoc.items.push({
          amount: quarterAlloc.amount,
          note: quarterAlloc.note || `Tổng hợp từ 3 tháng ${quarter} năm ${year}`,
          isSaved: true,
        });

        quarterDoc.updatedBy = userId;
        await quarterDoc.save();
        createdRecords.push(quarterDoc);
      }
    }

    // ========== CASE 3-5: Phân bổ (Year→Quarter, Year→Month, Quarter→Month) ==========
    for (const alloc of allocations) {
      const { periodKey: toPeriodKey, amount, note } = alloc;

      // Skip year & quarter allocations nếu là month→year/quarter case (đã xử lý ở trên)
      if (fromPeriodType === "month" && (/^\d{4}$/.test(toPeriodKey) || /^\d{4}-Q[1-4]$/.test(toPeriodKey))) {
        continue;
      }

      // Xác định toPeriodType từ format periodKey
      let toPeriodType = "month";
      if (toPeriodKey.includes("Q")) toPeriodType = "quarter";
      if (/^\d{4}$/.test(toPeriodKey)) toPeriodType = "year";

      // Kiểm tra record đã tồn tại
      const existing = await OperatingExpense.findOne({
        storeId,
        periodType: toPeriodType,
        periodKey: toPeriodKey,
        isDeleted: false,
      });

      if (existing) {
        // Record đã tồn tại → thêm item vào
        existing.items.push({
          amount,
          note: note || `Phân bổ từ ${formatPeriodVN(fromPeriodType, fromPeriodKey)}`,
          isSaved: true,
        });
        existing.updatedBy = userId;
        await existing.save();
        createdRecords.push(existing);
      } else {
        // Tạo record mới
        const newRecord = new OperatingExpense({
          storeId,
          periodType: toPeriodType,
          periodKey: toPeriodKey,
          items: [
            {
              amount,
              note: note || `Phân bổ từ ${formatPeriodVN(fromPeriodType, fromPeriodKey)}`,
              isSaved: true,
            },
          ],
          status: "active",
          createdBy: userId,
          updatedBy: userId,
        });
        await newRecord.save();
        createdRecords.push(newRecord);
      }
    }

    return res.json({
      success: true,
      message: `Phân bổ thành công ${createdRecords.length} khoảng thời gian`,
      createdRecords,
    });
  } catch (error) {
    console.error("operatingExpenseController.executeAllocation:", error);
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
  suggestAllocation,
  executeAllocation,
};

{/* 
Có thông báo cho phạm vi của period, ví dụ quý 1 chỉ hiển thị thông báo với tháng 1 2 3, không hiện tháng 4 5 6,...

Quarter → Month: Q1 → chỉ hiển thị với T1/T2/T3
Year → Month: Year → hiển thị với tất cả T1-T12 (tất cả hợp lệ)
Year → Quarter: Year → hiển thị với tất cả Q1-Q4 (tất cả hợp lệ)
Month → Quarter: T1-T3 → chỉ hiển thị khi chuyển sang Q1
Month → Year: T1-T12 → hiển thị với Year (tất cả hợp lệ)

| #   | Case            | Validation Check                  | Kết quả                 | Status |
| --- | --------------- | --------------------------------- | ----------------------- | ------ |
| 1️⃣ | Year → Year     | Tất cả hợp lệ (tương tự năm)      | Luôn hiển thị ✅         | ✅      |
| 2️⃣ | Year → Quarter  | [Q1,Q2,Q3,Q4] → tất cả hợp lệ     | Luôn hiển thị ✅         | ✅      |
| 3️⃣ | Year → Month    | [T1-T12] → tất cả hợp lệ          | Luôn hiển thị ✅         | ✅      |
| 4️⃣ | Month → Year    | Cùng năm + tất cả T1-T12 hợp lệ   | Luôn hiển thị ✅         | ✅      |
| 5️⃣ | Month → Quarter | T1-T3→Q1, T4-T6→Q2, ...           | ✅ T1-T3 show / T4+ hide | ✅      |
| 6️⃣ | Quarter → Month | Q1→[T1,T2,T3], Q2→[T4,T5,T6], ... | ✅ T1-T3 show / T4+ hide | ✅      |

*/} 