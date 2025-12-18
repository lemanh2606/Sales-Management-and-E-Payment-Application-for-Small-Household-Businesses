// frontend/src/api/subscriptionApi.js
import apiClient from "./apiClient";

const subscriptionApi = {
  /**
   * GET /api/subscriptions/plans
   * Lấy danh sách các gói subscription
   */
  getPlans: () => {
    return apiClient.get("/subscriptions/plans");
  },

  /**
   * GET /api/subscriptions/current
   * Lấy thông tin subscription hiện tại của user
   */
  getCurrentSubscription: () => {
    return apiClient.get("/subscriptions/current");
  },

  /**
   * POST /api/subscriptions/checkout
   * Tạo link thanh toán subscription
   * @param {Object} data - { plan_duration: 1|3|6 }
   */
  createCheckout: (data) => {
    return apiClient.post("/subscriptions/checkout", data);
  },

  /**
   * POST /api/subscriptions/activate
   * Kích hoạt premium sau khi thanh toán (webhook internal)
   * @param {Object} data - { transaction_id, plan_duration, amount }
   */
  activatePremium: (data) => {
    return apiClient.post("/subscriptions/activate", data);
  },

  /**
   * POST /api/subscriptions/cancel
   * Hủy auto-renew subscription
   */
  cancelAutoRenew: () => {
    return apiClient.post("/subscriptions/cancel");
  },

  /**
   * GET /api/subscriptions/history
   * Lấy lịch sử thanh toán subscription
   */
  getPaymentHistory: () => {
    return apiClient.get("/subscriptions/history");
  },

  /**
   * GET /api/subscriptions/usage
   * Lấy thống kê sử dụng (orders, revenue, products)
   */
  getUsageStats: () => {
    return apiClient.get("/subscriptions/usage");
  },

  clearPendingPayment: () => {
    return apiClient.post("/subscriptions/clear-pending");
  },
};

export default subscriptionApi;
