// src/type/supplier.ts

export type MongoId = string;

// Nếu backend đôi lúc trả Extended JSON (ví dụ: { $oid: "..." }) thì dùng type này
export type MongoIdLike = MongoId | { $oid: MongoId };

// Nếu backend đôi lúc trả Extended JSON cho date (ví dụ: { $date: "..." }) thì dùng type này
export type MongoDateLike = string | Date | { $date: string };

export type SupplierStatus = "đang hoạt động" | "ngừng hoạt động";

// Store populate khi lấy chi tiết
export interface StoreInfo {
    _id: MongoId;
    name?: string;
    address?: string;
    phone?: string;
    owner_id?: MongoId;
}

// Model Supplier dùng trong app
export interface Supplier {
    _id: MongoId; // nên là string sau normalize ở FE/BE
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxcode?: string;
    notes?: string;
    status?: SupplierStatus;
    store_id?: MongoId; // trong list API thường là store_id ObjectId
    store?: StoreInfo;  // trong getSupplierById API bạn đang trả "store: supplier.store_id" (populate)
    isDeleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface SuppliersResponse {
    message: string;
    total: number;
    suppliers: Supplier[];
}

export interface SupplierResponse {
    message: string;
    supplier: Supplier;
}

export interface CreateSupplierData {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxcode?: string;
    notes?: string;
    status?: SupplierStatus;
}

export interface UpdateSupplierData {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxcode?: string;
    notes?: string;
    status?: SupplierStatus;
    isDeleted?: boolean;
}

export interface DeleteSupplierResponse {
    message: string;
    supplier?: Supplier;
}

export interface RestoreSupplierResponse {
    message: string;
    supplier?: Supplier;
}

export type ExportSuppliersResponse = Blob;

// Options cho getSuppliers
export interface GetSuppliersOptions {
    deleted?: boolean; // true: lấy đã xóa, false: lấy active, undefined: lấy tất cả (nếu backend hỗ trợ)
}
export interface GetSuppliersParams extends GetSuppliersOptions {
    storeId?: string;
    search?: string; // tìm theo tên, phone, email, address
    status?: SupplierStatus;
    page?: number;
    limit?: number;
    sortBy?: string; // ví dụ: "name", "createdAt"
    sortOrder?: "asc" | "desc";
}
