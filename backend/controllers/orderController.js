// controllers/orderController.js (update: create pending luôn, ko trừ stock; add confirmQR + printBill để trừ khi in)
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const OrderRefund = require("../models/OrderRefund");
const Product = require("../models/Product");
const Employee = require("../models/Employee");
const Store = require("../models/Store");
const { generateQRWithPayOS } = require("../services/payOSService");
const { v2: cloudinary } = require("cloudinary");

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
            orderInfo: `Thanh toan hoa don ${newOrder._id}`, // Không dấu theo lưu ý cậu
          },
        });
        console.log("Sử dụng PayOS QR thành công");
        paymentRef = qrData.txnRef; // Ref từ PayOS cho webhook
        newOrder.paymentRef = paymentRef;
        newOrder.qrExpiry = new Date(Date.now() + 15 * 60 * 1000); // Hết hạn 15 phút

        await newOrder.save({ session });

        console.log(`Tạo QR pending thành công cho hóa đơn ${newOrder._id}, ref: ${paymentRef}, chờ webhook confirm`);
      } else {
        // Cash: Pending, chờ in bill để paid + trừ stock (ko làm gì ở đây)
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
            console.log(`In bill thành công cho ${prod.name}: Stock -${item.quantity}`);
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
    const order = await Order.findById(orderId).populate("storeId", "name").populate("employeeId", "fullName").lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn hoặc Hóa đơn không tồn tại" });
    }

    const items = await OrderItem.find({ orderId: order._id }).populate("productId", "name sku price").lean();

    const enrichedOrder = {
      ...order,
      items: items.map((item) => ({
        ...item,
        productName: item.productId?.name || "N/A",
        productSku: item.productId?.sku || "N/A",
      })),
    };
    res.json({ message: "Lấy hóa đơn thành công", order: enrichedOrder });
  } catch (err) {
    console.error("Lỗi lấy hóa đơn:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// fix refundOrder: query OrderItem để lấy items, loop cộng stock, populate product name cho log
const refundOrder = async (req, res) => {
  try {
    const { orderId: mongoId } = req.params; // Lấy _id từ params
    const { employeeId, refundReason } = req.body; // Body: employeeId + lý do hoàn

    // Kiểm tra nhân viên
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(400).json({ message: "Nhân viên không tồn tại" });

    // Kiểm tra đơn hàng
    const order = await Order.findById(mongoId).populate("employeeId", "fullName");
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    if (order.status !== "paid") return res.status(400).json({ message: "Chỉ hoàn đơn đã thanh toán" });

    const files = req.files || []; // Files từ middleware upload.array("files", 5)
    const evidenceMedia = []; // Mảng media upload Cloudinary

    // Upload lần lượt từng file lên Cloudinary (dùng Promise để đợi xong)
    for (const file of files) {
      const resourceType = file.mimetype.startsWith("video") ? "video" : "image"; // Xác định type image/video

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
    const items = await OrderItem.find({ orderId: mongoId }).populate("productId", "name"); // Query OrderItem + populate product name cho log
    const session = await mongoose.startSession(); // Session atomic cộng stock
    session.startTransaction();
    try {
      for (const item of items) {
        // Loop items từ OrderItem
        const prod = await Product.findById(item.productId._id).session(session); // Ref productId sau populate
        if (prod) {
          prod.stock_quantity += item.quantity; // Cộng stock lại (inc positive)
          await prod.save({ session });
          console.log(`Cộng stock hoàn hàng thành công cho ${prod.name}: +${item.quantity}`);
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
          matchDate = { $gte: new Date(now.setHours(0, 0, 0, 0)), $lte: new Date(now.setHours(23, 59, 59, 999)) };
          break;
        case "yesterday":
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          matchDate = {
            $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
            $lte: new Date(yesterday.setHours(23, 59, 59, 999)),
          };
          break;
        case "thisWeek":
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          matchDate = { $gte: new Date(weekStart.setHours(0, 0, 0, 0)) };
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
    //chỉ khi có lọc ngày mới ép vào $match, còn không thì khỏi nhét – tránh crash query
    const match = { "order.status": "paid" };
    if (Object.keys(matchDate).length > 0) {
      match["order.createdAt"] = matchDate;
    }

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
    res.json({ message: `Top selling products thành công, limit ${limit}, kết quả: ${topProducts.length} sản phẩm`, data: topProducts });
  } catch (err) {
    console.error("Lỗi top selling products:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy top sản phẩm bán chạy" });
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
};
