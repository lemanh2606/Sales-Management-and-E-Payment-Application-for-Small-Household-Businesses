// services/cronJobs.js (cron job gửi email cảnh báo tồn kho thấp hàng ngày - require node-cron + emailService)
const cron = require("node-cron"); // Scheduler cron
const { transporter } = require("./emailService"); // Import transporter từ emailService (sẵn có Gmail config .env)
const User = require("../models/User"); // Require User cho MANAGER
const Product = require("../models/Product"); // Require Product cho low stock
const ActivityLog = require("../models/ActivityLog"); // require activityLog để xoá log cũ > 6 tháng
const Notification = require("../models/Notification"); // Thêm Notification model để tạo thông báo trong app
const Store = require("../models/Store");

// 1. Cảnh báo tồn kho: mỗi ngày lúc 8h sáng
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

console.log("✅ Cron cảnh báo tồn kho thấp đã khởi động (8h sáng hàng ngày)");

// 2. Xóa log cũ: mỗi ngày lúc 2h sáng, xoá những log đã hơn 6 tháng - (khung giờ ít truy cập)
cron.schedule("0 2 * * *", async () => {
  console.log("Bắt đầu dọn dẹp ActivityLog cũ (> 6 tháng)...");

  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: sixMonthsAgo },
    });

    if (result.deletedCount > 0) {
      console.log(`Đã xóa ${result.deletedCount} bản ghi log cũ (trước ${sixMonthsAgo.toLocaleDateString()})`);
    } else {
      console.log("Không có log nào cần xóa.");
    }
  } catch (error) {
    console.error("Lỗi xóa log cũ:", error.message);
  }
});

console.log("✅ Cron job xóa ActivityLog cũ đã được khởi động (2h sáng hàng ngày)!");

// 3. Check subscription expired: mỗi ngày lúc 3h sáng
const Subscription = require("../models/Subscription");

cron.schedule("0 3 * * *", async () => {
  try {
    console.log("Bắt đầu cron check subscription expired");

    const now = new Date();

    // Tìm subscription TRIAL hết hạn
    const expiredTrials = await Subscription.find({
      status: "TRIAL",
      trial_ends_at: { $lt: now },
    });

    for (const sub of expiredTrials) {
      sub.status = "EXPIRED";
      await sub.save();

      // Update User is_premium flag
      const user = await User.findById(sub.user_id);
      if (user) {
        user.is_premium = false;
        await user.save();
        console.log(` Trial expired for user ${user.username}`);
      }
    }

    // Tìm subscription ACTIVE hết hạn
    const expiredPremiums = await Subscription.find({
      status: "ACTIVE",
      expires_at: { $lt: now },
    });

    for (const sub of expiredPremiums) {
      sub.status = "EXPIRED";
      await sub.save();

      // Update User is_premium flag
      const user = await User.findById(sub.user_id);
      if (user) {
        user.is_premium = false;
        await user.save();
        console.log(` Premium expired for user ${user.username}`);
      }
    }

    console.log(
      `✅ Subscription check completed: ${expiredTrials.length} trials, ${expiredPremiums.length} premiums expired`
    );
  } catch (err) {
    console.error("Lỗi cron check subscription:", err.message);
  }
});

console.log("✅ Cron job check subscription expired đã khởi động (3h sáng hàng ngày)!");

// 4. Kiểm tra hàng sắp hết hạn & Tồn kho thấp (Tạo Notification trong App): mỗi ngày lúc 8h30 sáng
cron.schedule("30 8 * * *", async () => {
  try {
    console.log("Bắt đầu cron quét hàng hết hạn & tồn kho thấp để tạo thông báo hệ thống");
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // BƯỚC 1: QUÉT HÀNG SẮP HẾT HẠN
    const productsWithExpiringBatches = await Product.find({
      "batches.expiry_date": { $lte: thirtyDaysFromNow, $gt: now },
      status: "Đang kinh doanh",
      isDeleted: false
    });

    for (const p of productsWithExpiringBatches) {
      try {
        const expiringBatches = p.batches.filter(b => b.expiry_date && new Date(b.expiry_date) <= thirtyDaysFromNow && new Date(b.expiry_date) > now && b.quantity > 0);
        if (expiringBatches.length > 0) {
          // Lấy manager/owner của cửa hàng
          const manager = await User.findOne({ 
            stores: p.store_id,
            role: "MANAGER",
            isDeleted: false 
          });

          if (manager) {
            const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
            const alreadyNotified = await Notification.findOne({
              storeId: p.store_id,
              userId: manager._id,
              title: "Cảnh báo hàng sắp hết hạn",
              message: { $regex: p.name, $options: "i" },
              createdAt: { $gte: startOfDay }
            });

            if (!alreadyNotified) {
              await Notification.create({
                storeId: p.store_id,
                userId: manager._id,
                type: "inventory",
                title: "Cảnh báo hàng sắp hết hạn",
                message: `Sản phẩm "${p.name}" (${p.sku}) có ${expiringBatches.length} lô sắp hết hạn trong 30 ngày tới. Vui lòng kiểm tra kho!`
              });
            }
          }
        }
      } catch (prodErr) {
        console.error(` Lỗi xử lý thông báo sắp hết hạn cho SP ${p._id}:`, prodErr.message);
      }
    }

    // BƯỚC 2: QUÉT HÀNG ĐÃ HẾT HẠN
    const productsWithExpiredBatches = await Product.find({
      "batches.expiry_date": { $lte: now },
      status: "Đang kinh doanh",
      isDeleted: false
    });

    for (const p of productsWithExpiredBatches) {
      try {
        const expiredCount = p.batches.filter(b => b.expiry_date && new Date(b.expiry_date) <= now && b.quantity > 0).length;
        if (expiredCount > 0) {
          const manager = await User.findOne({ 
            stores: p.store_id, 
            role: "MANAGER",
            isDeleted: false
          });

          if (manager) {
            const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
            const alreadyNotified = await Notification.findOne({
              storeId: p.store_id,
              userId: manager._id,
              title: "Cảnh báo hàng HẾT HẠN",
              message: { $regex: p.name, $options: "i" },
              createdAt: { $gte: startOfDay }
            });

            if (!alreadyNotified) {
              await Notification.create({
                storeId: p.store_id,
                userId: manager._id,
                type: "inventory",
                title: "Cảnh báo hàng HẾT HẠN",
                message: `CẢNH BÁO: Sản phẩm "${p.name}" có ${expiredCount} lô ĐÃ HẾT HẠN sử dụng. Vui lòng kiểm tra và xử lý hủy hàng!`
              });
            }
          }
        }
      } catch (prodErr) {
        console.error(` Lỗi xử lý thông báo đã hết hạn cho SP ${p._id}:`, prodErr.message);
      }
    }

    console.log("✅ Hoàn thành cron tạo thông báo hệ thống");
  } catch (err) {
    console.error(" Lỗi cron thông báo hết hạn:", err.message);
  }
});

console.log("✅ Cron job thông báo hàng hết hạn đã khởi động (8h30 sáng hàng ngày)!");
