import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

//  Tạo 1 instance axios duy nhất
const supplierApi = axios.create({
  baseURL: API_URL,
  withCredentials: true, // cho phép gửi cookie
});

//  Interceptor để tự động thêm token từ localStorage
supplierApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ------------------ SUPPLIER API ------------------

//  Lấy danh sách nhà cung cấp theo cửa hàng
export const getSuppliers = async (storeId) =>
  (await supplierApi.get(`/suppliers/stores/${storeId}`)).data;

//  Lấy chi tiết 1 nhà cung cấp
export const getSupplierById = async (supplierId) =>
  (await supplierApi.get(`/suppliers/${supplierId}`)).data;

//  Tạo nhà cung cấp mới
export const createSupplier = async (storeId, data) =>
  (await supplierApi.post(`/suppliers/stores/${storeId}`, data)).data;

//  Cập nhật nhà cung cấp
export const updateSupplier = async (supplierId, data) =>
  (await supplierApi.put(`/suppliers/${supplierId}`, data)).data;

//  Xoá nhà cung cấp
export const deleteSupplier = async (supplierId) =>
  (await supplierApi.delete(`/suppliers/${supplierId}`)).data;

export default supplierApi;
