// src/api/productApi.ts
import apiClient from "./apiClient";
import { PaginatedProducts, Product } from "../type/product";
import { PaginationParams } from "../type/product";




// --------------------- PRODUCT CRUD ---------------------

/**
 * Tạo sản phẩm mới trong cửa hàng
 */
export const createProduct = async (
    storeId: string,
    data: Partial<Product>
): Promise<Product> => {
    const response = await apiClient.post<Product>(`/products/store/${storeId}`, data);
    return response.data;
};

/**
 * Cập nhật sản phẩm
 */
export const updateProduct = async (
    productId: string,
    data: Partial<Product>
): Promise<Product> => {
    const response = await apiClient.put<Product>(`/products/${productId}`, data);
    return response.data;
};

/**
 * Xóa sản phẩm
 */
export const deleteProduct = async (productId: string): Promise<{ message?: string }> => {
    const response = await apiClient.delete<{ message?: string }>(`/products/${productId}`);
    return response.data;
};

/**
 * Lấy danh sách sản phẩm theo cửa hàng, phân trang
 */
export const getProductsByStore = async (
    storeId: string,
    { page = 1, limit = 10 }: PaginationParams = {}
): Promise<PaginatedProducts> => {
    try {
        const response = await apiClient.get<PaginatedProducts>(`/products/store/${storeId}`, {
            params: { page, limit },
        });
        return response.data;
    } catch (error) {
        console.error("❌ Lỗi khi lấy sản phẩm:", error);
        throw error;
    }
};

/**
 * Lấy chi tiết 1 sản phẩm
 */
export const getProductById = async (productId: string): Promise<Product> => {
    const response = await apiClient.get<Product>(`/products/${productId}`);
    return response.data;
};

// --------------------- EXPORT ---------------------
export default {
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsByStore,
    getProductById,
};
