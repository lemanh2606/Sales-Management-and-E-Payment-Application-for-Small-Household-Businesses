// src/api/stockCheckApi.js
// API Kiểm kho (Stock Check)
import apiClient from "./apiClient";

// ===================== CREATE =====================

// Tạo phiếu kiểm kho mới cho một cửa hàng
export const createStockCheck = async (storeId, data) =>
  (await apiClient.post(`/stores/${storeId}/stock-checks`, data)).data;

// ===================== READ =====================

// Lấy danh sách phiếu kiểm kho của một cửa hàng
export const getStockChecksByStore = async (storeId) =>
  (await apiClient.get(`/stores/${storeId}/stock-checks`)).data;

// Lấy chi tiết phiếu kiểm kho theo ID
export const getStockCheckById = async (checkId) =>
  (await apiClient.get(`/stock-checks/${checkId}`)).data;

// ===================== UPDATE =====================

// Cập nhật phiếu kiểm kho
export const updateStockCheck = async (checkId, data) =>
  (await apiClient.put(`/stock-checks/${checkId}`, data)).data;

// ===================== DELETE =====================

// Xóa phiếu kiểm kho
export const deleteStockCheck = async (checkId) =>
  (await apiClient.delete(`/stock-checks/${checkId}`)).data;

// ===================== DEFAULT EXPORT =====================
export default {
  createStockCheck,
  getStockChecksByStore,
  getStockCheckById,
  updateStockCheck,
  deleteStockCheck,
};
