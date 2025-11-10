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
const { generateQRWithPayOS } = require("../../services/payOSService");
const { v2: cloudinary } = require("cloudinary");

const createOrder = async (req, res) => {
  try {
    const { storeId, employeeId, customerInfo, items, paymentMethod, isVATInvoice, vatInfo, usedPoints } = req.body;

    if (!items || items.length === 0) {
      console.log("Lỗi: Không có sản phẩm trong hóa đơn");
      return res.status(400).json({ message: "Hóa đơn phải có ít nhất 1 sản phẩm" });
    }

    // Validate sản phẩm + tính total (ko trừ stock ở đây, chờ in bill)
    let total = 0;
    const validatedItems = [];
    const session = await mongoose.startSession();
    session.startTransaction();
    let qrData = null; // Define qrData = null ngoài if, safe ternary res.json
    try {
      for (let item of items) {
        const prod = await Product.findById(item.productId).session(session);
        if (
          !prod ||
          prod.store_id.toString() !== storeId.toString() ||
          prod.stock_quantity < item.quantity ||
          prod.status !== "Đang kinh doanh"
        ) {
          // Kiểm tra stock đủ trước, nhưng ko trừ - chỉ warn nếu thiếu
          throw new Error(`Sản phẩm ${prod?.name || "không tồn tại"} hết hàng hoặc không tồn tại trong cửa hàng`);
        }
        const priceAtTime = prod.price;
        const subtotal = (parseFloat(priceAtTime) * item.quantity).toFixed(2);
        total += parseFloat(subtotal);
        validatedItems.push({
          ...item,
          priceAtTime: priceAtTime.toString(),
          subtotal: subtotal.toString(),
        });
      }

      // Tính VAT nếu cần (bonus: lưu sẵn cho báo cáo)
      let vatAmountStr = "0";
      let beforeTaxStr = total.toFixed(2); // Default trước thuế = total nếu ko VAT
      if (isVATInvoice) {
        // Tính bằng Number rồi format 2 chữ số
        const totalNum = Number(parseFloat(total).toFixed(2)); // đảm bảo là number với 2 chữ số
        const vatNum = Number((totalNum * 0.1).toFixed(2)); // VAT 10%
        const beforeTaxNum = Number((totalNum - vatNum).toFixed(2)); // Giá chưa thuế
        // Lưu chuỗi (hoặc dùng Decimal128.fromString nếu muốn)
        vatAmountStr = vatNum.toString();
        beforeTaxStr = beforeTaxNum.toString();
      }

      // Xử lý customer: Tìm hoặc tạo mới nếu phone ko trùng (tránh duplicate)
      let customer;
      if (customerInfo && customerInfo.phone) {
        customer = await Customer.findOne({
          phone: customerInfo.phone.trim(),
        }).session(session);
        if (!customer) {
          // Tạo mới nếu ko tồn tại
          customer = new Customer({
            name: customerInfo.name.trim(),
            phone: customerInfo.phone.trim(),
            storeId: storeId, // 👈 Fix: Truyền storeId vào Customer để ref store (required validation pass)
          });
          await customer.save({ session });
          console.log("Tạo khách hàng mới:", customer.phone);
        } else {
          // Update name nếu khác
          if (customer.name !== customerInfo.name.trim()) {
            customer.name = customerInfo.name.trim();
            await customer.save({ session });
          }
        }
      } else {
        // Không có thông tin khách, để null (khách vãng lai)
        customer = null;
      }

      // Lấy loyalty config store (cho discount usedPoints)
      const loyalty = await LoyaltySetting.findOne({ storeId }).session(session);
      let discount = 0;
      if (usedPoints && loyalty && loyalty.isActive) {
        // Áp dụng giảm giá nếu active, usedPoints <= loyaltyPoints customer
        const maxUsed = Math.min(usedPoints, customer.loyaltyPoints || 0);
        discount = maxUsed * loyalty.vndPerPoint;
        if (discount > 0) {
          customer.loyaltyPoints -= maxUsed; // Trừ điểm dùng
          await customer.save({ session });
          total -= discount; // Subtract discount từ total
          console.log(`Giảm giá ${discount} từ ${maxUsed} điểm cho khách ${customer.phone}`);
        }
      }

      // Tạo Order pending (status default pending)
      const newOrder = new Order({
        storeId,
        employeeId,
        customer: customer ? customer._id : null, // Ref customer thay customerInfo
        totalAmount: total.toFixed(2).toString(),
        paymentMethod,
        isVATInvoice,
        vatInfo,
        vatAmount: vatAmountStr,
        beforeTaxAmount: beforeTaxStr,
      });

      await newOrder.save({ session });

      // Lưu OrderItems
      for (let validatedItem of validatedItems) {
        const newItem = new OrderItem({
          orderId: newOrder._id,
          ...validatedItem,
        });
        await newItem.save({ session });
      }

      let paymentRef = null;
      if (paymentMethod === "qr") {
        // Generate QR PayOS (pending, chờ webhook)
        qrData = await generateQRWithPayOS({
          body: {
            amount: total,
            orderInfo: `Thanh toan hoa don ${newOrder._id}`,
          },
        });
        console.log("Sử dụng PayOS QR thành công");
        paymentRef = qrData.txnRef;
        newOrder.paymentRef = paymentRef;
        newOrder.qrExpiry = new Date(Date.now() + 15 * 60 * 1000); // Hết hạn 15 phút
        await newOrder.save({ session });
        console.log(`Tạo QR pending thành công cho hóa đơn ${newOrder._id}, ref: ${paymentRef}, chờ webhook confirm`);
      } else {
        // Cash: Pending, chờ in bill để paid + trừ stock
        console.log(`Tạo hóa đơn cash pending thành công cho ${newOrder._id}, chờ in bill`);
      }

      await session.commitTransaction(); // Commit tất cả
      session.endSession();

      // Inner try res.json sau commit, catch local format error ko abort
      try {
        // Sắp xếp lại format object để _id lên đầu dễ đọc
        const orderObj = newOrder.toObject();
        const orderedOrder = {
          _id: orderObj._id,
          ...orderObj,
          items: validatedItems,
        };
        // log nhật ký hoạt động
        await logActivity({
          user: req.user,
          store: { _id: storeId },
          action: "create",
          entity: "Order",
          entityId: newOrder._id,
          entityName: `Đơn hàng #${newOrder._id}`,
          req,
          description: `Tạo đơn hàng mới (phương thức ${paymentMethod === "qr" ? "QRCode" : "tiền mặt"}) cho khách ${
            customerInfo?.name || customerInfo?.phone || "khách vãng lai"
          }`,
        });

        res.status(201).json({
          message: "Tạo hóa đơn thành công (pending)",
          order: orderedOrder,
          qrRef: paymentRef, // Ref để webhook
          qrDataURL: qrData ? qrData.qrDataURL : null, // QR base64 FE render
          paymentLinkUrl: qrData ? qrData.paymentLinkUrl : null, // Link quẹt nếu PayOS
          qrExpiry: paymentMethod === "qr" ? newOrder.qrExpiry : null, // Expiry FE countdown
        });
      } catch (format_err) {
        console.log("Lỗi format response order:", format_err.message); // Log tiếng Việt format error
        res.status(500).json({ message: "Lỗi format response: " + format_err.message }); // Return local ko abort
      }
    } catch (inner_err) {
      await session.abortTransaction(); // Abort chỉ inner error (validate/save)
      session.endSession();
      console.error("Lỗi inner createOrder:", inner_err.message); // Log tiếng Việt inner error
      res.status(500).json({ message: "Lỗi tạo hóa đơn nội bộ: " + inner_err.message });
    }
  } catch (err) {
    console.error("Lỗi tạo hóa đơn:", err.message); // Log tiếng Việt outer error
    res.status(500).json({ message: "Lỗi server khi tạo hóa đơn: " + err.message });
  }
};

// Bonus: POST /api/orders/:orderId/set-paid-cash - Cho cash: Staff confirm giao dịch tay → set paid (trước print)
const setPaidCash = async (req, res) => {
  try {
    const { orderId: mongoId } = req.params;
    const order = await Order.findById(mongoId);
    if (!order || order.paymentMethod !== "cash" || order.status !== "pending") {
      return res.status(400).json({ message: "Hóa đơn cash không hợp lệ cho set paid" });
    }
    order.status = "paid";
    await order.save();
    // Gửi socket thông báo hóa đơn đã paid (FE lắng nghe để refresh)
    const io = req.app.get("io");
    if (io) {
      io.emit("payment_success", {
        orderId: order._id,
        ref: order._id.toString(), // Cash ko có paymentRef, dùng _id
        amount: order.totalAmount,
        method: order.paymentMethod,
        message: `Đơn hàng ${order._id} đã thanh toán thành công (TIỀN MẶT)!`,
      });
      console.log(
        `🔔 [SOCKET] Gửi thông báo: Thanh toán thành công, số tiền: (${order.totalAmount}đ) - Mã đơn hàng: ${order._id}`
      );
    }
    // log nhật ký hoạt động
    await logActivity({
      user: req.user,
      store: { _id: order.storeId },
      action: "update",
      entity: "Order",
      entityId: order._id,
      entityName: `Đơn hàng #${order._id}`,
      req,
      description: `Xác nhận thanh toán tiền mặt cho đơn hàng #${order._id}, tổng tiền ${order.totalAmount}đ`,
    });

    console.log(`Set paid cash thành công cho hóa đơn ${mongoId}, sẵn sàng in bill`);
    res.json({
      message: "Xác nhận thanh toán cash thành công, sẵn sàng in hóa đơn",
    });
  } catch (err) {
    console.error("Lỗi set paid cash:", err.message);
    res.status(500).json({ message: "Lỗi server set paid cash" });
  }
};

// POST /api/orders/:orderId/print-bill - In hóa đơn (check paid → trừ stock + generate text bill chi tiết với populate)
const printBill = async (req, res) => {
  try {
    const { orderId: mongoId } = req.params; // Dùng _id Mongo
    // Populate full order trước: store name, employee fullName, customer name/phone
    const order = await Order.findById(mongoId)
      .populate("storeId", "name") // Populate tên cửa hàng
      .populate("employeeId", "fullName") // Tên nhân viên
      .populate("customer", "name phone") // Populate tên/SĐT khách từ Customer ref
      .lean();

    if (!order || order.status !== "paid") {
      console.log("Hóa đơn chưa paid, không thể in bill:", mongoId);
      return res.status(400).json({ message: "Hóa đơn chưa thanh toán, không thể in" });
    }

    // Di chuyển items ra ngoài session, populate cho bill (read only, ko cần session)
    const items = await OrderItem.find({ orderId: order._id })
      .populate("productId", "name sku") // Populate tên/sku sản phẩm cho bill
      .lean(); // Lean cho nhanh, ko session

    let isFirstPrint = order.printCount === 0; // Check lần in đầu (printCount default 0)
    const isDuplicate = !isFirstPrint; // Nếu >0 thì duplicate

    // Lấy loyalty config store (cho earnedPoints khi in bill)
    const loyalty = await LoyaltySetting.findOne({ storeId: order.storeId });
    let earnedPoints = 0;
    if ((isFirstPrint && loyalty && loyalty.isActive && order.totalAmount >= loyalty.minOrderValue, order.customer)) {
      earnedPoints = parseFloat(order.totalAmount) * loyalty.pointsPerVND; // Tích điểm = total * tỉ lệ
      // Cộng điểm vào customer (atomic session)
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const customer = await Customer.findById(order.customer).session(session);
        if (customer) {
          // 🔢 Chuyển đổi và cộng dồn tổng chi tiêu (Decimal128 → float)
          const prevSpent = parseFloat(customer.totalSpent?.toString() || 0);
          const currentSpent = parseFloat(order.totalAmount?.toString() || 0);
          const newSpent = prevSpent + currentSpent;

          // 🎯 Làm tròn điểm thưởng (chỉ lấy số nguyên, bỏ lẻ)
          const roundedEarnedPoints = Math.floor(earnedPoints);

          // 💾 Cập nhật dữ liệu khách hàng
          customer.loyaltyPoints = (customer.loyaltyPoints || 0) + roundedEarnedPoints; // 🎁 Cộng điểm mới (làm tròn)
          customer.totalSpent = mongoose.Types.Decimal128.fromString(newSpent.toFixed(2)); // 💰 Cập nhật tổng chi tiêu chính xác 2 số lẻ
          customer.totalOrders = (customer.totalOrders || 0) + 1; // 🛒 +1 đơn hàng

          await customer.save({ session });

          console.log(
            `[LOYALTY] +${roundedEarnedPoints} điểm cho khách ${customer.phone} | Tổng điểm: ${
              customer.loyaltyPoints
            } | Tổng chi tiêu: ${newSpent.toLocaleString()}đ`
          );
        }

        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw new Error("Lỗi cộng điểm khi in bill: " + err.message);
      }
    } else if (isDuplicate) {
      console.log(`In hóa đơn duplicate lần ${order.printCount + 1}, không trừ stock/cộng điểm cho ${mongoId}`);
    }

    // Trừ stock chỉ lần đầu (atomic session)
    if (isFirstPrint) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        for (let item of items) {
          // Dùng items từ ngoài, chỉ trừ stock
          const prod = await Product.findById(item.productId._id).session(session); // Ref _id sau populate
          if (prod) {
            prod.stock_quantity -= item.quantity; // Trừ stock thật
            await prod.save({ session });
            console.log(`Trừ stock khi in bill thành công cho ${prod.name}: -${item.quantity}`);
          }
        }
        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw new Error("Lỗi trừ stock khi in bill: " + err.message);
      }
    }

    // Generate text bill chi tiết (với tên prod từ populate items, thêm note duplicate nếu có)
    let bill = `=== HÓA ĐƠN BÁN HÀNG ===\n`;
    bill += `ID Hóa đơn: ${order._id}\n`;
    bill += `Cửa hàng: ${order.storeId?.name || "Cửa hàng mặc định"}\n`;
    bill += `Nhân viên: ${order.employeeId?.fullName || "N/A"}\n`;
    bill += `Khách hàng: ${order.customer?.name || "Khách vãng lai"} ${
      order.customer?.phone ? "- " + order.customer.phone : ""
    }\n`; // Populate từ customer ref
    bill += `Ngày: ${new Date(order.createdAt).toLocaleString("vi-VN")}\n`;
    bill += `Ngày in: ${new Date().toLocaleString("vi-VN")}\n`;
    if (isDuplicate) bill += `(Bản sao hóa đơn - lần in ${order.printCount + 1})\n`; // Note duplicate
    bill += `\nCHI TIẾT SẢN PHẨM:\n`;
    items.forEach((item) => {
      bill += `- ${item.productId?.name || "Sản phẩm"} (${item.productId?.sku || "N/A"}): ${item.quantity} x ${
        item.priceAtTime
      } = ${item.subtotal} VND\n`;
    });
    bill += `\nTỔNG TIỀN: ${order.totalAmount.toString()} VND\n`; // toString() cho Decimal128 clean
    bill += `Phương thức: ${order.paymentMethod === "cash" ? "TIỀN MẶT" : "QR CODE"}\n`; // Rõ ràng hơn cho bill
    if (earnedPoints > 0) bill += `Điểm tích lũy lần này: ${earnedPoints.toFixed(0)} điểm\n`; // Thêm điểm tích nếu có
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

    const logMsg = isDuplicate ? "In hóa đơn BẢN SAO thành công" : "In hóa đơn thành công, đã trừ stock";
    console.log(`${logMsg} cho ${order._id}, Số lần in hiện tại: ${updatedOrder.printCount}`);
    res.json({
      message: `${logMsg}, printCount: ${updatedOrder.printCount}`,
      bill: bill,
      orderId: order._id,
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
        productName: item.productId.name, // Ví dụ: "Giày Nike Air"
        productSku: item.productId.sku, // "NIKE-AIR-001"
      })),
    };

    console.log("Lấy chi tiết hóa đơn thành công:", orderId); // Log success
    res.json({ message: "Lấy hóa đơn thành công", order: enrichedOrder });
  } catch (err) {
    console.error("Lỗi khi lấy hóa đơn:", err.message); // Log error tiếng Việt
    res.status(500).json({ message: "Lỗi server khi lấy hóa đơn" });
  }
};

// fix refundOrder: query OrderItem để lấy items, loop cộng stock, populate product name cho log
const refundOrder = async (req, res) => {
  try {
    const { orderId: mongoId } = req.params; // _id từ params
    let { employeeId, refundReason, items } = req.body; // Body: employeeId + lý do hoàn + danh sách sản phẩm

    // 👇 SỬA LẠI ĐOẠN NÀY
    // Parse items nếu là string
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch (err) {
        // Nếu parse fail, log ra để debug
        console.error("❌ Parse items error:", err.message);
        console.error("📦 Raw items value:", items);
        return res.status(400).json({
          message: "items phải là JSON array hợp lệ",
          receivedValue: items,
          error: err.message,
        });
      }
    }

    // Kiểm tra items sau khi parse
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Danh sách sản phẩm hoàn không hợp lệ",
        receivedValue: items,
        receivedType: typeof items,
      });
    }

    // 1️⃣ Kiểm tra nhân viên
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(400).json({ message: "Nhân viên không tồn tại" });

    // 2️⃣ Kiểm tra đơn hàng
    const order = await Order.findById(mongoId).populate("employeeId", "fullName");
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    if (order.status !== "paid" && order.status !== "partially_refunded")
      return res.status(400).json({ message: "Chỉ hoàn đơn đã thanh toán" });

    // 3️⃣ Upload chứng từ (image/video)
    const files = req.files || [];
    const evidenceMedia = [];
    for (const file of files) {
      const resourceType = file.mimetype.startsWith("video") ? "video" : "image";
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `refunds/${mongoId}`,
            resource_type: resourceType,
          },
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });
      evidenceMedia.push({
        url: result.secure_url,
        public_id: result.public_id,
        type: resourceType,
      });
    }

    let refundTotal = 0;
    const refundItems = [];

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const i of items) {
        const orderItem = await OrderItem.findOne({
          orderId: mongoId,
          productId: i.productId,
        }).populate("productId", "name stock_quantity");

        if (!orderItem) continue;
        //check không cho hoàn quá số lượng đã mua, kể cả là đến hoàn hàng lần thứ "n"
        const totalRefundedBefore = await OrderRefund.aggregate([
          { $match: { orderId: new mongoose.Types.ObjectId(mongoId) } },
          { $unwind: "$refundItems" },
          { $match: { "refundItems.productId": i.productId } },
          { $group: { _id: null, refundedQty: { $sum: "$refundItems.quantity" } } },
        ]);

        const refundedQty = totalRefundedBefore[0]?.refundedQty || 0;

        if (i.quantity + refundedQty > orderItem.quantity) {
          throw new Error(
            `Tổng số lượng hoàn (${i.quantity + refundedQty}) vượt quá số lượng đã mua (${
              orderItem.quantity
            }) cho sản phẩm "${orderItem.productId.name}"`
          );
        }

        const refundQty = Math.min(i.quantity, orderItem.quantity);
        const subtotal = Number(orderItem.priceAtTime || orderItem.subtotal / orderItem.quantity) * refundQty;
        refundTotal += subtotal;

        refundItems.push({
          productId: i.productId,
          quantity: refundQty,
          priceAtTime: orderItem.priceAtTime || orderItem.subtotal / orderItem.quantity,
          subtotal,
        });

        // Cộng lại stock
        await Product.findByIdAndUpdate(i.productId, { $inc: { stock_quantity: refundQty } }, { session });

        console.log(`➕ Cộng lại tồn kho cho ${orderItem.productId.name}: +${refundQty}`);
      }

      // 5️⃣ Tạo bản ghi refund
      const refund = await OrderRefund.create(
        [
          {
            orderId: mongoId,
            refundedBy: employeeId,
            refundedAt: new Date(),
            refundReason,
            refundAmount: refundTotal,
            refundItems,
            evidenceMedia,
          },
        ],
        { session }
      );

      // 6️⃣ Cập nhật trạng thái đơn
      const totalItems = await OrderItem.countDocuments({ orderId: mongoId });
      const totalRefundedQty = refundItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalOrderQty =
        (
          await OrderItem.aggregate([
            { $match: { orderId: new mongoose.Types.ObjectId(mongoId) } },
            { $group: { _id: null, totalQty: { $sum: "$quantity" } } },
          ])
        )[0]?.totalQty || 0;

      if (totalRefundedQty >= totalOrderQty) {
        order.status = "refunded";
      } else {
        order.status = "partially_refunded";
      }

      order.refundId = refund[0]._id;
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      // 7️⃣ Ghi log hoạt động
      await logActivity({
        user: req.user,
        store: { _id: order.storeId },
        action: "update",
        entity: "OrderRefund",
        entityId: refund[0]._id,
        entityName: `Hoàn hàng đơn #${order._id}`,
        req,
        description: `Hoàn ${refundItems.length} sản phẩm trong đơn #${
          order._id
        }, tổng tiền hoàn ${refundTotal.toLocaleString()}đ. Lý do: "${refundReason}"`,
      });

      res.status(200).json({
        message: "Hoàn hàng thành công",
        refund: refund[0],
        order,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ Lỗi khi hoàn hàng:", err.message);
      res.status(500).json({ message: "Lỗi khi hoàn hàng", error: err.message });
    }
  } catch (err) {
    console.error("🔥 Lỗi refund:", err.message);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// GET http://localhost:9999/api/orders/top-products?limit=5&range=thisYear&storeId=68f8f19a4d723cad0bda9fa5
//  Top sản phẩm bán chạy (sum quantity/sales từ OrderItem, filter paid + range/date/store)
const getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10, storeId, range, dateFrom, dateTo } = req.query; // nếu ko có limit thì mặc định lấy top 10 sản phẩm
    // Nếu không có range và không có dateFrom/dateTo thì báo lỗi
    if (!range && !dateFrom && !dateTo) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tham số range hoặc khoảng thời gian (today/yesterday/thisWeek/thisMonth/thisYear)",
      });
    }
    // Tự lấy storeId từ user nếu không truyền query
    let finalStoreId = storeId;
    if (!finalStoreId && req.user?.storeId) {
      finalStoreId = req.user.storeId;
    }
    // Nếu vẫn không có storeId thì báo lỗi (tránh leak toàn bộ data)
    if (!finalStoreId) {
      return res.status(400).json({
        message: "Thiếu storeId, không thể lấy top sản phẩm.",
      });
    }
    // Xử lý date range
    let matchDate = {};
    const now = new Date();

    if (range) {
      switch (range) {
        case "today":
          matchDate = {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lte: new Date(now.setHours(23, 59, 59, 999)),
          };
          break;
        case "yesterday":
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          matchDate = {
            $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
            $lte: new Date(yesterday.setHours(23, 59, 59, 999)),
          };
          break;
        case "thisWeek": // Tuần hiện tại từ Thứ 2, vì việt nam thứ 2 là đầu tuần
          const currentDay = now.getDay(); // 0 (Sun) -> 6 (Sat)
          const diffToMonday = currentDay === 0 ? 6 : currentDay - 1; // Nếu chủ nhật -> lùi 6 ngày
          const monday = new Date(now);
          monday.setDate(now.getDate() - diffToMonday);
          matchDate = { $gte: new Date(monday.setHours(0, 0, 0, 0)) };
          break;
        case "thisMonth":
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          matchDate = { $gte: new Date(monthStart.setHours(0, 0, 0, 0)) };
          break;
        case "thisYear":
          const yearStart = new Date(now.getFullYear(), 0, 1);
          matchDate = { $gte: new Date(yearStart.setHours(0, 0, 0, 0)) };
          break;
        default:
          matchDate = {}; // Default nếu range sai
      }
    } else if (dateFrom || dateTo) {
      if (dateFrom) matchDate.$gte = new Date(dateFrom);
      if (dateTo) matchDate.$lte = new Date(dateTo);
    } else {
      // Default thisMonth nếu ko có range/date
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      matchDate.$gte = monthStart;
    }
    const match = {
      "order.status": "paid",
      "order.createdAt": matchDate,
    };

    if (storeId) {
      match["order.storeId"] = new mongoose.Types.ObjectId(storeId); // Filter store nếu có
    }

    const topProducts = await OrderItem.aggregate([
      // Join với Order để filter status 'paid' + date/store
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      { $match: match }, // Match filter paid + date/store

      // Group by productId, sum quantity/sales/count orders
      {
        $group: {
          _id: "$productId",
          totalQuantity: { $sum: "$quantity" }, // Tổng số lượng bán
          totalSales: { $sum: "$subtotal" }, // Tổng doanh thu
          countOrders: { $sum: 1 }, // Số order có sản phẩm này
        },
      },
      // Sort top (quantity desc)
      { $sort: { totalQuantity: -1 } },
      // Limit
      { $limit: parseInt(limit) },
      // Populate product name/sku
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
          // Project fields cần
          productName: "$product.name",
          productSku: "$product.sku",
          totalQuantity: 1,
          totalSales: 1,
          countOrders: 1,
        },
      },
    ]);
    res.json({
      message: `Top selling products thành công, limit ${limit}, kết quả: ${topProducts.length} sản phẩm`,
      data: topProducts,
    });
  } catch (err) {
    console.error("Lỗi top selling products:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy top sản phẩm bán chạy" });
  }
};

//api/orders/top-customers?limit=5&range=thisMonth&storeId=68e81dbffae46c6d9fe2e895
const getTopFrequentCustomers = async (req, res) => {
  try {
    const { limit = 10, storeId, range } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    // 🔹 Xác định khoảng thời gian theo range
    const now = new Date();
    let matchDate = {};

    switch (range) {
      case "thisWeek": {
        const currentDay = now.getDay(); // 0 (CN) -> 6 (T7)
        const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        matchDate = { $gte: new Date(monday.setHours(0, 0, 0, 0)) };
        break;
      }

      case "thisYear": {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        matchDate = { $gte: new Date(yearStart.setHours(0, 0, 0, 0)) };
        break;
      }

      case "thisMonth":
      default: {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        matchDate = { $gte: new Date(monthStart.setHours(0, 0, 0, 0)) };
        break;
      }
    }

    // 🔹 Lọc theo cửa hàng + đơn đã thanh toán + thời gian
    const matchStage = {
      status: "paid",
      storeId: new mongoose.Types.ObjectId(storeId),
      createdAt: matchDate,
    };

    // 🔹 Aggregate pipeline
    const topCustomers = await Order.aggregate([
      { $match: matchStage },

      // Gom nhóm theo customer ref
      {
        $group: {
          _id: "$customer",
          totalAmount: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          latestOrder: { $max: "$createdAt" },
        },
      },

      { $sort: { totalAmount: -1 } },
      { $limit: parseInt(limit) },

      // Join sang bảng customers
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },

      // Lọc khách đã xóa
      { $match: { "customer.isDeleted": { $ne: true } } },

      // 🔸 Trả nhiều field hơn để FE dùng
      {
        $project: {
          customerId: "$customer._id",
          customerName: "$customer.name",
          customerPhone: "$customer.phone",
          address: "$customer.address",
          note: "$customer.note",
          loyaltyPoints: "$customer.loyaltyPoints",
          totalSpentAllTime: "$customer.totalSpent",
          totalOrdersAllTime: "$customer.totalOrders",
          totalAmount: 1, // trong khoảng range được chọn
          orderCount: 1, // trong khoảng range được chọn
          latestOrder: 1,
        },
      },
    ]);

    res.json({
      message: `Top khách hàng thường xuyên (${range || "thisMonth"})`,
      data: topCustomers,
    });
  } catch (err) {
    console.error("Lỗi top khách hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy top khách hàng" });
  }
};

// GET /api/orders/top-products/export - Export top sản phẩm bán chạy ra CSV hoặc PDF (params giống getTopSellingProducts + format='csv' or 'pdf')
const exportTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10, storeId, range, dateFrom, dateTo, format = "csv" } = req.query;
    // Xử lý date range (giống getTopSellingProducts)
    let matchDate = {};
    const now = new Date();

    if (range) {
      switch (range) {
        case "today":
          matchDate = {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lte: new Date(now.setHours(23, 59, 59, 999)),
          };
          break;
        case "yesterday":
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          matchDate = {
            $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
            $lte: new Date(yesterday.setHours(23, 59, 59, 999)),
          };
          break;
        case "thisWeek": // Tuần hiện tại từ Thứ 2, vì việt nam thứ 2 là đầu tuần
          const currentDay = now.getDay(); // 0 (Sun) -> 6 (Sat)
          const diffToMonday = currentDay === 0 ? 6 : currentDay - 1; // Nếu chủ nhật -> lùi 6 ngày
          const monday = new Date(now);
          monday.setDate(now.getDate() - diffToMonday);
          matchDate = { $gte: new Date(monday.setHours(0, 0, 0, 0)) };
          break;
        case "thisMonth":
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          matchDate = { $gte: new Date(monthStart.setHours(0, 0, 0, 0)) };
          break;
        case "thisYear":
          const yearStart = new Date(now.getFullYear(), 0, 1);
          matchDate = { $gte: new Date(yearStart.setHours(0, 0, 0, 0)) };
          break;
        default:
          matchDate = {}; // Default nếu range sai
      }
    } else if (dateFrom || dateTo) {
      if (dateFrom) matchDate.$gte = new Date(dateFrom);
      if (dateTo) matchDate.$lte = new Date(dateTo);
    } else {
      // Default thisMonth nếu ko có range/date
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      matchDate.$gte = monthStart;
    }

    const match = {
      "order.status": "paid",
      "order.createdAt": matchDate,
    };

    if (storeId) {
      match["order.storeId"] = new mongoose.Types.ObjectId(storeId); // Filter store nếu có
    }

    const topProducts = await OrderItem.aggregate([
      // Join với Order để filter status 'paid' + date/store
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      { $match: match }, // Match filter paid + date/store

      // Group by productId, sum quantity/sales/count orders
      {
        $group: {
          _id: "$productId",
          totalQuantity: { $sum: "$quantity" }, // Tổng số lượng bán
          totalSales: { $sum: "$subtotal" }, // Tổng doanh thu
          countOrders: { $sum: 1 }, // Số order có sản phẩm này
        },
      },

      // Sort top (quantity desc)
      { $sort: { totalQuantity: -1 } },

      // Limit
      { $limit: parseInt(limit) },

      // Populate product name/sku
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
          // Project fields cần
          productName: "$product.name",
          productSku: "$product.sku",
          totalQuantity: 1,
          totalSales: 1,
          countOrders: 1,
        },
      },
    ]);

    if (format === "csv") {
      // Convert data sang CSV string với json2csv
      const fields = ["productName", "productSku", "totalQuantity", "totalSales", "countOrders"]; // Fields CSV
      const csv = new Parser({ fields }).parse(topProducts); // Parse data sang CSV
      res.header("Content-Type", "text/csv"); // Set header CSV
      res.attachment("top-selling-products.csv"); // Tên file download
      res.send(csv); // Gửi CSV string
    } else if (format === "pdf") {
      // Generate PDF với pdfkit (table top products)
      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=top-selling-products.pdf");
      doc.pipe(res); // Pipe PDF stream vào response

      // Header PDF
      doc.fontSize(20).text("Báo cáo Top Sản phẩm Bán chạy", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Thời gian: ${new Date().toLocaleDateString("vi-VN")}`);
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(10).text("STT", 50, doc.y);
      doc.text("Tên sản phẩm", 100, doc.y);
      doc.text("SKU", 250, doc.y);
      doc.text("Số lượng bán", 300, doc.y);
      doc.text("Doanh thu", 350, doc.y);
      doc.text("Số đơn hàng", 450, doc.y);
      doc.moveDown();

      // Table data
      topProducts.forEach((prod, index) => {
        doc.text((index + 1).toString(), 50, doc.y);
        doc.text(prod.productName, 100, doc.y);
        doc.text(prod.productSku, 250, doc.y);
        doc.text(prod.totalQuantity.toString(), 300, doc.y);
        doc.text(prod.totalSales.toString() + " VND", 350, doc.y);
        doc.text(prod.countOrders.toString(), 450, doc.y);
        doc.moveDown();
      });

      doc.end(); // End PDF stream
    } else {
      // Default JSON response
      res.json({
        message: `Top selling products thành công, limit ${limit}, kết quả: ${topProducts.length} sản phẩm`,
        data: topProducts,
      });
    }
  } catch (err) {
    console.error("Lỗi top selling products:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy top sản phẩm bán chạy" });
  }
};

// 1) api/orders/list-paid, "getListPaidOrders ", (lấy danh sách các đơn đã thanh toán thành công, status là "paid")
// 2) api/orders/list-refund, (Xem danh sách các order đã hoàn trả thành công, có 2 trạng thái là refunded và partially_refunded)
// 3) /api/orders/order-refund/:orderId, ( để xem chi tiết 1 order đã hoàn trả thành công)

const getListPaidOrders = async (req, res) => {
  const { storeId } = req.query;
  try {
    const orders = await Order.find({ status: "paid", storeId })
      .populate("storeId", "name")
      .populate("employeeId", "fullName")
      .populate("customer", "name phone")
      .select("storeId employeeId customer totalAmount paymentMethod createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      message: "Lấy danh sách hóa đơn đã thanh toán thành công",
      orders,
    });
  } catch (err) {
    console.error("Lỗi khi lấy danh sách hóa đơn đã thanh toán:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách hóa đơn đã thanh toán" });
  }
};

const getListRefundOrders = async (req, res) => {
  const { storeId } = req.query;
  try {
    const refundOrders = await Order.find({
      storeId,
      status: { $in: ["refunded", "partially_refunded"] },
    })
      .populate("storeId", "name")
      .populate("employeeId", "fullName")
      .populate("customer", "name phone")
      .select("storeId employeeId customer totalAmount status createdAt updatedAt refundId")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      message: "Lấy danh sách đơn hoàn hàng thành công",
      orders: refundOrders,
    });
  } catch (err) {
    console.error("Lỗi khi lấy danh sách đơn hoàn hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách đơn hoàn hàng" });
  }
};

const getOrderRefundDetail = async (req, res) => {
  const { storeId } = req.query;
  const { orderId } = req.params;

  try {
    // Lấy đơn hàng gốc
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

    // Nếu đơn có refundId thì lấy thêm chi tiết từ bảng OrderRefund
    let refundDetail = null;
    if (order.refundId) {
      refundDetail = await OrderRefund.findById(order.refundId)
        .populate("orderId", "totalAmount paymentMethod status")
        .populate("refundedBy", "fullName")
        .populate("refundItems.productId", "name price sku")
        .lean();
    }

    // Nếu ông có OrderItem thì lấy danh sách sản phẩm của đơn gốc luôn
    const orderItems = await OrderItem.find({ orderId }).populate("productId", "name price sku").lean();

    return res.status(200).json({
      message: "Lấy chi tiết đơn hoàn hàng thành công",
      order,
      refundDetail,
      orderItems,
    });
  } catch (error) {
    console.error("getOrderRefundDetail error:", error);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết đơn hoàn hàng" });
  }
};

module.exports = {
  createOrder,
  setPaidCash,
  printBill,
  vietqrReturn,
  vietqrCancel,
  getTopSellingProducts,
  getTopFrequentCustomers,
  exportTopSellingProducts,
  getOrderById,
  refundOrder,
  getListPaidOrders,
  getListRefundOrders,
  getOrderRefundDetail,
};
