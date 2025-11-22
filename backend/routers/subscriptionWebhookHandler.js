// routers/subscriptionWebhookHandler.js
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Notification = require("../models/Notification");
const PaymentHistory = require("../models/PaymentHistory");
const { computePayOSSignatureFromData } = require("../services/payOSService");

/**
 * Webhook handler cho thanh toán Subscription (PayOS)
 *
 * Flow:
 * 1. PayOS gọi webhook khi thanh toán thành công
 * 2. Verify signature HMAC-SHA256
 * 3. Parse orderCode format: "SUB_{userId}_{duration}_{timestamp}"
 * 4. Tìm subscription pending
 * 5. Activate premium cho user
 * 6. Emit socket notification
 */
module.exports = async (req, res) => {
  try {
    console.log("🛰️  Subscription Webhook HIT:", new Date().toISOString());
    console.log("Headers:", JSON.stringify(req.headers, null, 2));

    // Nếu middleware express.raw() được gắn cho route thì req.body là Buffer
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch (e) {
      console.error("Webhook payload không phải JSON:", e.message);
      return res.status(400).send("Bad payload");
    }

    console.log("Nhận subscription webhook (parsed):", JSON.stringify(parsed, null, 2));

    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      console.error("❌ PAYOS_CHECKSUM_KEY chưa được cấu hình");
      return res.status(500).json({ message: "Server config error" });
    }

    const tx = parsed.data || {};
    const receivedSignature = (
      req.headers["x-payos-signature"] ||
      parsed.signature ||
      tx.signature ||
      ""
    ).toUpperCase();

    if (!Object.keys(tx).length) {
      console.error("❌ Payload thiếu data để verify");
      return res.status(400).json({ message: "Invalid payload" });
    }

    const expectedSignature = computePayOSSignatureFromData(tx, checksumKey);

    if (!receivedSignature || receivedSignature !== expectedSignature) {
      console.error("❌ Signature không khớp", { expected: expectedSignature, received: receivedSignature });
      return res.status(400).json({ message: "Invalid signature" });
    }

    if (parsed.code !== "00") {
      console.warn("⚠️ PayOS báo lỗi:", parsed.desc);
      return res.status(200).json({ message: "Ignored non-success event" });
    }

    const orderCode = tx.orderCode ? tx.orderCode.toString() : null;
    if (!orderCode) {
      console.error("❌ orderCode missing trong webhook");
      return res.status(400).json({ message: "Missing orderCode" });
    }

    const subscription = await Subscription.findOne({ pending_order_code: orderCode });
    if (!subscription) {
      console.warn("⚠️ Không tìm thấy subscription khớp orderCode", orderCode);
      return res.status(200).json({ message: "Subscription not found" });
    }

    const planDuration =
      subscription.pending_plan_duration || subscription.plan_duration || subscription.duration_months || 1;
    const amount = tx.amount || subscription.pending_amount || 0;
    const isRenewal = subscription.status === "ACTIVE" && !subscription.isExpired();

    if (isRenewal) {
      subscription.extendPremium(planDuration);
    } else {
      subscription.activatePremium(planDuration);
    }

    subscription.clearPendingPayment();
    await subscription.save();

    await User.findByIdAndUpdate(subscription.user_id, { is_premium: true });

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
        notes: isRenewal
          ? `Gia hạn gói ${planDuration} tháng - PayOS`
          : `Kích hoạt gói ${planDuration} tháng - PayOS`,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const user = await User.findById(subscription.user_id).select("fullname username");
    const displayName = user?.fullname || user?.username || "Người dùng";
    const expiresAt = subscription.expires_at;
    const expiresText = expiresAt ? expiresAt.toLocaleDateString("vi-VN") : "không xác định";
    const message = `${displayName} đã kích hoạt gói Premium ${planDuration} tháng 🎉 (hết hạn vào ${expiresText})`;

    const io = req.app.get("io");
    if (io) {
      io.emit("subscription_activated", {
        userId: subscription.user_id.toString(),
        duration: planDuration,
        expiresAt,
        message,
      });
    }

    await Notification.create({
      storeId: null,
      userId: subscription.user_id,
      type: "service",
      title: "Kích hoạt gói dịch vụ",
      message,
    });

    console.log(
      `🔔 [SOCKET + DB] Premium ${planDuration} tháng kích hoạt cho user ${displayName} (${subscription.user_id})`
    );

    return res.status(200).json({ message: "Subscription activated" });
  } catch (err) {
    console.error("💥 Lỗi subscription webhook handler:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
