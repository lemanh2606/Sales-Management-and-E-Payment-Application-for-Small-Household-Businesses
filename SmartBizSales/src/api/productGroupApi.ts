// src/api/productGroupApi.ts
import { PaginationParams } from "../type/product";
import { ProductGroup, ProductGroupResponse, ProductGroupsResponse, DeleteProductGroupResponse, ImportProductGroupsResponse } from "../type/productGroup";
import apiClient from "./apiClient";


// --------------------- PRODUCT GROUP CRUD ---------------------

// CREATE - Tạo nhóm sản phẩm mới trong cửa hàng
export const createProductGroup = async (
    storeId: string,
    data: Partial<ProductGroup>
): Promise<ProductGroupResponse> => {
    const response = await apiClient.post<ProductGroupResponse>(`/product-groups/store/${storeId}`, data);
    return response.data;
};

// READ - Lấy tất cả nhóm sản phẩm của 1 cửa hàng
export const getProductGroupsByStore = async (
    storeId: string,
    params: PaginationParams = {}
): Promise<ProductGroupsResponse> => {
    const response = await apiClient.get<ProductGroupsResponse>(`/product-groups/store/${storeId}`, { params });
    return response.data;
};

// READ - Lấy chi tiết 1 nhóm sản phẩm
export const getProductGroupById = async (groupId: string): Promise<ProductGroupResponse> => {
    const response = await apiClient.get<ProductGroupResponse>(`/product-groups/${groupId}`);
    return response.data;
};

// UPDATE - Cập nhật thông tin nhóm sản phẩm
export const updateProductGroup = async (
    groupId: string,
    data: Partial<ProductGroup>
): Promise<ProductGroupResponse> => {
    const response = await apiClient.put<ProductGroupResponse>(`/product-groups/${groupId}`, data);
    return response.data;
};

// DELETE - Xóa nhóm sản phẩm
export const deleteProductGroup = async (groupId: string): Promise<DeleteProductGroupResponse> => {
    const response = await apiClient.delete<DeleteProductGroupResponse>(`/product-groups/${groupId}`);
    return response.data;
};

// IMPORT - Import nhóm sản phẩm từ file Excel/CSV
export const importProductGroups = async (
    storeId: string,
    file: File
): Promise<ImportProductGroupsResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<ImportProductGroupsResponse>(
        `/product-groups/store/${storeId}/import`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
};

// --------------------- EXPORT ---------------------
export default {
    createProductGroup,
    getProductGroupsByStore,
    getProductGroupById,
    updateProductGroup,
    deleteProductGroup,
    importProductGroups,
};
