// src/api/supplierApi.js
import apiClient from "./apiClient";

// Lấy danh sách nhà cung cấp theo cửa hàng
// - getSuppliers(storeId, { deleted: false }) -> active
// - getSuppliers(storeId, { deleted: true }) -> deleted
export const getSuppliers = async (storeId, options = {}) => {
  if (!storeId) throw new Error("Thiếu storeId khi lấy danh sách nhà cung cấp");

  const { deleted } = options;
  const res = await apiClient.get(`/suppliers/stores/${storeId}`, {
    params: typeof deleted === "boolean" ? { deleted } : undefined,
  });
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

// Khôi phục nhà cung cấp
export const restoreSupplier = async (supplierId) => {
  if (!supplierId)
    throw new Error("Thiếu supplierId khi khôi phục nhà cung cấp");
  const res = await apiClient.put(`/suppliers/${supplierId}/restore`, {});
  return res.data;
};

// Xuất danh sách nhà cung cấp ra Excel
export const exportSuppliers = async (storeId) => {
  if (!storeId)
    throw new Error("Thiếu storeId khi xuất danh sách nhà cung cấp");

  const res = await apiClient.get(`/suppliers/stores/${storeId}/export`, {
    responseType: "blob",
  });

  // Lấy tên file từ header Content-Disposition nếu có
  let fileName = "suppliers.xlsx";
  const disposition = res.headers["content-disposition"];
  if (disposition && disposition.indexOf("filename=") !== -1) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      fileName = matches[1].replace(/['"]/g, "");
      // Giải mã percent-encoding nếu có (cho UTF-8)
      if (fileName.startsWith("UTF-8''")) {
        fileName = decodeURIComponent(fileName.substring(7));
      }
    }
  }

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
