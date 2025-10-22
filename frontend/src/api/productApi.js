// src/api/productApi.js
// Sử dụng apiClient chung để gọi API sản phẩm
import apiClient from "./apiClient";

/*
  PRODUCT API
  - Dùng chung instance apiClient (có sẵn baseURL + token interceptor)
  - Các hàm trả về .data để component gọi trực tiếp
*/

// ========================= PRODUCT CRUD =========================

//  Tạo sản phẩm mới trong cửa hàng
export const createProduct = async (storeId, data) =>
  (await apiClient.post(`/products/store/${storeId}`, data)).data;

//  Cập nhật thông tin sản phẩm
export const updateProduct = async (productId, data) =>
  (await apiClient.put(`/products/${productId}`, data)).data;

//  Xóa sản phẩm khỏi cửa hàng
export const deleteProduct = async (productId) =>
  (await apiClient.delete(`/products/${productId}`)).data;

//  Lấy danh sách sản phẩm của cửa hàng
export const getProductsByStore = async (storeId, params) =>
  (await apiClient.get(`/products/store/${storeId}`, { params })).data;

//  Lấy chi tiết 1 sản phẩm cụ thể
export const getProductById = async (productId) =>
  (await apiClient.get(`/products/${productId}`)).data;

// ========================= EXPORT =========================
export default {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByStore,
  getProductById,
};
