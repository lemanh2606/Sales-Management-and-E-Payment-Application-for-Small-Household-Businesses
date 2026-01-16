// Sử dụng apiClient chung để gọi API phiếu nhập/xuất kho
import apiClient from "./apiClient";

/*
  INVENTORY VOUCHER API
  - Dùng chung instance apiClient (có sẵn baseURL + token interceptor)
  - Các hàm trả về .data để component gọi trực tiếp
*/

// ========================= CRUD =========================

// Tạo phiếu kho (mặc định DRAFT)
export const createInventoryVoucher = async (storeId, data) => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers`,
    data,
    {}
  );
  return response.data;
};

// Cập nhật phiếu kho (chỉ DRAFT)
export const updateInventoryVoucher = async (storeId, voucherId, data) => {
  const response = await apiClient.put(
    `/stores/${storeId}/inventory-vouchers/${voucherId}`,
    data,
    {}
  );
  return response.data;
};

// Xóa phiếu kho (chỉ DRAFT)
export const deleteInventoryVoucher = async (storeId, voucherId) => {
  const response = await apiClient.delete(
    `/stores/${storeId}/inventory-vouchers/${voucherId}`
  );
  return response.data;
};

// Lấy danh sách phiếu kho (có phân trang + filter)
export const getInventoryVouchers = async (
  storeId,
  { page = 1, limit = 20, type, status, q, from, to, sort } = {}
) => {
  try {
    const response = await apiClient.get(
      `/stores/${storeId}/inventory-vouchers`,
      {
        params: { page, limit, type, status, q, from, to, sort },
      }
    );
    return response.data; // { data: [], meta: { page, limit, total } }
  } catch (error) {
    console.error(" Lỗi khi lấy danh sách phiếu kho:", error);
    throw error;
  }
};

// Lấy chi tiết 1 phiếu kho
export const getInventoryVoucherById = async (storeId, voucherId) => {
  const response = await apiClient.get(
    `/stores/${storeId}/inventory-vouchers/${voucherId}`
  );
  return response.data; // { voucher }
};

// ========================= ACTIONS =========================

export const approveInventoryVoucher = async (storeId, voucherId) => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/approve`,
    {}
  );
  return response.data;
};

export const postInventoryVoucher = async (storeId, voucherId) => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/post`,
    {}
  );
  return response.data;
};

export const cancelInventoryVoucher = async (
  storeId,
  voucherId,
  { cancel_reason = "" } = {}
) => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/cancel`,
    { cancel_reason }
  );
  return response.data;
};

export const reverseInventoryVoucher = async (storeId, voucherId) => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/reverse`,
    {}
  );
  return response.data;
};

export default {
  createInventoryVoucher,
  updateInventoryVoucher,
  deleteInventoryVoucher,
  getInventoryVouchers,
  getInventoryVoucherById,

  approveInventoryVoucher,
  postInventoryVoucher,
  cancelInventoryVoucher,
  reverseInventoryVoucher,
};
