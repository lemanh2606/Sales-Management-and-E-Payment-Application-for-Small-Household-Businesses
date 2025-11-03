
import { Types } from "mongoose";

export interface Store {
    _id: Types.ObjectId | string;
    name: string;
    address?: string;
    phone?: string;
}
// --------------------- TYPES ---------------------
export interface ProductGroup {
    _id: Types.ObjectId | string;
    name: string;
    description?: string;
    storeId: Types.ObjectId | string; // tham chiếu gốc đến Store
    store?: Store; // populated store info
    productCount?: number; // số lượng sản phẩm trong nhóm
    isDeleted?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface PaginatedProductGroups {
    total: number;
    page: number;
    limit: number;
    groups: ProductGroup[];
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    [key: string]: any; // optional filter params
}

// Response dạng danh sách nhóm sản phẩm
export interface ProductGroupsResponse {
    message: string;
    total: number;
    productGroups: ProductGroup[];
}

// Response khi thao tác với 1 nhóm sản phẩm
export interface ProductGroupResponse {
    message: string;
    productGroup: ProductGroup;
}

// Response khi xóa nhóm sản phẩm
export interface DeleteProductGroupResponse {
    message: string;
    deletedGroupId: string;
}

// Import Excel/CSV
export interface ImportResultRow {
    row: number;
    data?: Record<string, any>;
    group?: { _id: string; name: string };
    error?: string;
}

export interface ImportProductGroupsResponse {
    message: string;
    results: {
        success: ImportResultRow[];
        failed: ImportResultRow[];
        total: number;
    };
}

