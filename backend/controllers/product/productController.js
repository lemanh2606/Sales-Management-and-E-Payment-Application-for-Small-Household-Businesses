// controllers/productController.js
const mongoose = require("mongoose");
const Product = require("../../models/Product");
const ProductGroup = require("../../models/ProductGroup");
const Store = require("../../models/Store");
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Supplier = require("../../models/Supplier");
const logActivity = require("../../utils/logActivity");
const InventoryVoucher = require("../../models/InventoryVoucher");
const Warehouse = require("../../models/Warehouse"); // Imported logic
const path = require("path");
const { sendEmptyNotificationWorkbook } = require("../../utils/excelExport");
const { cloudinary, deleteFromCloudinary } = require("../../utils/cloudinary");
const {
  parseExcelToJSON,
  validateRequiredFields,
  validateNumericField,
  sanitizeData,
} = require("../../utils/fileImport");

// ============= HELPER FUNCTIONS =============
const PRODUCT_HEADERS = [
  "Tên sản phẩm",
  "Mô tả",
  "Mã SKU",
  "Giá bán",
  "Giá vốn",
  "Tồn kho",
  "Tồn kho tối thiểu",
  "Tồn kho tối đa",
  "Đơn vị",
  "Trạng thái",
  "Nhà cung cấp",
  "Nhóm sản phẩm",
  "Tên kho",
  "Địa chỉ kho",
  "Người quản lý kho",
  "SĐT kho",
  "Số lô",
  "Hạn sử dụng",
  "Thuế GTGT (%)",
  "Xuất xứ",
  "Thương hiệu",
  "Bảo hành",
  "Số chứng từ",
  "Ngày chứng từ",
  "Ngày thêm",
  "Người giao",
  "Người nhận",
];

// ============= HELPER FUNCTIONS =============
const generateSKU = async (storeId) => {
  // Find the max SKU matching "SP" + digits
  const lastProduct = await Product.findOne({
    store_id: storeId,
    sku: { $regex: /^SP\d+$/ },
  }).sort({ sku: -1 });

  let nextNumber = 1;

  if (lastProduct && lastProduct.sku) {
    const lastNumber = parseInt(lastProduct.sku.replace("SP", ""));
    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  // Ensure uniqueness loop
  while (true) {
    let paddingLength = 6;
    if (nextNumber > 999999)
      paddingLength = Math.max(6, nextNumber.toString().length);
    const sku = `SP${String(nextNumber).padStart(paddingLength, "0")}`;

    const exists = await Product.exists({ store_id: storeId, sku });
    if (!exists) return sku;
    nextNumber++;
  }
};

// ============= CREATE - Tạo sản phẩm mới =============
const createProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("----- CREATE PRODUCT REQUEST -----");
    console.log("User:", req.user?.id || req.user?._id);
    console.log("storeId param:", req.params.storeId);
    console.log("req.body keys:", Object.keys(req.body || {}));
    console.log("req.body sample:", req.body);
    console.log("req.file (multer):", req.file);

    const { storeId } = req.params;
    const userId = req.user?.id || req.user?._id;

    // ===== Validate cơ bản =====
    if (!storeId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    // IMPORTANT:
    // Với multipart/form-data, đôi lúc req.body ít key / rỗng nhưng vẫn có req.file (multer)
    if ((!req.body || Object.keys(req.body).length === 0) && !req.file) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message:
          "Thiếu dữ liệu. Nếu upload ảnh, hãy gửi multipart/form-data gồm các field + file.",
      });
    }

    // Multer + form-data: tất cả text field thường là string => parse số
    // THÊM: default_warehouse_id, default_warehouse_name từ form
    const {
      name,
      description,
      sku,
      price,
      cost_price,
      stock_quantity,
      min_stock,
      max_stock,
      unit,
      status,
      supplier_id,
      group_id,
      default_warehouse_id,
      default_warehouse_name,
      // Legal fields
      tax_rate,
      origin,
      brand,
      warranty_period,
    } = req.body || {};

    if (!name || price === undefined || cost_price === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Tên sản phẩm, giá bán và giá vốn là bắt buộc" });
    }

    const priceNum = Number(price);
    const costNum = Number(cost_price);

    if (!Number.isFinite(priceNum) || priceNum < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    }

    if (!Number.isFinite(costNum) || costNum < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Giá vốn phải là số dương" });
    }

    // UI vẫn gửi stock_quantity => coi là "tồn đầu kỳ"
    const openingQty =
      stock_quantity !== undefined &&
      stock_quantity !== null &&
      stock_quantity !== ""
        ? Number(stock_quantity)
        : 0;

    if (!Number.isFinite(openingQty) || openingQty < 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Số lượng tồn kho phải là số không âm" });
    }

    if (min_stock !== undefined && min_stock !== null && min_stock !== "") {
      const minNum = Number(min_stock);
      if (!Number.isFinite(minNum) || minNum < 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Tồn kho tối thiểu phải là số không âm" });
      }
    }

    if (max_stock !== undefined && max_stock !== null && max_stock !== "") {
      const maxNum = Number(max_stock);
      if (!Number.isFinite(maxNum) || maxNum < 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Tồn kho tối đa phải là số không âm" });
      }
    }

    if (
      min_stock !== undefined &&
      min_stock !== null &&
      min_stock !== "" &&
      max_stock !== undefined &&
      max_stock !== null &&
      max_stock !== ""
    ) {
      const minNum = Number(min_stock);
      const maxNum = Number(max_stock);
      if (
        Number.isFinite(minNum) &&
        Number.isFinite(maxNum) &&
        minNum > maxNum
      ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Tồn kho tối thiểu không thể lớn hơn tồn kho tối đa",
        });
      }
    }

    if (
      status &&
      !["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].includes(status)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Trạng thái sản phẩm không hợp lệ" });
    }

    // ===== Validate user/store =====
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const store = await Store.findById(storeId).session(session);
    if (!store) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // ===== Validate group/supplier =====
    if (group_id) {
      const productGroup = await ProductGroup.findOne({
        _id: group_id,
        isDeleted: false,
      }).session(session);

      if (!productGroup) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
      }

      // hỗ trợ cả storeId/store_id/storeid (tránh mismatch)
      const pgStoreId =
        productGroup.storeId || productGroup.store_id || productGroup.storeid;

      if (pgStoreId && pgStoreId.toString() !== storeId) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Nhóm sản phẩm không thuộc cửa hàng này" });
      }
    }

    if (supplier_id) {
      const supplier = await Supplier.findOne({
        _id: supplier_id,
        isDeleted: false,
      }).session(session);

      if (!supplier) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
      }

      const supStoreId =
        supplier.store_id || supplier.storeid || supplier.storeId;
      if (supStoreId && supStoreId.toString() !== storeId) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Nhà cung cấp không thuộc cửa hàng này" });
      }
    }

    // SKU uniqueness check removed per user request: "vẫn cho trùng sku như cũ"
    const productSKU = sku || (await generateSKU(storeId));

    // ===== CHUẨN BỊ THÔNG TIN KHO MẶC ĐỊNH =====
    // Ưu tiên: 1. từ form → 2. từ store → 3. null
    let finalDefaultWarehouseId = default_warehouse_id || null;
    let finalDefaultWarehouseName = default_warehouse_name || "";

    if (!finalDefaultWarehouseId && store.default_warehouse_id) {
      finalDefaultWarehouseId = store.default_warehouse_id;
      finalDefaultWarehouseName =
        store.default_warehouse_name || "Kho mặc định cửa hàng";
    }

    console.log(" Kho mặc định được chọn:", {
      warehouse_id: finalDefaultWarehouseId,
      warehouse_name: finalDefaultWarehouseName,
    });

    // ===== Tạo Product (Hướng B: luôn stock_quantity = 0) =====
    const productData = {
      name,
      description,
      sku: productSKU,
      price: priceNum,
      cost_price: costNum,

      // Quan trọng: không set tồn trực tiếp từ form
      stock_quantity: 0,

      min_stock:
        min_stock !== undefined && min_stock !== null && min_stock !== ""
          ? Number(min_stock)
          : 0,
      max_stock:
        max_stock !== undefined && max_stock !== null && max_stock !== ""
          ? Number(max_stock)
          : null,
      unit,
      status: status || "Đang kinh doanh",
      store_id: storeId,
      supplier_id: supplier_id || null,
      group_id: group_id || null,
      createdBy: userId,

      //  GẮN KHO MẶC ĐỊNH VÀO PRODUCT
      default_warehouse_id: finalDefaultWarehouseId,
      default_warehouse_name: finalDefaultWarehouseName,

      //  LEGAL FIELDS
      tax_rate: tax_rate !== undefined ? Number(tax_rate) : 0,
      origin: origin || "",
      brand: brand || "",
      warranty_period: warranty_period || "",
    };

    // ===== IMAGE: lưu đúng schema image.publicid + image.url =====
    if (req.file) {
      const imageUrl =
        req.file.path || req.file.secure_url || req.file.url || "";

      const publicid =
        req.file.filename ||
        req.file.public_id ||
        req.file.key ||
        (imageUrl ? imageUrl.split("/").pop().split(".")[0] : "");

      productData.image = {
        url: imageUrl,
        publicid: publicid || null,
      };

      console.log("Ảnh sản phẩm đã upload:", productData.image);
    }

    const newProduct = new Product(productData);
    await newProduct.save({ session });

    // ===== Nếu có openingQty => tạo phiếu nhập kho tồn đầu kỳ + POST =====
    let createdVoucher = null;

    if (openingQty > 0) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");

      const voucherCode = `NK-${y}${m}${d}-${newProduct.sku}-${Date.now()}`;

      createdVoucher = new InventoryVoucher({
        store_id: storeId,
        type: "IN",
        status: "POSTED",
        voucher_code: voucherCode,
        voucher_date: now,
        reason: "Tồn đầu kỳ khi tạo sản phẩm",

        //  GẮN KHO CHO PHIẾU (level header)
        warehouse_id: finalDefaultWarehouseId || null,
        warehouse_name: finalDefaultWarehouseName || "",

        ref_type: "PRODUCT_CREATE",
        ref_id: newProduct._id,

        created_by: userId,
        posted_by: userId,
        posted_at: now,

        items: [
          {
            product_id: newProduct._id,
            sku_snapshot: newProduct.sku,
            name_snapshot: newProduct.name,
            unit_snapshot: newProduct.unit || "",

            //  GẮN KHO CHO TỪNG DÒNG ITEM
            warehouse_id: finalDefaultWarehouseId || null,
            warehouse_name: finalDefaultWarehouseName || "",

            qty_document: openingQty,
            qty_actual: openingQty,

            unit_cost: mongoose.Types.Decimal128.fromString(String(costNum)),
            note: "Tồn ban đầu từ màn tạo sản phẩm",
          },
        ],
      });

      await createdVoucher.save({ session });

      await createdVoucher.save({ session });

      // ===== UPDATE STOCK & INITIAL BATCH =====
      // Tạo batch mặc định cho tồn đầu kỳ
      await Product.updateOne(
        { _id: newProduct._id, store_id: storeId, isDeleted: false },
        {
          $inc: { stock_quantity: openingQty },
          $push: {
            batches: {
              batch_no: `BATCH-INIT-${Date.now()}`,
              expiry_date: null, // Mặc định null nếu form không nhập
              cost_price: costNum, // Giá vốn nhập ban đầu
              quantity: openingQty,
              warehouse_id: finalDefaultWarehouseId,
              created_at: now,
            },
          },
        },
        { session }
      );
    }

    // ===== Commit transaction =====
    await session.commitTransaction();
    session.endSession();

    const populatedProduct = await Product.findOne({
      _id: newProduct._id,
      isDeleted: false,
    })
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "Product",
      entityId: newProduct._id,
      entityName: newProduct.name,
      req,
      description: `Tạo mới sản phẩm ${newProduct.name} (SKU: ${newProduct.sku}) tại cửa hàng ${storeId}`,
    });

    if (createdVoucher) {
      await logActivity({
        user: req.user,
        store: { _id: storeId },
        action: "create",
        entity: "InventoryVoucher",
        entityId: createdVoucher._id,
        entityName: `Phiếu nhập kho ${createdVoucher.voucher_code}`,
        req,
        description: `Nhập tồn đầu kỳ khi tạo sản phẩm ${
          newProduct.name
        } (SKU: ${newProduct.sku}) số lượng ${openingQty} ${
          finalDefaultWarehouseName
            ? `tại kho ${finalDefaultWarehouseName}`
            : ""
        }`,
      });
    }

    return res.status(201).json({
      message: "Tạo sản phẩm thành công",
      product: populatedProduct,
      openingStock: openingQty,
      inventoryVoucher: createdVoucher
        ? {
            _id: createdVoucher._id,
            voucher_code: createdVoucher.voucher_code,
            type: createdVoucher.type,
            status: createdVoucher.status,
            voucher_date: createdVoucher.voucher_date,
            //  TRẢ VỀ THÔNG TIN KHO
            warehouse_id: createdVoucher.warehouse_id,
            warehouse_name: createdVoucher.warehouse_name,
          }
        : null,
    });
  } catch (error) {
    console.error(" Lỗi createProduct:", error);

    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật sản phẩm đầy đủ =============
const updateProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // để xóa cloudinary sau commit (tránh xóa xong mà DB rollback)
  let oldImagePublicIdToDelete = null;

  try {
    // IMPORTANT:
    // multipart/form-data có thể body ít key/rỗng nhưng vẫn có file (multer)
    if ((!req.body || Object.keys(req.body).length === 0) && !req.file) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Thiếu dữ liệu cập nhật" });
    }

    const { productId } = req.params;
    const { storeId } = req.query; // optional
    const userId = req.user?.id || req.user?._id;

    // THÊM: default_warehouse_id, default_warehouse_name từ form
    const {
      name,
      description,
      sku,
      price,
      cost_price,
      stock_quantity, // nếu có => sẽ tạo phiếu điều chỉnh theo delta
      min_stock,
      max_stock,
      unit,
      status,
      supplier_id,
      group_id,
      default_warehouse_id,
      default_warehouse_name,
      // Legal
      tax_rate,
      origin,
      brand,
      warranty_period,
    } = req.body || {};

    // ===== Check user =====
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // ===== Load product (kèm store) =====
    const productQuery = { _id: productId, isDeleted: false };
    if (storeId) productQuery.store_id = storeId;

    const product = await Product.findOne(productQuery)
      .session(session)
      .populate(
        "store_id",
        "owner_id name default_warehouse_id default_warehouse_name"
      );

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    const productStoreId =
      product.store_id?._id?.toString() || product.store_id?.toString();

    // ===== Validate numeric fields =====
    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Giá bán phải là số dương" });
      }
    }

    if (cost_price !== undefined) {
      const costNum = Number(cost_price);
      if (!Number.isFinite(costNum) || costNum < 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Giá vốn phải là số dương" });
      }
    }

    // Hướng B: stock_quantity khi update => hiểu là "set tồn hiện tại"
    let targetStockQty = null;
    if (stock_quantity !== undefined) {
      const sq = Number(stock_quantity);
      if (!Number.isFinite(sq) || sq < 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Số lượng tồn kho phải là số không âm" });
      }
      targetStockQty = sq;
    }

    if (min_stock !== undefined) {
      const minNum = Number(min_stock);
      if (!Number.isFinite(minNum) || minNum < 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Tồn kho tối thiểu phải là số không âm" });
      }
    }

    if (max_stock !== undefined) {
      const maxNum = Number(max_stock);
      if (!Number.isFinite(maxNum) || maxNum < 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Tồn kho tối đa phải là số không âm" });
      }
    }

    if (min_stock !== undefined && max_stock !== undefined) {
      const minNum = Number(min_stock);
      const maxNum = Number(max_stock);
      if (
        Number.isFinite(minNum) &&
        Number.isFinite(maxNum) &&
        minNum > maxNum
      ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Tồn kho tối thiểu không thể lớn hơn tồn kho tối đa",
        });
      }
    }

    if (
      status &&
      !["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].includes(status)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Trạng thái sản phẩm không hợp lệ" });
    }

    // SKU uniqueness check removed per user request: "vẫn cho trùng sku như cũ"

    // ===== Validate group/supplier =====
    if (group_id) {
      const productGroup = await ProductGroup.findOne({
        _id: group_id,
        isDeleted: false,
      }).session(session);

      if (!productGroup) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
      }

      const pgStoreId =
        productGroup.storeId || productGroup.store_id || productGroup.storeid;

      if (pgStoreId && pgStoreId.toString() !== productStoreId) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Nhóm sản phẩm không thuộc cửa hàng này" });
      }
    }

    if (supplier_id) {
      const supplier = await Supplier.findOne({
        _id: supplier_id,
        isDeleted: false,
      }).session(session);

      if (!supplier) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
      }

      const supStoreId =
        supplier.store_id || supplier.storeid || supplier.storeId;
      if (supStoreId && supStoreId.toString() !== productStoreId) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "Nhà cung cấp không thuộc cửa hàng này" });
      }
    }

    // ===== CHUẨN BỊ THÔNG TIN KHO MẶC ĐỊNH (nếu update kho) =====
    let finalDefaultWarehouseId = product.default_warehouse_id;
    let finalDefaultWarehouseName = product.default_warehouse_name || "";

    if (default_warehouse_id !== undefined) {
      finalDefaultWarehouseId = default_warehouse_id || null;
      finalDefaultWarehouseName = default_warehouse_name || "";

      // Nếu không gửi từ form nhưng có store default → fallback
      if (!finalDefaultWarehouseId && product.store_id?.default_warehouse_id) {
        finalDefaultWarehouseId = product.store_id.default_warehouse_id;
        finalDefaultWarehouseName =
          product.store_id.default_warehouse_name || "Kho mặc định cửa hàng";
      }
    }

    // ===== Build updateData (KHÔNG set stock_quantity trực tiếp) =====
    const updateData = {
      name,
      description,
      sku,
      price: price !== undefined ? Number(price) : undefined,
      cost_price: cost_price !== undefined ? Number(cost_price) : undefined,
      min_stock: min_stock !== undefined ? Number(min_stock) : undefined,
      max_stock: max_stock !== undefined ? Number(max_stock) : undefined,
      unit,
      status,
      supplier_id,
      group_id,
      //  THÊM: Legal & Warranty fields
      tax_rate: tax_rate !== undefined ? Number(tax_rate) : undefined,
      origin: origin !== undefined ? origin : undefined,
      brand: brand !== undefined ? brand : undefined,
      warranty_period:
        warranty_period !== undefined ? warranty_period : undefined,
    };

    //  THÊM: Update kho mặc định nếu có thay đổi
    if (default_warehouse_id !== undefined) {
      updateData.default_warehouse_id = finalDefaultWarehouseId;
      updateData.default_warehouse_name = finalDefaultWarehouseName;
    }

    Object.keys(updateData).forEach(
      (k) => updateData[k] === undefined && delete updateData[k]
    );

    // ===== Image update (DB trước, xóa cloudinary sau commit) =====
    if (req.file) {
      // schema đúng: image.publicid
      const oldPid =
        product.image?.publicid || product.image?.public_id || null;
      if (oldPid) oldImagePublicIdToDelete = oldPid;

      const imageUrl =
        req.file.path || req.file.secure_url || req.file.url || "";
      const newPublicId =
        req.file.filename ||
        req.file.public_id ||
        req.file.key ||
        (imageUrl ? imageUrl.split("/").pop().split(".")[0] : null);

      updateData.image = {
        url: imageUrl,
        publicid: newPublicId,
      };
    }

    // ===== Update product fields (trừ stock) =====
    await Product.updateOne(
      { _id: productId, isDeleted: false },
      { $set: updateData },
      { session }
    );

    // ===== Nếu có targetStockQty => tạo phiếu điều chỉnh theo delta và $inc =====
    let createdVoucher = null;

    if (targetStockQty !== null) {
      const currentQty = Number(
        product.stockquantity ?? product.stock_quantity ?? 0
      );
      const delta = targetStockQty - currentQty;

      if (delta !== 0) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");

        const voucherType = delta > 0 ? "IN" : "OUT";
        const absQty = Math.abs(delta);

        // ưu tiên giá vốn mới nếu update
        const effectiveCost =
          updateData.cost_price !== undefined
            ? updateData.cost_price
            : typeof product.cost_price === "object" &&
              product.cost_price?.toString
            ? Number(product.cost_price.toString())
            : Number(product.cost_price || 0);

        const voucherCode = `${
          voucherType === "IN" ? "NK" : "XK"
        }-${y}${m}${d}-${product.sku}-${Date.now()}`;

        createdVoucher = new InventoryVoucher({
          store_id: productStoreId,
          type: voucherType,
          status: "POSTED",
          voucher_code: voucherCode,
          voucher_date: now,
          reason: "Điều chỉnh tồn kho khi cập nhật sản phẩm",

          //  GẮN KHO CHO PHIẾU (dùng kho mặc định của product)
          warehouse_id: finalDefaultWarehouseId || null,
          warehouse_name: finalDefaultWarehouseName || "",

          ref_type: "PRODUCT_UPDATE_STOCK",
          ref_id: product._id,

          created_by: userId,
          posted_by: userId,
          posted_at: now,

          items: [
            {
              product_id: product._id,
              sku_snapshot: sku !== undefined ? sku : product.sku,
              name_snapshot: name !== undefined ? name : product.name,
              unit_snapshot: unit !== undefined ? unit : product.unit || "",

              //  GẮN KHO CHO TỪNG DÒNG ITEM
              warehouse_id: finalDefaultWarehouseId || null,
              warehouse_name: finalDefaultWarehouseName || "",

              qty_document: absQty,
              qty_actual: absQty,

              unit_cost: mongoose.Types.Decimal128.fromString(
                String(effectiveCost)
              ),
              note: `Set tồn từ ${currentQty} -> ${targetStockQty} (delta ${
                delta > 0 ? "+" : "-"
              }${absQty})`,
            },
          ],
        });

        await createdVoucher.save({ session });

        // cập nhật tồn kho bằng $inc: SỬA field đúng stock_quantity (không phải stockquantity)
        await Product.updateOne(
          { _id: productId, store_id: productStoreId, isDeleted: false },
          { $inc: { stock_quantity: delta } }, //  Sửa field đúng
          { session }
        );
      }
    }

    // ===== Commit =====
    await session.commitTransaction();
    session.endSession();

    // Xóa ảnh cũ sau commit (best-effort)
    if (oldImagePublicIdToDelete) {
      try {
        await deleteFromCloudinary(oldImagePublicIdToDelete);
      } catch (e) {
        console.warn("⚠️ Không xóa được ảnh cũ Cloudinary:", e?.message || e);
      }
    }

    // ===== Return populated =====
    const updatedProduct = await Product.findOne({
      _id: productId,
      isDeleted: false,
    })
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    await logActivity({
      user: req.user,
      store: { _id: productStoreId },
      action: "update",
      entity: "Product",
      entityId: updatedProduct._id,
      entityName: updatedProduct.name,
      req,
      description: `Cập nhật sản phẩm ${updatedProduct.name} (SKU: ${updatedProduct.sku})`,
    });

    if (createdVoucher) {
      await logActivity({
        user: req.user,
        store: { _id: productStoreId },
        action: "create",
        entity: "InventoryVoucher",
        entityId: createdVoucher._id,
        entityName: `Phiếu kho ${createdVoucher.voucher_code}`,
        req,
        description: `Điều chỉnh tồn kho sản phẩm ${updatedProduct.name}: ${
          createdVoucher.type
        } ${
          finalDefaultWarehouseName
            ? `tại kho ${finalDefaultWarehouseName}`
            : ""
        }`,
      });
    }

    return res.status(200).json({
      message: "Cập nhật sản phẩm thành công",
      product: updatedProduct,
      inventoryVoucher: createdVoucher
        ? {
            _id: createdVoucher._id,
            voucher_code: createdVoucher.voucher_code,
            type: createdVoucher.type,
            status: createdVoucher.status,
            voucher_date: createdVoucher.voucher_date,
            //  TRẢ VỀ THÔNG TIN KHO
            warehouse_id: createdVoucher.warehouse_id,
            warehouse_name: createdVoucher.warehouse_name,
          }
        : null,
    });
  } catch (error) {
    console.error(" Lỗi updateProduct:", error);

    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId } = req.params;
    const userId = req.user.id || req.user._id;

    // Check user tồn tại
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    })
      .session(session)
      .populate("store_id", "owner_id name");

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Chặn xóa nếu còn tồn kho (tránh làm sai báo cáo / lịch sử kho)
    // Nếu bạn muốn vẫn cho xóa thì nên chuyển sang status "Ngừng bán" thay vì isDeleted
    const currentQty = Number(product.stock_quantity || 0);
    if (currentQty > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message:
          `Không thể xóa sản phẩm vì đang còn tồn kho (${currentQty}). ` +
          `Vui lòng xử lý tồn (xuất hủy/điều chỉnh/kiểm kho) hoặc chuyển trạng thái "Ngừng bán".`,
      });
    }

    // Soft delete
    product.isDeleted = true;
    await product.save({ session });

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: product.store_id?._id || product.store_id },
      action: "delete",
      entity: "Product",
      entityId: product._id,
      entityName: product.name,
      req,
      description: `Xóa mềm sản phẩm ${product.name} (SKU: ${product.sku})`,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Xóa sản phẩm thành công",
      deletedProductId: productId,
    });
  } catch (error) {
    console.error(" Lỗi deleteProduct:", error);

    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};
const getProductsByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 10, query = "", status } = req.query;

    const store = await Store.findById(storeId);
    if (!store)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });

    const skip = (Number(page) - 1) * Number(limit);
    const filter = { store_id: storeId, isDeleted: false };

    if (query && query.trim() !== "") {
      const searchRegex = new RegExp(query.trim(), "i");
      filter.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { description: searchRegex },
      ];
    }

    if (status && status !== "all") filter.status = status;

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("supplier_id", "name phone")
        .populate("store_id", "name")
        .populate("group_id", "name")
        .populate("default_warehouse_id", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    const formattedProducts = products.map((p) => ({
      _id: p._id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: parseFloat(p.price?.toString() || 0),
      cost_price: parseFloat(p.cost_price?.toString() || 0),
      stock_quantity: p.stock_quantity,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      unit: p.unit,
      status: p.status,
      image: p.image,

      store: p.store_id,
      supplier: p.supplier_id,
      group: p.group_id,

      // Warehouse fields
      default_warehouse_id: p.default_warehouse_id?._id || null,
      default_warehouse: p.default_warehouse_id || null,
      default_warehouse_name:
        p.default_warehouse_name || p.default_warehouse_id?.name || "",
      warehouse_id: p.default_warehouse_id?._id || null,
      warehouse: p.default_warehouse_id || null,
      warehouse_name:
        p.default_warehouse_name || p.default_warehouse_id?.name || "",

      //  BATCHES - Include batch information for expiry and inventory tracking
      batches: (p.batches || []).map((b) => ({
        batch_no: b.batch_no || "",
        expiry_date: b.expiry_date || null,
        cost_price: b.cost_price ? parseFloat(b.cost_price.toString()) : 0,
        selling_price: b.selling_price
          ? parseFloat(b.selling_price.toString())
          : 0, // Bổ sung selling_price
        quantity: b.quantity || 0,
        warehouse_id: b.warehouse_id || null,
        created_at: b.created_at || null,
      })),

      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      //  Bổ sung thông tin pháp lý & bảo hành
      tax_rate: p.tax_rate ?? 0,
      origin: p.origin || "",
      brand: p.brand || "",
      warranty_period: p.warranty_period || "",
    }));

    return res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      total,
      page: Number(page),
      limit: Number(limit),
      products: formattedProducts,
    });
  } catch (error) {
    console.error(" Lỗi getProductsByStore:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({ _id: productId, isDeleted: false })
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name")
      .populate("default_warehouse_id", "name"); //  ĐÚNG schema

    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    const formattedProduct = {
      _id: product._id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: parseFloat(product.price?.toString() || 0),
      cost_price: parseFloat(product.cost_price?.toString() || 0),
      stock_quantity: product.stock_quantity,
      min_stock: product.min_stock,
      max_stock: product.max_stock,
      unit: product.unit,
      status: product.status,
      image: product.image,

      store: product.store_id,
      supplier: product.supplier_id,
      group: product.group_id,

      default_warehouse_id: product.default_warehouse_id?._id || null,
      default_warehouse: product.default_warehouse_id || null,
      default_warehouse_name:
        product.default_warehouse_name ||
        product.default_warehouse_id?.name ||
        "",

      // (Tuỳ chọn) Alias
      warehouse_id: product.default_warehouse_id?._id || null,
      warehouse: product.default_warehouse_id || null,
      warehouse_name:
        product.default_warehouse_name ||
        product.default_warehouse_id?.name ||
        "",

      // BATCHES - Include batch information for expiry and inventory tracking
      batches: (product.batches || []).map((b) => ({
        batch_no: b.batch_no || "",
        expiry_date: b.expiry_date || null,
        cost_price: b.cost_price ? parseFloat(b.cost_price.toString()) : 0,
        quantity: b.quantity || 0,
        warehouse_id: b.warehouse_id || null,
        created_at: b.created_at || null,
      })),

      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      //  Bổ sung thông tin pháp lý & bảo hành
      tax_rate: product.tax_rate ?? 0,
      origin: product.origin || "",
      brand: product.brand || "",
      warranty_period: product.warranty_period || "",
    };

    return res.status(200).json({
      message: "Lấy thông tin sản phẩm thành công",
      product: formattedProduct,
    });
  } catch (error) {
    console.error(" Lỗi getProductById:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật giá bán sản phẩm
const updateProductPrice = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { productId } = req.params;
    const { price } = req.body;
    const userId = req.user.id || req.user._id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (!price) {
      return res.status(400).json({ message: "Giá bán (price) là bắt buộc" });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    }

    // ĐÃ LOẠI BỎ CHECK ROLE - Mọi user đã xác thực đều có thể cập nhật giá

    // Tìm sản phẩm và populate store để kiểm tra quyền (chỉ tìm sản phẩm chưa bị xóa)
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Cập nhật giá bán sản phẩm
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { price: price },
      { new: true }
    )
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    // Định dạng lại dữ liệu trả về
    const formattedProduct = {
      _id: updatedProduct._id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      sku: updatedProduct.sku,
      price: parseFloat(updatedProduct.price.toString()),
      cost_price: parseFloat(updatedProduct.cost_price.toString()),
      stock_quantity: updatedProduct.stock_quantity,
      min_stock: updatedProduct.min_stock,
      max_stock: updatedProduct.max_stock,
      unit: updatedProduct.unit,
      status: updatedProduct.status,
      image: updatedProduct.image,
      store: updatedProduct.store_id,
      supplier: updatedProduct.supplier_id,
      group: updatedProduct.group_id,
      createdAt: updatedProduct.createdAt,
      updatedAt: updatedProduct.updatedAt,
    };

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: updatedProduct.store_id._id },
      action: "update",
      entity: "Product",
      entityId: updatedProduct._id,
      entityName: updatedProduct.name,
      req,
      description: `Cập nhật giá bán sản phẩm ${updatedProduct.name} (SKU: ${updatedProduct.sku}) từ ${product.price} → ${price}`,
    });

    res.status(200).json({
      message: "Cập nhật giá bán sản phẩm thành công",
      product: formattedProduct,
    });
  } catch (error) {
    console.error(" Lỗi updateProductPrice:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

//Lấy list sản phẩm tồn kho thấp (stock <= min_stock, status "Đang kinh doanh", min_stock > 0, lowStockAlerted = false)
const getLowStockProducts = async (req, res) => {
  try {
    const { storeId } = req.query; // Filter theo storeId (optional, cho manager multi-store)

    const query = {
      $expr: { $lte: ["$stock_quantity", "$min_stock"] }, // Tồn kho <= min_stock
      status: "Đang kinh doanh", // Chỉ sản phẩm đang bán
      min_stock: { $gt: 0 }, // Min stock > 0 tránh cảnh báo ảo
      lowStockAlerted: false, // Chưa cảnh báo
      store_id: storeId
        ? new mongoose.Types.ObjectId(storeId)
        : { $exists: true }, // Filter store nếu có
      isDeleted: false, // Chỉ lấy sản phẩm chưa bị xóa
    };

    const lowStockProds = await Product.find(query)
      .select("name sku stock_quantity min_stock unit") // Chỉ lấy field cần thiết
      .sort({ stock_quantity: 1 }) // Sắp xếp tăng dần tồn kho (thấp nhất trước)
      .limit(20) // Limit 20 để tránh query lớn
      .lean(); // Lean cho nhanh

    console.log(
      `Query low stock thành công, số lượng: ${
        lowStockProds.length
      } sản phẩm cho store ${storeId || "tất cả"}`
    );
    res.json({
      message: "Lấy danh sách tồn kho thấp thành công",
      products: lowStockProds,
    });
  } catch (err) {
    console.error("Lỗi query low stock:", err.message); // Log tiếng Việt error
    res.status(500).json({ message: "Lỗi server khi lấy tồn kho thấp" });
  }
};

// Lấy danh sách sản phẩm sắp hết hạn (trong vòng 30 ngày)
const getExpiringProducts = async (req, res) => {
  try {
    const { storeId, days = 30 } = req.query;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + parseInt(days));

    const query = {
      store_id: new mongoose.Types.ObjectId(storeId),
      isDeleted: false,
      status: "Đang kinh doanh",
      batches: {
        $elemMatch: {
          expiry_date: { $lte: thresholdDate },
          quantity: { $gt: 0 },
        },
      },
    };

    const products = await Product.find(query)
      .select("name sku unit batches supplier_id")
      .populate("supplier_id", "name contact_person phone address")
      .lean();

    const now = new Date();
    // Flatten batches for UI if needed, or just return products
    const expiringItems = [];
    products.forEach((p) => {
      p.batches.forEach((b) => {
        if (b.expiry_date && b.expiry_date <= thresholdDate && b.quantity > 0) {
          const isExpired = new Date(b.expiry_date) <= now;
          expiringItems.push({
            _id: p._id,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            batch_no: b.batch_no,
            expiry_date: b.expiry_date,
            quantity: b.quantity,
            cost_price: b.cost_price,
            selling_price: b.selling_price,
            warehouse_id: b.warehouse_id,
            status: isExpired ? "expired" : "expiring_soon",
            supplier_id: p.supplier_id?._id,
            supplier_name: p.supplier_id?.name,
            supplier_contact: p.supplier_id?.contact_person,
            supplier_phone: p.supplier_id?.phone,
            supplier_address: p.supplier_id?.address,
          });
        }
      });
    });

    res.json({
      message: "Lấy danh sách sản phẩm sắp hết hạn thành công",
      data: expiringItems.sort(
        (a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)
      ),
    });
  } catch (err) {
    console.error("Lỗi query expiring products:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy hàng sắp hết hạn" });
  }
};

// GET /api/products/search - Tìm sản phẩm theo tên hoặc SKU (regex case-insensitive)
const searchProducts = async (req, res) => {
  try {
    const { query, storeId, limit = 50 } = req.query; // Tăng limit mặc định lên 50

    if (!query || query.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Query tìm kiếm không được để trống" });
    }

    const searchTerm = query.trim();

    const searchQuery = {
      $or: [
        { name: { $regex: searchTerm, $options: "i" } }, // Tìm tên (case-insensitive)
        { sku: { $regex: searchTerm, $options: "i" } }, // Tìm SKU (case-insensitive)
        { description: { $regex: searchTerm, $options: "i" } }, // Tìm cả mô tả
      ],
      status: "Đang kinh doanh", // Chỉ sản phẩm đang bán
      store_id: new mongoose.Types.ObjectId(storeId), // Filter store của staff/manager
      isDeleted: false, // Chỉ tìm sản phẩm chưa bị xóa
    };

    const products = await Product.find(searchQuery)
      .select(
        "image name sku price cost_price stock_quantity unit batches status tax_rate"
      )
      .sort({ stock_quantity: -1, name: 1 })
      .limit(parseInt(limit))
      .lean();

    //  Đồng bộ logic sắp xếp lô: Hạn dùng gần nhất -> Cũ nhất (FIFO)
    products.forEach((p) => {
      if (p.batches && p.batches.length > 0) {
        p.batches = p.batches
          .filter((b) => (b.quantity || 0) > 0)
          .sort((a, b) => {
            // 1. Ưu tiên lô có hạn dùng (Sắp hết hạn trước)
            if (a.expiry_date && !b.expiry_date) return -1;
            if (!a.expiry_date && b.expiry_date) return 1;
            if (a.expiry_date && b.expiry_date) {
              const diff = new Date(a.expiry_date) - new Date(b.expiry_date);
              if (diff !== 0) return diff;
            }
            // 2. Cùng hạn hoặc không hạn: Lô cũ nhất trước (FIFO)
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
          });
      }
    });

    console.log(
      `Tìm kiếm sản phẩm thành công: "${query}" trong store ${storeId}, kết quả: ${products.length} sản phẩm`
    );
    res.json({ message: `Tìm thấy ${products.length} sản phẩm`, products });
  } catch (err) {
    console.error("Lỗi search sản phẩm:", err.message);
    res.status(500).json({ message: "Lỗi server khi tìm kiếm sản phẩm" });
  }
};

// DELETE IMAGE - Xóa ảnh sản phẩm
const deleteProductImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id || req.user._id;

    // ĐÃ LOẠI BỎ CHECK ROLE - Mọi user đã xác thực đều có thể xóa ảnh

    // Tìm sản phẩm và kiểm tra quyền (chỉ tìm sản phẩm chưa bị xóa)
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Kiểm tra có ảnh không
    if (!product.image || !product.image.public_id) {
      return res.status(404).json({ message: "Sản phẩm không có ảnh" });
    }

    // Xóa ảnh trên Cloudinary
    try {
      await deleteFromCloudinary(product.image.public_id);
    } catch (error) {
      console.error("Lỗi xóa ảnh trên Cloudinary:", error);
      return res.status(500).json({ message: "Lỗi xóa ảnh trên Cloudinary" });
    }

    // Xóa thông tin ảnh trong database
    product.image = null;
    await product.save();

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: product.store_id._id },
      action: "delete",
      entity: "ProductImage",
      entityId: product._id,
      entityName: product.name,
      req,
      description: `Xóa ảnh sản phẩm ${product.name} (SKU: ${product.sku})`,
    });

    res.status(200).json({
      message: "Xóa ảnh sản phẩm thành công",
      productId: productId,
    });
  } catch (error) {
    console.error(" Lỗi deleteProductImage:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const importProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.id || req.user?._id;

    console.log(
      "🚀 Starting import products for store:",
      storeId,
      "| userId:",
      userId
    );
    console.log(
      " Request received - file:",
      req.file ? `${req.file.originalname} (${req.file.size} bytes)` : "NO FILE"
    );

    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên file" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const store = await Store.findById(storeId).lean();
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // ===== CHECK QUYỀN =====
    const storeOwnerId = store.owner_id?.toString();
    if (storeOwnerId !== userId.toString()) {
      if (user.role === "STAFF") {
        const employee = await Employee.findOne({
          user_id: userId,
          store_id: storeId,
        });
        if (!employee) {
          return res.status(403).json({ message: "Bạn không có quyền import" });
        }
      } else {
        return res.status(403).json({ message: "Bạn không có quyền import" });
      }
    }

    const data = await parseExcelToJSON(req.file.buffer);
    console.log("📊 Parsed Excel data:", data.length, "rows");

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "File không có dữ liệu hợp lệ" });
    }

    const results = {
      success: [],
      failed: [],
      total: data.length,
      newlyCreated: {
        suppliers: 0,
        productGroups: 0,
        warehouses: 0,
        products: 0,
      },
    };

    // ===== KHO MẶC ĐỊNH =====
    const defaultWarehouseId = store.default_warehouse_id || null;
    const defaultWarehouseName = store.default_warehouse_name || "Kho mặc định";

    // ===== CACHE =====
    const suppliers = await Supplier.find({
      store_id: storeId,
      isDeleted: false,
    }).lean();
    const supplierMap = new Map(
      suppliers.map((s) => [s.name.toLowerCase().trim(), s])
    );

    const groups = await ProductGroup.find({
      storeId: storeId,
      isDeleted: false,
    }).lean();
    const groupMap = new Map(
      groups.map((g) => [g.name.toLowerCase().trim(), g])
    );

    const warehouses = await Warehouse.find({ store_id: storeId }).lean();
    const warehouseMap = new Map(
      warehouses.map((w) => [w.name.toLowerCase().trim(), w])
    );

    // Helper: Parse Date an toàn
    const parseImportDate = (str) => {
      if (!str) return null;
      if (typeof str === "number") {
        return new Date(Math.round((str - 25569) * 86400 * 1000));
      }
      const s = String(str).trim();
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split("/").map(Number);
        return new Date(y, m - 1, d);
      }
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    // Map để theo dõi các voucher đã tạo TRONG CÙNG PHIÊN IMPORT này (để gom nhóm)
    const sessionVouchers = new Map();

    // ================= IMPORT LOOP =================
    for (let i = 0; i < data.length; i++) {
      const session = await mongoose.startSession();
      session.startTransaction();

      let row = null; // Declare outside try to use in catch
      try {
        row = sanitizeData(data[i]);
        const rowNumber = i + 2;
        console.log(`📝 Processing row ${rowNumber}:`, row["Tên sản phẩm"]);

        const priceInput = Number(row["Giá bán"] || 0);
        const costInput = Number(row["Giá vốn"] || 0);
        const openingQty = Number(row["Tồn kho"] || 0);
        const expiryDate = parseImportDate(
          row["Hạn sử dụng"] || row["Hạn dùng"]
        );
        const entryDate =
          parseImportDate(
            row["Ngày chứng từ"] || row["Ngày thêm"] || row["Ngày nhập"]
          ) || new Date();

        let sku = row["Mã SKU"] ? row["Mã SKU"].toString().trim() : "";
        const productName = row["Tên sản phẩm"]
          ? row["Tên sản phẩm"].toString().trim()
          : "";

        if (!productName) {
          throw new Error("Tên sản phẩm là bắt buộc");
        }

        // --- 1. SUPPLIER (Auto Create or Use Existing) ---
        let supplierId = null;
        const supplierName = row["Nhà cung cấp"]
          ? row["Nhà cung cấp"].toString().trim()
          : "";
        if (supplierName) {
          const lowerName = supplierName.toLowerCase().trim();

          // Bước 1: Kiểm tra trong cache map
          if (supplierMap.has(lowerName)) {
            supplierId = supplierMap.get(lowerName)._id;
            console.log(` Using cached supplier: ${supplierName}`);
          } else {
            // Bước 2: Fallback - Query DB trực tiếp để tránh tạo trùng
            const existingSupplier = await Supplier.findOne({
              store_id: storeId,
              isDeleted: false,
              name: {
                $regex: new RegExp(
                  `^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                  "i"
                ),
              },
            }).session(session);

            if (existingSupplier) {
              // Nhà cung cấp đã tồn tại trong DB - sử dụng và cập nhật cache
              supplierId = existingSupplier._id;
              supplierMap.set(lowerName, existingSupplier);
              console.log(
                ` Found existing supplier in DB: ${existingSupplier.name}`
              );
            } else {
              // Bước 3: Tạo mới vì chưa tồn tại
              const newSupplier = new Supplier({
                name: supplierName,
                store_id: storeId,
              });
              await newSupplier.save({ session });
              supplierId = newSupplier._id;
              supplierMap.set(lowerName, newSupplier.toObject());
              results.newlyCreated.suppliers++;
              console.log(` Created new supplier: ${supplierName}`);
            }
          }
        }

        // --- 2. GROUP (Auto Create or Use Existing) ---
        let groupId = null;
        const groupName = row["Nhóm sản phẩm"]
          ? row["Nhóm sản phẩm"].toString().trim()
          : "";
        if (groupName) {
          const lowerName = groupName.toLowerCase().trim();

          // Bước 1: Kiểm tra trong cache map
          if (groupMap.has(lowerName)) {
            groupId = groupMap.get(lowerName)._id;
            console.log(` Using cached product group: ${groupName}`);
          } else {
            // Bước 2: Fallback - Query DB trực tiếp để tránh tạo trùng
            const existingGroup = await ProductGroup.findOne({
              storeId: storeId,
              isDeleted: false,
              name: {
                $regex: new RegExp(
                  `^${groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                  "i"
                ),
              },
            }).session(session);

            if (existingGroup) {
              // Nhóm sản phẩm đã tồn tại trong DB - sử dụng và cập nhật cache
              groupId = existingGroup._id;
              groupMap.set(lowerName, existingGroup);
              console.log(
                ` Found existing product group in DB: ${existingGroup.name}`
              );
            } else {
              // Bước 3: Tạo mới vì chưa tồn tại
              const newGroup = new ProductGroup({
                name: groupName,
                storeId: storeId,
                description: "Tự động tạo từ Import Excel",
              });
              await newGroup.save({ session });
              groupId = newGroup._id;
              groupMap.set(lowerName, newGroup.toObject());
              results.newlyCreated.productGroups++;
              console.log(` Created new product group: ${groupName}`);
            }
          }
        }

        // --- 3. WAREHOUSE (Auto Create or Use Existing) ---
        let warehouseIdForRow = defaultWarehouseId;
        let warehouseNameForRow = defaultWarehouseName;
        const rowWarehouseName = row["Tên kho"]
          ? row["Tên kho"].toString().trim()
          : "";
        const rowWhAddress = row["Địa chỉ kho"]
          ? row["Địa chỉ kho"].toString().trim()
          : "Tạo tự động từ Import";
        const rowWhContact = row["Người quản lý kho"]
          ? row["Người quản lý kho"].toString().trim()
          : "";
        const rowWhPhone = row["SĐT kho"]
          ? row["SĐT kho"].toString().trim()
          : "";

        if (rowWarehouseName) {
          const lowerWName = rowWarehouseName.toLowerCase().trim();

          // Bước 1: Kiểm tra trong cache map
          if (warehouseMap.has(lowerWName)) {
            const wh = warehouseMap.get(lowerWName);
            warehouseIdForRow = wh._id;
            warehouseNameForRow = wh.name;
            console.log(` Using cached warehouse: ${wh.name} (ID: ${wh._id})`);
          } else {
            // Bước 2: Fallback - Query DB trực tiếp để tránh tạo trùng (case-insensitive)
            const existingWarehouse = await Warehouse.findOne({
              store_id: storeId,
              name: {
                $regex: new RegExp(
                  `^${rowWarehouseName.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                  )}$`,
                  "i"
                ),
              },
            }).session(session);

            if (existingWarehouse) {
              // Kho đã tồn tại trong DB - sử dụng và cập nhật cache
              warehouseIdForRow = existingWarehouse._id;
              warehouseNameForRow = existingWarehouse.name;
              warehouseMap.set(lowerWName, existingWarehouse);
              console.log(
                ` Found existing warehouse in DB: ${existingWarehouse.name} (ID: ${existingWarehouse._id})`
              );
            } else {
              // Bước 3: Tạo mới kho vì chưa tồn tại
              const generatedWHCode =
                rowWarehouseName
                  .toUpperCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "") // Remove accents
                  .replace(/\s+/g, "_")
                  .replace(/[^A-Z0-9_]/g, "")
                  .substring(0, 10) +
                "_" +
                Date.now().toString().slice(-4);

              const newWh = new Warehouse({
                code: generatedWHCode,
                name: rowWarehouseName,
                store_id: storeId,
                is_default: false,
                address: rowWhAddress,
                contact_person: rowWhContact,
                phone: rowWhPhone,
              });
              await newWh.save({ session });
              warehouseIdForRow = newWh._id;
              warehouseNameForRow = newWh.name;
              // Thêm vào cache để các dòng tiếp theo có thể sử dụng
              warehouseMap.set(lowerWName, newWh.toObject());
              results.newlyCreated.warehouses++;
              console.log(
                ` Created new warehouse: ${rowWarehouseName} (Code: ${generatedWHCode})`
              );
            }
          }
        }

        // --- 4. FIND OR CREATE PRODUCT ---
        let product = null;
        let isNew = false;

        // Check by SKU first
        if (sku) {
          product = await Product.findOne({
            sku,
            store_id: storeId,
            isDeleted: false,
          }).session(session);
          // NEW RULE: If SKU found but name is different -> Error and notify
          if (product && product.name !== productName) {
            throw new Error(
              `Dòng ${i + 2}: Mã SKU "${sku}" đã tồn tại cho sản phẩm "${
                product.name
              }". Không thể trùng mã với tên khác phẩm ("${productName}").`
            );
          }
        }
        // If not found by SKU, check by name
        if (!product) {
          product = await Product.findOne({
            name: productName,
            store_id: storeId,
            isDeleted: false,
          }).session(session);
        }

        const unit = row["Đơn vị"] ? row["Đơn vị"].toString().trim() : "";
        const description = row["Mô tả"] ? row["Mô tả"].toString().trim() : "";
        const minStock =
          row["Tồn kho tối thiểu"] !== undefined
            ? Number(row["Tồn kho tối thiểu"])
            : 0;
        const maxStock =
          row["Tồn kho tối đa"] !== undefined
            ? row["Tồn kho tối đa"] === "" || row["Tồn kho tối đa"] === null
              ? null
              : Number(row["Tồn kho tối đa"])
            : null;
        const statusImport = row["Trạng thái"]
          ? row["Trạng thái"].toString().trim()
          : "Đang kinh doanh";
        const taxRate =
          row["Thuế GTGT (%)"] !== undefined ? Number(row["Thuế GTGT (%)"]) : 0;
        const origin = row["Xuất xứ"] ? row["Xuất xứ"].toString().trim() : "";
        const brand = row["Thương hiệu"]
          ? row["Thương hiệu"].toString().trim()
          : "";
        const warranty = row["Bảo hành"]
          ? row["Bảo hành"].toString().trim()
          : "";

        if (product) {
          // UPDATE existing product
          console.log(
            ` Found existing product: ${product.name} (${
              product.sku
            }) - Identified by ${sku && product.sku === sku ? "SKU" : "Name"}`
          );
          const newPrice =
            priceInput > 0
              ? priceInput
              : Number(product.price?.toString() || 0);
          const newCost =
            costInput > 0
              ? costInput
              : Number(product.cost_price?.toString() || 0);

          await Product.updateOne(
            { _id: product._id },
            {
              $set: {
                name: productName,
                sku: sku || product.sku, // Update SKU if provided in Excel (and we matched by name)
                description: description || product.description,
                price: newPrice,
                cost_price: newCost,
                min_stock: isNaN(minStock) ? product.min_stock : minStock,
                max_stock: isNaN(maxStock) ? product.max_stock : maxStock,
                status: statusImport || product.status,
                supplier_id: supplierId || product.supplier_id,
                group_id: groupId || product.group_id,
                unit: unit || product.unit,
                tax_rate: isNaN(taxRate) ? product.tax_rate : taxRate,
                origin: origin || product.origin,
                brand: brand || product.brand,
                warranty_period: warranty || product.warranty_period,
              },
            },
            { session }
          );
          // Reload product
          product = await Product.findById(product._id).session(session);
          sku = product.sku;
        } else {
          // CREATE new product
          isNew = true;
          if (!sku) {
            sku = await generateSKU(storeId);
          }
          console.log(`🆕 Creating new product: ${productName} (${sku})`);

          product = new Product({
            name: productName,
            sku,
            description,
            price: priceInput,
            cost_price: costInput,
            stock_quantity: 0,
            min_stock: isNaN(minStock) ? 0 : minStock,
            max_stock: isNaN(maxStock) ? null : maxStock,
            status: statusImport,
            store_id: storeId,
            supplier_id: supplierId,
            group_id: groupId,
            default_warehouse_id: warehouseIdForRow,
            default_warehouse_name: warehouseNameForRow,
            createdBy: userId,
            unit: unit,
            tax_rate: isNaN(taxRate) ? 0 : taxRate,
            origin: origin,
            brand: brand,
            warranty_period: warranty,
            batches: [],
          });
          await product.save({ session });
          results.newlyCreated.products++;
        }

        // --- 5. CREATE INVENTORY VOUCHER & UPDATE STOCK ---
        let finalVoucherCode = "";
        if (openingQty > 0) {
          const entryCost =
            costInput > 0
              ? costInput
              : Number(product.cost_price?.toString() || 0);
          const batchNo = row["Số lô"]
            ? row["Số lô"].toString().trim()
            : `BATCH-${Date.now()}`;

          let voucherCode = row["Số chứng từ"]
            ? row["Số chứng từ"].toString().trim()
            : "";
          const isManualVoucher = !!voucherCode;
          if (!voucherCode) {
            voucherCode = `NK-${entryDate.getTime()}-${sku}`;
          }

          const voucherItem = {
            product_id: product._id,
            supplier_id: supplierId || product.supplier_id,
            supplier_name_snapshot: supplierName || "",
            sku_snapshot: product.sku,
            name_snapshot: product.name,
            unit_snapshot: product.unit || "",
            warehouse_id: warehouseIdForRow,
            warehouse_name: warehouseNameForRow,
            qty_document: openingQty,
            qty_actual: openingQty,
            unit_cost: mongoose.Types.Decimal128.fromString(String(entryCost)),
            batch_no: batchNo,
            expiry_date: expiryDate,
            note: "Nhập tồn khi import Excel",
          };

          let voucher = null;
          // Nếu user nhập mã chứng từ, thử tìm trong phiên import này để gom nhóm
          if (isManualVoucher && sessionVouchers.has(voucherCode)) {
            voucher = await InventoryVoucher.findById(
              sessionVouchers.get(voucherCode)
            ).session(session);
          }

          if (voucher) {
            // Gom vào voucher đã có
            voucher.items.push(voucherItem);
            await voucher.save({ session });
            console.log(`📄 Appended item to session voucher: ${voucherCode}`);
          } else {
            // Tạo mới: Kiểm tra trùng mã trong DB (check cả store_id hiện tại VÀ null/legacy data)
            const existingVoucher = await InventoryVoucher.findOne({
              $or: [
                { store_id: storeId, voucher_code: voucherCode },
                { store_id: null, voucher_code: voucherCode },
                { store_id: { $exists: false }, voucher_code: voucherCode },
              ],
            }).session(session);

            if (existingVoucher) {
              // Tạo mã mới unique: thêm timestamp + random để tránh trùng
              const uniqueSuffix = `${Date.now()
                .toString()
                .slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;
              voucherCode = `${voucherCode}-${uniqueSuffix}`;
              console.log(
                `⚠️ Voucher code conflict detected, using new code: ${voucherCode}`
              );
            }

            // --- Auto Query Recipient/Deliverer ---
            let delivererName = row["Người giao"] || "";
            let receiverName = row["Người nhận"] || "";

            if (!delivererName) {
              const suppDoc = supplierMap.get(
                (supplierName || "").toLowerCase().trim()
              );
              delivererName =
                suppDoc?.contact_person ||
                suppDoc?.name ||
                supplierName ||
                "Người giao hàng";
            }
            if (!receiverName) {
              const whDoc = Array.from(warehouseMap.values()).find(
                (w) => w._id.toString() === warehouseIdForRow.toString()
              );
              receiverName =
                whDoc?.contact_person || user.fullname || user.username;
            }

            voucher = new InventoryVoucher({
              store_id: storeId,
              type: "IN",
              status: "POSTED",
              voucher_code: voucherCode,
              voucher_date: entryDate,
              reason: isNew
                ? "Nhập tồn đầu kỳ khi import sản phẩm"
                : "Nhập bổ sung tồn kho khi import",
              warehouse_id: warehouseIdForRow,
              warehouse_name: warehouseNameForRow,
              supplier_id: supplierId,
              supplier_name_snapshot: supplierName || "",
              partner_name: supplierName || "Nhập file Excel",
              deliverer_name: delivererName,
              receiver_name: receiverName,
              ref_type: isNew
                ? "PRODUCT_IMPORT_CREATE"
                : "PRODUCT_IMPORT_UPDATE",
              ref_no: row["Số chứng từ"] || "",
              ref_date: entryDate,
              created_by: userId,
              posted_by: userId,
              posted_at: entryDate,
              items: [voucherItem],
            });
            await voucher.save({ session });
            if (isManualVoucher) sessionVouchers.set(voucherCode, voucher._id);
            console.log(`📄 Created new voucher: ${voucher.voucher_code}`);
          }
          finalVoucherCode = voucherCode;

          // Update product batches and stock
          if (batchNo || expiryDate) {
            const currentProduct = await Product.findById(product._id).session(
              session
            );
            const entrySellingPrice =
              priceInput > 0
                ? priceInput
                : Number(product.price?.toString() || 0);

            //  Validation: Kiểm tra tồn tối đa khi Import (Check chung trước khi xử lý lô)
            const projectedStock =
              (currentProduct.stock_quantity || 0) + openingQty;
            const limit =
              currentProduct.max_stock !== undefined &&
              currentProduct.max_stock !== null
                ? Number(currentProduct.max_stock)
                : 0;

            if (limit > 0 && projectedStock > limit) {
              throw new Error(
                `Dòng ${i + 2}: Sản phẩm "${
                  currentProduct.name
                }" có tồn kho tối đa là ${limit}. Nhập thêm ${openingQty} sẽ làm tổng tồn kho biểu kiến (${projectedStock}) vượt quá hạn mức.`
              );
            }

            const existingBatchIndex = (currentProduct.batches || []).findIndex(
              (b) =>
                b.batch_no === batchNo &&
                (expiryDate
                  ? b.expiry_date &&
                    new Date(b.expiry_date).getTime() ===
                      new Date(expiryDate).getTime()
                  : !b.expiry_date) &&
                String(b.warehouse_id || "") ===
                  String(warehouseIdForRow || "") &&
                b.cost_price === entryCost &&
                b.selling_price === entrySellingPrice
            );

            if (existingBatchIndex >= 0) {
              // Increment existing batch (only if all criteria match including prices)
              await Product.updateOne(
                { _id: product._id },
                {
                  $inc: {
                    stock_quantity: openingQty,
                    [`batches.${existingBatchIndex}.quantity`]: openingQty,
                  },
                },
                { session }
              );
              console.log(
                ` Updated existing batch: ${batchNo} (cost: ${entryCost}, selling: ${entrySellingPrice})`
              );
            } else {
              // Push new batch with selling_price
              await Product.updateOne(
                { _id: product._id },
                {
                  $inc: { stock_quantity: openingQty },
                  $push: {
                    batches: {
                      batch_no: batchNo,
                      expiry_date: expiryDate,
                      cost_price: entryCost,
                      selling_price: entrySellingPrice, // NEW: Add selling_price to batch
                      quantity: openingQty,
                      warehouse_id: warehouseIdForRow,
                      created_at: entryDate,
                    },
                  },
                },
                { session }
              );
              console.log(
                ` Added new batch: ${batchNo} (cost: ${entryCost}, selling: ${entrySellingPrice})`
              );
            }
          } else {
            // No batch info, just update stock
            await Product.updateOne(
              { _id: product._id },
              { $inc: { stock_quantity: openingQty } },
              { session }
            );
          }
        }

        await session.commitTransaction();
        session.endSession();

        results.success.push({
          row: rowNumber,
          sku,
          product: product.name,
          voucher_code: finalVoucherCode,
        });
        console.log(` Row ${rowNumber} imported successfully`);
      } catch (err) {
        console.error(` Row ${i + 2} failed:`, err.message);
        await session.abortTransaction();
        session.endSession();
        results.failed.push({
          row: i + 2,
          data: row,
          error: err.message,
        });
      }
    }

    console.log("🏁 Import completed:", results);
    return res.status(200).json({
      message: "Import hoàn tất",
      results,
      newlyCreated: results.newlyCreated,
    });
  } catch (error) {
    console.error(" Import error:", error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// Download Product Template (Dynamic with ExcelJS)
const downloadProductTemplate = async (req, res) => {
  try {
    const XLSX = require("xlsx");
    const workbook = XLSX.utils.book_new();

    // Sử dụng PRODUCT_HEADERS dùng chung để đồng bộ
    const headers = PRODUCT_HEADERS;

    // Tạo dữ liệu mẫu (2 dòng ví dụ)
    const sampleData = [
      [
        "Coca Cola Lon 330ml", // Tên sản phẩm
        "Nước giải khát có gas", // Mô tả
        "SP000001", // Mã SKU
        10000, // Giá bán
        8000, // Giá vốn
        100, // Tồn kho
        10, // Tồn tối thiểu
        1000, // Tồn tối đa
        "Lon", // Đơn vị
        "Đang kinh doanh", // Trạng thái
        "Công ty CocaCola", // Nhà cung cấp
        "Đồ uống", // Nhóm sản phẩm
        "Kho mặc định", // Tên kho
        "Số 123 Đường ABC, Hà Nội", // Địa chỉ kho
        "Nguyễn Văn A", // Người quản lý kho
        "0987654321", // SĐT kho
        "BATCH001", // Số lô
        "31/12/2026", // Hạn sử dụng (dd/mm/yyyy)
        10, // Thuế GTGT (%)
        "Việt Nam", // Xuất xứ
        "CocaCola", // Thương hiệu
        "12 tháng", // Bảo hành
        "NK-001", // Số chứng từ
        "15/05/2024", // Ngày chứng từ
        "15/05/2024", // Ngày thêm
        "Công ty CocaCola", // Người giao
        "Nguyễn Văn A", // Người nhận
      ],
      [
        "Mì Hảo Hảo Tôm Chua Cay", // Tên sản phẩm
        "Mì ăn liền Acecook", // Mô tả
        "SP000002", // Mã SKU
        5000, // Giá bán
        3500, // Giá vốn
        50, // Tồn kho
        20, // Tồn tối thiểu
        null, // Tồn tối đa
        "Gói", // Đơn vị
        "Đang kinh doanh", // Trạng thái
        "Acecook Việt Nam", // Nhà cung cấp
        "Mì gói", // Nhóm sản phẩm
        "Kho Hà Nội", // Tên kho
        "", // Địa chỉ kho
        "", // Người quản lý kho
        "", // SĐT kho
        "BATCH-M-02", // Số lô
        "20/12/2025", // Hạn sử dụng (dd/mm/yyyy)
        8, // Thuế GTGT (%)
        "Việt Nam", // Xuất xứ
        "Mì Hảo Hảo", // Thương hiệu
        "", // Bảo hành
        "", // Số chứng từ
        "", // Ngày chứng từ
        "", // Ngày thêm
        "", // Người giao
        "", // Người nhận
      ],
    ];

    // Tạo sheet từ mảng
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

    const wscols = headers.map(() => ({ wch: 15 }));
    wscols[0].wch = 30; // Tên SP
    wscols[1].wch = 25; // Mô tả
    wscols[10].wch = 20; // NCC
    wscols[11].wch = 20; // Nhóm
    wscols[12].wch = 20; // Tên kho
    wscols[13].wch = 25; // Địa chỉ kho

    worksheet["!cols"] = wscols;

    // Add sheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    // Tạo buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    const filename = "product_import_template_v2.xlsx";
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("Content-Length", excelBuffer.length);

    console.log(
      " Generated dynamic Import Template with Batch/Expiry/Warehouse"
    );
    return res.send(excelBuffer);
  } catch (error) {
    console.error(" Lỗi downloadProductTemplate:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= EXPORT - Xuất danh sách sản phẩm ra Excel =============
const exportProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    console.log(
      `🔄 Export products request for store: ${storeId}, user: ${userId}`
    );

    // Kiểm tra cửa hàng tồn tại
    const store = await Store.findById(storeId);
    if (!store) {
      console.log(` Store not found: ${storeId}`);
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // ĐÃ LOẠI BỎ CHECK ROLE - Mọi user đã xác thực đều có thể export

    // Lấy tất cả sản phẩm của cửa hàng
    const products = await Product.find({
      store_id: storeId,
      isDeleted: false,
    })
      .populate("supplier_id", "name contact_person")
      .populate("group_id", "name")
      .sort({ createdAt: -1 });

    console.log(`📊 Found ${products.length} products for export`);

    // Nếu không có sản phẩm, vẫn xuất file Excel với thông báo thay vì trả lỗi 404
    if (products.length === 0) {
      console.log(" No products found, generating info Excel file");
      return await sendEmptyNotificationWorkbook(
        res,
        "sản phẩm",
        store,
        "Danh_Sach_San_Pham"
      );
    }

    // Chuẩn bị dữ liệu cho Excel (Cache Warehouse)
    const warehouses = await Warehouse.find({ store_id: storeId }).lean();
    const warehouseCache = new Map(
      warehouses.map((w) => [w._id.toString(), w])
    );

    const excelData = [];
    for (const product of products) {
      // Xác định kho mặc định
      const defaultWh = product.default_warehouse_id
        ? warehouseCache.get(product.default_warehouse_id.toString())
        : null;

      if (product.batches && product.batches.length > 0) {
        for (const batch of product.batches) {
          const batchWh = batch.warehouse_id
            ? warehouseCache.get(batch.warehouse_id.toString())
            : defaultWh;

          excelData.push({
            "Tên sản phẩm": product.name || "",
            "Mô tả": product.description || "",
            "Mã SKU": product.sku || "",
            "Giá bán": product.price ? parseFloat(product.price.toString()) : 0,
            "Giá vốn":
              batch.cost_price ||
              (product.cost_price
                ? parseFloat(product.cost_price.toString())
                : 0),
            "Tồn kho": batch.quantity || 0,
            "Tồn kho tối thiểu": product.min_stock || 0,
            "Tồn kho tối đa": product.max_stock || "",
            "Đơn vị": product.unit || "",
            "Trạng thái": product.status || "Đang kinh doanh",
            "Nhà cung cấp": product.supplier_id ? product.supplier_id.name : "",
            "Nhóm sản phẩm": product.group_id ? product.group_id.name : "",
            "Tên kho": batchWh
              ? batchWh.name
              : product.default_warehouse_name || "Kho mặc định",
            "Địa chỉ kho": batchWh?.address || "",
            "Người quản lý kho": batchWh?.contact_person || "",
            "SĐT kho": batchWh?.phone || "",
            "Số lô": batch.batch_no || "",
            "Hạn sử dụng": batch.expiry_date
              ? new Date(batch.expiry_date).toLocaleDateString("vi-VN")
              : "",
            "Thuế GTGT (%)": product.tax_rate || 0,
            "Xuất xứ": product.origin || "",
            "Thương hiệu": product.brand || "",
            "Bảo hành": product.warranty_period || "",
            "Số chứng từ": "EXPORT_AUTO",
            "Ngày chứng từ": batch.created_at
              ? new Date(batch.created_at).toLocaleDateString("vi-VN")
              : new Date().toLocaleDateString("vi-VN"),
            "Ngày thêm": product.createdAt
              ? new Date(product.createdAt).toLocaleDateString("vi-VN")
              : "",
            "Người giao":
              product.supplier_id?.contact_person ||
              product.supplier_id?.name ||
              "",
            "Người nhận": batchWh?.contact_person || "",
          });
        }
      } else {
        // Tồn kho tổng nếu không có lô
        excelData.push({
          "Tên sản phẩm": product.name || "",
          "Mô tả": product.description || "",
          "Mã SKU": product.sku || "",
          "Giá bán": product.price ? parseFloat(product.price.toString()) : 0,
          "Giá vốn": product.cost_price
            ? parseFloat(product.cost_price.toString())
            : 0,
          "Tồn kho": product.stock_quantity || 0,
          "Tồn kho tối thiểu": product.min_stock || 0,
          "Tồn kho tối đa": product.max_stock || "",
          "Đơn vị": product.unit || "",
          "Trạng thái": product.status || "Đang kinh doanh",
          "Nhà cung cấp": product.supplier_id ? product.supplier_id.name : "",
          "Nhóm sản phẩm": product.group_id ? product.group_id.name : "",
          "Tên kho": defaultWh
            ? defaultWh.name
            : product.default_warehouse_name || "Kho mặc định",
          "Địa chỉ kho": defaultWh?.address || "",
          "Người quản lý kho": defaultWh?.contact_person || "",
          "SĐT kho": defaultWh?.phone || "",
          "Số lô": "",
          "Hạn sử dụng": "",
          "Thuế GTGT (%)": product.tax_rate || 0,
          "Xuất xứ": product.origin || "",
          "Thương hiệu": product.brand || "",
          "Bảo hành": product.warranty_period || "",
          "Số chứng từ": "EXPORT_AUTO",
          "Ngày chứng từ": product.createdAt
            ? new Date(product.createdAt).toLocaleDateString("vi-VN")
            : new Date().toLocaleDateString("vi-VN"),
          "Ngày thêm": product.createdAt
            ? new Date(product.createdAt).toLocaleDateString("vi-VN")
            : "",
          "Người giao":
            product.supplier_id?.contact_person ||
            product.supplier_id?.name ||
            "",
          "Người nhận": defaultWh?.contact_person || "",
        });
      }
    }

    // --- FIX ALIGNMENT: Ensure all objects have keys in EXACT order of headers ---
    const finalExcelData = excelData.map((row) => {
      const orderedRow = {};
      PRODUCT_HEADERS.forEach((header) => {
        orderedRow[header] = row[header] !== undefined ? row[header] : "";
      });
      return orderedRow;
    });

    // Tạo workbook và worksheet
    const XLSX = require("xlsx");
    const workbook = XLSX.utils.book_new();

    // Tạo worksheet với dữ liệu, sử dụng PRODUCT_HEADERS
    const worksheet = XLSX.utils.json_to_sheet(finalExcelData, {
      header: PRODUCT_HEADERS,
    });

    // Định dạng cột chuyên nghiệp
    const columnWidths = PRODUCT_HEADERS.map(() => ({ wch: 15 }));
    columnWidths[0].wch = 30; // Tên
    columnWidths[1].wch = 25; // Mô tả
    columnWidths[12].wch = 20; // Tên kho
    columnWidths[13].wch = 25; // Địa chỉ kho

    worksheet["!cols"] = columnWidths;

    // Thêm worksheet vào workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sản phẩm");

    // Tạo buffer từ workbook
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    // Tạo tên file an toàn (loại bỏ ký tự đặc biệt)
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:]/g, "-");
    const safeStoreName = store.name
      .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g, "")
      .trim();
    const filename = `danh_sach_san_pham_${safeStoreName}_${timestamp}.xlsx`;

    // Encode filename cho an toàn
    const encodedFilename = encodeURIComponent(filename).replace(
      /['()]/g,
      escape
    );

    // Thiết lập headers cho response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("Content-Length", excelBuffer.length);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Pragma", "no-cache");

    console.log(` Export successful: ${filename}, ${products.length} products`);

    // Ghi log hoạt động
    try {
      await logActivity({
        user: req.user,
        store: { _id: storeId },
        action: "export",
        entity: "Product",
        entityId: storeId,
        entityName: "Danh sách sản phẩm",
        req,
        description: `Xuất danh sách ${products.length} sản phẩm từ cửa hàng ${store.name}`,
      });
      console.log(" Activity log created for export");
    } catch (logError) {
      console.error(
        " Lỗi ghi Activity Log (không ảnh hưởng export):",
        logError.message
      );
    }

    // Gửi file về client
    res.send(excelBuffer);
  } catch (error) {
    console.error(" Lỗi exportProducts:", error);
    res.status(500).json({
      message: "Lỗi server khi xuất danh sách sản phẩm",
      error: error.message,
    });
  }
};

// ============= GET ALL PRODUCTS - Lấy tất cả sản phẩm (cho dashboard, reports) =============
const getAllProducts = async (req, res) => {
  try {
    const { storeId, page = 1, limit = 50, status, category } = req.query;

    const filter = { isDeleted: false };

    if (storeId) {
      filter.store_id = storeId;
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (category) {
      filter.group_id = category;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("supplier_id", "name")
        .populate("group_id", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    const formattedProducts = products.map((p) => ({
      _id: p._id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: parseFloat(p.price?.toString() || 0),
      cost_price: parseFloat(p.cost_price?.toString() || 0),
      stock_quantity: p.stock_quantity,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      unit: p.unit,
      status: p.status,
      image: p.image,
      store: p.store_id,
      supplier: p.supplier_id,
      group: p.group_id,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      total,
      page: Number(page),
      limit: Number(limit),
      products: formattedProducts,
    });
  } catch (error) {
    console.error(" Lỗi getAllProducts:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE BATCH - Cập nhật thông tin lô hàng =============
const updateProductBatch = async (req, res) => {
  let session = null;

  try {
    const { productId } = req.params;
    const {
      old_batch_no,
      new_batch_no,
      expiry_date,
      cost_price,
      selling_price,
      quantity,
      warehouse_id,
      deliverer_name,
      deliverer_phone,
      receiver_name,
      receiver_phone,
    } = req.body;
    const userId = req.user?._id || req.user?.id;

    console.log(` Updating batch ${old_batch_no} for product ${productId}`);

    // 1. Chuyển đổi ID cực kỳ cẩn thận
    let objectId;
    try {
      if (mongoose.Types.ObjectId.isValid(productId)) {
        objectId = new mongoose.Types.ObjectId(productId);
      } else {
        throw new Error("Invalid format");
      }
    } catch (err) {
      return res.status(400).json({ message: "ID sản phẩm không hợp lệ" });
    }

    // 2. Tìm sản phẩm - Ghi đè điều kiện isDeleted để tránh bị middleware lọc mất
    // Ta tìm theo store_id nếu có thể, nhưng quan trọng nhất là ID
    let product = await Product.findOne({
      _id: objectId,
      $or: [
        { isDeleted: false },
        { isDeleted: true },
        { isDeleted: { $exists: false } },
      ],
    }).populate("supplier_id", "name phone");

    if (!product) {
      console.log(` Product truly not found even with raw query: ${productId}`);
      return res
        .status(404)
        .json({ message: "Sản phẩm không tồn tại trên hệ thống" });
    }

    // Nếu tìm thấy bằng findOne thô, ta đảm bảo nó là Mongoose Document
    if (!(product instanceof mongoose.Document)) {
      product = await Product.findById(product._id)
        .populate("supplier_id")
        .setOptions({ skipMiddleware: true });
    }

    console.log(
      ` Product found: ${product.name}, batches count: ${
        product.batches?.length || 0
      }`
    );
    console.log(
      ` Batches in DB:`,
      product.batches?.map((b) => b.batch_no)
    );

    // Tìm index của lô hàng cũ
    const batchIndex = product.batches.findIndex(
      (b) => b.batch_no === old_batch_no
    );
    if (batchIndex === -1) {
      console.log(` Batch not found: ${old_batch_no}`);
      return res
        .status(404)
        .json({ message: `Không tìm thấy lô ${old_batch_no}` });
    }

    // Lấy thông tin batch cũ để tính toán chênh lệch
    const oldBatch = { ...product.batches[batchIndex].toObject() };
    const newQuantity = quantity !== undefined ? quantity : oldBatch.quantity;
    const quantityDiff = newQuantity - (oldBatch.quantity || 0);

    // So sánh giá cũ và mới
    const oldCostPrice = oldBatch.cost_price || 0;
    const oldSellingPrice = oldBatch.selling_price || 0;
    const newCostPrice = cost_price !== undefined ? cost_price : oldCostPrice;
    const newSellingPrice =
      selling_price !== undefined ? selling_price : oldSellingPrice;
    const priceChanged =
      oldCostPrice !== newCostPrice || oldSellingPrice !== newSellingPrice;

    // 3. Cập nhật thông tin batch
    product.batches[batchIndex].batch_no = new_batch_no || old_batch_no;
    product.batches[batchIndex].expiry_date = expiry_date
      ? new Date(expiry_date)
      : oldBatch.expiry_date;
    product.batches[batchIndex].cost_price = newCostPrice;
    product.batches[batchIndex].selling_price = newSellingPrice;
    product.batches[batchIndex].quantity = newQuantity;
    product.batches[batchIndex].warehouse_id =
      warehouse_id || oldBatch.warehouse_id;

    // Cập nhật stock_quantity của product (tổng số lượng tất cả các lô)
    const projectedStock = product.batches.reduce((sum, b) => {
      const bQty =
        b.batch_no === (new_batch_no || old_batch_no)
          ? newQuantity
          : b.quantity || 0;
      return sum + bQty;
    }, 0);

    //  Validation: Kiểm tra tồn kho tối đa
    const maxStock =
      product.max_stock !== undefined && product.max_stock !== null
        ? Number(product.max_stock)
        : 0;
    if (maxStock > 0 && projectedStock > maxStock) {
      return res.status(400).json({
        message: `Không thể cập nhật: Tổng tồn kho (${projectedStock}) sẽ vượt quá hạn mức tối đa (${maxStock}) của sản phẩm này.`,
      });
    }

    product.stock_quantity = projectedStock;

    // Đồng bộ lại giá vốn và giá bán chính của sản phẩm (phục vụ báo cáo Biến thiên tồn kho/COGS)
    product.cost_price = newCostPrice;
    product.price = newSellingPrice;

    // Bắt đầu transaction khi cần save
    session = await mongoose.startSession();
    session.startTransaction();

    await product.save({ session });

    // So sánh kho cũ và mới
    const warehouseChanged =
      warehouse_id &&
      String(oldBatch.warehouse_id || "") !== String(warehouse_id || "");

    // ===== TẠO PHIẾU NHẬP/XUẤT KHO NẾU CÓ THAY ĐỔI SỐ LƯỢNG, GIÁ HOẶC KHO =====
    let createdVouchers = [];

    if (quantityDiff !== 0 || priceChanged || warehouseChanged) {
      // 📝 Thu thập thông tin chung
      const timestamp = Date.now().toString(36).toUpperCase();

      // Lấy thông tin warehouse nếu có
      let warehouseName = "";
      if (oldBatch.warehouse_id || warehouse_id) {
        const warehouseDoc = await Warehouse.findById(
          oldBatch.warehouse_id || warehouse_id
        );
        warehouseName = warehouseDoc?.name || "";
      }

      //  LẤY THÔNG TIN NHÀ CUNG CẤP (NGƯỜI GIAO)
      let supplierId = product.supplier_id?._id || product.supplier_id;
      let finalDelivererName =
        deliverer_name || product.supplier_id?.name || "";
      let finalDelivererPhone =
        deliverer_phone || product.supplier_id?.phone || "";

      // 👤 TỰ ĐỘNG LẤY THÔNG TIN NGƯỜI LƯU (NGƯỜI NHẬN)
      let finalReceiverName = receiver_name;
      let finalReceiverPhone = receiver_phone;
      if (!finalReceiverName && userId) {
        const currentUser = await User.findById(userId);
        if (currentUser) {
          finalReceiverName = currentUser.fullname || currentUser.username;
          finalReceiverPhone = currentUser.phone || "";
        }
      }

      // 🛠️ LOGIC TẠO PHIẾU
      const voucherBase = {
        store_id: product.store_id,
        voucher_date: new Date(),
        status: "POSTED",
        warehouse_id: oldBatch.warehouse_id || warehouse_id || null,
        warehouse_name: warehouseName,
        deliverer_name: finalDelivererName || "",
        deliverer_phone: finalDelivererPhone || "",
        receiver_name: finalReceiverName || "",
        receiver_phone: finalReceiverPhone || "",
        supplier_id: supplierId || null,
        supplier_name_snapshot: finalDelivererName || "",
        ref_type: "BATCH_ADJUSTMENT",
        ref_no: old_batch_no,
        created_by: userId,
        posted_by: userId,
        posted_at: new Date(),
      };

      if (priceChanged || warehouseChanged) {
        // TRƯỜNG HỢP 1: CÓ THAY ĐỔI GIÁ HOẶC THAY ĐỔI KHO -> "XUẤT CŨ - NHẬP MỚI"
        console.log(
          "🔄 Price or Warehouse changed, creating OUT and IN vouchers"
        );

        // 1. Phiếu Xuất (Xóa trạng thái cũ)
        if (oldBatch.quantity > 0) {
          const pxQty = Number(oldBatch.quantity || 0);
          const pxUnitCost = Number(oldCostPrice || 0);
          const pxLineCost = pxQty * pxUnitCost;
          const pxTotalAmount = pxQty * Number(oldSellingPrice || 0);

          const pxData = {
            ...voucherBase,
            type: "OUT",
            voucher_code: `PX-ADJ-${timestamp}-OLD`,
            reason: `Điều chỉnh giá (Xuất giá cũ): ${old_batch_no} - ${product.name}`,
            total_qty: pxQty,
            total_cost: mongoose.Types.Decimal128.fromString(
              String(pxLineCost)
            ),
            total_amount: mongoose.Types.Decimal128.fromString(
              String(pxTotalAmount)
            ),
            items: [
              {
                product_id: product._id,
                sku_snapshot: product.sku || "",
                name_snapshot: product.name,
                unit_snapshot: product.unit || "cái",
                warehouse_id: voucherBase.warehouse_id,
                warehouse_name: warehouseName,
                batch_no: old_batch_no,
                expiry_date: oldBatch.expiry_date,
                qty_document: pxQty,
                qty_actual: pxQty,
                unit_cost: mongoose.Types.Decimal128.fromString(
                  String(pxUnitCost)
                ),
                line_cost: mongoose.Types.Decimal128.fromString(
                  String(pxLineCost)
                ),
                selling_price: mongoose.Types.Decimal128.fromString(
                  String(oldSellingPrice || 0)
                ),
                note: `Xuất kho để cập nhật giá mới (Giá cũ: ${pxUnitCost.toLocaleString()})`,
                supplier_id: supplierId || null,
                supplier_name_snapshot: finalDelivererName || "",
              },
            ],
          };
          const px = await InventoryVoucher.create([pxData], { session });
          createdVouchers.push(px[0]);
        }

        // 2. Phiếu Nhập (Ghi nhận trạng thái mới)
        if (newQuantity > 0) {
          const pnQty = Number(newQuantity || 0);
          const pnUnitCost = Number(newCostPrice || 0);
          const pnUnitSelling = Number(newSellingPrice || 0);
          const pnLineCost = pnQty * pnUnitCost;
          const pnTotalAmount = pnQty * pnUnitSelling;

          const pnData = {
            ...voucherBase,
            type: "IN",
            voucher_code: `PN-ADJ-${timestamp}-NEW`,
            reason: `Điều chỉnh giá (Nhập giá mới): ${
              new_batch_no || old_batch_no
            } - ${product.name}`,
            total_qty: pnQty,
            total_cost: mongoose.Types.Decimal128.fromString(
              String(pnLineCost)
            ),
            total_amount: mongoose.Types.Decimal128.fromString(
              String(pnTotalAmount)
            ),
            items: [
              {
                product_id: product._id,
                sku_snapshot: product.sku || "",
                name_snapshot: product.name,
                unit_snapshot: product.unit || "cái",
                warehouse_id: voucherBase.warehouse_id,
                warehouse_name: warehouseName,
                batch_no: new_batch_no || old_batch_no,
                expiry_date: expiry_date
                  ? new Date(expiry_date)
                  : oldBatch.expiry_date,
                qty_document: pnQty,
                qty_actual: pnQty,
                unit_cost: mongoose.Types.Decimal128.fromString(
                  String(pnUnitCost)
                ),
                line_cost: mongoose.Types.Decimal128.fromString(
                  String(pnLineCost)
                ),
                selling_price: mongoose.Types.Decimal128.fromString(
                  String(pnUnitSelling)
                ),
                note: `Nhập kho với giá mới (${pnUnitCost.toLocaleString()})${
                  quantityDiff !== 0 ? ` và sl mới (${pnQty})` : ""
                }`,
                supplier_id: supplierId || null,
                supplier_name_snapshot: finalDelivererName || "",
              },
            ],
          };
          const pn = await InventoryVoucher.create([pnData], { session });
          createdVouchers.push(pn[0]);
        }
      } else {
        // TRƯỜNG HỢP 2: CHỈ THAY ĐỔI SỐ LƯỢNG (GIÁ GIỮ NGUYÊN) -> DÙNG PHIẾU NHẬP/XUẤT (Positive)
        console.log("📉 Quantity changed, creating IN/OUT voucher adjustment");

        // Nếu quantityDiff > 0: Tăng số lượng -> Tạo phiếu NHẬP (IN)
        // Nếu quantityDiff < 0: Giảm số lượng -> Tạo phiếu XUẤT (OUT)

        const voucherType = quantityDiff >= 0 ? "IN" : "OUT";
        const prefix = voucherType === "IN" ? "PN" : "PX";
        const vQty = Math.abs(quantityDiff); // Luôn dùng số dương

        const vUnitCost = Number(newCostPrice || 0);
        const vLineCost = vQty * vUnitCost;
        const vTotalAmount = vQty * Number(newSellingPrice || 0);

        const vData = {
          ...voucherBase,
          type: voucherType,
          voucher_code: `${prefix}-ADJ-${timestamp}`,
          reason: `Điều chỉnh số lượng lô hàng ${old_batch_no} - ${product.name}`,
          total_qty: vQty,
          total_cost: mongoose.Types.Decimal128.fromString(String(vLineCost)),
          total_amount: mongoose.Types.Decimal128.fromString(
            String(vTotalAmount)
          ),
          items: [
            {
              product_id: product._id,
              sku_snapshot: product.sku || "",
              name_snapshot: product.name,
              unit_snapshot: product.unit || "cái",
              warehouse_id: voucherBase.warehouse_id,
              warehouse_name: warehouseName,
              batch_no: new_batch_no || old_batch_no,
              expiry_date: expiry_date
                ? new Date(expiry_date)
                : oldBatch.expiry_date,
              qty_document: vQty,
              qty_actual: vQty,
              unit_cost: mongoose.Types.Decimal128.fromString(
                String(vUnitCost)
              ),
              line_cost: mongoose.Types.Decimal128.fromString(
                String(vLineCost)
              ),
              selling_price: mongoose.Types.Decimal128.fromString(
                String(newSellingPrice || 0)
              ),
              note: `Điều chỉnh số lượng: ${
                oldBatch.quantity || 0
              } → ${newQuantity} (${
                quantityDiff > 0 ? "+" : ""
              }${quantityDiff})`,
              supplier_id: supplierId || null,
              supplier_name_snapshot: finalDelivererName || "",
            },
          ],
        };
        const v = await InventoryVoucher.create([vData], { session });
        createdVouchers.push(v[0]);
      }
    }

    await session.commitTransaction();
    session.endSession();

    console.log(` Batch ${new_batch_no || old_batch_no} updated successfully`);

    res.json({
      message: "Cập nhật lô hàng thành công",
      batch: product.batches[batchIndex],
      stock_quantity: product.stock_quantity,
      vouchers: createdVouchers.map((v) => ({
        code: v.voucher_code,
        type: v.type,
      })),
      // Giữ 'voucher' cho frontend cũ (lấy cái nhập mới nếu có 2 cái)
      voucher:
        createdVouchers.length > 0
          ? {
              code: createdVouchers[createdVouchers.length - 1].voucher_code,
              type: createdVouchers[createdVouchers.length - 1].type,
              quantityDiff,
              priceChanged,
            }
          : null,
    });
  } catch (error) {
    if (session && session.inTransaction()) {
      await session.abortTransaction();
    }
    if (session) session.endSession();
    console.error(" Lỗi updateProductBatch:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  // CUD
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  searchProducts,
  // Reads
  getProductsByStore,
  getProductById,
  getAllProducts,
  // Updates
  updateProductPrice,
  updateProductBatch, // NEW
  // thông báo, cảnh báo
  getLowStockProducts,
  getExpiringProducts,
  // Import/Export
  importProducts,
  downloadProductTemplate,
  exportProducts,
};
