// routers/subscriptionWebhookHandler.js
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Store = require("../models/Store");
const Notification = require("../models/Notification");
const PaymentHistory = require("../models/PaymentHistory");
const { computePayOSSignatureFromData } = require("../services/payOSService");

module.exports = async (req, res) => {
  console.log("🛰️ Webhook nhận tín hiệu từ PayOS:", new Date().toISOString());

  let parsed;

  // ============================
  // 1) Parse JSON từ raw buffer
  // ============================
  try {
    if (Buffer.isBuffer(req.body)) {
      try {
        parsed = JSON.parse(req.body.toString());
      } catch (e) {
        console.error("❌ Không parse được JSON từ raw body");
        return res.status(200).json({ message: "Invalid raw JSON" });
      }
    } else {
      parsed = req.body;
    }
  } catch (err) {
    console.error("❌ Lỗi khi đọc body:", err);
    return res.status(200).json({ message: "Invalid body" });
  }

  console.log("📝 Payload đã parse:", parsed);

  // ============================
  // 2) Kiểm tra config
  // ============================
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!checksumKey) {
    console.error("❌ Thiếu PAYOS_CHECKSUM_KEY trong môi trường");
    return res.status(200).json({ message: "Server config error" });
  }

  const tx = parsed.data || {};
  if (!tx || !tx.orderCode) {
    console.error("❌ Thiếu orderCode trong payload");
    return res.status(200).json({ message: "Missing orderCode" });
  }

  const orderCode = tx.orderCode.toString();

  // ============================
  // 3) Verify chữ ký
  // ============================
  const receivedSignature = (req.headers["x-payos-signature"] || parsed.signature || "").toUpperCase();

  const expectedSignature = computePayOSSignatureFromData(tx, checksumKey);

  console.log("🔑 Chữ ký nhận:", receivedSignature);
  console.log("🔑 Chữ ký đúng :", expectedSignature);

  if (!receivedSignature || receivedSignature !== expectedSignature) {
    console.warn("❌ Sai chữ ký – từ chối xử lý webhook");
    return res.status(200).json({ message: "Invalid signature" });
  }

  if (parsed.code !== "00") {
    console.warn("⚠ PayOS báo trạng thái không thành công, bỏ qua");
    return res.status(200).json({ message: "Ignored non-success" });
  }

  // ============================
  // 4) Tìm subscription đang pending
  // ============================
  const subscription = await Subscription.findOne({
    pending_order_code: orderCode,
  });

  if (!subscription) {
    console.warn("⚠ Không tìm thấy subscription đang pending:", orderCode);
    return res.status(200).json({ message: "Not found" });
  }

  console.log("📌 Tìm thấy subscription:", subscription._id.toString());

  const planDuration = subscription.pending_plan_duration || subscription.duration_months || 1;

  const amount = tx.amount || subscription.pending_amount || 0;

  // ============================
  // 5) Xử lý nâng cấp hoặc gia hạn
  // ============================
  try {
    const isRenewal = subscription.status === "ACTIVE" && !subscription.isExpired();

    if (isRenewal) {
      console.log("🔄 Đây là giao dịch gia hạn premium");
      subscription.extendPremium(planDuration);
    } else {
      console.log("🎉 Đây là giao dịch kích hoạt premium mới");
      subscription.activatePremium(planDuration);
    }

    subscription.clearPendingPayment();
    await subscription.save();
  } catch (e) {
    console.error("❌ Lỗi update subscription:", e);
    return res.status(200).json({ message: "Update error" });
  }

  // ============================
  // 6) Update User.is_premium
  // ============================
  await User.findByIdAndUpdate(subscription.user_id, {
    is_premium: true,
  });

  // ============================
  // 7) Ghi log lịch sử thanh toán
  // ============================
  await PaymentHistory.findOneAndUpdate(
    { subscription_id: subscription._id, transaction_id: orderCode },
    {
      subscription_id: subscription._id,
      user_id: subscription.user_id,
      plan_duration: planDuration,
      amount,
      payment_method: "PAYOS",
      status: "SUCCESS",
      paid_at: new Date(),
      notes: `Thanh toán gói ${planDuration} tháng qua PayOS`,
    },
    { upsert: true }
  );

  // ============================
  // 8) Gửi thông báo (có try/catch riêng)
  // ============================
  try {
    const user = await User.findById(subscription.user_id).select("fullname username");
    const name = user?.fullname || user?.username || "Người dùng";

    // Lấy danh sách store mà user sở hữu, để báo toàn bộ store luôn vì mua Premium chỉ cần 1 lần báo All store
    const stores = await Store.find({ owner_id: subscription.user_id }).select("_id");

    console.log("🔔 Tạo thông báo dịch vụ cho user:", subscription.user_id);

    if (stores.length === 0) {
      console.warn("⚠ User không sở hữu store nào, bỏ qua tạo thông báo");
    } else {
      for (const store of stores) {
        await Notification.create({
          storeId: store._id,
          userId: subscription.user_id,
          type: "service",
          title: "Kích hoạt gói dịch vụ",
          message: `${name} đã kích hoạt thành công gói Premium ${planDuration} tháng!`,
        });
      }
    }
  } catch (error) {
    console.error("⚠ Lỗi tạo thông báo:", error);
  }

  console.log("✅ Hoàn tất xử lý webhook cho orderCode:", orderCode);

  return res.status(200).json({ message: "Subscription activated" });
};
