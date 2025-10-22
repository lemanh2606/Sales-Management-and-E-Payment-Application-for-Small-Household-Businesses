// src/api/productGroupApi.js
// Sử dụng apiClient dùng chung cho toàn dự án
import apiClient from "./apiClient";

/*
  PRODUCT GROUP API
  - Dùng chung instance apiClient (baseURL + token interceptor)
  - Các hàm trả về .data để component gọi trực tiếp
*/

// ===================== PRODUCT GROUP CRUD =====================

//  CREATE - Tạo nhóm sản phẩm mới trong cửa hàng
export const createProductGroup = async (storeId, data) =>
  (await apiClient.post(`/product-groups/store/${storeId}`, data)).data;

//  READ - Lấy tất cả nhóm sản phẩm của 1 cửa hàng
export const getProductGroupsByStore = async (storeId, params) =>
  (await apiClient.get(`/product-groups/store/${storeId}`, { params })).data;

//  READ - Lấy chi tiết 1 nhóm sản phẩm
export const getProductGroupById = async (groupId) =>
  (await apiClient.get(`/product-groups/${groupId}`)).data;

//  UPDATE - Cập nhật thông tin nhóm sản phẩm
export const updateProductGroup = async (groupId, data) =>
  (await apiClient.put(`/product-groups/${groupId}`, data)).data;

//  DELETE - Xóa nhóm sản phẩm
export const deleteProductGroup = async (groupId) =>
  (await apiClient.delete(`/product-groups/${groupId}`)).data;

// ===================== EXPORT =====================
export default {
  createProductGroup,
  getProductGroupsByStore,
  getProductGroupById,
  updateProductGroup,
  deleteProductGroup,
};
