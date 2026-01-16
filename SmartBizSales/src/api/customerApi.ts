import {
  Customer,
  ApiResponse,
  CustomerCreateData,
  CustomerUpdateData,
  CustomersListResponse,
} from "../type/customer";
import apiClient from "./apiClient";

/**
 * Helper unwrap: ưu tiên response.data.data (chuẩn ApiResponse),
 * fallback để không crash nếu BE trả khác format.
 */
function unwrap<T>(res: any): T {
  if (res?.data?.data !== undefined) return res.data.data as T;
  return res?.data as T;
}

// SEARCH - GET /api/customers/search?query=abc&limit=10&storeId=...&deleted=...
export const searchCustomers = async (
  keyword: string,
  opts?: { limit?: number; storeId?: string; deleted?: boolean }
): Promise<Customer[]> => {
  const response = await apiClient.get<ApiResponse<Customer[]>>(
    "/customers/search",
    {
      params: {
        query: keyword,
        limit: opts?.limit ?? 10,
        storeId: opts?.storeId,
        deleted: opts?.deleted,
      },
    }
  );
  return unwrap<Customer[]>(response) ?? [];
};

// CREATE - POST /api/customers
export const createCustomer = async (
  data: CustomerCreateData
): Promise<Customer> => {
  const response = await apiClient.post<ApiResponse<Customer>>(
    "/customers",
    data
  );
  return unwrap<Customer>(response);
};

// UPDATE - PUT /api/customers/:id
export const updateCustomer = async (
  id: string,
  data: CustomerUpdateData
): Promise<Customer> => {
  const response = await apiClient.put<ApiResponse<Customer>>(
    `/customers/${id}`,
    data
  );
  return unwrap<Customer>(response);
};

// SOFT DELETE - DELETE /api/customers/:id
export const softDeleteCustomer = async (
  id: string
): Promise<{ message: string }> => {
  const response = await apiClient.delete<ApiResponse<{ message: string }>>(
    `/customers/${id}`
  );
  return unwrap<{ message: string }>(response);
};

/**
 * RESTORE (khôi phục)
 * Endpoint phổ biến: PATCH /api/customers/:id/restore
 * Nếu BE của bạn dùng route khác, đổi path tại đây cho đúng.
 */
export const restoreCustomer = async (
  id: string
): Promise<{ message: string }> => {
  const response = await apiClient.put<ApiResponse<{ message: string }>>(
    `/customers/${id}/restore`
  );
  return unwrap<{ message: string }>(response);
};

/**
 * GET BY STORE (có phân trang + query + deleted)
 * GET /api/customers/store/:storeId?page=1&limit=10&query=&deleted=false
 */
export const getCustomersByStore = async (
  storeId: string,
  params?: { page?: number; limit?: number; query?: string; deleted?: boolean }
): Promise<CustomersListResponse> => {
  const response = await apiClient.get<ApiResponse<CustomersListResponse>>(
    `/customers/store/${storeId}`,
    {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
        query: params?.query ?? "",
        deleted: params?.deleted ?? false,
      },
    }
  );

  const data = unwrap<CustomersListResponse>(response);

  // Hardening: đảm bảo luôn có customers array
  return {
    customers: Array.isArray((data as any)?.customers)
      ? (data as any).customers
      : [],
    total: Number(
      (data as any)?.total ?? (data as any)?.customers?.length ?? 0
    ),
    page: Number((data as any)?.page ?? params?.page ?? 1),
    limit: Number((data as any)?.limit ?? params?.limit ?? 50),
    message: (data as any)?.message ?? "Success",
    count: Array.isArray((data as any)?.customers)
      ? (data as any).customers.length
      : 0,
  };
};

// GET BY ID - GET /api/customers/:id
export const getCustomerById = async (id: string): Promise<Customer> => {
  const response = await apiClient.get<ApiResponse<Customer>>(
    `/customers/${id}`
  );
  return unwrap<Customer>(response);
};

// BULK CREATE - POST /api/customers/bulk
export const bulkCreateCustomers = async (
  customers: CustomerCreateData[]
): Promise<{ created: number; errors: any[] }> => {
  const response = await apiClient.post<
    ApiResponse<{ created: number; errors: any[] }>
  >("/customers/bulk", {
    customers,
  });
  return unwrap<{ created: number; errors: any[] }>(response);
};

/**
 * EXPORT EXCEL
 * - App (React Native/Expo) nên dùng responseType: 'arraybuffer' để xử lý nhị phân. [web:332]
 * - Route ví dụ: GET /api/customers/export/:storeId
 * Nếu BE của bạn là /customers/export?storeId=... thì đổi lại cho đúng.
 */
export const exportCustomers = async (
  storeId: string
): Promise<ArrayBuffer> => {
  const response = await apiClient.get(`/customers/store/${storeId}/export`, {
    responseType: "arraybuffer",
  });
  return response.data as ArrayBuffer;
};

const customerApi = {
  searchCustomers,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  restoreCustomer,
  getCustomersByStore,
  getCustomerById,
  bulkCreateCustomers,
  exportCustomers,
};

export default customerApi;

// // 🆕 GET BY STORE - GET /api/customers/store/:storeId
// export const getCustomersByStore = async (
//     storeId: string
// ): Promise<Customer[]> => {
//     const response = await apiClient.get<ApiResponse<CustomersListResponse>>(`/customers/store/${storeId}`);
//     // Lấy customers từ response.data.data.customers
//     if (response.data && Array.isArray(response.data?.customers)) {
//         console.log(` Loaded ${response.data.customers.length} customers`);
//         return response.data.customers;
//     }
//     console.warn("⚠️ No customers found in response");
//     return [];
// };
