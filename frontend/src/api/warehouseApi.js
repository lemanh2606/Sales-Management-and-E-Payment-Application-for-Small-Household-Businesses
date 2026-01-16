// src/api/warehouseApi.js
import apiClient from "./apiClient";

// ==================== LIST & DETAIL ====================

/**
 * Lấy danh sách kho theo store
 * @param {string} storeId
 * @param {object} params { deleted, status, page, limit, q }
 */
export const getWarehouses = async (storeId, params = {}) =>
  (
    await apiClient.get(`/stores/${storeId}/warehouses`, {
      params,
    })
  ).data;

/**
 * Lấy chi tiết 1 kho
 */
export const getWarehouseById = async (storeId, warehouseId) =>
  (await apiClient.get(`/stores/${storeId}/warehouses/${warehouseId}`)).data;

// ==================== CREATE / UPDATE ====================

/**
 * Tạo kho mới
 */
export const createWarehouse = async (storeId, data) =>
  (await apiClient.post(`/stores/${storeId}/warehouses`, data)).data;

/**
 * Cập nhật kho
 */
export const updateWarehouse = async (storeId, warehouseId, data) =>
  (await apiClient.put(`/stores/${storeId}/warehouses/${warehouseId}`, data))
    .data;

// ==================== DELETE / RESTORE / DEFAULT ====================

/**
 * Xóa mềm kho
 */
export const deleteWarehouse = async (storeId, warehouseId) =>
  (await apiClient.delete(`/stores/${storeId}/warehouses/${warehouseId}`)).data;

/**
 * Khôi phục kho đã xóa
 */
export const restoreWarehouse = async (storeId, warehouseId) =>
  (
    await apiClient.patch(
      `/stores/${storeId}/warehouses/${warehouseId}/restore`
    )
  ).data;

/**
 * Đặt kho làm kho mặc định của cửa hàng
 */
export const setDefaultWarehouse = async (storeId, warehouseId) =>
  (
    await apiClient.patch(
      `/stores/${storeId}/warehouses/${warehouseId}/set-default`
    )
  ).data;

// ==================== EXPORT DEFAULT ====================
export default {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  restoreWarehouse,
  setDefaultWarehouse,
};
