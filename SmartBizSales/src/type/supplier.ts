// src/types/supplier.ts
export interface Supplier {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxcode?: string;
    notes?: string;
    status: 'đang hoạt động' | 'ngừng hoạt động';
    store_id: string;
    isDeleted: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface SupplierRef {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
}

export interface CreateSupplierData {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxcode?: string;
    notes?: string;
    status?: 'đang hoạt động' | 'ngừng hoạt động';
}

export interface UpdateSupplierData {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxcode?: string;
    notes?: string;
    status?: 'đang hoạt động' | 'ngừng hoạt động';
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

export interface DeleteSupplierResponse {
    message: string;
    deletedSupplierId: string;
}