// src/api/supplierApi.ts
import apiClient from "./apiClient";
import {
    Supplier,
    SupplierResponse,
    SuppliersResponse,
    CreateSupplierData,
    UpdateSupplierData,
    DeleteSupplierResponse
} from "../type/supplier";

/**
 * Lấy danh sách nhà cung cấp theo cửa hàng
 * @param storeId - ID của cửa hàng
 * @returns Danh sách nhà cung cấp
 */
export const getSuppliers = async (storeId: string): Promise<SuppliersResponse> => {
    if (!storeId) {
        throw new Error("Thiếu storeId khi lấy danh sách nhà cung cấp");
    }

    const response = await apiClient.get<SuppliersResponse>(`/suppliers/stores/${storeId}`);
    return response.data;
};

/**
 * Lấy chi tiết một nhà cung cấp
 * @param supplierId - ID của nhà cung cấp
 * @returns Thông tin chi tiết nhà cung cấp
 */
export const getSupplierById = async (supplierId: string): Promise<SupplierResponse> => {
    if (!supplierId) {
        throw new Error("Thiếu supplierId khi lấy chi tiết nhà cung cấp");
    }

    const response = await apiClient.get<SupplierResponse>(`/suppliers/${supplierId}`);
    return response.data;
};

/**
 * Tạo mới nhà cung cấp cho cửa hàng
 * @param storeId - ID của cửa hàng
 * @param data - Dữ liệu tạo nhà cung cấp
 * @returns Nhà cung cấp vừa tạo
 */
export const createSupplier = async (
    storeId: string,
    data: CreateSupplierData
): Promise<SupplierResponse> => {
    if (!storeId) {
        throw new Error("Thiếu storeId khi tạo nhà cung cấp");
    }

    if (!data?.name || data.name.trim() === "") {
        throw new Error("Thiếu dữ liệu nhà cung cấp - Tên là bắt buộc");
    }

    const response = await apiClient.post<SupplierResponse>(
        `/suppliers/stores/${storeId}`,
        data
    );
    return response.data;
};

/**
 * Cập nhật thông tin nhà cung cấp
 * @param supplierId - ID của nhà cung cấp
 * @param data - Dữ liệu cập nhật
 * @returns Nhà cung cấp đã cập nhật
 */
export const updateSupplier = async (
    supplierId: string,
    data: UpdateSupplierData
): Promise<SupplierResponse> => {
    if (!supplierId) {
        throw new Error("Thiếu supplierId khi cập nhật nhà cung cấp");
    }

    const response = await apiClient.put<SupplierResponse>(
        `/suppliers/${supplierId}`,
        data
    );
    return response.data;
};

/**
 * Xóa nhà cung cấp (soft delete)
 * @param supplierId - ID của nhà cung cấp
 * @returns Thông tin xóa thành công
 */
export const deleteSupplier = async (supplierId: string): Promise<DeleteSupplierResponse> => {
    if (!supplierId) {
        throw new Error("Thiếu supplierId khi xóa nhà cung cấp");
    }

    const response = await apiClient.delete<DeleteSupplierResponse>(`/suppliers/${supplierId}`);
    return response.data;
};

export default {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
};