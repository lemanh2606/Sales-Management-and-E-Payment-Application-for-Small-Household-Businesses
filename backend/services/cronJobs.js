// services/cronJobs.js (cron job gửi email cảnh báo tồn kho thấp hàng ngày - require node-cron + emailService)
const cron = require("node-cron"); // Scheduler cron
const { transporter } = require("./emailService"); // Import transporter từ emailService (sẵn có Gmail config .env)
const User = require("../models/User"); // Require User cho MANAGER
const Product = require("../models/Product"); // Require Product cho low stock

// Cron chạy hàng ngày 8h sáng ('0 8 * * *')
cron.schedule("0 8 * * *", async () => {
  try {
    console.log("Bắt đầu cron cảnh báo tồn kho thấp");

    // Aggregation query low stock group by store_id, chỉ lấy store có low stock
    const lowStockByStore = await Product.aggregate([
      {
        $match: {
          // Match low stock
          $expr: { $lte: ["$stock_quantity", "$min_stock"] }, // So sánh field stock_quantity <= min_stock
          status: "Đang kinh doanh",
          min_stock: { $gt: 0 },
        },
      },
      {
        $group: {
          // Group by store_id, lấy list sản phẩm low
          _id: "$store_id",
          lowProducts: {
            $push: { name: "$name", sku: "$sku", stock_quantity: "$stock_quantity", min_stock: "$min_stock" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          // Join với Store để lấy name store
          from: "stores",
          localField: "_id",
          foreignField: "_id",
          as: "store",
        },
      },
      { $unwind: "$store" }, // Unwind store để flat
    ]); // LowStockByStore = [{ _id: storeId, lowProducts: [prod1, prod2], count: 2, store: {name: 'Huy test shop'} }]

    if (lowStockByStore.length === 0) {
      console.log("Không có sản phẩm tồn kho thấp để cảnh báo");
      return;
    }

    console.log(
      `Tìm thấy ${lowStockByStore.length} store có low stock:`,
      lowStockByStore.map((s) => `${s.store.name} (${s.count} sản phẩm)`)
    ); // Log chi tiết store low stock

    // Duyệt từng store low stock, gửi email cho manager owner store đó (gửi vô hạn, track alertCount ++)
    for (const storeLow of lowStockByStore) {
      const storeId = storeLow._id;
      const lowProducts = storeLow.lowProducts; // List sản phẩm low của store này

      // Query manager owner store (User.stores include storeId)
      const manager = await User.findOne({
        role: "MANAGER",
        stores: storeId, // Manager có store này trong array stores
      }).select("email"); // Chỉ lấy email

      if (!manager) {
        console.log(`Không có MANAGER owner store ${storeLow.store.name}, bỏ qua`);
        continue;
      }

      // Check alertCount của manager này (ko skip, chỉ track ++)
      const user = await User.findOne({ email: manager.email }); // Query user để alertCount

      // HTML email template (table list sản phẩm low của store này)
      let htmlTable = `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color: #d9534f; margin-bottom: 5px;">
      🔔 Cảnh báo tồn kho thấp
    </h2>
    <h3 style="margin-top: 0; color: #555;">
      Cửa hàng: <strong>${storeLow.store.name}</strong>
    </h3>
    <p>Hiện đang có <strong>${lowProducts.length}</strong> sản phẩm dưới mức tồn kho tối thiểu:</p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
      <thead>
        <tr>
          <th style="background: #f5f5f5; border: 1px solid #ddd; padding: 8px; text-align: left;">Tên sản phẩm</th>
          <th style="background: #f5f5f5; border: 1px solid #ddd; padding: 8px; text-align: left;">SKU</th>
          <th style="background: #f8d7da; border: 1px solid #ddd; padding: 8px; text-align: center;">Tồn kho</th>
          <th style="background: #fff3cd; border: 1px solid #ddd; padding: 8px; text-align: center;">Min Stock</th>
        </tr>
      </thead>
      <tbody>
`;

      lowProducts.forEach((prod) => {
        htmlTable += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${prod.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${prod.sku}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #d9534f; text-align: center;">
            <strong>${prod.stock_quantity}</strong>
          </td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
            ${prod.min_stock}
          </td>
        </tr>
  `;
      });

      htmlTable += `
      </tbody>
    </table>

    <p style="margin-top: 20px; font-size: 12px; color: #777;">
      <em>Email này được gửi tự động từ hệ thống SmartRetail. Vui lòng không trả lời email này.</em>
    </p>
  </div>
`;

      const mailOptions = {
        from: process.env.EMAIL_USER, // Email sender
        to: manager.email, // Email nhận
        subject: "Cảnh báo tồn kho thấp - SmartRetail", // Tiêu đề
        html: htmlTable, // Nội dung HTML table
      };

      await transporter.sendMail(mailOptions); // Gửi email
      console.log(`Gửi email cảnh báo thành công cho ${manager.email} (store ${storeLow.store.name})`);

      // Update alertCount +1 (track tổng số cảnh báo, ko skip)
      user.alertCount += 1;
      await user.save();
    }
  } catch (err) {
    console.error("Lỗi cron cảnh báo tồn kho:", err.message);
  }
});

console.log("Cron cảnh báo tồn kho thấp đã khởi động (8h sáng hàng ngày)");
