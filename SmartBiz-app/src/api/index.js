// ======================================================
// 📦 API EXPORT HUB — GOM TẤT CẢ API VỀ MỘT CHỖ
// ======================================================
// Dễ dàng import ở nơi khác bằng:
// import { apiClient, userApi, storeApi } from "@/api";

export { default as apiClient } from "./apiClient";

// ========== MODULE API EXPORTS ==========
// Tạm thời chỉ giữ 2 module bạn đang dùng
export * as userApi from "./userApi";
export * as storeApi from "./storeApi";
