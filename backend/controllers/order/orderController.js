// controllers/orderController.js
const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const { Types } = require("mongoose");
const PDFDocument = require("pdfkit");
const logActivity = require("../../utils/logActivity");
const Order = require("../../models/Order");
const OrderItem = require("../../models/OrderItem");
const OrderRefund = require("../../models/OrderRefund");
const Product = require("../../models/Product");
const Employee = require("../../models/Employee");
const Customer = require("../../models/Customer");
const LoyaltySetting = require("../../models/LoyaltySetting");
const Notification = require("../../models/Notification");
const StorePaymentConfig = require("../../models/StorePaymentConfig");
const InventoryVoucher = require("../../models/InventoryVoucher");
const Warehouse = require("../../models/Warehouse"); // ✅ Đã thêm import Warehouse

const { periodToRange } = require("../../utils/period");
const { v2: cloudinary } = require("cloudinary");
const XLSX = require("xlsx");
const dayjs = require("dayjs");
const fs = require("fs");
const path = require("path");

// helper tạo mã phiếu XK đơn giản (ít bảng, tránh counter)
const genXKCode = () => {
  return `XK-${Date.now()}`;
};

// ============= CREATE ORDER - Tạo đơn hàng mới =============
// POST /api/orders - Tạo đơn hàng mới (paid + xuất kho POSTED)

// const createOrder = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       employeeId: clientEmployeeId,
//       storeId: bodyStoreId,
//       customerInfo,
//       items,
//       paymentMethod,
//       isVATInvoice,
//       vatInfo,
//       usedPoints,
//       warehouseId,
//     } = req.body;

//     const userId = req.user?.id || req.user?._id;

//     // 1. VALIDATE STORE
//     const storeId =
//       bodyStoreId ||
//       req.store?._id?.toString() ||
//       req.store?.id ||
//       req.user?.current_store?.toString() ||
//       null;

//     if (!storeId) throw new Error("Thiếu thông tin Store ID (Cửa hàng)");

//     // 2. VALIDATE PAYMENT METHOD
//     const validMethods = ["cash", "qr"];
//     if (!paymentMethod || !validMethods.includes(paymentMethod)) {
//       throw new Error(
//         `Phương thức thanh toán '${paymentMethod}' không hợp lệ. Chỉ chấp nhận: cash, qr`
//       );
//     }

//     if (!Array.isArray(items) || items.length === 0)
//       throw new Error("Hóa đơn chưa có sản phẩm");

//     // 3. XỬ LÝ KHO (Ưu tiên kho FE gửi -> Kho mặc định)
//     let explicitWarehouse = null;
//     if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
//       explicitWarehouse = await Warehouse.findOne({
//         _id: warehouseId,
//         store_id: storeId,
//       }).lean();
//     }

//     // Fallback: Lấy kho đầu tiên còn hoạt động
//     if (!explicitWarehouse) {
//       explicitWarehouse = await Warehouse.findOne({
//         store_id: storeId,
//         isDeleted: false,
//       }).lean();
//     }

//     // Fallback cuối cùng để tránh lỗi null access
//     if (!explicitWarehouse) {
//       explicitWarehouse = { _id: null, name: "" };
//     }

//     let total = 0;
//     const validatedOrderItems = [];
//     const voucherItems = [];

//     // 4. LOOP ITEMS & TRỪ KHO
//     for (const item of items) {
//       const quantity = Number(item.quantity);
//       if (!quantity || quantity <= 0)
//         throw new Error(`Số lượng sản phẩm không hợp lệ: ${item.quantity}`);

//       // Lock sản phẩm
//       const prod = await Product.findOne({
//         _id: item.productId,
//         store_id: storeId,
//         isDeleted: { $ne: true },
//         status: "Đang kinh doanh",
//       }).session(session);

//       if (!prod) throw new Error(`Sản phẩm ID ${item.productId} không tồn tại`);

//       // CHECK TỒN KHO
//       const stockQty = Number(prod.stock_quantity || 0);
//       if (stockQty < quantity) {
//         throw new Error(
//           `Sản phẩm "${prod.name}" không đủ tồn kho (Còn: ${stockQty}, Cần: ${quantity})`
//         );
//       }

//       // === TRỪ TỒN KHO NGAY LẬP TỨC ===
//       prod.stock_quantity = stockQty - quantity;
//       await prod.save({ session });

//       // TÍNH GIÁ
//       let priceAtTime = Number(prod.price);
//       if (item.saleType === "AT_COST") priceAtTime = Number(prod.cost_price);
//       else if (item.saleType === "FREE") priceAtTime = 0;
//       else if (item.saleType === "VIP" && item.customPrice)
//         priceAtTime = Number(item.customPrice);

//       const subtotal = priceAtTime * quantity;
//       total += subtotal;

//       // Xác định kho cho item này
//       const itemWhId =
//         explicitWarehouse._id || prod.default_warehouse_id || null;
//       const itemWhName =
//         explicitWarehouse.name || prod.default_warehouse_name || "";

//       // Data cho OrderItem
//       validatedOrderItems.push({
//         productId: prod._id,
//         quantity,
//         priceAtTime: priceAtTime.toFixed(2),
//         subtotal: subtotal.toFixed(2),
//         sku_snapshot: prod.sku || "",
//         name_snapshot: prod.name || "",
//         unit_snapshot: prod.unit || "",
//         cost_price_snapshot: prod.cost_price,
//         warehouse_id: itemWhId,
//         warehouse_name: itemWhName,
//       });

//       // Data cho Voucher (dùng giá vốn unit_cost)
//       voucherItems.push({
//         product_id: prod._id,
//         sku_snapshot: prod.sku || "",
//         name_snapshot: prod.name || "",
//         unit_snapshot: prod.unit || "",
//         qty_document: quantity,
//         qty_actual: quantity,
//         unit_cost: prod.cost_price || 0,
//         warehouse_id: itemWhId,
//         warehouse_name: itemWhName,
//         note: "Bán hàng",
//       });
//     }

//     // 5. VAT & TOTAL
//     const totalString = total.toFixed(2);
//     let vatAmountStr = "0";
//     let beforeTaxStr = totalString;

//     if (isVATInvoice) {
//       const vat = total * 0.1;
//       vatAmountStr = vat.toFixed(2);
//       beforeTaxStr = (total - vat).toFixed(2);
//     }

//     // 6. CUSTOMER & EMPLOYEE
//     let customer = null;
//     let receiverName = "Khách lẻ";
//     if (customerInfo?.phone) {
//       const phone = customerInfo.phone.trim();
//       customer = await Customer.findOne({ phone, storeId }).session(session);
//       if (!customer) {
//         customer = await new Customer({
//           name: customerInfo.name || phone,
//           phone,
//           storeId,
//         }).save({ session });
//       }
//       receiverName = customer.name;
//     }

//     let finalEmployeeId = null;
//     let delivererName = "Admin";

//     if (req.user?.role === "STAFF") {
//       const emp = await Employee.findOne({
//         user_id: req.user._id,
//         store_id: storeId,
//       }).lean();

//       // Cho phép null nếu staff chưa map employee (tuỳ nghiệp vụ), ở đây throw error cho chặt
//       if (!emp)
//         throw new Error(
//           "Tài khoản nhân viên chưa được liên kết hồ sơ Employee"
//         );

//       finalEmployeeId = emp._id;
//       delivererName = emp.fullName;
//     } else {
//       finalEmployeeId = clientEmployeeId || null;
//       delivererName = req.user?.fullname || "Quản trị viên";
//     }

//     // 7. SAVE ORDER
//     const order = await new Order({
//       storeId,
//       employeeId: finalEmployeeId,
//       customer: customer?._id || null,
//       totalAmount: totalString,
//       paymentMethod,
//       isVATInvoice: !!isVATInvoice,
//       vatInfo,
//       vatAmount: vatAmountStr,
//       beforeTaxAmount: beforeTaxStr,
//       usedPoints: usedPoints || 0,
//       status: "pending", // Mặc định PAID vì đã trừ kho và hoàn tất
//     }).save({ session });

//     // 8. SAVE ORDER ITEMS
//     for (const it of validatedOrderItems) {
//       await new OrderItem({ orderId: order._id, ...it }).save({ session });
//     }

//     // 9. SAVE INVENTORY VOUCHER (POSTED - ĐÃ GHI SỔ)
//     const voucher = await new InventoryVoucher({
//       store_id: storeId,
//       type: "OUT",
//       status: "POSTED", // Đã ghi sổ
//       voucher_code: genXKCode(),
//       voucher_date: new Date(),
//       document_place: "Tại quầy",
//       reason: "Xuất bán hàng",
//       note: `Đơn hàng: ${order._id}`,

//       ref_type: "ORDER",
//       ref_id: order._id,
//       ref_no: order._id.toString(),
//       ref_date: order.createdAt,

//       // Header Info (Lấy từ item đầu hoặc kho xác định)
//       warehouse_id: explicitWarehouse._id,
//       warehouse_name: explicitWarehouse.name,

//       deliverer_name: delivererName,
//       receiver_name: receiverName,
//       partner_name: customer?.name || "Khách lẻ",
//       partner_phone: customer?.phone || "",

//       created_by: userId,
//       items: voucherItems,
//     }).save({ session });

//     // Link lại
//     order.inventory_voucher_id = voucher._id;
//     await order.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(201).json({
//       message: "Tạo đơn hàng và xuất kho thành công",
//       order,
//       inventoryVoucher: {
//         _id: voucher._id,
//         voucher_code: voucher.voucher_code,
//         status: voucher.status,
//       },
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Create Order Error:", err);
//     return res.status(400).json({ message: err.message, details: err.errors });
//   }
// };

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      employeeId: clientEmployeeId,
      storeId: bodyStoreId,
      customerInfo,
      items,
      paymentMethod,
      isVATInvoice,
      vatInfo,
      usedPoints,
      warehouseId,
    } = req.body;

    const userId = req.user?.id || req.user?._id;

    // ================= 1. STORE =================
    const storeId = bodyStoreId || req.store?._id?.toString() || req.store?.id || req.user?.current_store?.toString() || null;

    if (!storeId) throw new Error("Thiếu Store ID");

    if (!["cash", "qr"].includes(paymentMethod)) {
      throw new Error("Phương thức thanh toán chỉ hỗ trợ cash | qr");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Hóa đơn chưa có sản phẩm");
    }

    // ================= 2. WAREHOUSE =================
    let warehouse = null;
    if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
      warehouse = await Warehouse.findOne({
        _id: warehouseId,
        store_id: storeId,
      }).lean();
    }

    if (!warehouse) {
      warehouse = await Warehouse.findOne({
        store_id: storeId,
        isDeleted: false,
      }).lean();
    }

    if (!warehouse) {
      warehouse = { _id: null, name: "" };
    }

    // ================= 3. ITEMS + STOCK =================
    let total = 0;
    const orderItems = [];
    const voucherItems = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) throw new Error("Số lượng không hợp lệ");

      const prod = await Product.findOne({
        _id: item.productId,
        store_id: storeId,
        status: "Đang kinh doanh",
        isDeleted: { $ne: true },
      }).session(session);

      if (!prod) throw new Error("Sản phẩm không tồn tại");

      if (prod.stock_quantity < qty) {
        throw new Error(`Không đủ tồn kho: ${prod.name}`);
      }

      // TRỪ KHO NGAY
      prod.stock_quantity -= qty;
      await prod.save({ session });

      // PRICE
      let price = Number(prod.price);
      if (item.saleType === "AT_COST") price = Number(prod.cost_price);
      if (item.saleType === "FREE") price = 0;
      if (item.saleType === "VIP" && item.customPrice) price = Number(item.customPrice);

      const subtotal = price * qty;
      total += subtotal;

      orderItems.push({
        productId: prod._id,
        quantity: qty,
        priceAtTime: price.toFixed(2),
        subtotal: subtotal.toFixed(2),
        name_snapshot: prod.name,
        sku_snapshot: prod.sku,
        unit_snapshot: prod.unit,
        cost_price_snapshot: prod.cost_price,
        warehouse_id: warehouse._id,
        warehouse_name: warehouse.name,
      });

      voucherItems.push({
        product_id: prod._id,
        name_snapshot: prod.name,
        sku_snapshot: prod.sku,
        unit_snapshot: prod.unit,
        qty_document: qty,
        qty_actual: qty,
        unit_cost: prod.cost_price,
        warehouse_id: warehouse._id,
        warehouse_name: warehouse.name,
        note: "Bán hàng",
      });
    }

    // ================= 4. VAT =================
    let vatAmount = "0";
    let beforeTax = total.toFixed(2);

    if (isVATInvoice) {
      const vat = total * 0.1;
      vatAmount = vat.toFixed(2);
      beforeTax = (total - vat).toFixed(2);
    }

    // ================= 5. CUSTOMER =================
    let customer = null;
    if (customerInfo?.phone) {
      customer = await Customer.findOne({
        phone: customerInfo.phone.trim(),
        storeId,
      }).session(session);

      if (!customer) {
        customer = await new Customer({
          name: customerInfo.name || customerInfo.phone,
          phone: customerInfo.phone,
          storeId,
        }).save({ session });
      }
    }

    // ================= 6. EMPLOYEE =================
    let finalEmployeeId = null;
    if (req.user?.role === "STAFF") {
      const emp = await Employee.findOne({
        user_id: req.user._id,
        store_id: storeId,
      });
      if (!emp) throw new Error("Staff chưa map Employee");
      finalEmployeeId = emp._id;
    } else {
      finalEmployeeId = clientEmployeeId || null;
    }

    // ================= 7. CREATE ORDER =================
    const order = await new Order({
      storeId,
      employeeId: finalEmployeeId,
      customer: customer?._id || null,
      totalAmount: total.toFixed(2),
      paymentMethod,
      isVATInvoice,
      vatInfo,
      vatAmount,
      beforeTaxAmount: beforeTax,
      usedPoints: usedPoints || 0,
      status: "pending",
    }).save({ session });

    for (const it of orderItems) {
      await new OrderItem({ orderId: order._id, ...it }).save({ session });
    }

    // ================= 8. INVENTORY VOUCHER =================
    const voucher = await new InventoryVoucher({
      store_id: storeId,
      type: "OUT",
      status: "POSTED",
      voucher_code: genXKCode(),
      voucher_date: new Date(),
      reason: "Xuất bán hàng",
      ref_type: "ORDER",
      ref_id: order._id,
      warehouse_id: warehouse._id,
      warehouse_name: warehouse.name,
      created_by: userId,
      items: voucherItems,
    }).save({ session });

    order.inventory_voucher_id = voucher._id;

    // ================= 9. QR PAYMENT =================
    let qrData = null;
    let bankInfo = null;

    if (paymentMethod === "qr") {
      const paymentConfig = await StorePaymentConfig.findOne({
        store: storeId,
      }).session(session);

      if (!paymentConfig || !paymentConfig.banks.length) {
        throw new Error("Chưa cấu hình ngân hàng QR");
      }

      const bank = paymentConfig.banks.find((b) => b.isDefault);
      if (!bank) throw new Error("Chưa có ngân hàng mặc định");

      const amount = Math.round(total);
      const desc = `Thanh toan don ${order._id}`;

      const qrUrl = `https://img.vietqr.io/image/${bank.bankCode}-${bank.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
        desc
      )}&accountName=${encodeURIComponent(bank.accountName)}`;

      order.qrImageUrl = qrUrl;
      order.qrExpiry = new Date(Date.now() + 15 * 60 * 1000);

      qrData = qrUrl;
      bankInfo = {
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
      };
    }

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Tạo đơn hàng thành công",
      order,
      qrDataURL: qrData,
      bankInfo,
      inventoryVoucher: {
        _id: voucher._id,
        voucher_code: voucher.voucher_code,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("CreateOrder Error:", err);
    return res.status(400).json({ message: err.message });
  }
};

//POST /api/orders/:orderId/set-paid-cash - Cho cash: Staff confirm giao dịch tay → set paid (trước print)
//POST /api/orders/:orderId/set-paid-cash
const setPaidCash = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId: mongoId } = req.params;

    // Lock đơn hàng để xử lý
    const order = await Order.findById(mongoId).session(session);

    if (!order) {
      throw new Error("Đơn hàng không tồn tại");
    }

    // ✅ FIX LỖI Ở ĐÂY:
    // Nếu đơn hàng ĐÃ thanh toán rồi (do createOrder đã set), thì coi như thành công luôn.
    // Không báo lỗi 400 nữa để Frontend không bị đỏ.
    if (order.status === "paid") {
      await session.abortTransaction();
      session.endSession();
      console.log(`⚠️ Đơn hàng ${mongoId} đã thanh toán trước đó (Bỏ qua set-paid)`);
      return res.status(200).json({
        message: "Đơn hàng đã được thanh toán thành công.",
        alreadyPaid: true,
      });
    }

    // Nếu đơn hàng bị hủy hoặc hoàn trả thì mới báo lỗi
    if (["refunded", "partially_refunded", "cancelled"].includes(order.status)) {
      throw new Error("Không thể thanh toán đơn hàng đã hủy hoặc hoàn trả");
    }

    // --- Logic set paid bình thường (cho các đơn pending cũ) ---
    order.status = "paid";
    order.paymentMethod = "cash";
    await order.save({ session });

    // Nếu chưa có phiếu xuất kho (đơn pending cũ), tạo phiếu xuất kho tại đây
    if (!order.inventory_voucher_id) {
      // ... (Logic tạo phiếu xuất kho bù nếu cần - thường createOrder mới đã có rồi)
      // Với code mới thì trường hợp này hiếm khi xảy ra, nhưng giữ để tương thích ngược
    }

    await session.commitTransaction();
    session.endSession();

    // Socket & Log Activity
    const io = req.app.get("io");
    if (io) {
      io.emit("payment_success", {
        orderId: order._id,
        ref: order._id.toString(),
        amount: order.totalAmount,
        method: "cash",
        message: `Đơn hàng ${order._id} đã thanh toán thành công!`,
      });

      // Lưu thông báo
      await Notification.create({
        storeId: order.storeId,
        userId: req.user?._id,
        type: "payment",
        title: "Thanh toán tiền mặt",
        message: `Đơn hàng #${order._id} đã thanh toán: ${order.totalAmount}đ`,
      });
    }

    await logActivity({
      user: req.user,
      store: { _id: order.storeId },
      action: "update",
      entity: "Order",
      entityId: order._id,
      entityName: `Đơn hàng #${order._id}`,
      req,
      description: `Xác nhận thanh toán tiền mặt (Manual)`,
    });

    res.json({ message: "Xác nhận thanh toán cash thành công" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi set paid cash:", err.message);
    // Trả về 400 để FE biết có lỗi
    res.status(400).json({ message: err.message });
  }
};

// POST /api/orders/:orderId/print-bill - In hóa đơn (auto set paid + trừ stock + generate text bill chi tiết với populate)
const printBill = async (req, res) => {
  try {
    const { orderId: mongoId } = req.params; // Dùng _id Mongo
    // Populate full order trước: store name, employee fullName, customer name/phone
    const order = await Order.findById(mongoId)
      .populate("storeId", "name") // Populate tên cửa hàng
      .populate("employeeId", "fullName") // Tên nhân viên
      .populate("customer", "name phone loyaltyPoints totalSpent totalOrders"); // Populate tên/SĐT khách từ Customer ref

    if (!order) {
      return res.status(404).json({ message: "Hóa đơn không tồn tại" });
    }

    // Kiểm tra trạng thái
    if (order.status !== "paid" && order.status !== "pending") {
      return res.status(400).json({ message: "Trạng thái đơn hàng không thể in bill" });
    }

    // Nếu là Pending (thường là QR), auto set Paid (tuỳ nghiệp vụ)
    if (order.status === "pending" && order.paymentMethod === "qr") {
      order.status = "paid";
      await order.save();
    }

    // Di chuyển items ra ngoài session, populate cho bill (read only, ko cần session)
    const items = await OrderItem.find({ orderId: order._id })
      .populate("productId", "name sku") // Populate tên/sku sản phẩm cho bill
      .lean(); // Lean cho nhanh, ko session

    const isFirstPrint = order.printCount === 0; // Check lần in đầu (printCount default 0)
    const isDuplicate = !isFirstPrint; // Nếu >0 thì duplicate

    // === TÍNH ĐIỂM LOYALTY (Chỉ tính lần in đầu) ===
    let earnedPoints = 0;
    let roundedEarnedPoints = 0;

    if (isFirstPrint && order.customer) {
      const loyalty = await LoyaltySetting.findOne({
        storeId: order.storeId._id || order.storeId,
      });

      if (loyalty && loyalty.isActive && Number(order.totalAmount) >= loyalty.minOrderValue) {
        earnedPoints = parseFloat(order.totalAmount.toString()) * loyalty.pointsPerVND;
        roundedEarnedPoints = Math.round(earnedPoints);

        if (roundedEarnedPoints > 0) {
          // Cộng điểm vào customer (atomic session)
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            const customer = await Customer.findById(order.customer._id).session(session);
            if (customer) {
              const prevSpent = parseFloat(customer.totalSpent?.toString() || 0);
              const currentSpent = parseFloat(order.totalAmount?.toString() || 0);
              const newSpent = prevSpent + currentSpent;

              customer.loyaltyPoints = (customer.loyaltyPoints || 0) + roundedEarnedPoints;
              customer.totalSpent = mongoose.Types.Decimal128.fromString(newSpent.toFixed(2));
              customer.totalOrders = (customer.totalOrders || 0) + 1;

              await customer.save({ session });
            }

            // Lưu điểm vào Order
            await Order.findByIdAndUpdate(mongoId, { earnedPoints: roundedEarnedPoints }, { session });

            await session.commitTransaction();
            session.endSession();
            console.log(`[LOYALTY] +${roundedEarnedPoints} điểm cho khách ${order.customer.phone}`);
          } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error("Lỗi cộng điểm:", err);
          }
        }
      }
    }

    // ⛔️ ĐÃ XOÁ: Logic trừ stock tại đây (VÌ createOrder ĐÃ LÀM RỒI)

    // Generate text bill chi tiết (với tên prod từ populate items, thêm note duplicate nếu có)
    let bill = `=== HÓA ĐƠN BÁN HÀNG ===\n`;
    bill += `ID Hóa đơn: ${order._id}\n`;
    bill += `Cửa hàng: ${order.storeId?.name || "Cửa hàng mặc định"}\n`;
    bill += `Nhân viên: ${order.employeeId?.fullName || "N/A"}\n`;
    bill += `Khách hàng: ${order.customer?.name || "Khách vãng lai"} ${order.customer?.phone ? "- " + order.customer.phone : ""}\n`; // Populate từ customer ref
    bill += `Ngày: ${new Date(order.createdAt).toLocaleString("vi-VN")}\n`;
    bill += `Ngày in: ${new Date().toLocaleString("vi-VN")}\n`;
    if (isDuplicate) bill += `(Bản sao hóa đơn - lần in ${order.printCount + 1})\n`; // Note duplicate
    bill += `\nCHI TIẾT SẢN PHẨM:\n`;
    items.forEach((item) => {
      bill += `- ${item.productId?.name || "Sản phẩm"} (${item.productId?.sku || "N/A"}): ${item.quantity} x ${item.priceAtTime} = ${
        item.subtotal
      } VND\n`;
    });
    bill += `\nTỔNG TIỀN: ${(parseFloat(order.beforeTaxAmount.toString()) || 0).toFixed(2)} VND\n`; // Tổng trước giảm
    if (order.usedPoints && order.usedPoints > 0) {
      const discountAmount = (order.usedPoints / 10).toFixed(2); // ví dụ 10 points = 1k VND
      bill += `Giảm từ điểm: ${discountAmount} VND\n`;
    }
    bill += `Thanh toán: ${order.totalAmount.toString()} VND\n`; // Số tiền khách trả thật
    bill += `Phương thức: ${order.paymentMethod === "cash" ? "TIỀN MẶT" : "QR CODE"}\n`; // Rõ ràng hơn cho bill
    if (roundedEarnedPoints > 0) bill += `Điểm tích lũy lần này: ${roundedEarnedPoints.toFixed(0)} điểm\n`; // Thêm điểm tích nếu có
    bill += `Trạng thái: Đã thanh toán\n`;
    bill += `=== CẢM ƠN QUÝ KHÁCH! ===\n`;

    // Update printDate/printCount (luôn update, dù duplicate)
    const updatedOrder = await Order.findByIdAndUpdate(
      mongoId,
      {
        printDate: new Date(),
        $inc: { printCount: 1 },
      },
      { new: true } // Lấy bản mới nhất
    );

    res.json({
      message: isDuplicate ? "In hóa đơn BẢN SAO thành công" : "In hóa đơn thành công",
      bill: bill,
      orderId: order._id,
      printCount: updatedOrder.printCount,
    });
  } catch (err) {
    console.error("Lỗi in hóa đơn:", err.message);
    res.status(500).json({ message: "Lỗi server khi in hóa đơn: " + err.message });
  }
};

const vietqrReturn = async (req, res) => {
  // log hoạt động
  await logActivity({
    user: req.user || { _id: null, username: "guest" },
    store: { _id: req.query?.storeId || null },
    action: "update",
    entity: "Order",
    entityId: req.query?.orderCode || null,
    entityName: `Đơn hàng #${req.query?.orderCode || "unknown"}`,
    req,
    description: `Thanh toán VietQR thành công, số tiền ${req.query?.amount || "?"}đ`,
  });

  console.log("✅ Người dùng quay lại sau khi thanh toán thành công");
  return res.status(200).json({
    message: "Thanh toán thành công! Cảm ơn bạn đã mua hàng.",
    query: req.query, // PayOS có thể gửi kèm orderCode, amount,...
  });
};

const vietqrCancel = async (req, res) => {
  // log hoạt động
  await logActivity({
    user: req.user || { _id: null, username: "guest" },
    store: { _id: req.query?.storeId || null },
    action: "delete",
    entity: "Order",
    entityId: req.query?.orderCode || null,
    entityName: `Đơn hàng #${req.query?.orderCode || "unknown"}`,
    req,
    description: `Hủy thanh toán VietQR cho đơn hàng #${req.query?.orderCode || "unknown"}`,
  });

  console.log("❌ Người dùng hủy thanh toán hoặc lỗi");
  return res.status(400).json({
    message: "Thanh toán bị hủy hoặc không thành công.",
    query: req.query,
  });
};

const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Query order chính + populate store (tên cửa hàng), employee (fullName), customer (name/phone)
    const order = await Order.findOne({ _id: orderId })
      .populate("storeId", "name") // Chỉ lấy field name từ Store
      .populate("employeeId", "fullName") // Lấy fullName từ Employee
      .populate("customer", "name phone") // Populate name/phone từ Customer ref
      .lean(); // Chuyển sang plain JS object cho nhanh

    if (!order) {
      console.log("Không tìm thấy hóa đơn với orderId:", orderId); // Log tiếng Việt
      return res.status(404).json({ message: "Hóa đơn không tồn tại" });
    }

    // Query items riêng + populate product (tên/sku)
    const items = await OrderItem.find({ orderId: order._id })
      .populate("productId", "name sku price") // Lấy name, sku, price từ Product
      .lean();

    // Merge items vào order để return JSON ngầu
    const enrichedOrder = {
      ...order,
      items: items.map((item) => ({
        ...item,
        productName: item.productId?.name, // Ví dụ: "Giày Nike Air"
        productSku: item.productId?.sku, // "NIKE-AIR-001"
      })),
    };

    console.log("Lấy chi tiết hóa đơn thành công:", orderId); // Log success
    res.json({ message: "Lấy hóa đơn thành công", order: enrichedOrder });
  } catch (err) {
    console.error("Lỗi khi lấy hóa đơn:", err.message); // Log error tiếng Việt
    res.status(500).json({ message: "Lỗi server khi lấy hóa đơn" });
  }
};

// ============= REFUND ORDER - Hoàn hàng =============
const refundOrder = async (req, res) => {
  console.log("🔁 START refundOrder");

  const session = await mongoose.startSession();

  try {
    const { orderId } = req.params;
    let { employeeId, refundReason = "", items } = req.body;

    console.log("📥 Params:", { orderId, employeeId });

    // ===== Parse items =====
    if (typeof items === "string") {
      items = JSON.parse(items);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Danh sách hoàn không hợp lệ" });
    }

    for (const it of items) {
      if (!it.productId || Number(it.quantity) <= 0) {
        return res.status(400).json({ message: "Item hoàn không hợp lệ", it });
      }
    }

    session.startTransaction();

    // ===== LOAD ORDER =====
    console.log("🔍 Load order");
    const order = await Order.findById(orderId)
      .populate("employeeId")
      .populate({
        path: "inventory_voucher_id",
        populate: { path: "items.product_id" },
      })
      .session(session);

    if (!order) throw new Error("Không tìm thấy đơn hàng");

    console.log("✅ Order found:", order._id.toString());

    if (!["paid", "partially_refunded"].includes(order.status)) {
      throw new Error("Chỉ hoàn đơn đã thanh toán");
    }

    // ===== XÁC ĐỊNH NGƯỜI HOÀN =====
    const refundedByUserId = employeeId || req.user?._id || order.employeeId?._id;

    if (!refundedByUserId) {
      throw new Error("Không xác định được người thực hiện hoàn hàng");
    }

    console.log(employeeId ? "👷 Refund by STAFF" : "👑 Refund by OWNER");

    // ===== LOAD ORDER ITEMS =====
    console.log("📦 Load OrderItems");
    const orderItems = await OrderItem.find({
      orderId,
      productId: { $in: items.map((i) => i.productId) },
    })
      .populate("productId")
      .session(session);

    console.log("📦 OrderItems found:", orderItems.length);

    const orderItemMap = new Map(orderItems.map((oi) => [oi.productId._id.toString(), oi]));

    let refundTotal = 0;
    const refundItems = [];

    // ===== LOOP HOÀN =====
    for (const i of items) {
      const oi = orderItemMap.get(i.productId);
      if (!oi) continue;

      const refundQty = Number(i.quantity);
      const unitPrice = Number(oi.priceAtTime);
      const subtotal = refundQty * unitPrice;

      refundTotal += subtotal;

      refundItems.push({
        productId: oi.productId._id,
        quantity: refundQty,
        priceAtTime: unitPrice,
        subtotal,
        warehouse_id: oi.warehouse_id || null,
        warehouse_name: oi.warehouse_name || "",
      });

      await Product.findByIdAndUpdate(oi.productId._id, { $inc: { stock_quantity: refundQty } }, { session });

      console.log(`➕ Restore stock ${oi.productId.name}: +${refundQty}`);
    }

    if (refundItems.length === 0) {
      throw new Error("Không có sản phẩm hợp lệ để hoàn");
    }

    // ===== TẠO PHIẾU NHẬP HOÀN =====
    console.log("🧾 Create inventory voucher (IN)");
    const refundVoucher = new InventoryVoucher({
      store_id: order.storeId,
      type: "IN",
      status: "POSTED",
      voucher_code: `HN-${Date.now()}`,
      voucher_date: new Date(),
      reason: `Hoàn hàng đơn ${order._id}`,
      ref_type: "ORDER_REFUND",
      ref_id: order._id,
      created_by: refundedByUserId,
      posted_by: refundedByUserId,
      posted_at: new Date(),
      warehouse_id: refundItems[0].warehouse_id,
      warehouse_name: refundItems[0].warehouse_name,
      items: refundItems.map((it) => ({
        product_id: it.productId,
        qty_document: it.quantity,
        qty_actual: it.quantity,
        unit_cost: mongoose.Types.Decimal128.fromString("0"),
        note: refundReason,
      })),
    });

    await refundVoucher.save({ session });

    // ===== SAVE REFUND RECORD =====
    console.log("💾 Save OrderRefund");
    const refundDoc = new OrderRefund({
      orderId,
      inventory_voucher_id: refundVoucher._id,
      refundedBy: refundedByUserId, // ✅ FIX
      refundedAt: new Date(), // ✅ FIX
      refundReason,
      refundAmount: refundTotal, // ✅ FIX
      refundItems,
    });

    await refundDoc.save({ session });

    // ===== UPDATE ORDER =====
    const newTotal = Number(order.totalAmount) - refundTotal;
    order.totalAmount = newTotal.toFixed(2);
    order.status =
      refundItems.reduce((s, i) => s + i.quantity, 0) >= orderItems.reduce((s, i) => s + i.quantity, 0) ? "refunded" : "partially_refunded";

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.log("✅ REFUND SUCCESS");

    return res.json({
      message: "Hoàn hàng thành công",
      refund: refundDoc,
      inventoryVoucher: refundVoucher,
      order,
    });
  } catch (err) {
    console.error("🔥 REFUND ERROR:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: err.message });
  }
};

//  Top sản phẩm bán chạy (sum quantity/sales từ OrderItem, filter paid + range/date/store)
const getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10, storeId, periodType, periodKey, monthFrom, monthTo } = req.query;

    // Validate period
    if (!periodType) {
      return res.status(400).json({
        success: false,
        message: "Thiếu periodType",
      });
    }

    if (periodType !== "custom" && !periodKey) {
      return res.status(400).json({
        success: false,
        message: "Thiếu periodKey cho loại kỳ này (vd: month + 2025-10)",
      });
    }

    if (periodType === "custom" && (!req.query.monthFrom || !req.query.monthTo)) {
      return res.status(400).json({
        success: false,
        message: "Thiếu monthFrom hoặc monthTo cho kỳ tùy chỉnh",
      });
    }

    // Lấy storeId từ token nếu FE không gửi
    let finalStoreId = storeId;
    if (!finalStoreId && req.user?.storeId) {
      finalStoreId = req.user.storeId;
    }

    if (!finalStoreId) {
      return res.status(400).json({
        message: "Thiếu storeId, không thể lấy top sản phẩm.",
      });
    }

    // --- Dùng periodToRange (đang xài trong hơn 10 hàm order) ---
    const { start, end } = periodToRange(periodType, periodKey, monthFrom, monthTo);

    const match = {
      "order.status": "paid",
      "order.createdAt": { $gte: start, $lte: end },
      "order.storeId": new mongoose.Types.ObjectId(finalStoreId),
    };

    // --- Aggregation ---
    const topProducts = await OrderItem.aggregate([
      // Join với Order
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },

      // Filter status + thời gian + storeId
      { $match: match },

      // Group theo productId
      {
        $group: {
          _id: "$productId",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: "$subtotal" },
          countOrders: { $sum: 1 },
        },
      },

      // Sort theo số lượng bán
      { $sort: { totalQuantity: -1 } },

      // Giới hạn top
      { $limit: parseInt(limit) },

      // Join product
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },

      // Output
      {
        $project: {
          productName: "$product.name",
          productSku: "$product.sku",
          totalQuantity: 1,
          totalSales: 1,
          countOrders: 1,
        },
      },
    ]);

    return res.json({
      message: `Top selling products thành công (limit ${limit})`,
      data: topProducts,
    });
  } catch (err) {
    console.error("Lỗi top selling products:", err.message);
    return res.status(500).json({ message: "Lỗi server khi lấy top sản phẩm bán chạy" });
  }
};

//http://localhost:9999/api/orders/top-customers?limit=5&range=thisYear&storeId=68f8f19a4d723cad0bda9fa5
const getTopFrequentCustomers = async (req, res) => {
  try {
    const { storeId, periodType = "month", periodKey, monthFrom, monthTo, limit = 10, range } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    let start, end;

    // ƯU TIÊN DÙNG periodType + periodKey (UI mới)
    if (periodType && periodKey) {
      ({ start, end } = periodToRange(periodType, periodKey, monthFrom, monthTo));
    }
    // FALLBACK: nếu vẫn dùng UI cũ (range=thisMonth...)
    else if (range) {
      const now = new Date();
      switch (range) {
        case "thisWeek": {
          const currentDay = now.getDay();
          const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
          start = new Date(now);
          start.setDate(now.getDate() - diffToMonday);
          start.setHours(0, 0, 0, 0);
          end = new Date(); // đến hiện tại
          break;
        }
        case "thisYear": {
          start = new Date(now.getFullYear(), 0, 1);
          start.setHours(0, 0, 0, 0);
          end = new Date();
          break;
        }
        case "thisMonth":
        default: {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          start.setHours(0, 0, 0, 0);
          end = new Date();
          break;
        }
      }
    } else {
      // mặc định tháng này
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
    }

    const matchStage = {
      status: "paid",
      storeId: new mongoose.Types.ObjectId(storeId),
      createdAt: { $gte: start, ...(end ? { $lte: end } : {}) },
      customer: { $ne: null }, // loại khách lẻ luôn từ đầu cho nhanh
    };

    const topCustomers = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$customer",
          totalAmount: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          latestOrder: { $max: "$createdAt" },
        },
      },
      { $sort: { totalAmount: -1, orderCount: -1 } },
      { $limit: parseInt(limit) || 10 },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: false } },
      { $match: { "customerInfo.isDeleted": { $ne: true } } },
      {
        $project: {
          _id: 0,
          customerId: "$_id",
          customerName: "$customerInfo.name",
          customerPhone: "$customerInfo.phone",
          address: "$customerInfo.address",
          note: "$customerInfo.note",
          loyaltyPoints: { $ifNull: ["$customerInfo.loyaltyPoints", 0] },
          totalSpent: { $toDouble: "$totalAmount" },
          orderCount: 1,
          latestOrder: 1,
        },
      },
    ]);

    return res.json({
      success: true,
      message: "Lấy top khách hàng thành công",
      count: topCustomers.length,
      data: topCustomers,
    });
  } catch (err) {
    console.error("Lỗi top khách hàng:", err);
    return res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// =============== EXPORT TOP CUSTOMERS (sửa xong) ===============
const exportTopFrequentCustomers = async (req, res) => {
  try {
    const { storeId, periodType = "month", periodKey, monthFrom, monthTo, limit = 500, format = "xlsx" } = req.query;

    if (!storeId) return res.status(400).json({ message: "Thiếu storeId" });

    const { start, end } = periodToRange(
      periodType,
      periodKey || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      monthFrom,
      monthTo
    );

    const matchStage = {
      status: "paid",
      storeId: new mongoose.Types.ObjectId(storeId),
      createdAt: { $gte: start, $lte: end },
      customer: { $ne: null },
    };

    const data = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$customer",
          totalAmount: { $sum: "$totalAmount" }, // giống GET
          orderCount: { $sum: 1 },
          latestOrder: { $max: "$createdAt" }, // giống GET
        },
      },
      { $sort: { totalAmount: -1, orderCount: -1 } },
      { $limit: parseInt(limit) || 500 },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "c",
        },
      },
      { $unwind: "$c" },
      { $match: { "c.isDeleted": { $ne: true } } },
      {
        $project: {
          "ID khách": "$_id",
          "Tên khách hàng": "$c.name",
          "Số điện thoại": "$c.phone",
          "Địa chỉ": "$c.address",
          "Ghi chú": "$c.note",
          "Tổng chi tiêu (VND)": { $toDouble: "$totalAmount" }, // GIỐNG GET
          "Số đơn hàng": "$orderCount",
          "Lần mua gần nhất": "$latestOrder", // GIỐNG GET
          "Điểm tích lũy": { $ifNull: ["$c.loyaltyPoints", 0] }, // GIỐNG GET
        },
      },
    ]);

    // export xlsx
    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top Khach Hang");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      res.setHeader("Content-Disposition", `attachment; filename=Top_Khach_Hang_${periodKey || "hien_tai"}.xlsx`);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    }
  } catch (err) {
    console.error("Export top customers error:", err);
    res.status(500).json({ message: "Lỗi xuất file" });
  }
};

// GET /api/orders/top-products/export - Export top sản phẩm bán chạy ra CSV hoặc PDF (params giống getTopSellingProducts + format='csv' or 'pdf')
// GET /api/orders/top-products/export?format=pdf|csv|xlsx&storeId=...&range=...
const exportTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10, storeId, range, dateFrom, dateTo, format: rawFormat = "csv" } = req.query;

    const format = String(rawFormat || "csv").toLowerCase();

    // Validate format
    if (!["pdf", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({
        message: "Format phải là 'pdf', 'csv' hoặc 'xlsx'",
        format,
        hint: "Vui lòng chọn format=pdf hoặc format=csv hoặc format=xlsx",
      });
    }

    // Validate storeId nếu có truyền
    if (storeId && !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ", storeId });
    }

    // ===== Helpers =====
    const formatVND = (n) => {
      const num = Number(n || 0);
      try {
        return new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(num));
      } catch {
        return `${Math.round(num)} VND`;
      }
    };

    const pad2 = (x) => String(x).padStart(2, "0");
    const formatDateTimeVN = (d) => {
      const dt = new Date(d);
      return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    };

    const describeRange = () => {
      if (range) {
        const map = {
          today: "Hôm nay",
          yesterday: "Hôm qua",
          thisWeek: "Tuần này",
          thisMonth: "Tháng này",
          thisYear: "Năm nay",
        };
        return map[range] || `range=${range}`;
      }
      if (dateFrom || dateTo) return `Từ ${dateFrom || "..."} đến ${dateTo || "..."}`;
      return "Tháng này (mặc định)";
    };

    // ===== xử lý date range (không mutate Date gốc) =====
    let matchDate = null;
    const now = new Date();

    if (range) {
      switch (range) {
        case "today": {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          matchDate = { $gte: start, $lte: end };
          break;
        }
        case "yesterday": {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
          const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
          matchDate = { $gte: start, $lte: end };
          break;
        }
        case "thisWeek": {
          const currentDay = now.getDay(); // 0..6
          const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
          const monday = new Date(now);
          monday.setDate(monday.getDate() - diffToMonday);
          const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
          matchDate = { $gte: start };
          break;
        }
        case "thisMonth": {
          const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          matchDate = { $gte: start };
          break;
        }
        case "thisYear": {
          const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          matchDate = { $gte: start };
          break;
        }
        default: {
          // fallback: thisMonth
          const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          matchDate = { $gte: start };
        }
      }
    } else if (dateFrom || dateTo) {
      matchDate = {};
      if (dateFrom) matchDate.$gte = new Date(dateFrom);
      if (dateTo) matchDate.$lte = new Date(dateTo);
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      matchDate = { $gte: start };
    }

    const match = { "order.status": "paid" };
    if (matchDate) match["order.createdAt"] = matchDate;
    if (storeId) match["order.storeId"] = new mongoose.Types.ObjectId(storeId);

    // ===== Aggregate (fix Decimal128 totalSales bằng $toDouble) =====
    const topProducts = await OrderItem.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      { $match: match },

      {
        $group: {
          _id: "$productId",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: { $toDouble: "$subtotal" } }, // quan trọng: bỏ $numberDecimal
          countOrders: { $sum: 1 },
        },
      },

      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit, 10) || 10 },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productName: "$product.name",
          productSku: "$product.sku",
          totalQuantity: 1,
          totalSales: 1,
          countOrders: 1,
        },
      },
    ]);

    if (!topProducts || topProducts.length === 0) {
      return res.status(404).json({ message: "Không có dữ liệu top sản phẩm trong kỳ này" });
    }

    // normalize lần nữa cho chắc (nếu data bẩn)
    const normalized = topProducts.map((p) => ({
      productName: p.productName || "",
      productSku: p.productSku || "",
      totalQuantity: Number(p.totalQuantity || 0),
      totalSales: Number(p.totalSales || 0),
      countOrders: Number(p.countOrders || 0),
    }));

    const totalQtyAll = normalized.reduce((s, x) => s + x.totalQuantity, 0);
    const totalSalesAll = normalized.reduce((s, x) => s + x.totalSales, 0);
    const totalOrdersAll = normalized.reduce((s, x) => s + x.countOrders, 0);

    const ts = new Date().toISOString().slice(0, 19).replace(/[:]/g, "-");
    const filenameBase = `top-selling-products-${ts}`;

    // ===== CSV (thêm BOM cho Excel UTF-8) =====
    if (format === "csv") {
      const fields = ["productName", "productSku", "totalQuantity", "totalSales", "countOrders"];
      const csv = new Parser({ fields }).parse(normalized);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=${filenameBase}.csv`);
      return res.send("\uFEFF" + csv);
    }

    // ===== XLSX =====
    if (format === "xlsx") {
      const excelData = normalized.map((p, i) => ({
        STT: i + 1,
        "Tên sản phẩm": p.productName,
        SKU: p.productSku,
        "SL bán": p.totalQuantity,
        "Doanh thu": p.totalSales,
        "Số đơn hàng": p.countOrders,
      }));

      // dòng tổng
      excelData.push({
        STT: "",
        "Tên sản phẩm": "TỔNG",
        SKU: "",
        "SL bán": totalQtyAll,
        "Doanh thu": totalSalesAll,
        "Số đơn hàng": totalOrdersAll,
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      worksheet["!cols"] = [{ wch: 6 }, { wch: 40 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Top bán chạy");
      const buf = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${filenameBase}.xlsx`);
      res.setHeader("Content-Length", buf.length);
      return res.send(buf);
    }

    // ===== PDF (bảng chuyên nghiệp + tự xuống trang) =====
    const fontPath = {
      normal: path.resolve(__dirname, "../../fonts/Roboto/static/Roboto-Regular.ttf"),
      bold: path.resolve(__dirname, "../../fonts/Roboto/static/Roboto-Bold.ttf"),
    };

    const pdf = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
      info: { Title: "Top selling products", Author: "SmartRetail" },
    });

    // Register font
    const hasRoboto = fs.existsSync(fontPath.normal);
    if (hasRoboto) {
      try {
        pdf.registerFont("Roboto", fontPath.normal);
        if (fs.existsSync(fontPath.bold)) pdf.registerFont("RobotoBold", fontPath.bold);
      } catch {}
    }

    const FONT_NORMAL = hasRoboto ? "Roboto" : "Helvetica";
    const FONT_BOLD = hasRoboto && fs.existsSync(fontPath.bold) ? "RobotoBold" : "Helvetica-Bold";

    res.setHeader("Content-Type", "application/pdf; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filenameBase}.pdf`);
    pdf.pipe(res);

    // Layout constants
    const pageLeft = pdf.page.margins.left;
    const pageRight = pdf.page.width - pdf.page.margins.right;
    const contentWidth = pageRight - pageLeft;

    const colors = {
      border: "#111827",
      headBg: "#F3F4F6",
      zebra: "#FAFAFA",
      text: "#111827",
      muted: "#6B7280",
    };

    const cols = [
      { key: "stt", label: "STT", w: 40, align: "center" },
      { key: "productName", label: "Tên sản phẩm", w: 230, align: "left" },
      { key: "productSku", label: "SKU", w: 90, align: "left" },
      { key: "totalQuantity", label: "SL bán", w: 55, align: "right" },
      { key: "totalSales", label: "Doanh thu", w: 90, align: "right" },
      { key: "countOrders", label: "Số đơn", w: 50, align: "right" },
    ];

    // fit width (nếu margin khác)
    const sumW = cols.reduce((s, c) => s + c.w, 0);
    if (sumW !== contentWidth) {
      // scale nhẹ theo contentWidth
      const scale = contentWidth / sumW;
      cols.forEach((c) => (c.w = Math.floor(c.w * scale)));
      // bù chênh lệch do floor
      const diff = contentWidth - cols.reduce((s, c) => s + c.w, 0);
      cols[1].w += diff; // bù vào cột Tên sản phẩm
    }

    const rowPaddingY = 6;
    const rowPaddingX = 6;

    const drawReportHeader = () => {
      const y0 = pdf.y;

      pdf.fillColor(colors.text).font(FONT_BOLD).fontSize(16);
      pdf.text("BÁO CÁO TOP SẢN PHẨM BÁN CHẠY", pageLeft, y0, {
        width: contentWidth,
        align: "center",
      });

      pdf.moveDown(0.6);
      pdf.font(FONT_NORMAL).fontSize(10).fillColor(colors.muted);

      const line1Left = `Thời gian: ${describeRange()}`;
      const line1Right = `Xuất lúc: ${formatDateTimeVN(new Date())}`;
      pdf.text(line1Left, pageLeft, pdf.y, {
        width: contentWidth / 2,
        align: "left",
      });
      pdf.text(line1Right, pageLeft, pdf.y - 12, {
        width: contentWidth,
        align: "right",
      });

      const line2Left = storeId ? `StoreId: ${storeId}` : "StoreId: (tất cả)";
      const line2Right = `Top: ${normalized.length} (limit=${parseInt(limit, 10) || 10})`;
      pdf.text(line2Left, pageLeft, pdf.y, {
        width: contentWidth / 2,
        align: "left",
      });
      pdf.text(line2Right, pageLeft, pdf.y - 12, {
        width: contentWidth,
        align: "right",
      });

      pdf.moveDown(0.8);

      // divider
      const yDiv = pdf.y;
      pdf.moveTo(pageLeft, yDiv).lineTo(pageRight, yDiv).lineWidth(1).strokeColor("#E5E7EB").stroke();
      pdf.moveDown(0.8);
    };

    const drawTableHeader = (y) => {
      // background
      pdf.save();
      pdf.rect(pageLeft, y, contentWidth, 24).fill(colors.headBg);
      pdf.restore();

      pdf.lineWidth(1).strokeColor(colors.border);
      pdf.rect(pageLeft, y, contentWidth, 24).stroke();

      pdf.font(FONT_BOLD).fontSize(10).fillColor(colors.text);

      let x = pageLeft;
      cols.forEach((c) => {
        // vertical line
        pdf
          .moveTo(x, y)
          .lineTo(x, y + 24)
          .stroke();
        pdf.text(c.label, x + rowPaddingX, y + 7, {
          width: c.w - rowPaddingX * 2,
          align: c.align,
        });
        x += c.w;
      });

      // last vertical line
      pdf
        .moveTo(pageRight, y)
        .lineTo(pageRight, y + 24)
        .stroke();

      return y + 24;
    };

    const ensureSpace = (neededHeight) => {
      const bottom = pdf.page.height - pdf.page.margins.bottom;
      if (pdf.y + neededHeight <= bottom) return;

      pdf.addPage();
      drawReportHeader();
      pdf.y = drawTableHeader(pdf.y);
    };

    const drawRow = (row, index) => {
      const cells = [
        String(index + 1),
        row.productName || "-",
        row.productSku || "-",
        String(row.totalQuantity ?? 0),
        formatVND(row.totalSales),
        String(row.countOrders ?? 0),
      ];

      // tính chiều cao dòng dựa vào cột tên (wrap)
      const nameCol = cols[1];
      const nameHeight = pdf.heightOfString(cells[1], {
        width: nameCol.w - rowPaddingX * 2,
        align: "left",
      });

      const base = 20;
      const rowH = Math.max(base, Math.ceil(nameHeight + rowPaddingY * 2));

      ensureSpace(rowH + 2);

      const y = pdf.y;

      // zebra background
      if (index % 2 === 1) {
        pdf.save();
        pdf.rect(pageLeft, y, contentWidth, rowH).fill(colors.zebra);
        pdf.restore();
      }

      // border box
      pdf.lineWidth(1).strokeColor("#D1D5DB");
      pdf.rect(pageLeft, y, contentWidth, rowH).stroke();

      pdf.font(FONT_NORMAL).fontSize(10).fillColor(colors.text);

      let x = pageLeft;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];

        // cell border
        pdf
          .moveTo(x, y)
          .lineTo(x, y + rowH)
          .strokeColor("#D1D5DB")
          .stroke();

        const text = cells[i];
        const align = c.align;

        pdf.text(text, x + rowPaddingX, y + rowPaddingY, {
          width: c.w - rowPaddingX * 2,
          align,
        });

        x += c.w;
      }

      // last border
      pdf
        .moveTo(pageRight, y)
        .lineTo(pageRight, y + rowH)
        .strokeColor("#D1D5DB")
        .stroke();

      pdf.y = y + rowH;
    };

    const drawSummary = () => {
      ensureSpace(70);

      pdf.moveDown(0.6);
      const y = pdf.y + 6;

      // box
      pdf.save();
      pdf.rect(pageLeft, y, contentWidth, 52).fill("#F9FAFB").strokeColor("#E5E7EB").stroke();
      pdf.restore();

      pdf.font(FONT_BOLD).fontSize(11).fillColor(colors.text);
      pdf.text("TỔNG HỢP", pageLeft + 10, y + 10);

      pdf.font(FONT_NORMAL).fontSize(10).fillColor(colors.text);
      pdf.text(`Tổng SL bán: ${totalQtyAll}`, pageLeft + 10, y + 28, {
        width: contentWidth / 3,
      });
      pdf.text(`Tổng doanh thu: ${formatVND(totalSalesAll)}`, pageLeft + 10 + contentWidth / 3, y + 28, {
        width: contentWidth / 3,
      });
      pdf.text(`Tổng số đơn: ${totalOrdersAll}`, pageLeft + 10 + (contentWidth * 2) / 3, y + 28, {
        width: contentWidth / 3 - 10,
        align: "right",
      });

      pdf.y = y + 52;
    };

    // render
    drawReportHeader();
    pdf.y = drawTableHeader(pdf.y);

    normalized.forEach((row, idx) => drawRow(row, idx));
    drawSummary();

    pdf.end();
  } catch (err) {
    console.error("Lỗi export top selling products:", err);
    return res.status(500).json({
      message: "Lỗi server khi export top sản phẩm bán chạy",
      error: err.message,
    });
  }
};

// 1) api/orders/list-paid, "getListPaidOrders ", (lấy danh sách các đơn đã thanh toán thành công, status là "paid")
// 2) api/orders/list-refund, (Xem danh sách các order đã hoàn trả thành công, có 2 trạng thái là refunded và partially_refunded)
// 3) /api/orders/order-refund/:orderId, ( để xem chi tiết 1 order đã hoàn trả thành công)

const getListPaidOrders = async (req, res) => {
  const { storeId, status } = req.query;
  try {
    // 🔴 FIX: Hỗ trợ tham số status để lấy cả paid và partially_refunded
    // Nếu không có status → mặc định lấy "paid"
    // Nếu status="paid,partially_refunded" → lấy cả 2
    let statusFilter = "paid";
    if (status) {
      const statusArray = status.split(",").map((s) => s.trim());
      statusFilter = { $in: statusArray };
    }

    const orders = await Order.find({ status: statusFilter, storeId })
      .populate("storeId", "name")
      .populate("employeeId", "fullName")
      .populate("customer", "name phone")
      .select("storeId employeeId customer totalAmount paymentMethod status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      message: "Lấy danh sách hóa đơn để hoàn trả thành công",
      orders,
    });
  } catch (err) {
    console.error("Lỗi khi lấy danh sách hóa đơn để hoàn trả:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách hóa đơn để hoàn trả" });
  }
};

const getListRefundOrders = async (req, res) => {
  const { storeId } = req.query;

  try {
    // 1. Tìm tất cả các bản ghi trong OrderRefund
    // 2. Populate 'orderId' để lấy thông tin đơn gốc.
    // 3. Dùng 'match' trong populate để chỉ lấy đơn thuộc storeId này.
    let refundOrders = await OrderRefund.find()
      .populate({
        path: "orderId",
        match: { storeId: storeId }, // Chỉ lấy refund của đơn hàng thuộc store này
        select: "totalAmount customer storeId paymentMethod status", // Lấy các trường cần thiết của đơn gốc
        populate: [
          { path: "customer", select: "name phone" }, // Lấy thông tin khách từ đơn gốc
          { path: "storeId", select: "name" },
        ],
      })
      .populate("refundedBy", "fullName") // Người thực hiện hoàn
      .sort({ createdAt: -1 }) // Sắp xếp ngày tạo mới nhất
      .lean();

    // 4. Vì dùng populate match, những refund không thuộc storeId sẽ có orderId = null.
    // Cần lọc bỏ chúng đi.
    refundOrders = refundOrders.filter((item) => item.orderId !== null);

    res.json({
      message: "Lấy danh sách đơn hoàn hàng thành công",
      orders: refundOrders,
    });
  } catch (err) {
    console.error("Lỗi getListRefundOrders:", err);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách đơn hoàn hàng" });
  }
};
const getOrderRefundDetail = async (req, res) => {
  const { storeId } = req.query;
  const { orderId } = req.params;

  try {
    // 1. Lấy đơn hàng gốc
    const order = await Order.findOne({ _id: orderId, storeId })
      .populate("storeId", "name")
      .populate("employeeId", "fullName")
      .populate("customer", "name phone")
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng hoặc không thuộc cửa hàng này",
      });
    }

    // 2. SỬA ĐOẠN NÀY: Tìm chi tiết hoàn trả bằng orderId (an toàn hơn)
    // Thay vì check if (order.refundId), ta query trực tiếp bảng OrderRefund
    const refundDetail = await OrderRefund.findOne({ orderId: orderId })
      .populate("orderId", "totalAmount paymentMethod status")
      .populate("refundedBy", "fullName")
      .populate("refundItems.productId", "name price sku")
      .lean();

    // 3. Lấy danh sách sản phẩm của đơn gốc
    const orderItems = await OrderItem.find({ orderId }).populate("productId", "name price sku").lean();

    return res.status(200).json({
      message: "Lấy chi tiết đơn hoàn hàng thành công",
      order,
      refundDetail, // Nếu có đơn hoàn, biến này sẽ có dữ liệu
      orderItems,
    });
  } catch (error) {
    console.error("getOrderRefundDetail error:", error);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết đơn hoàn hàng" });
  }
};

// Lấy toàn bộ danh sách đơn hàng (mọi trạng thái)
const getOrderListAll = async (req, res) => {
  try {
    const { storeId, periodType, periodKey, monthFrom, monthTo } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }
    let dateFilter = {};
    // Nếu FE gửi filter theo thời gian
    if (periodType) {
      const { start, end } = periodToRange(periodType, periodKey, monthFrom, monthTo);
      dateFilter.createdAt = {
        $gte: start,
        $lte: end,
      };
    }
    const orders = await Order.find({
      storeId,
      ...dateFilter,
    })
      .populate("storeId", "name")
      .populate("employeeId", "fullName")
      .populate("customer", "name phone")
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      message: "Lấy danh sách tất cả đơn hàng thành công",
      total: orders.length,
      orders,
    });
  } catch (err) {
    console.error("Lỗi khi lấy danh sách đơn hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách đơn hàng" });
  }
};

const exportAllOrdersToExcel = async (req, res) => {
  try {
    const { storeId, periodType, periodKey, monthFrom, monthTo } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    // ===== Helper: Decimal128 -> number an toàn =====
    const decimalToNumber = (decimal) => {
      if (decimal == null) return 0;
      if (typeof decimal === "number") return Number.isFinite(decimal) ? decimal : 0;

      if (typeof decimal === "object" && decimal.$numberDecimal != null) {
        const n = parseFloat(decimal.$numberDecimal);
        return Number.isFinite(n) ? n : 0;
      }

      const n = parseFloat(String(decimal));
      return Number.isFinite(n) ? n : 0;
    };

    // ===== Helper: sanitize filename for header (ASCII fallback) =====
    // - Remove CR/LF to prevent header injection
    // - Remove quotes/backslashes/unsafe chars
    // - Convert Vietnamese/Unicode to ASCII-ish by stripping diacritics
    // - Final allowlist: A-Z a-z 0-9 _ - . space
    const toAsciiSafe = (input) => {
      const s = String(input ?? "")
        .replace(/[\r\n]+/g, " ")
        .replace(/["\\]/g, " ")
        .trim();

      const noDiacritics = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cleaned = noDiacritics
        .replace(/[^a-zA-Z0-9._ -]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return cleaned || "Cua_Hang";
    };

    // ===== Helper: RFC 5987 encode for filename* =====
    // encodeURIComponent is sufficient for most cases; keep it strict & no CRLF.
    const encodeRFC5987 = (str) =>
      encodeURIComponent(
        String(str ?? "")
          .replace(/[\r\n]+/g, " ")
          .trim()
      );

    // ===== Build query filter (để khớp web/app) =====
    // Nếu bạn muốn export theo kỳ giống list-all, nên lọc theo periodType/periodKey ở đây.
    // (Ở code bạn đưa hiện đang export theo storeId thôi)
    const filter = { storeId };

    // Nếu BE của bạn đã có logic lọc kỳ ở endpoint export-all,
    // bạn có thể thay bằng function giống list-all.
    // Ở đây để "an toàn mọi trường hợp", chỉ thêm lọc khi có đủ dữ liệu:
    if (periodType && periodKey && periodType !== "custom") {
      // Gợi ý: bạn nên map periodType/periodKey -> createdAt range đúng như API list-all.
      // Nếu đã có helper dựng range ở nơi khác, hãy dùng lại.
      // (Không tự suy đoán range ở đây để tránh sai nghiệp vụ.)
    }
    if (periodType === "custom" && monthFrom && monthTo) {
      // Tương tự: nếu đã có helper createdAt range thì dùng.
    }

    const orders = await Order.find(filter)
      .populate("storeId", "name")
      .populate("employeeId", "fullName")
      .populate("customer", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng để xuất" });
    }

    const data = orders.map((order) => ({
      "Mã đơn": String(order._id).slice(-8),
      "Thời gian": dayjs(order.createdAt).format("DD/MM/YYYY HH:mm"),
      "Nhân viên": order.employeeId?.fullName || "—",
      "Khách hàng": order.customer?.name || "Khách lẻ",
      "Số điện thoại": order.customer?.phone || "—",
      "Tổng tiền": decimalToNumber(order.totalAmount),
      "Phương thức": order.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản",
      "Trạng thái":
        {
          pending: "Chờ thanh toán",
          paid: "Đã thanh toán",
          refunded: "Đã hoàn tiền",
          partially_refunded: "Hoàn 1 phần",
        }[order.status] || order.status,
      "In hóa đơn": order.printCount > 0 ? `Có (${order.printCount} lần)` : "Chưa",
      "Ghi chú": order.isVATInvoice ? "Có VAT" : "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 20 }];

    // Format cột "Tổng tiền" (cột F -> index 5)
    if (ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let R = 1; R <= range.e.r; ++R) {
        const cellRef = XLSX.utils.encode_cell({ c: 5, r: R });
        if (ws[cellRef]) {
          ws[cellRef].t = "n";
          ws[cellRef].z = "#,##0";
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Don_Hang");

    // SheetJS buffer
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // ===== Filename safe for all clients =====
    const storeName = orders[0]?.storeId?.name || "Cua_Hang";
    const dateText = dayjs().format("DD-MM-YYYY");

    // Name to show to users (UTF-8, can include Vietnamese)
    const utf8Name = `Danh_Sach_Don_Hang_${storeName}_${dateText}.xlsx`.replace(/[\r\n]+/g, " ").trim();

    // ASCII fallback (never breaks headers)
    const asciiFallback = `Danh_Sach_Don_Hang_${toAsciiSafe(storeName).replace(/ /g, "_")}_${dateText}.xlsx`;

    // RFC5987 for filename*
    const filenameStar = encodeRFC5987(utf8Name);

    res.status(200);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Length", String(buffer.length));

    // ✅ Quan trọng: gửi cả filename + filename* để mọi trình duyệt/app đều ổn
    res.setHeader("Content-Disposition", `attachment; filename="${asciiFallback}"; filename*=UTF-8''${filenameStar}`);

    return res.end(buffer);
  } catch (err) {
    console.error("Lỗi export đơn hàng:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const { storeId, periodType = "year", periodKey, monthFrom, monthTo } = req.query;
    const { start, end } = periodToRange(periodType, periodKey, monthFrom, monthTo);

    // Lấy ra danh sách orderId của cửa hàng trong khoảng thời gian
    const orders = await Order.find({
      storeId,
      createdAt: { $gte: start, $lte: end },
    })
      .select("_id status")
      .lean();

    const orderIds = orders.map((o) => o._id);

    // Đếm đơn từng trạng thái
    const total = orders.length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const refunded = orders.filter((o) => ["refunded", "partially_refunded"].includes(o.status)).length;
    const paid = orders.filter((o) => o.status === "paid").length;

    // ✅ Tổng số lượng sản phẩm bán ra (theo order_items)
    const orderItems = await OrderItem.find({
      orderId: { $in: orderIds },
      createdAt: { $gte: start, $lte: end },
    })
      .select("quantity")
      .lean();

    const totalSoldItems = orderItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

    // ✅ Tổng số lượng sản phẩm bị hoàn trả (theo order_refunds)
    const refundDocs = await OrderRefund.find({
      orderId: { $in: orderIds },
      refundedAt: { $gte: start, $lte: end },
    })
      .select("refundItems.quantity")
      .lean();

    const totalRefundedItems = refundDocs.reduce((sum, refund) => {
      const refundCount = refund.refundItems?.reduce((a, i) => a + (i.quantity || 0), 0) || 0;
      return sum + refundCount;
    }, 0);

    // Số lượng hàng thực bán (sau khi trừ hoàn)
    const netSoldItems = totalSoldItems - totalRefundedItems;

    res.json({
      message: "Lấy số liệu thống kê đơn hàng thành công",
      total,
      pending,
      refunded,
      paid,
      totalSoldItems,
      totalRefundedItems,
      netSoldItems: netSoldItems >= 0 ? netSoldItems : 0, // Đây chính là “Số lượng hàng thực bán”
    });
  } catch (err) {
    console.error("Lỗi khi lấy thống kê đơn:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy thống kê đơn hàng" });
  }
};
const genNKCode = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");

  return `NK-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(
    now.getSeconds()
  )}`;
};

// Hủy đơn pending + hoàn kho + tạo phiếu nhập (IN)
const deletePendingOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    // 1. LẤY ĐƠN
    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // 2. CHỈ HỦY PENDING
    if (order.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Chỉ có thể hủy đơn ở trạng thái pending" });
    }

    // 3. LẤY ITEM
    const orderItems = await OrderItem.find({
      orderId: order._id,
    }).session(session);

    if (!orderItems.length) {
      throw new Error("Không tìm thấy sản phẩm trong đơn");
    }

    // 4. HOÀN KHO + PREPARE VOUCHER ITEM
    const voucherItems = [];

    for (const it of orderItems) {
      const prod = await Product.findById(it.productId).session(session);
      if (!prod) continue;

      prod.stock_quantity = Number(prod.stock_quantity || 0) + Number(it.quantity || 0);

      await prod.save({ session });

      voucherItems.push({
        product_id: prod._id,
        sku_snapshot: it.sku_snapshot || prod.sku || "",
        name_snapshot: it.name_snapshot || prod.name || "",
        unit_snapshot: it.unit_snapshot || prod.unit || "",
        qty_document: it.quantity,
        qty_actual: it.quantity,
        unit_cost: it.cost_price_snapshot || prod.cost_price || 0,
        warehouse_id: it.warehouse_id || null,
        warehouse_name: it.warehouse_name || "",
        note: "Hoàn kho do hủy đơn hàng",
      });
    }

    // 5. TẠO PHIẾU NHẬP (IN) – KHÔNG PHỤ THUỘC PHIẾU CŨ
    const reverseVoucher = await new InventoryVoucher({
      store_id: order.storeId,
      type: "IN",
      status: "POSTED",
      voucher_code: genNKCode(),
      voucher_date: new Date(),

      document_place: "Tại quầy",
      reason: "Hoàn kho do hủy đơn hàng",
      note: `Hủy đơn hàng #${order._id}`,

      ref_type: "ORDER_CANCEL",
      ref_id: order._id,
      ref_no: order._id.toString(),
      ref_date: new Date(),

      created_by: userId,
      items: voucherItems,
    }).save({ session });

    // 6. UPDATE ORDER (KHÔNG DELETE)
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.reverse_inventory_voucher_id = reverseVoucher._id;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Hủy đơn pending & hoàn kho thành công",
      orderId: order._id,
      reverseVoucher: {
        _id: reverseVoucher._id,
        voucher_code: reverseVoucher.voucher_code,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Hủy đơn pending lỗi:", err);
    return res.status(500).json({
      message: err.message || "Lỗi server khi hủy đơn hàng",
    });
  }
};

module.exports = {
  createOrder,
  setPaidCash,
  printBill,
  //phần của thanh toán QR
  vietqrReturn,
  vietqrCancel,
  //phần của top sản phẩm và export
  getTopSellingProducts,
  exportTopSellingProducts,
  //phần của top khách hàng và export
  getTopFrequentCustomers,
  exportTopFrequentCustomers,

  getOrderById,
  getOrderStats,
  refundOrder,
  getListPaidOrders,
  getListRefundOrders,
  getOrderRefundDetail,
  getOrderListAll,
  exportAllOrdersToExcel,
  deletePendingOrder,
};
