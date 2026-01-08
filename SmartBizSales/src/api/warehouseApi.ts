// src/api/warehouseApi.ts
import apiClient from "./apiClient";

export interface Warehouse {
  _id: string;
  storeId: string;
  code: string;
  name: string;
  address?: string;
  ward?: string;
  district?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  contact_person?: string;
  phone?: string;
  email?: string;
  warehouse_type: "normal" | "cold_storage" | "hazardous" | "high_value" | "other";
  capacity?: number;
  capacity_unit?: string;
  is_default: boolean;
  status: "active" | "inactive" | "maintenance" | "archived";
  allow_negative_stock?: boolean;
  auto_reorder?: boolean;
  reorder_point?: number;
  barcode_enabled?: boolean;
  lot_tracking?: boolean;
  expiry_tracking?: boolean;
  fifo_enabled?: boolean;
  description?: string;
  notes?: string;
  is_active: boolean; // mapped from status active
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehousesResponse {
  success: boolean;
  warehouses: Warehouse[];
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export const getWarehousesByStore = async (
  storeId: string,
  params?: any
): Promise<WarehousesResponse> => {
  if (!storeId) throw new Error("Thiếu storeId");
  const response = await apiClient.get<WarehousesResponse>(
    `/stores/${storeId}/warehouses`,
    { params }
  );
  return response.data;
};

export const createWarehouse = async (
  storeId: string,
  data: Partial<Warehouse>
): Promise<any> => {
  const response = await apiClient.post(`/stores/${storeId}/warehouses`, data);
  return response.data;
};

export const updateWarehouse = async (
  storeId: string,
  warehouseId: string,
  data: Partial<Warehouse>
): Promise<any> => {
  const response = await apiClient.put(
    `/stores/${storeId}/warehouses/${warehouseId}`,
    data
  );
  return response.data;
};

export const deleteWarehouse = async (
  storeId: string,
  warehouseId: string
): Promise<any> => {
  const response = await apiClient.delete(
    `/stores/${storeId}/warehouses/${warehouseId}`
  );
  return response.data;
};

export const restoreWarehouse = async (
  storeId: string,
  warehouseId: string
): Promise<any> => {
  const response = await apiClient.patch(
    `/stores/${storeId}/warehouses/${warehouseId}/restore`
  );
  return response.data;
};

export const setDefaultWarehouse = async (
  storeId: string,
  warehouseId: string
): Promise<any> => {
  const response = await apiClient.patch(
    `/stores/${storeId}/warehouses/${warehouseId}/set-default`
  );
  return response.data;
};

export default {
  getWarehousesByStore,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  restoreWarehouse,
  setDefaultWarehouse,
};
