// src/api/purchaseOrderApi.js
// API xử lý Đơn nhập hàng (Purchase Orders): tạo, xem, cập nhật, xóa
import apiClient from "./apiClient";

// ===================== CREATE =====================

// Tạo đơn nhập hàng mới cho cửa hàng
export const createPurchaseOrder = async (storeId, data) =>
  (await apiClient.post(`/purchase-orders/store/${storeId}`, data)).data;

// ===================== READ =====================

// Lấy tất cả đơn nhập hàng thuộc cửa hàng
export const getPurchaseOrdersByStore = async (storeId) =>
  (await apiClient.get(`/purchase-orders/store/${storeId}`)).data;

// Lấy chi tiết một đơn nhập hàng theo ID
export const getPurchaseOrderById = async (orderId) =>
  (await apiClient.get(`/purchase-orders/${orderId}`)).data;

// ===================== UPDATE =====================

// Cập nhật thông tin đơn nhập hàng
export const updatePurchaseOrder = async (orderId, data) =>
  (await apiClient.put(`/purchase-orders/${orderId}`, data)).data;

// ===================== DELETE =====================

// Xóa đơn nhập hàng
export const deletePurchaseOrder = async (orderId) =>
  (await apiClient.delete(`/purchase-orders/${orderId}`)).data;

// ===================== EXPORT =====================
export default {
  createPurchaseOrder,
  getPurchaseOrdersByStore,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
};
