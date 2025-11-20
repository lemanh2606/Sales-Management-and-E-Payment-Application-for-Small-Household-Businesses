// routers/subscriptionWebhookHandler.js
const crypto = require("crypto");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Notification = require("../models/Notification");

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

    // Verify signature
    const receivedSignature = req.headers["x-payos-signature"];
    if (!receivedSignature) {
      console.error("❌ Thiếu x-payos-signature header");
      return res.status(400).json({ message: "Missing signature" });
    }

    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      console.error("❌ PAYOS_CHECKSUM_KEY chưa được cấu hình");
      return res.status(500).json({ message: "Server config error" });
    }

    // Tính signature: HMAC-SHA256(rawBody, checksumKey)
    const expectedSignature = crypto.createHmac("sha256", checksumKey).update(rawBody).digest("hex");

    if (receivedSignature !== expectedSignature) {
      console.error("❌ Signature không khớp");
      console.error("Expected:", expectedSignature);
      console.error("Received:", receivedSignature);
      return res.status(400).json({ message: "Invalid signature" });
    }

    console.log("✅ Signature hợp lệ");

    // Parse orderCode format: "SUB_{userId}_{duration}_{timestamp}"
    const orderCode = parsed.data?.orderCode;
    if (!orderCode || !orderCode.startsWith("SUB_")) {
      console.log("⚠️ OrderCode không phải subscription, bỏ qua");
      return res.status(200).json({ message: "Not a subscription order" });
    }

    const parts = orderCode.split("_");
    if (parts.length !== 4) {
      console.error("❌ OrderCode format không hợp lệ:", orderCode);
      return res.status(400).json({ message: "Invalid orderCode format" });
    }

    const userId = parts[1];
    const duration = parseInt(parts[2]);
    const amount = parsed.data?.amount;

    console.log(`📦 Subscription payment detected: userId=${userId}, duration=${duration}, amount=${amount}`);

    // Tìm subscription pending
    const subscription = await Subscription.findOne({
      user: userId,
      status: "PENDING",
      duration_months: duration,
    }).sort({ created_at: -1 });

    if (!subscription) {
      console.error("❌ Không tìm thấy subscription pending cho user:", userId);
      return res.status(404).json({ message: "Subscription not found" });
    }

    // Activate premium
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + duration);

    subscription.activatePremium(duration);
    await subscription.save();
    console.log(`✅ Activated premium for user ${userId}, expires at ${expiresAt}`);

    // Update User model - chỉ cập nhật is_premium flag
    const user = await User.findById(userId);
    const displayName = user?.fullname || user?.username || "Người dùng";

    if (user) {
      user.is_premium = true;
      await user.save();
      console.log(`✅ Updated User ${user.username} to PREMIUM`);
    }

    // 🔔 Emit socket notification
    const io = req.app.get("io");
    if (io) {
      io.emit("subscription_activated", {
        userId,
        duration,
        expiresAt,
        message: `${displayName} đã kích hoạt gói Premium ${duration} tháng 🎉 (hết hạn vào ${expiresAt.toLocaleDateString(
          "vi-VN"
        )})`,
      });

      // 🧠 Lưu thông báo vào DB
      await Notification.create({
        storeId: null,
        userId,
        type: "service",
        title: "Kích hoạt gói dịch vụ",
        message: `${displayName} đã kích hoạt gói Premium ${duration} tháng 🎉 (hết hạn vào ${expiresAt.toLocaleDateString(
          "vi-VN"
        )})`,
      });

      console.log(`🔔 [SOCKET + DB] Premium ${duration} tháng kích hoạt cho user ${displayName} (${userId})`);
    }

    return res.status(200).json({ message: "Subscription activated" });
  } catch (err) {
    console.error("💥 Lỗi subscription webhook handler:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
