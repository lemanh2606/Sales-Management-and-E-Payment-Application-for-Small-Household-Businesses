import apiClient from "./apiClient";

export interface InventoryVoucher {
  _id: string;
  storeId: string;
  warehouse_id: string | any;
  warehouse_name: string;
  warehouse_location?: string;
  type: "IN" | "OUT";
  status: "DRAFT" | "APPROVED" | "POSTED" | "CANCELLED";
  voucher_code: string;
  voucher_date: string;
  reason?: string;
  attached_docs?: number;
  items: any[];
  total_qty: number;
  total_cost: number;
  deliverer_name?: string;
  receiver_name?: string;
  deliverer_phone?: string;
  receiver_phone?: string;
  supplier_id?: string | any;
  ref_no?: string;
  ref_date?: string;
  notes?: string;
  supplier_name_snapshot?: string;
  supplier_phone_snapshot?: string;
  supplier_email_snapshot?: string;
  supplier_address_snapshot?: string;
  partner_name?: string;
  partner_phone?: string;
  partner_address?: string;
  created_by?: string | any;
  approved_by?: string | any;
  posted_by?: string | any;
  cancelled_by?: string | any;
  cancel_reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const getInventoryVouchers = async (
  storeId: string,
  params?: any
): Promise<any> => {
  if (!storeId) throw new Error("Thiếu storeId");
  const response = await apiClient.get(`/stores/${storeId}/inventory-vouchers`, {
    params,
  });
  return response.data;
};

export const getInventoryVoucherById = async (
  storeId: string,
  voucherId: string
): Promise<any> => {
  const response = await apiClient.get(
    `/stores/${storeId}/inventory-vouchers/${voucherId}`
  );
  return response.data;
};

export const createInventoryVoucher = async (
  storeId: string,
  data: any
): Promise<any> => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers`,
    data
  );
  return response.data;
};

export const updateInventoryVoucher = async (
  storeId: string,
  voucherId: string,
  data: any
): Promise<any> => {
  const response = await apiClient.put(
    `/stores/${storeId}/inventory-vouchers/${voucherId}`,
    data
  );
  return response.data;
};

export const deleteInventoryVoucher = async (
  storeId: string,
  voucherId: string
): Promise<any> => {
  const response = await apiClient.delete(
    `/stores/${storeId}/inventory-vouchers/${voucherId}`
  );
  return response.data;
};

export const approveInventoryVoucher = async (
  storeId: string,
  voucherId: string
): Promise<any> => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/approve`
  );
  return response.data;
};

export const postInventoryVoucher = async (
  storeId: string,
  voucherId: string
): Promise<any> => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/post`
  );
  return response.data;
};

export const cancelInventoryVoucher = async (
  storeId: string,
  voucherId: string,
  data?: any
): Promise<any> => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/cancel`,
    data
  );
  return response.data;
};

export const reverseInventoryVoucher = async (
  storeId: string,
  voucherId: string
): Promise<any> => {
  const response = await apiClient.post(
    `/stores/${storeId}/inventory-vouchers/${voucherId}/reverse`
  );
  return response.data;
};

export default {
  getInventoryVouchers,
  getInventoryVoucherById,
  createInventoryVoucher,
  updateInventoryVoucher,
  deleteInventoryVoucher,
  approveInventoryVoucher,
  postInventoryVoucher,
  cancelInventoryVoucher,
  reverseInventoryVoucher,
};
