import { Customer, ApiResponse, CustomerCreateData, CustomerUpdateData, CustomersListResponse } from "../type/customer";
import apiClient from "./apiClient";



/*
  CUSTOMER API
  - Tìm kiếm, tạo, cập nhật, xóa mềm khách hàng
  - apiClient sẽ tự thêm token nếu cấu hình interceptor
*/

// SEARCH - GET /api/customers/search?query=abc
export const searchCustomers = async (
    keyword: string,
    limit: number = 10
): Promise<Customer[]> => {
    const response = await apiClient.get<ApiResponse<Customer[]>>("/customers/search", {
        params: { query: keyword, limit },
    });
    return response.data.data;
};

// CREATE - POST /api/customers
export const createCustomer = async (
    data: CustomerCreateData
): Promise<Customer> => {
    const response = await apiClient.post<ApiResponse<Customer>>("/customers", data);
    return response.data.data;
};

// UPDATE - PUT /api/customers/:id
export const updateCustomer = async (
    id: string,
    data: CustomerUpdateData
): Promise<Customer> => {
    const response = await apiClient.put<ApiResponse<Customer>>(`/customers/${id}`, data);
    return response.data.data;
};

// SOFT DELETE - DELETE /api/customers/:id
export const softDeleteCustomer = async (
    id: string
): Promise<{ message: string }> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/customers/${id}`);
    return response.data.data;
};

// 🆕 GET BY STORE - GET /api/customers/store/:storeId
export const getCustomersByStore = async (
    storeId: string
): Promise<Customer[]> => {
    const response = await apiClient.get<ApiResponse<CustomersListResponse>>(`/customers/store/${storeId}`);
    // Lấy customers từ response.data.data.customers
    if (response.data && Array.isArray(response.data?.customers)) {
        console.log(`✅ Loaded ${response.data.customers.length} customers`);
        return response.data.customers;
    }
    console.warn("⚠️ No customers found in response");
    return [];
};

// GET BY ID - GET /api/customers/:id
export const getCustomerById = async (
    id: string
): Promise<Customer> => {
    const response = await apiClient.get<ApiResponse<Customer>>(`/customers/${id}`);
    return response.data.data;
};

// BULK CREATE - POST /api/customers/bulk
export const bulkCreateCustomers = async (
    customers: CustomerCreateData[]
): Promise<{ created: number; errors: any[] }> => {
    const response = await apiClient.post<ApiResponse<{ created: number; errors: any[] }>>(
        "/customers/bulk",
        { customers }
    );
    return response.data.data;
};

const customerApi = {
    searchCustomers,
    createCustomer,
    updateCustomer,
    softDeleteCustomer,
    getCustomersByStore,
    getCustomerById,
    bulkCreateCustomers,
};

export default customerApi;