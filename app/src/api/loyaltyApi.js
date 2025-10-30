// src/api/loyaltyApi.js
// Dùng apiClient chung cho các API cấu hình khách hàng thân thiết (Loyalty)
import apiClient from "./apiClient";

/*
  LOYALTY API
  - Dành cho Manager/Staff của store
  - Gồm setup cấu hình và lấy cấu hình điểm thưởng của cửa hàng
*/

// ===================== LOYALTY CONFIG =====================

//  POST - Thiết lập cấu hình Loyalty (chỉ Manager có quyền)
export const setupLoyaltyConfig = async (storeId, data) =>
  (await apiClient.post(`/loyalty/config/${storeId}`, data)).data;

//  GET - Lấy cấu hình Loyalty của 1 cửa hàng (manager/staff)
export const getLoyaltyConfig = async (storeId) =>
  (await apiClient.get(`/loyalty/config/${storeId}`)).data;

// ===================== EXPORT =====================
export default {
  setupLoyaltyConfig,
  getLoyaltyConfig,
};
