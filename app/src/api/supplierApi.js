// src/api/supplierApi.js
import apiClient from "./apiClient";

// Lấy danh sách nhà cung cấp theo cửa hàng
export const getSuppliers = async (storeId) => {
  if (!storeId) throw new Error("Thiếu storeId khi lấy danh sách nhà cung cấp");
  const res = await apiClient.get(`/suppliers/stores/${storeId}`);
  return res.data;
};

// Lấy chi tiết một nhà cung cấp
export const getSupplierById = async (supplierId) => {
  if (!supplierId)
    throw new Error("Thiếu supplierId khi lấy chi tiết nhà cung cấp");
  const res = await apiClient.get(`/suppliers/${supplierId}`);
  return res.data;
};

// Tạo mới nhà cung cấp cho cửa hàng
export const createSupplier = async (storeId, data) => {
  if (!storeId) throw new Error("Thiếu storeId khi tạo nhà cung cấp");
  if (!data?.name) throw new Error("Thiếu dữ liệu nhà cung cấp");
  const res = await apiClient.post(`/suppliers/stores/${storeId}`, data);
  return res.data;
};

// Cập nhật thông tin nhà cung cấp
export const updateSupplier = async (supplierId, data) => {
  if (!supplierId)
    throw new Error("Thiếu supplierId khi cập nhật nhà cung cấp");
  const res = await apiClient.put(`/suppliers/${supplierId}`, data);
  return res.data;
};

// Xóa nhà cung cấp
export const deleteSupplier = async (supplierId) => {
  if (!supplierId) throw new Error("Thiếu supplierId khi xóa nhà cung cấp");
  const res = await apiClient.delete(`/suppliers/${supplierId}`);
  return res.data;
};
