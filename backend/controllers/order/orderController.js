// controllers/orderController.js
const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const { Types } = require("mongoose");
const PDFDocument = require("pdfkit");
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
    const {
      storeId,
      employeeId,
      customerInfo,
      items,
      paymentMethod,
      isVATInvoice,
      vatInfo,
      usedPoints,
    } = req.body; // Thêm usedPoints optional cho giảm giá

    if (!items || items.length === 0) {
      console.log("Lỗi: Không có sản phẩm trong hóa đơn");
      return res
        .status(400)
        .json({ message: "Hóa đơn phải có ít nhất 1 sản phẩm" });
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
          throw new Error(
            `Sản phẩm ${
              prod?.name || "không tồn tại"
            } hết hàng hoặc không tồn tại trong cửa hàng`
          );
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
        throw new Error("Thiếu thông tin khách hàng (phone bắt buộc)");
      }

      // Lấy loyalty config store (cho discount usedPoints)
      const loyalty = await LoyaltySetting.findOne({ storeId }).session(
        session
      );
      let discount = 0;
      if (usedPoints && loyalty && loyalty.isActive) {
        // Áp dụng giảm giá nếu active, usedPoints <= loyaltyPoints customer
        const maxUsed = Math.min(usedPoints, customer.loyaltyPoints || 0);
        discount = maxUsed * loyalty.vndPerPoint;
        if (discount > 0) {
          customer.loyaltyPoints -= maxUsed; // Trừ điểm dùng
          await customer.save({ session });
          total -= discount; // Subtract discount từ total
          console.log(
            `Giảm giá ${discount} từ ${maxUsed} điểm cho khách ${customer.phone}`
          );
        }
      }

      // Tạo Order pending (status default pending)
      const newOrder = new Order({
        storeId,
        employeeId,
        customer: customer._id, // Ref customer thay customerInfo
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
        console.log(
          `Tạo QR pending thành công cho hóa đơn ${newOrder._id}, ref: ${paymentRef}, chờ webhook confirm`
        );
      } else {
        // Cash: Pending, chờ in bill để paid + trừ stock
        console.log(
          `Tạo hóa đơn cash pending thành công cho ${newOrder._id}, chờ in bill`
        );
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
        res
          .status(500)
          .json({ message: "Lỗi format response: " + format_err.message }); // Return local ko abort
      }
    } catch (inner_err) {
      await session.abortTransaction(); // Abort chỉ inner error (validate/save)
      session.endSession();
      console.error("Lỗi inner createOrder:", inner_err.message); // Log tiếng Việt inner error
      res
        .status(500)
        .json({ message: "Lỗi tạo hóa đơn nội bộ: " + inner_err.message });
    }
  } catch (err) {
    console.error("Lỗi tạo hóa đơn:", err.message); // Log tiếng Việt outer error
    res
      .status(500)
      .json({ message: "Lỗi server khi tạo hóa đơn: " + err.message });
  }
};

// Bonus: POST /api/orders/:orderId/set-paid-cash - Cho cash: Staff confirm giao dịch tay → set paid (trước print)
const setPaidCash = async (req, res) => {
  try {
    const { orderId: mongoId } = req.params;
    const order = await Order.findById(mongoId);
    if (
      !order ||
      order.paymentMethod !== "cash" ||
      order.status !== "pending"
    ) {
      return res
        .status(400)
        .json({ message: "Hóa đơn cash không hợp lệ cho set paid" });
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
    console.log(
      `Set paid cash thành công cho hóa đơn ${mongoId}, sẵn sàng in bill`
    );
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
      return res
        .status(400)
        .json({ message: "Hóa đơn chưa thanh toán, không thể in" });
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
    if (
      isFirstPrint &&
      loyalty &&
      loyalty.isActive &&
      order.totalAmount >= loyalty.minOrderValue
    ) {
      earnedPoints = parseFloat(order.totalAmount) * loyalty.pointsPerVND; // Tích điểm = total * tỉ lệ
      // Cộng điểm vào customer (atomic session)
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const customer = await Customer.findById(order.customer).session(
          session
        );
        if (customer) {
          // 🔢 Chuyển đổi và cộng dồn tổng chi tiêu (Decimal128 → float)
          const prevSpent = parseFloat(customer.totalSpent?.toString() || 0);
          const currentSpent = parseFloat(order.totalAmount?.toString() || 0);
          const newSpent = prevSpent + currentSpent;

          // 🎯 Làm tròn điểm thưởng (chỉ lấy số nguyên, bỏ lẻ)
          const roundedEarnedPoints = Math.floor(earnedPoints);

          // 💾 Cập nhật dữ liệu khách hàng
          customer.loyaltyPoints =
            (customer.loyaltyPoints || 0) + roundedEarnedPoints; // 🎁 Cộng điểm mới (làm tròn)
          customer.totalSpent = mongoose.Types.Decimal128.fromString(
            newSpent.toFixed(2)
          ); // 💰 Cập nhật tổng chi tiêu chính xác 2 số lẻ
          customer.totalOrders = (customer.totalOrders || 0) + 1; // 🛒 +1 đơn hàng

          await customer.save({ session });

          console.log(
            `[LOYALTY] +${roundedEarnedPoints} điểm cho khách ${
              customer.phone
            } | Tổng điểm: ${
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
      console.log(
        `In hóa đơn duplicate lần ${
          order.printCount + 1
        }, không trừ stock/cộng điểm cho ${mongoId}`
      );
    }

    // Trừ stock chỉ lần đầu (atomic session)
    if (isFirstPrint) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        for (let item of items) {
          // Dùng items từ ngoài, chỉ trừ stock
          const prod = await Product.findById(item.productId._id).session(
            session
          ); // Ref _id sau populate
          if (prod) {
            prod.stock_quantity -= item.quantity; // Trừ stock thật
            await prod.save({ session });
            console.log(
              `Trừ stock khi in bill thành công cho ${prod.name}: -${item.quantity}`
            );
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
    bill += `Khách hàng: ${order.customer?.name || "N/A"} - ${
      order.customer?.phone || ""
    }\n`; // Populate từ customer ref
    bill += `Ngày: ${new Date(order.createdAt).toLocaleString("vi-VN")}\n`;
    bill += `Ngày in: ${new Date().toLocaleString("vi-VN")}\n`;
    if (isDuplicate)
      bill += `(Bản sao hóa đơn - lần in ${order.printCount + 1})\n`; // Note duplicate
    bill += `\nCHI TIẾT SẢN PHẨM:\n`;
    items.forEach((item) => {
      bill += `- ${item.productId?.name || "Sản phẩm"} (${
        item.productId?.sku || "N/A"
      }): ${item.quantity} x ${item.priceAtTime} = ${item.subtotal} VND\n`;
    });
    bill += `\nTỔNG TIỀN: ${order.totalAmount.toString()} VND\n`; // toString() cho Decimal128 clean
    bill += `Phương thức: ${
      order.paymentMethod === "cash" ? "TIỀN MẶT" : "QR CODE"
    }\n`; // Rõ ràng hơn cho bill
    if (earnedPoints > 0)
      bill += `Điểm tích lũy lần này: ${earnedPoints.toFixed(0)} điểm\n`; // Thêm điểm tích nếu có
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

    const logMsg = isDuplicate
      ? "In hóa đơn BẢN SAO thành công"
      : "In hóa đơn thành công, đã trừ stock";
    console.log(
      `${logMsg} cho ${order._id}, Số lần in hiện tại: ${updatedOrder.printCount}`
    );
    res.json({
      message: `${logMsg}, printCount: ${updatedOrder.printCount}`,
      bill: bill,
      orderId: order._id,
    });
  } catch (err) {
    console.error("Lỗi in hóa đơn:", err.message);
    res
      .status(500)
      .json({ message: "Lỗi server khi in hóa đơn: " + err.message });
  }
};

const vietqrReturn = (req, res) => {
  console.log("✅ Người dùng quay lại sau khi thanh toán thành công");
  return res.status(200).json({
    message: "Thanh toán thành công! Cảm ơn bạn đã mua hàng.",
    query: req.query, // PayOS có thể gửi kèm orderCode, amount,...
  });
};

const vietqrCancel = (req, res) => {
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
    const { orderId: mongoId } = req.params; // Lấy _id từ params
    const { employeeId, refundReason } = req.body; // Body: employeeId + lý do hoàn

    // Kiểm tra nhân viên
    const employee = await Employee.findById(employeeId);
    if (!employee)
      return res.status(400).json({ message: "Nhân viên không tồn tại" });

    // Kiểm tra đơn hàng
    const order = await Order.findById(mongoId).populate(
      "employeeId",
      "fullName"
    );
    if (!order)
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    if (order.status !== "paid")
      return res.status(400).json({ message: "Chỉ hoàn đơn đã thanh toán" });

    const files = req.files || []; // Files từ middleware upload.array("files", 5)
    const evidenceMedia = []; // Mảng media upload Cloudinary

    // Upload lần lượt từng file lên Cloudinary (dùng Promise để đợi xong)
    for (const file of files) {
      const resourceType = file.mimetype.startsWith("video")
        ? "video"
        : "image"; // Xác định type image/video

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `refunds/${mongoId}`, // Folder Cloudinary theo orderId
            resource_type: resourceType, // Type image/video
          },
          (err, result) => {
            if (err) reject(err); // Reject nếu upload fail
            else resolve(result); // Resolve result {secure_url, public_id}
          }
        );
        uploadStream.end(file.buffer); // Kết thúc stream với buffer file
      });

      evidenceMedia.push({
        url: result.secure_url, // URL an toàn HTTPS
        public_id: result.public_id, // ID Cloudinary để xóa sau nếu cần
        type: resourceType, // Type image/video
      });
    }

    // Tạo bản ghi refund
    const refund = await OrderRefund.create({
      orderId: mongoId,
      refundedBy: employeeId, // Ref employee hoàn hàng
      refundedAt: new Date(), // Thời gian hoàn
      refundTransactionId: null, // Tx ref nếu có (sau thêm)
      refundReason, // Lý do hoàn từ body
      evidenceMedia, // Mảng media upload
    });

    // Cập nhật đơn hàng
    order.status = "refunded"; // Update status hoàn
    order.refundId = refund._id; // Ref refund record
    await order.save(); // Save DB

    // Cộng lại stock từ OrderItem (query items thay vì order.items undefined)
    const items = await OrderItem.find({ orderId: mongoId }).populate(
      "productId",
      "name"
    ); // Query OrderItem + populate product name cho log
    const session = await mongoose.startSession(); // Session atomic cộng stock
    session.startTransaction();
    try {
      for (const item of items) {
        // Loop items từ OrderItem
        const prod = await Product.findById(item.productId._id).session(
          session
        ); // Ref productId sau populate
        if (prod) {
          prod.stock_quantity += item.quantity; // Cộng stock lại (inc positive)
          await prod.save({ session });
          console.log(
            `Cộng stock hoàn hàng thành công cho ${prod.name}: +${item.quantity}`
          );
        }
      }
      await session.commitTransaction(); // Commit atomic
      session.endSession();
    } catch (stock_err) {
      await session.abortTransaction(); // Rollback nếu cộng stock fail
      session.endSession();
      console.error("Lỗi cộng stock hoàn hàng:", stock_err.message);
      throw new Error("Lỗi cộng stock: " + stock_err.message);
    }

    res.status(200).json({
      message: "Hoàn hàng thành công (nội bộ)",
      refund, // Refund record
      order, // Order updated
    });
  } catch (err) {
    console.error("Lỗi refund:", err.message);
    res.status(500).json({ message: "Lỗi khi hoàn hàng", error: err.message });
  }
};

// GET /api/orders/top-products - Top sản phẩm bán chạy (sum quantity/sales từ OrderItem, filter paid + range/date/store)
const getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10, storeId, range, dateFrom, dateTo } = req.query; // Params: limit, storeId, range quick/custom date
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
    res
      .status(500)
      .json({ message: "Lỗi server khi lấy top sản phẩm bán chạy" });
  }
};

//api/orders/top-customers?limit=5&range=thisMonth&storeId=68e81dbffae46c6d9fe2e895
const getTopFrequentCustomers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Aggregate top khách hàng theo tổng tiền và số đơn (group by customer ref)
    const topCustomers = await Order.aggregate([
      { $match: { status: "paid" } }, // Chỉ order đã thanh toán
      {
        $group: {
          _id: "$customer", // Group by customer ref thay customerInfo.phone
          totalAmount: { $sum: "$totalAmount" }, // Tổng tiền (Decimal128 sum)
          orderCount: { $sum: 1 }, // Số đơn hàng
          latestOrder: { $max: "$createdAt" }, // Order mới nhất
        },
      },
      { $sort: { totalAmount: -1 } }, // Sắp xếp theo tổng tiền giảm dần
      { $limit: parseInt(limit) }, // Limit số lượng
      {
        $lookup: {
          // Populate customer info từ ref
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" }, // Unwind array customer
      { $match: { "customer.isDeleted": { $ne: true } } }, // Lọc customer active
      {
        $project: {
          // Project fields cần
          customerName: "$customer.name",
          customerPhone: "$customer.phone",
          totalAmount: 1,
          orderCount: 1,
          latestOrder: 1,
        },
      },
    ]);

    console.log("Lấy top khách hàng thành công, limit:", limit);
    res.json({ message: "Top khách hàng thường xuyên", data: topCustomers });
  } catch (err) {
    console.error("Lỗi top khách hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy top khách hàng" });
  }
};

// GET /api/orders/top-products/export - Export top sản phẩm bán chạy ra CSV hoặc PDF (params giống getTopSellingProducts + format='csv' or 'pdf')
const exportTopSellingProducts = async (req, res) => {
  try {
    const {
      limit = 10,
      storeId,
      range,
      dateFrom,
      dateTo,
      format = "csv",
    } = req.query;
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
      const fields = [
        "productName",
        "productSku",
        "totalQuantity",
        "totalSales",
        "countOrders",
      ]; // Fields CSV
      const csv = new Parser({ fields }).parse(topProducts); // Parse data sang CSV
      res.header("Content-Type", "text/csv"); // Set header CSV
      res.attachment("top-selling-products.csv"); // Tên file download
      res.send(csv); // Gửi CSV string
    } else if (format === "pdf") {
      // Generate PDF với pdfkit (table top products)
      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=top-selling-products.pdf"
      );
      doc.pipe(res); // Pipe PDF stream vào response

      // Header PDF
      doc
        .fontSize(20)
        .text("Báo cáo Top Sản phẩm Bán chạy", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Thời gian: ${new Date().toLocaleDateString("vi-VN")}`);
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
    res
      .status(500)
      .json({ message: "Lỗi server khi lấy top sản phẩm bán chạy" });
  }
};

module.exports = {
  createOrder,
  setPaidCash,
  printBill,
  vietqrReturn,
  vietqrCancel,
  getOrderById,
  refundOrder,
  getTopSellingProducts,
  getTopFrequentCustomers,
  exportTopSellingProducts,
};
