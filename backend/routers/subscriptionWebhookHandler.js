// routers/subscriptionWebhookHandler.js
// routers/subscriptionWebhookHandler.js
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Notification = require("../models/Notification");
const PaymentHistory = require("../models/PaymentHistory");
const { computePayOSSignatureFromData } = require("../services/payOSService");

module.exports = async (req, res) => {
  try {
    console.log("🛰️ Subscription Webhook HIT:", new Date().toISOString());
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const parsed = req.body;

    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      console.error("❌ PAYOS_CHECKSUM_KEY missing");
      return res.status(200).json({ message: "Server config error" });
    }

    const tx = parsed.data || {};
    if (!Object.keys(tx).length) {
      console.error("❌ Missing data");
      return res.status(200).json({ message: "Invalid payload" });
    }

    // === Signature ===
    // const receivedSignature = (parsed.signature || tx.signature || req.headers["x-payos-signature"] || "").toUpperCase();
    const receivedSignature = (req.headers["x-payos-signature"] || parsed.signature || "").toUpperCase();

    const expectedSignature = computePayOSSignatureFromData(tx, checksumKey);

    console.log("🔑 Received signature:", receivedSignature);
    console.log("🔑 Expected signature:", expectedSignature);

    if (!receivedSignature || receivedSignature !== expectedSignature) {
      console.warn("❌ Invalid signature — ignoring");
      return res.status(200).json({ message: "Invalid signature" });
    }

    if (parsed.code !== "00") {
      console.warn("⚠️ PayOS non-success:", parsed.desc);
      return res.status(200).json({ message: "Ignored non-success" });
    }

    const orderCode = tx.orderCode?.toString();
    if (!orderCode) {
      console.error("❌ Thiếu orderCode");
      return res.status(200).json({ message: "Thiếu orderCode" });
    }

    const subscription = await Subscription.findOne({
      pending_order_code: orderCode,
    });

    if (!subscription) {
      console.warn("⚠️ Subscription not found, không tìm thấy Subscription:", orderCode);
      return res.status(200).json({ message: "Not found" });
    }

    const planDuration = subscription.pending_plan_duration || subscription.plan_duration || subscription.duration_months || 1;

    const amount = tx.amount || subscription.pending_amount || 0;
    const isRenewal = subscription.status === "ACTIVE" && !subscription.isExpired();

    if (isRenewal) {
      subscription.extendPremium(planDuration);
    } else {
      subscription.activatePremium(planDuration);
    }

    subscription.clearPendingPayment();
    await subscription.save();

    await User.findByIdAndUpdate(subscription.user_id, {
      is_premium: true,
    });

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
        notes: isRenewal ? `Gia hạn gói ${planDuration} tháng - PayOS` : `Kích hoạt gói ${planDuration} tháng - PayOS`,
      },
      { upsert: true }
    );

    const user = await User.findById(subscription.user_id).select("fullname username");
    const displayName = user?.fullname || user?.username || "Người dùng";
    const expiresAt = subscription.expires_at;
    const expiresText = expiresAt ? expiresAt.toLocaleDateString("vi-VN") : "không xác định";

    const message = `${displayName} đã kích hoạt gói Premium ${planDuration} tháng 🎉 (hết hạn ${expiresText})`;

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

    console.log(`🔔 Premium ${planDuration} tháng kích hoạt cho ${displayName}`);

    return res.status(200).json({ message: "Subscription activated" });
  } catch (err) {
    console.error("💥 Webhook error:", err);
    return res.status(200).json({ message: "Server error" });
  }
};

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
