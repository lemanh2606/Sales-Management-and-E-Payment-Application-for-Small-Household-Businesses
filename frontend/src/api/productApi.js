// src/api/productApi.js
// Sử dụng apiClient chung để gọi API sản phẩm
import apiClient from "./apiClient";

/*
  PRODUCT API
  - Dùng chung instance apiClient (có sẵn baseURL + token interceptor)
  - Các hàm trả về .data để component gọi trực tiếp
*/

// ========================= PRODUCT CRUD =========================

// Tạo sản phẩm mới trong cửa hàng – CÓ FILE ẢNH
export const createProduct = async (storeId, data) => {
  return await apiClient.post(`/products/store/${storeId}`, data, {});
};

// Cập nhật sản phẩm trong cửa hàng – CÓ THỂ CÓ FILE ẢNH
export const updateProduct = async (productId, storeId, data) => {
  return await apiClient.put(`/products/${productId}?storeId=${storeId}`, data, {});
};

//  Xóa sản phẩm khỏi cửa hàng
export const deleteProduct = async (productId) => (await apiClient.delete(`/products/${productId}`)).data;

// Lấy danh sách sản phẩm của cửa hàng với phân trang
export const getProductsByStore = async (storeId, { page = 1, limit = 10 } = {}) => {
  try {
    const response = await apiClient.get(`/products/store/${storeId}`, {
      params: { page, limit },
    });
    return response.data; // trả về object chứa total, page, limit, products
  } catch (error) {
    console.error("❌ Lỗi khi lấy sản phẩm:", error);
    throw error;
  }
};

//  Lấy chi tiết 1 sản phẩm cụ thể
export const getProductById = async (productId) => (await apiClient.get(`/products/${productId}`)).data;

//  Import sản phẩm bằng file Excel/CSV
export const importProductsByExcel = async (storeId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post(`/products/store/${storeId}/import`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};

// ========================= EXPORT =========================
export default {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByStore,
  getProductById,
  importProductsByExcel,
};
