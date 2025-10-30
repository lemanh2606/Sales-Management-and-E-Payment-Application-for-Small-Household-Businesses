// src/api/stockDisposalApi.js
// API Phiếu xuất hủy hàng tồn (Stock Disposal)
import apiClient from "./apiClient";

// ===================== CREATE =====================

// Tạo phiếu xuất hủy mới trong cửa hàng
export const createStockDisposal = async (storeId, data) =>
  (await apiClient.post(`/store/${storeId}`, data)).data;

// ===================== READ =====================

// Lấy danh sách phiếu xuất hủy của cửa hàng
export const getStockDisposalsByStore = async (storeId) =>
  (await apiClient.get(`/store/${storeId}`)).data;

// Lấy chi tiết phiếu xuất hủy theo ID
export const getStockDisposalById = async (disposalId) =>
  (await apiClient.get(`/stock-disposals/${disposalId}`)).data;

// ===================== UPDATE =====================

// Cập nhật phiếu xuất hủy
export const updateStockDisposal = async (disposalId, data) =>
  (await apiClient.put(`/stock-disposals/${disposalId}`, data)).data;

// ===================== DELETE =====================

// Xóa phiếu xuất hủy
export const deleteStockDisposal = async (disposalId) =>
  (await apiClient.delete(`/stock-disposals/${disposalId}`)).data;

// ===================== DEFAULT EXPORT =====================
export default {
  createStockDisposal,
  getStockDisposalsByStore,
  getStockDisposalById,
  updateStockDisposal,
  deleteStockDisposal,
};
