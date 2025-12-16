// src/api/supplierApi.ts
import apiClient from "./apiClient";
import type {
    SupplierResponse,
    SuppliersResponse,
    CreateSupplierData,
    UpdateSupplierData,
    DeleteSupplierResponse,
    RestoreSupplierResponse,
    ExportSuppliersResponse,
    GetSuppliersOptions,
} from "../type/supplier";

/**
 * Lấy danh sách nhà cung cấp theo cửa hàng
 * @param storeId - ID của cửa hàng
 * @param options - { deleted?: boolean }
 * @returns Danh sách nhà cung cấp
 */
export const getSuppliers = async (
    storeId: string,
    options: GetSuppliersOptions = {}
): Promise<SuppliersResponse> => {
    if (!storeId) throw new Error("Thiếu storeId khi lấy danh sách nhà cung cấp");

    const { deleted } = options;

    const response = await apiClient.get<SuppliersResponse>(`/suppliers/stores/${storeId}`, {
        params: typeof deleted === "boolean" ? { deleted } : undefined,
    });

    return response.data;
};

/**
 * Lấy chi tiết một nhà cung cấp (backend của bạn đã sửa để xem được cả isDeleted=true)
 * @param supplierId - ID của nhà cung cấp
 */
export const getSupplierById = async (supplierId: string): Promise<SupplierResponse> => {
    if (!supplierId) throw new Error("Thiếu supplierId khi lấy chi tiết nhà cung cấp");

    const response = await apiClient.get<SupplierResponse>(`/suppliers/${supplierId}`);
    return response.data;
};

/**
 * Tạo mới nhà cung cấp cho cửa hàng
 */
export const createSupplier = async (
    storeId: string,
    data: CreateSupplierData
): Promise<SupplierResponse> => {
    if (!storeId) throw new Error("Thiếu storeId khi tạo nhà cung cấp");
    if (!data?.name || data.name.trim() === "") {
        throw new Error("Thiếu dữ liệu nhà cung cấp - Tên là bắt buộc");
    }

    const response = await apiClient.post<SupplierResponse>(`/suppliers/stores/${storeId}`, data);
    return response.data;
};

/**
 * Cập nhật thông tin nhà cung cấp
 */
export const updateSupplier = async (
    supplierId: string,
    data: UpdateSupplierData
): Promise<SupplierResponse> => {
    if (!supplierId) throw new Error("Thiếu supplierId khi cập nhật nhà cung cấp");

    const response = await apiClient.put<SupplierResponse>(`/suppliers/${supplierId}`, data);
    return response.data;
};

/**
 * Xóa nhà cung cấp (soft delete)
 */
export const deleteSupplier = async (supplierId: string): Promise<DeleteSupplierResponse> => {
    if (!supplierId) throw new Error("Thiếu supplierId khi xóa nhà cung cấp");

    const response = await apiClient.delete<DeleteSupplierResponse>(`/suppliers/${supplierId}`);
    return response.data;
};

/**
 * Khôi phục nhà cung cấp (restore soft delete)
 */
export const restoreSupplier = async (supplierId: string): Promise<RestoreSupplierResponse> => {
    if (!supplierId) throw new Error("Thiếu supplierId khi khôi phục nhà cung cấp");

    const response = await apiClient.put<RestoreSupplierResponse>(`/suppliers/${supplierId}/restore`, {});
    return response.data;
};

/**
 * Xuất danh sách nhà cung cấp ra Excel
 * @returns Blob để bạn tự saveAs hoặc tự tạo link download
 */
export const exportSuppliers = async (storeId: string): Promise<ExportSuppliersResponse> => {
    if (!storeId) throw new Error("Thiếu storeId khi xuất danh sách nhà cung cấp");

    // Axios hỗ trợ responseType: "blob" để nhận file nhị phân. [web:131]
    const response = await apiClient.get<Blob>(`/suppliers/stores/${storeId}/export`, {
        responseType: "blob",
    });

    return response.data;
};

export default {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    restoreSupplier,
    exportSuppliers,
};
