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
const path = require("path");
const { cloudinary, deleteFromCloudinary } = require("../../utils/cloudinary");
const {
  parseExcelToJSON,
  validateRequiredFields,
  validateNumericField,
  sanitizeData,
} = require("../../utils/fileImport");

// ============= HELPER FUNCTIONS =============
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
      warranty_period
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

    // ===== SKU unique per store =====
    if (sku) {
      const existingProduct = await Product.findOne({
        sku,
        store_id: storeId,
        isDeleted: false,
      }).session(session);

      if (existingProduct) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(409)
          .json({ message: "Mã SKU này đã tồn tại trong cửa hàng" });
      }
    }

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

    console.log("📦 Kho mặc định được chọn:", {
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

      // ✅ GẮN KHO MẶC ĐỊNH VÀO PRODUCT
      default_warehouse_id: finalDefaultWarehouseId,
      default_warehouse_name: finalDefaultWarehouseName,

      // ✅ LEGAL FIELDS
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

        // ✅ GẮN KHO CHO PHIẾU (level header)
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

            // ✅ GẮN KHO CHO TỪNG DÒNG ITEM
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
              created_at: now
            }
          }
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
        description: `Nhập tồn đầu kỳ khi tạo sản phẩm ${newProduct.name
          } (SKU: ${newProduct.sku}) số lượng ${openingQty} ${finalDefaultWarehouseName
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
          // ✅ TRẢ VỀ THÔNG TIN KHO
          warehouse_id: createdVoucher.warehouse_id,
          warehouse_name: createdVoucher.warehouse_name,
        }
        : null,
    });
  } catch (error) {
    console.error("❌ Lỗi createProduct:", error);

    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) { }

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
      warranty_period
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

    // ===== SKU unique per store =====
    if (sku !== undefined && sku !== product.sku) {
      const existingProduct = await Product.findOne({
        sku,
        store_id: productStoreId,
        _id: { $ne: productId },
        isDeleted: false,
      }).session(session);

      if (existingProduct) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(409)
          .json({ message: "Mã SKU này đã tồn tại trong cửa hàng" });
      }
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
    };

    // ✅ THÊM: Update kho mặc định nếu có thay đổi
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

        const voucherCode = `${voucherType === "IN" ? "NK" : "XK"
          }-${y}${m}${d}-${product.sku}-${Date.now()}`;

        createdVoucher = new InventoryVoucher({
          store_id: productStoreId,
          type: voucherType,
          status: "POSTED",
          voucher_code: voucherCode,
          voucher_date: now,
          reason: "Điều chỉnh tồn kho khi cập nhật sản phẩm",

          // ✅ GẮN KHO CHO PHIẾU (dùng kho mặc định của product)
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

              // ✅ GẮN KHO CHO TỪNG DÒNG ITEM
              warehouse_id: finalDefaultWarehouseId || null,
              warehouse_name: finalDefaultWarehouseName || "",

              qty_document: absQty,
              qty_actual: absQty,

              unit_cost: mongoose.Types.Decimal128.fromString(
                String(effectiveCost)
              ),
              note: `Set tồn từ ${currentQty} -> ${targetStockQty} (delta ${delta > 0 ? "+" : "-"
                }${absQty})`,
            },
          ],
        });

        await createdVoucher.save({ session });

        // cập nhật tồn kho bằng $inc: SỬA field đúng stock_quantity (không phải stockquantity)
        await Product.updateOne(
          { _id: productId, store_id: productStoreId, isDeleted: false },
          { $inc: { stock_quantity: delta } }, // ✅ Sửa field đúng
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
        description: `Điều chỉnh tồn kho sản phẩm ${updatedProduct.name}: ${createdVoucher.type
          } ${finalDefaultWarehouseName
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
          // ✅ TRẢ VỀ THÔNG TIN KHO
          warehouse_id: createdVoucher.warehouse_id,
          warehouse_name: createdVoucher.warehouse_name,
        }
        : null,
    });
  } catch (error) {
    console.error("❌ Lỗi updateProduct:", error);

    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) { }

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
    console.error("❌ Lỗi deleteProduct:", error);

    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) { }

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
        .populate("supplier_id", "name")
        .populate("store_id", "name")
        .populate("group_id", "name")
        .populate("default_warehouse_id", "name") // ✅ ĐÚNG schema của bạn
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

      // ✅ Field đúng theo schema
      default_warehouse_id: p.default_warehouse_id?._id || null,
      default_warehouse: p.default_warehouse_id || null,
      default_warehouse_name:
        p.default_warehouse_name || p.default_warehouse_id?.name || "",

      // ✅ (Tuỳ chọn) Alias để khỏi sửa frontend nếu đang dùng warehouse_id/warehouse
      warehouse_id: p.default_warehouse_id?._id || null,
      warehouse: p.default_warehouse_id || null,
      warehouse_name:
        p.default_warehouse_name || p.default_warehouse_id?.name || "",

      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      total,
      page: Number(page),
      limit: Number(limit),
      products: formattedProducts,
    });
  } catch (error) {
    console.error("❌ Lỗi getProductsByStore:", error);
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
      .populate("default_warehouse_id", "name"); // ✅ ĐÚNG schema

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

      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return res.status(200).json({
      message: "Lấy thông tin sản phẩm thành công",
      product: formattedProduct,
    });
  } catch (error) {
    console.error("❌ Lỗi getProductById:", error);
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
    console.error("❌ Lỗi updateProductPrice:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

//Lấy list sản phẩm tồn kho thấp (stock <= min_stock, status "Đang kinh doanh", min_stock > 0, lowStockAlerted = false)
const getLowStockProducts = async (req, res) => {
  try {
    const { storeId } = req.query; // Filter theo storeId (optional, cho manager multi-store)

    const query = {
      stock_quantity: { $lte: "$min_stock" }, // Tồn kho <= min_stock
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
      `Query low stock thành công, số lượng: ${lowStockProds.length
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

// GET /api/products/search - Tìm sản phẩm theo tên hoặc SKU (regex case-insensitive)
const searchProducts = async (req, res) => {
  try {
    const { query, storeId, limit = 10 } = req.query; // Params: query (tên/SKU), storeId, limit (default 10)

    if (!query || query.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Query tìm kiếm không được để trống" });
    }

    const searchQuery = {
      $or: [
        { name: { $regex: query.trim(), $options: "i" } }, // Tìm tên (case-insensitive)
        { sku: { $regex: query.trim(), $options: "i" } }, // Tìm SKU (case-insensitive)
      ],
      status: "Đang kinh doanh", // Chỉ sản phẩm đang bán
      store_id: new mongoose.Types.ObjectId(storeId), // Filter store của staff/manager
      isDeleted: false, // Chỉ tìm sản phẩm chưa bị xóa
    };

    const products = await Product.find(searchQuery)
      .select("image name sku price cost_price stock_quantity unit") // Chỉ lấy field cần thiết
      .sort({ name: 1 }) // Sắp xếp theo tên A-Z
      .limit(parseInt(limit)) // Limit số kết quả
      .lean(); // Lean cho nhanh

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
    console.error("❌ Lỗi deleteProductImage:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const importProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên file" });
    }

    const user = await User.findById(userId).lean();
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    const store = await Store.findById(storeId).lean();
    if (!store)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });

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
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "File không có dữ liệu hợp lệ" });
    }

    const results = {
      success: [],
      failed: [],
      total: data.length,
      debug: {
        processedRows: 0,
        suppliersUsed: 0,
        productsCreated: 0,
        productsUpdated: 0,
        vouchersCreated: 0,
      },
    };

    // ===== KHO MẶC ĐỊNH =====
    const warehouseId = store.default_warehouse_id || null;
    const warehouseName = store.default_warehouse_name || "Kho mặc định";

    // ===== CACHE =====
    const suppliers = await Supplier.find({
      store_id: storeId,
      isDeleted: false,
    }).lean();

    const supplierMap = new Map(
      suppliers.map((s) => [s.name.toLowerCase(), s])
    );

    const groups = await ProductGroup.find({
      storeId: storeId, // Fix: Model uses storeId
      isDeleted: false,
    }).lean();

    const groupMap = new Map(
      groups.map((g) => [g.name.toLowerCase(), g])
    );

    const existingProducts = await Product.find({
      store_id: storeId,
      isDeleted: false,
    })
      .select("sku")
      .lean();

    const existingSKUs = new Set(existingProducts.map((p) => p.sku));

    let skuCounter =
      (
        await Product.findOne({ isDeleted: false })
          .sort({ sku: -1 })
          .select("sku")
          .lean()
      )?.sku?.replace(/\D/g, "") || 0;

    const generateSKU = async () => {
      while (true) {
        skuCounter++;
        const sku = `SP${String(skuCounter).padStart(6, "0")}`;
        if (!existingSKUs.has(sku)) {
          existingSKUs.add(sku);
          return sku;
        }
      }
    };

    // Helper: Parse Date an toàn (hỗ trợ dd/mm/yyyy, yyyy-mm-dd, Excel date)
    const parseImportDate = (str) => {
      if (!str) return null;
      // Nếu là số (Excel serial date)
      if (typeof str === "number") {
        return new Date(Math.round((str - 25569) * 86400 * 1000));
      }
      // Nếu là string
      const s = String(str).trim();

      // Định dạng dd/mm/yyyy
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split("/").map(Number);
        return new Date(y, m - 1, d);
      }
      // Định dạng dd-mm-yyyy
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      }

      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    // ================= IMPORT LOOP =================
    for (let i = 0; i < data.length; i++) {
      const session = await mongoose.startSession();
      session.startTransaction();
      results.debug.processedRows++;

      try {
        const row = sanitizeData(data[i]);
        const rowNumber = i + 2;

        const price = Number(row["Giá bán"] || 0);
        const cost = Number(row["Giá vốn"] || 0);
        const openingQty = Number(row["Tồn kho"] || 0);

        let sku = row["Mã SKU"]?.trim();
        if (!sku) sku = await generateSKU();

        // --- SUPPLIER (Auto Create) ---
        let supplierId = null;
        let supplierName = row["Nhà cung cấp"] ? row["Nhà cung cấp"].trim() : "";
        if (supplierName) {
          const lowerName = supplierName.toLowerCase();
          if (supplierMap.has(lowerName)) {
            supplierId = supplierMap.get(lowerName)._id;
          } else {
            // Create new Supplier
            const newSupplier = new Supplier({
              name: supplierName,
              store_id: storeId,
            });
            await newSupplier.save({ session });
            supplierId = newSupplier._id;
            // Update cache
            supplierMap.set(lowerName, newSupplier);
          }
        }

        // --- GROUP (Auto Create) ---
        let groupId = null;
        let groupName = row["Nhóm sản phẩm"] ? row["Nhóm sản phẩm"].trim() : "";
        if (groupName) {
          const lowerName = groupName.toLowerCase();
          if (groupMap.has(lowerName)) {
            groupId = groupMap.get(lowerName)._id;
          } else {
            // Create new Group
            const newGroup = new ProductGroup({
              name: groupName,
              storeId: storeId, // Fix: Model uses storeId
              description: "Tự động tạo từ Import Excel"
            });
            await newGroup.save({ session });
            groupId = newGroup._id;
            // Update cache
            groupMap.set(lowerName, newGroup);
          }
        }

        let product = await Product.findOne({
          sku,
          store_id: storeId,
          isDeleted: false,
        }).session(session);

        let isNew = false;

        if (product) {
          // Legal fields
          const taxRate = row["Thuế GTGT (%)"] !== undefined ? Number(row["Thuế GTGT (%)"]) : 0;
          const origin = row["Xuất xứ"] ? row["Xuất xứ"].toString().trim() : "";
          const brand = row["Thương hiệu"] ? row["Thương hiệu"].toString().trim() : "";
          const warranty = row["Bảo hành"] ? row["Bảo hành"].toString().trim() : "";
          const unit = row["Đơn vị"] ? row["Đơn vị"].toString().trim() : "";

          await Product.updateOne(
            { _id: product._id },
            {
              $set: {
                name: row["Tên sản phẩm"],
                price,
                cost_price: cost,
                supplier_id: supplierId,
                group_id: groupId,
                unit: unit,
                // Update legal fields
                tax_rate: isNaN(taxRate) ? 0 : taxRate,
                origin: origin,
                brand: brand,
                warranty_period: warranty
              },
            },
            { session }
          );
          product = await Product.findById(product._id).session(session);
          results.debug.productsUpdated++;
        } else {
          // Legal fields
          const taxRate = row["Thuế GTGT (%)"] !== undefined ? Number(row["Thuế GTGT (%)"]) : 0;
          const origin = row["Xuất xứ"] ? row["Xuất xứ"].toString().trim() : "";
          const brand = row["Thương hiệu"] ? row["Thương hiệu"].toString().trim() : "";
          const warranty = row["Bảo hành"] ? row["Bảo hành"].toString().trim() : "";
          const unit = row["Đơn vị"] ? row["Đơn vị"].toString().trim() : "";

          product = new Product({
            name: row["Tên sản phẩm"],
            sku,
            price,
            cost_price: cost,
            stock_quantity: 0,
            store_id: storeId,
            supplier_id: supplierId,
            group_id: groupId,
            default_warehouse_id: warehouseId,
            default_warehouse_name: warehouseName,
            createdBy: userId,
            unit: unit,

            // Save legal fields
            tax_rate: isNaN(taxRate) ? 0 : taxRate,
            origin: origin,
            brand: brand,
            warranty_period: warranty
          });
          await product.save({ session });
          results.debug.productsCreated++;
          isNew = true;
        }

        // ===== TẠO PHIẾU NHẬP KHO =====
        if (openingQty > 0) {
          const now = new Date();

          const voucher = new InventoryVoucher({
            store_id: storeId,
            type: "IN",
            status: "POSTED",

            voucher_code: `NK-${now.getTime()}-${sku}`,
            voucher_date: now,

            reason: isNew
              ? "Nhập tồn đầu kỳ khi import sản phẩm"
              : "Nhập bổ sung tồn kho khi import",

            warehouse_id: warehouseId,
            warehouse_name: warehouseName,

            // ===== NGHIỆP VỤ ĐẦY ĐỦ =====
            supplier_id: supplierId,
            supplier_name_snapshot: supplier?.name || "",

            partner_name: supplier?.name || "Nhập file Excel",
            partner_phone: supplier?.phone || "",
            partner_address: supplier?.address || "",

            deliverer_name: supplier?.contact_person || "Nhà cung cấp",
            receiver_name: user.fullname || user.username,

            ref_type: isNew ? "PRODUCT_IMPORT_CREATE" : "PRODUCT_IMPORT_UPDATE",
            ref_no: row["Số chứng từ"] || "",
            ref_date: parseImportDate(row["Ngày chứng từ"]),

            created_by: userId,
            posted_by: userId,
            posted_at: now,

            items: [
              {
                product_id: product._id,
                supplier_id: supplierId,
                supplier_name_snapshot: supplier?.name || "",

                sku_snapshot: product.sku,
                name_snapshot: product.name,
                unit_snapshot: product.unit || "",

                warehouse_id: warehouseId,
                warehouse_name: warehouseName,

                qty_document: openingQty,
                qty_actual: openingQty,

                unit_cost: mongoose.Types.Decimal128.fromString(String(cost)),
                // Support Batch & Expiry
                batch_no: row["Số lô"] || "",
                expiry_date: parseImportDate(row["Hạn sử dụng"]),
                note: "Nhập tồn khi import Excel",
              },
            ],
          });

          await voucher.save({ session });

          // ===== UPDATE PRODUCT BATCHES (QUẢN LÝ LÔ) =====
          const batchNo = row["Số lô"] ? row["Số lô"].toString().trim() : "";
          const expiryDate = parseImportDate(row["Hạn sử dụng"]);

          if (batchNo || expiryDate) {
            await Product.updateOne(
              { _id: product._id },
              {
                $inc: { stock_quantity: openingQty },
                $push: {
                  batches: {
                    batch_no: batchNo || `BATCH-${Date.now()}`,
                    expiry_date: expiryDate,
                    cost_price: cost,
                    quantity: openingQty,
                    warehouse_id: warehouseId,
                    created_at: new Date()
                  }
                }
              },
              { session }
            );
          } else {
            await Product.updateOne(
              { _id: product._id },
              { $inc: { stock_quantity: openingQty } },
              { session }
            );
          }

          results.debug.vouchersCreated++;
        }

        await session.commitTransaction();
        session.endSession();

        results.success.push({
          row: rowNumber,
          sku,
          product: product.name,
        });
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        results.failed.push({
          row: i + 2,
          error: err.message,
        });
      }
    }

    return res.status(200).json({
      message: "Import hoàn tất",
      results,
    });
  } catch (error) {
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

    // Các cột trong template import
    const headers = [
      "Tên sản phẩm",
      "Mã SKU",
      "Giá bán",
      "Giá vốn",
      "Tồn kho",
      "Đơn vị",
      "Nhà cung cấp",
      "Nhóm sản phẩm",      // New: Cho phép import nhóm
      "Số lô",
      "Hạn sử dụng",
      "Thuế GTGT (%)",      // New
      "Xuất xứ",            // New
      "Thương hiệu",        // New
      "Bảo hành",           // New
      "Số chứng từ",
      "Ngày chứng từ",
    ];

    // Tạo dữ liệu mẫu (1 dòng ví dụ + dòng trống)
    const sampleData = [
      [
        "Coca Cola Lon 330ml", // Tên
        "SP000001",            // SKU (optional)
        10000,                 // Giá bán
        8000,                  // Giá vốn
        100,                   // Tồn
        "Lon",                 // Đơn vị
        "Công ty CocaCola",    // Nhà cung cấp
        "Đồ uống",             // Nhóm sản phẩm
        "BATCH001",            // Số lô
        "31/12/2026",          // Hạn dùng (dd/mm/yyyy)
        10,                    // Thuế GTGT
        "Việt Nam",            // Xuất xứ
        "CocaCola",            // Thương hiệu
        "12 tháng",            // Bảo hành
        "NK001",               // Số chứng từ
        "01/01/2025",          // Ngày chứng từ (dd/mm/yyyy)
      ],
    ];

    // Tạo sheet từ mảng
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

    // Định dạng độ rộng cột cho dễ nhìn
    const wscols = [
      { wch: 25 }, // Tên
      { wch: 15 }, // SKU
      { wch: 12 }, // Giá bán
      { wch: 12 }, // Giá vốn
      { wch: 10 }, // Tồn
      { wch: 10 }, // Đơn vị
      { wch: 20 }, // Nhà cung cấp
      { wch: 15 }, // Số lô
      { wch: 15 }, // Hạn sử dụng
      { wch: 15 }, // Số chứng từ
      { wch: 15 }, // Ngày chứng từ
    ];
    worksheet["!cols"] = wscols;

    // Add sheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    // Tạo buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    const filename = "product_import_template_v2.xlsx";
    const encodedFilename = encodeURIComponent(filename).replace(
      /['()]/g,
      escape
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("Content-Length", excelBuffer.length);

    console.log("✅ Generated dynamic Import Template with Batch/Expiry");
    return res.send(excelBuffer);
  } catch (error) {
    console.error("❌ Lỗi downloadProductTemplate:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
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
      console.log(`❌ Store not found: ${storeId}`);
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // ĐÃ LOẠI BỎ CHECK ROLE - Mọi user đã xác thực đều có thể export

    // Lấy tất cả sản phẩm của cửa hàng
    const products = await Product.find({
      store_id: storeId,
      isDeleted: false,
    })
      .populate("supplier_id", "name")
      .populate("group_id", "name")
      .sort({ createdAt: -1 });

    console.log(`📊 Found ${products.length} products for export`);

    if (products.length === 0) {
      return res.status(404).json({
        message: "Không có sản phẩm nào để xuất",
      });
    }

    // Chuẩn bị dữ liệu cho Excel
    const excelData = products.map((product) => ({
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
    }));

    // Tạo workbook và worksheet
    const XLSX = require("xlsx");
    const workbook = XLSX.utils.book_new();

    // Tạo worksheet với dữ liệu
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Đặt tiêu đề cột theo template
    const headers = [
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
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });

    // Định dạng cột
    const columnWidths = [
      { wch: 20 }, // Tên sản phẩm
      { wch: 15 }, // Mô tả
      { wch: 12 }, // Mã SKU
      { wch: 10 }, // Giá bán
      { wch: 10 }, // Giá vốn
      { wch: 10 }, // Tồn kho
      { wch: 15 }, // Tồn kho tối thiểu
      { wch: 15 }, // Tồn kho tối đa
      { wch: 8 }, // Đơn vị
      { wch: 15 }, // Trạng thái
      { wch: 15 }, // Nhà cung cấp
      { wch: 15 }, // Nhóm sản phẩm
    ];

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

    console.log(
      `✅ Export successful: ${filename}, ${products.length} products`
    );

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
      console.log("✅ Activity log created for export");
    } catch (logError) {
      console.error(
        "❌ Lỗi ghi Activity Log (không ảnh hưởng export):",
        logError.message
      );
    }

    // Gửi file về client
    res.send(excelBuffer);
  } catch (error) {
    console.error("❌ Lỗi exportProducts:", error);
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
    console.error("❌ Lỗi getAllProducts:", error);
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
  // thông báo, cảnh báo
  getLowStockProducts,
  // Import/Export
  importProducts,
  downloadProductTemplate,
  exportProducts,
};
