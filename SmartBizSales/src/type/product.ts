// src/types/product.ts
import { ObjectId } from "mongodb";
import { SupplierRef } from './supplier';

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

export interface ProductGroupRef {
    _id: ObjectId | string;
    name?: string;
}

// --------------------- PRODUCT ---------------------
export type ProductStatus = "Đang kinh doanh" | "Ngừng kinh doanh" | "Ngừng bán";

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
    store_id: ObjectId | string;
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
    error: any;
    success: ProductImportResultRow[];
    failed: ProductImportResultRow[];
    total: number;
}

// --------------------- SEARCH & FILTER ---------------------
export interface SearchProduct {
    _id: string;
    name: string;
    sku: string;
    price: number;
    stock_quantity: number;
    unit?: string;
}

export interface SearchResponse {
    message: string;
    products: SearchProduct[];
}

export interface LowStockProduct {
    _id: string;
    name: string;
    sku: string;
    stock_quantity: number;
    min_stock: number;
    unit?: string;
}

export interface LowStockResponse {
    message: string;
    products: LowStockProduct[];
}

// --------------------- CREATE/UPDATE DATA ---------------------
export interface CreateProductData {
    name: string;
    description?: string;
    sku?: string;
    price: number;
    cost_price: number;
    stock_quantity?: number;
    min_stock?: number;
    max_stock?: number | null;
    unit?: string;
    status?: ProductStatus;
    supplier_id?: string | null;
    group_id?: string | null;
    image?: string;
    store_id: string;
}

export interface UpdateProductData {
    name?: string;
    description?: string;
    sku?: string;
    price?: number;
    cost_price?: number;
    stock_quantity?: number;
    min_stock?: number;
    max_stock?: number | null;
    unit?: string;
    status?: ProductStatus;
    supplier_id?: string | null;
    group_id?: string | null;
    image?: string;
}

// --------------------- RESPONSE TYPES ---------------------
export interface ProductResponse {
    message: string;
    product: Product;
}

export interface ProductsResponse {
    productGroups: never[];
    message: string;
    total: number;
    products: Product[];
}

export interface DeleteResponse {
    message: string;
    deletedProductId: string;
}

// export interface ImportResponse {
//     data: any;
//     importedCount: undefined;
//     message: string;
//     results: ProductImportResult;
// }

export type ImportResponse = {
    message: string;
    data: any;
    importedCount: undefined;
    results: {
        success: Array<{ row: number; product: { _id: string; name: string; sku: string } }>;
        failed: Array<any>;
        total: number;
        errors: any
    };
};

export type ImportFile = {
    uri: string; // required
    name?: string;
    mimeType?: string; // optional, DocumentPicker may provide mimeType
    size?: number;
};