// src/api/index.js
// ======================================================
// 📦 API EXPORT HUB — GOM TẤT CẢ API VỀ MỘT CHỖ
// ======================================================
// Dễ dàng import ở nơi khác bằng:
// import { apiClient, userApi, productApi } from "@/api";

export { default as apiClient } from "./apiClient";

// Import modules (compatible with Metro/Babel)
import * as customerApi from "./customerApi";
import * as loyaltyApi from "./loyaltyApi";
import * as orderApi from "./orderApi";
import * as orderWebhookApi from "./orderWebhookApi";
import * as productGroupApi from "./productGroupApi";
import * as productApi from "./productApi";
import * as purchaseOrderApi from "./purchaseOrderApi";
import * as purchaseReturnApi from "./purchaseReturnApi";
import * as revenueApi from "./revenueApi";
import * as stockCheckApi from "./stockCheckApi";
import * as stockDisposalApi from "./stockDisposalApi";
import * as storeApi from "./storeApi";
import * as supplierApi from "./supplierApi";
import * as taxApi from "./taxApi";
import * as userApi from "./userApi";

// Export theo tên (tương đương `export * as ...`)
export {
  customerApi,
  loyaltyApi,
  orderApi,
  orderWebhookApi,
  productGroupApi,
  productApi,
  purchaseOrderApi,
  purchaseReturnApi,
  revenueApi,
  stockCheckApi,
  stockDisposalApi,
  storeApi,
  supplierApi,
  taxApi,
  userApi,
};
