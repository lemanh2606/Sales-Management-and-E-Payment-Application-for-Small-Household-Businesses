// src/api/purchaseReturnApi.js
// API xử lý Phiếu trả hàng nhập (Purchase Returns): tạo, xem, cập nhật, xóa
import apiClient from "./apiClient";

// ===================== CREATE =====================

// Tạo phiếu trả hàng mới cho cửa hàng
export const createPurchaseReturn = async (storeId, data) =>
  (await apiClient.post(`/purchase-returns/store/${storeId}`, data)).data;

// ===================== READ =====================

// Lấy tất cả phiếu trả hàng của cửa hàng
export const getPurchaseReturnsByStore = async (storeId) =>
  (await apiClient.get(`/purchase-returns/store/${storeId}`)).data;

// Lấy chi tiết phiếu trả hàng theo ID
export const getPurchaseReturnById = async (returnId) =>
  (await apiClient.get(`/purchase-returns/${returnId}`)).data;

// ===================== UPDATE =====================

// Cập nhật thông tin phiếu trả hàng
export const updatePurchaseReturn = async (returnId, data) =>
  (await apiClient.put(`/purchase-returns/${returnId}`, data)).data;

// ===================== DELETE =====================

// Hủy phiếu trả hàng
export const deletePurchaseReturn = async (returnId) =>
  (await apiClient.delete(`/purchase-returns/${returnId}`)).data;

// ===================== EXPORT =====================
export default {
  createPurchaseReturn,
  getPurchaseReturnsByStore,
  getPurchaseReturnById,
  updatePurchaseReturn,
  deletePurchaseReturn,
};
