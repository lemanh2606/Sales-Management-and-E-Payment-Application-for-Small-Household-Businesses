// ======================================================
// 📦 API EXPORT HUB — GOM TẤT CẢ API VỀ MỘT CHỖ
// ======================================================
// Dễ dàng import ở nơi khác bằng:
// import { apiClient, userApi, productApi } from "@/api";

export { default as apiClient } from "./apiClient";

// ========== MODULE API EXPORTS ==========
export * as customerApi from "./customerApi";
export * as exportApi from "./exportApi";
export * as loyaltyApi from "./loyaltyApi";
export * as orderApi from "./orderApi";
export * as orderWebhookApi from "./orderWebhookApi";
export * as productGroupApi from "./productGroupApi";
export * as productApi from "./productApi";
export * as purchaseOrderApi from "./purchaseOrderApi";
export * as purchaseReturnApi from "./purchaseReturnApi";
export * as revenueApi from "./revenueApi";
export * as stockCheckApi from "./stockCheckApi";
export * as stockDisposalApi from "./stockDisposalApi";
export * as storeApi from "./storeApi";
export * as supplierApi from "./supplierApi";
export * as taxApi from "./taxApi";
export * as userApi from "./userApi";
export { default as subscriptionApi } from "./subscriptionApi";
