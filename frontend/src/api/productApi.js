import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

//  Tạo 1 instance axios duy nhất
const productApi = axios.create({
  baseURL: API_URL,
  withCredentials: true, // cho phép gửi cookie
});

//  Interceptor để tự động thêm token từ localStorage
productApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ------------------ PRODUCT API ------------------

// 🛍️ Tạo sản phẩm mới trong cửa hàng (gửi kèm ảnh)
export const createProduct = async (storeId, data) => {
  const response = await productApi.post(`/products/store/${storeId}`, data, {
    headers: { "Content-Type": "multipart/form-data" }, // quan trọng cho upload ảnh
  });
  return response.data;
};


//  Cập nhật sản phẩm
export const updateProduct = async (productId, data) =>
  (await productApi.put(`/products/${productId}`, data)).data;

//  Xoá sản phẩm
export const deleteProduct = async (productId) =>
  (await productApi.delete(`/products/${productId}`)).data;

//  Lấy danh sách sản phẩm của cửa hàng
export const getProductsByStore = async (storeId) =>
  (await productApi.get(`/products/store/${storeId}`)).data;

export default productApi;
