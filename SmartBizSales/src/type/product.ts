
// src/types/product.ts
import { ObjectId } from "mongodb";

// --------------------- IMAGE ---------------------
export interface ProductImage {
    url: string;
    public_id: string;
}

// --------------------- RELATED ENTITIES ---------------------
export interface StoreRef {
    _id: ObjectId | string;
    name?: string;
    owner_id?: ObjectId | string;
}

export interface SupplierRef {
    _id: ObjectId | string;
    name?: string;
}

export interface ProductGroupRef {
    _id: ObjectId | string;
    name?: string;
}

// --------------------- PRODUCT ---------------------
export type ProductStatus = "Đang kinh doanh" | "Ngừng kinh doanh" | "Ngừng bán";
// --------------------- TYPES ---------------------
export interface Product {
    _id: ObjectId | string;
    name: string;
    description?: string;
    sku: string;
    price: number;
    cost_price: number;
    stock_quantity: number;
    min_stock: number;
    max_stock?: number | null;
    unit?: string;
    status: ProductStatus;
    store_id: ObjectId | string; // storeId lưu trong DB
    supplier_id?: ObjectId | string | null;
    group_id?: ObjectId | string | null;
    image?: ProductImage | null;
    lowStockAlerted?: boolean;
    isDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;

    // populated refs
    store?: StoreRef;
    supplier?: SupplierRef;
    group?: ProductGroupRef;
}
export interface PaginatedProducts {
    total: number;
    page: number;
    limit: number;
    products: Product[];
}

export interface PaginationParams {
    page?: number;
    limit?: number;
}

// --------------------- IMPORT/EXPORT RESULT ---------------------
export interface ProductImportResultRow {
    row: number;
    data?: Record<string, any>;
    error?: string;
    product?: Pick<Product, "_id" | "name" | "sku">;
}

export interface ProductImportResult {
    success: ProductImportResultRow[];
    failed: ProductImportResultRow[];
    total: number;
}