const ProductGroup = require("../../models/ProductGroup");
const Store = require("../../models/Store");
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Product = require("../../models/Product");
const logActivity = require("../../utils/logActivity");
const path = require("path");
const {
  parseExcelToJSON,
  validateRequiredFields,
  sanitizeData,
} = require("../../utils/fileImport");

// ============= CREATE =============
const createProductGroup = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON",
      });
    }

    const { name, description } = req.body;
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Tên nhóm sản phẩm là bắt buộc" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    const existingGroup = await ProductGroup.findOne({
      name: name.trim(),
      storeId: storeId,
      isDeleted: false,
    });
    if (existingGroup) {
      return res.status(409).json({
        message: "Nhóm sản phẩm với tên này đã tồn tại trong cửa hàng",
      });
    }

    const newProductGroup = new ProductGroup({
      name: name.trim(),
      description: description ? description.trim() : "",
      storeId: storeId,
    });
    await newProductGroup.save();

    const populatedGroup = await ProductGroup.findOne({
      _id: newProductGroup._id,
      isDeleted: false,
    }).populate("storeId", "name address phone");

    const formattedGroup = {
      _id: populatedGroup._id,
      name: populatedGroup.name,
      description: populatedGroup.description,
      createdAt: populatedGroup.createdAt,
      updatedAt: populatedGroup.updatedAt,
      store: populatedGroup.storeId,
    };

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "ProductGroup",
      entityId: newProductGroup._id,
      entityName: newProductGroup.name,
      req,
      description: `Tạo nhóm sản phẩm "${newProductGroup.name}" trong cửa hàng`,
    });

    res.status(201).json({
      message: "Tạo nhóm sản phẩm thành công",
      productGroup: formattedGroup,
    });
  } catch (error) {
    console.error("❌ Lỗi createProductGroup:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy tất cả nhóm sản phẩm của store ============
const getProductGroupsByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId);
    if (!store)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });

    const productGroups = await ProductGroup.find({ storeId, isDeleted: false })
      .populate("storeId", "name address phone")
      .sort({ createdAt: -1 });

    const formattedGroups = await Promise.all(
      productGroups.map(async (group) => {
        const productCount = await Product.countDocuments({
          group_id: group._id,
          isDeleted: false,
        });
        return {
          _id: group._id,
          name: group.name,
          description: group.description,
          productCount,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
          store: group.storeId,
        };
      })
    );

    res.status(200).json({
      message: "Lấy danh sách nhóm sản phẩm thành công",
      total: formattedGroups.length,
      productGroups: formattedGroups,
    });
  } catch (error) {
    console.error("❌ Lỗi getProductGroupsByStore:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy chi tiết một nhóm sản phẩm ============
const getProductGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;

    const productGroup = await ProductGroup.findOne({
      _id: groupId,
      isDeleted: false,
    }).populate("storeId", "name address phone");

    if (!productGroup)
      return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });

    const productCount = await Product.countDocuments({
      group_id: groupId,
      isDeleted: false,
    });

    res.status(200).json({
      message: "Lấy thông tin nhóm sản phẩm thành công",
      productGroup: {
        _id: productGroup._id,
        name: productGroup.name,
        description: productGroup.description,
        productCount,
        createdAt: productGroup.createdAt,
        updatedAt: productGroup.updatedAt,
        store: productGroup.storeId,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi getProductGroupById:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE ============
const updateProductGroup = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "Dữ liệu request body trống" });
    }

    const { groupId } = req.params;
    const { name, description } = req.body;

    const productGroup = await ProductGroup.findOne({
      _id: groupId,
      isDeleted: false,
    });
    if (!productGroup)
      return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });

    if (name && name.trim() !== productGroup.name) {
      const existingGroup = await ProductGroup.findOne({
        name: name.trim(),
        storeId: productGroup.storeId,
        _id: { $ne: groupId },
        isDeleted: false,
      });
      if (existingGroup) {
        return res
          .status(409)
          .json({ message: "Nhóm sản phẩm với tên này đã tồn tại" });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description ? description.trim() : "";

    const updatedGroup = await ProductGroup.findByIdAndUpdate(
      groupId,
      updateData,
      { new: true }
    ).populate("storeId", "name address phone");

    const productCount = await Product.countDocuments({
      group_id: groupId,
      isDeleted: false,
    });

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: productGroup.storeId._id },
      action: "update",
      entity: "ProductGroup",
      entityId: productGroup._id,
      entityName: updatedGroup.name,
      req,
      description: `Cập nhật nhóm sản phẩm "${updatedGroup.name}"`,
    });

    res.status(200).json({
      message: "Cập nhật nhóm sản phẩm thành công",
      productGroup: {
        _id: updatedGroup._id,
        name: updatedGroup.name,
        description: updatedGroup.description,
        productCount,
        createdAt: updatedGroup.createdAt,
        updatedAt: updatedGroup.updatedAt,
        store: updatedGroup.storeId,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi updateProductGroup:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE ============
const deleteProductGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const productGroup = await ProductGroup.findOne({
      _id: groupId,
      isDeleted: false,
    });
    if (!productGroup)
      return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });

    const productsInGroup = await Product.countDocuments({
      group_id: groupId,
      isDeleted: false,
    });
    if (productsInGroup > 0) {
      return res.status(400).json({
        message: `Không thể xóa nhóm sản phẩm này vì có ${productsInGroup} sản phẩm đang sử dụng`,
      });
    }

    productGroup.isDeleted = true;
    await productGroup.save();
    //log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: productGroup.storeId._id },
      action: "delete",
      entity: "ProductGroup",
      entityId: productGroup._id,
      entityName: productGroup.name,
      req,
      description: `Xóa nhóm sản phẩm "${productGroup.name}"`,
    });

    res.status(200).json({
      message: "Xóa nhóm sản phẩm thành công",
      deletedGroupId: groupId,
    });
  } catch (error) {
    console.error("❌ Lỗi deleteProductGroup:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Import Product Groups from Excel/CSV
const importProductGroups = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên file" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    const data = await parseExcelToJSON(req.file.buffer);

    if (data.length === 0) {
      return res
        .status(400)
        .json({ message: "File không chứa dữ liệu hợp lệ" });
    }

    const results = { success: [], failed: [], total: data.length };

    for (let i = 0; i < data.length; i++) {
      const row = sanitizeData(data[i]);
      const rowNumber = i + 2;

      try {
        const validation = validateRequiredFields(row, ["Tên nhóm sản phẩm"]);
        if (!validation.isValid) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Thiếu: ${validation.missingFields.join(", ")}`,
          });
          continue;
        }

        const name = row["Tên nhóm sản phẩm"].trim();

        const existingGroup = await ProductGroup.findOne({
          name: name,
          storeId: storeId,
          isDeleted: false,
        });

        if (existingGroup) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Nhóm sản phẩm đã tồn tại: ${name}`,
          });
          continue;
        }

        const newGroup = new ProductGroup({
          name: name,
          description: row["Mô tả"] || "",
          storeId: storeId,
        });

        await newGroup.save();
        results.success.push({
          row: rowNumber,
          group: { _id: newGroup._id, name: newGroup.name },
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    res.status(200).json({ message: "Import hoàn tất", results });
  } catch (error) {
    console.error("Lỗi importProductGroups:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Download Product Group Template
const downloadProductGroupTemplate = (req, res) => {
  const filePath = path.resolve(
    __dirname,
    "../../templates/product_group_template.xlsx"
  );

  return res.sendFile(
    filePath,
    {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          "attachment; filename=product_group_template.xlsx",
      },
    },
    (err) => {
      if (err) {
        console.error("Lỗi downloadProductGroupTemplate:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Lỗi server", error: err.message });
        }
      }
    }
  );
};

module.exports = {
  createProductGroup,
  getProductGroupsByStore,
  getProductGroupById,
  updateProductGroup,
  deleteProductGroup,
  importProductGroups,
  downloadProductGroupTemplate,
};
