// controllers/orderController.js (update: create pending luôn, ko trừ stock; add confirmQR + printBill để trừ khi in)
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Product = require("../models/Product");
const Store = require("../models/Store");
const { generateQRWithPayOS } = require("../services/payOSService");

const createOrder = async (req, res) => {
  try {
    const { storeId, employeeId, customerInfo, items, paymentMethod } = req.body; // Body từ FE: items [{productId, quantity}]

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
          throw new Error(`Sản phẩm ${prod?.name || "không tồn tại"} hết hàng hoặc không hợp lệ`);
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

      // Tạo Order pending (status default pending)
      const newOrder = new Order({
        storeId,
        employeeId,
        customerInfo,
        totalAmount: total.toFixed(2).toString(),
        paymentMethod,
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
      // Nếu chọn QR thì tạo QR PayOS (pending, chờ webhook confirm)
      if (paymentMethod === "qr") {
        qrData = await generateQRWithPayOS({ 
          body: { 
            amount: total,
            orderInfo: `Thanh toan hoa don ${newOrder._id}`  // Không dấu theo lưu ý cậu
          } 
        });
        console.log("Sử dụng PayOS QR thành công");
        paymentRef = qrData.txnRef;  // Ref từ PayOS cho webhook
        newOrder.paymentRef = paymentRef;
        newOrder.qrExpiry = new Date(Date.now() + 15 * 60 * 1000);  // Hết hạn 15 phút
        await newOrder.save({ session });
        console.log(`Tạo QR pending thành công cho hóa đơn ${newOrder._id}, ref: ${paymentRef}, chờ webhook confirm`);
      } else {
        // Cash: Pending, chờ in bill để paid + trừ stock (ko làm gì ở đây)
        console.log(`Tạo hóa đơn cash pending thành công cho ${newOrder._id}, chờ in bill`);
      }

      await session.commitTransaction();  // Commit tất cả
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
          message: 'Tạo hóa đơn thành công (pending)', 
          order: orderedOrder,
          qrRef: paymentRef,  // Ref để webhook
          qrDataURL: qrData ? qrData.qrDataURL : null,  // QR base64 FE render
          paymentLinkUrl: qrData ? qrData.paymentLinkUrl : null,  // Link quẹt nếu PayOS
          qrExpiry: paymentMethod === 'qr' ? newOrder.qrExpiry : null  // Expiry FE countdown
        });
      } catch (format_err) {
        console.log("Lỗi format response order:", format_err.message);  // Log tiếng Việt format error
        res.status(500).json({ message: "Lỗi format response: " + format_err.message });  // Return local ko abort
      }
    } catch (inner_err) {
      await session.abortTransaction();  // Abort chỉ inner error (validate/save)
      session.endSession();
      console.error("Lỗi inner createOrder:", inner_err.message);  // Log tiếng Việt inner error
      res.status(500).json({ message: "Lỗi tạo hóa đơn nội bộ: " + inner_err.message });
    }
  } catch (err) {
    console.error("Lỗi tạo hóa đơn:", err.message);  // Log tiếng Việt outer error
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
    console.log(`Set paid cash thành công cho hóa đơn ${mongoId}, sẵn sàng in bill`);
    res.json({ message: "Xác nhận thanh toán cash thành công, sẵn sàng in hóa đơn" });
  } catch (err) {
    console.error("Lỗi set paid cash:", err.message);
    res.status(500).json({ message: "Lỗi server set paid cash" });
  }
};

// POST /api/orders/:orderId/print-bill - In hóa đơn (check paid → trừ stock + generate text bill chi tiết với populate)
const printBill = async (req, res) => {
  try {
    const { orderId: mongoId } = req.params; // Dùng _id tự sinh của MongoDb
    // Populate full order trước: store name, employee fullName
    const order = await Order.findById(mongoId)
      .populate("storeId", "name") // Populate tên cửa hàng
      .populate("employeeId", "fullName") // Tên nhân viên
      .lean();

    if (!order || order.status !== "paid") {
      console.log("Hóa đơn chưa paid, không thể in bill:", mongoId);
      return res.status(400).json({ message: "Hóa đơn chưa thanh toán, không thể in" });
    }

    // 👈 Fix: Di chuyển items ra ngoài session, populate cho bill (read only, ko cần session)
    const items = await OrderItem.find({ orderId: order._id })
      .populate("productId", "name sku") // Populate tên/sku sản phẩm cho bill
      .lean(); // Lean cho nhanh, ko session

    let isFirstPrint = order.printCount === 0; // 👈 Check lần in đầu (printCount default 0)
    const isDuplicate = !isFirstPrint; // Nếu >0 thì duplicate

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
    } else {
      console.log(`In hóa đơn BẢN SAO lần ${order.printCount + 1}, không trừ stock cho ${mongoId}`);
    }

    // Generate text bill chi tiết (với tên prod từ populate items, thêm note duplicate nếu có)
    let bill = `=== HÓA ĐƠN BÁN HÀNG ===\n`;
    bill += `ID Hóa đơn: ${order._id}\n`;
    bill += `Cửa hàng: ${order.storeId?.name || "Cửa hàng mặc định"}\n`;
    bill += `Nhân viên: ${order.employeeId?.fullName || "N/A"}\n`;
    bill += `Khách hàng: ${order.customerInfo?.name || "N/A"} - ${order.customerInfo?.phone || ""}\n`;
    bill += `Ngày: ${new Date(order.createdAt).toLocaleString("vi-VN")}\n`;
    bill += `Ngày in: ${new Date().toLocaleString("vi-VN")}\n`;
    if (isDuplicate) bill += `(Bản sao hóa đơn - lần in ${order.printCount + 1})\n`; // 👈 Note duplicate
    bill += `\nCHI TIẾT SẢN PHẨM:\n`;
    items.forEach((item) => {
      bill += `- ${item.productId?.name || "Sản phẩm"} (${item.productId?.sku || "N/A"}): ${item.quantity} x ${
        item.priceAtTime
      } = ${item.subtotal} VND\n`;
    });
    bill += `\nTỔNG TIỀN: ${order.totalAmount.toString()} VND\n`; // toString() cho Decimal128 clean
    bill += `Phương thức: ${order.paymentMethod === "cash" ? "TIỀN MẶT" : "QR CODE"}\n`; // Rõ ràng hơn cho bill
    bill += `Trạng thái: Đã thanh toán\n`;
    bill += `=== CẢM ƠN QUÝ KHÁCH! ===\n`;

    // Update printDate/printCount (luôn update, dù duplicate)
    const updatedOrder = await Order.findByIdAndUpdate(
      mongoId,
      {
        printDate: new Date(),
        $inc: { printCount: 1 },
      },
      { new: true } // ⭐️ Lấy bản mới nhất
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

module.exports = { createOrder, printBill, setPaidCash };
