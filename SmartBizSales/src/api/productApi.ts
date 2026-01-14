// src/api/productApi.ts
import apiClient from "./apiClient";
import {
    PaginatedProducts,
    Product,
    PaginationParams,
    CreateProductData,
    UpdateProductData,
    DeleteResponse,
    LowStockResponse,
    SearchResponse,
    ImportResponse,
    ProductResponse,
    ProductsResponse,
    SearchProduct,
    LowStockProduct
} from "../type/product";

import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { useAuth } from "../context/AuthContext";
// --------------------- PRODUCT CRUD ---------------------

/**
 * Tạo sản phẩm mới trong cửa hàng
 */
export const createProduct = async (
    storeId: string,
    data: CreateProductData
): Promise<ProductResponse> => {
    if (!storeId) {
        throw new Error("Thiếu storeId khi tạo sản phẩm");
    }

    if (!data.name || !data.price || !data.cost_price) {
        throw new Error("Tên sản phẩm, giá bán và giá vốn là bắt buộc");
    }

    const response = await apiClient.post<ProductResponse>(`/products/store/${storeId}`, data);
    return response.data;
};

/**
 * Cập nhật sản phẩm
 */
export const updateProduct = async (
    productId: string,
    data: UpdateProductData
): Promise<ProductResponse> => {
    if (!productId) {
        throw new Error("Thiếu productId khi cập nhật sản phẩm");
    }

    const response = await apiClient.put<ProductResponse>(`/products/${productId}`, data);
    return response.data;
};

/**
 * Xóa sản phẩm (soft delete)
 */
export const deleteProduct = async (productId: string): Promise<DeleteResponse> => {
    if (!productId) {
        throw new Error("Thiếu productId khi xóa sản phẩm");
    }

    const response = await apiClient.delete<DeleteResponse>(`/products/${productId}`);
    return response.data;
};

/**
 * Lấy danh sách sản phẩm theo cửa hàng, phân trang
 */
export const getProductsByStore = async (
    storeId: string,
    { page = 1, limit = 10 }: PaginationParams = {}
): Promise<ProductsResponse> => {
    if (!storeId) {
        throw new Error("Thiếu storeId khi lấy danh sách sản phẩm");
    }

    try {
        const response = await apiClient.get<ProductsResponse>(`/products/store/${storeId}`, {
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
export const getProductById = async (productId: string): Promise<ProductResponse> => {
    if (!productId) {
        throw new Error("Thiếu productId khi lấy chi tiết sản phẩm");
    }

    const response = await apiClient.get<ProductResponse>(`/products/${productId}`);
    return response.data;
};

// --------------------- PRICE MANAGEMENT ---------------------

/**
 * Cập nhật giá bán sản phẩm (chỉ Manager)
 */
export const updateProductPrice = async (
    productId: string,
    price: number
): Promise<ProductResponse> => {
    if (!productId) {
        throw new Error("Thiếu productId khi cập nhật giá sản phẩm");
    }

    if (!price || price < 0) {
        throw new Error("Giá bán phải là số dương");
    }

    const response = await apiClient.put<ProductResponse>(
        `/products/${productId}/price`,
        { price }
    );
    return response.data;
};

/**
 * Cập nhật thông tin lô hàng (Batch)
 */
export const updateProductBatch = async (
    productId: string,
    batchIndex: number,
    data: {
        batch_no?: string;
        old_batch_no?: string;
        expiry_date?: string | null;
        quantity?: number;
        cost_price?: number;
        selling_price?: number;
        warehouse_id?: string;
        deliverer_name?: string;
        deliverer_phone?: string;
        receiver_name?: string;
        receiver_phone?: string;
        note?: string;
    }
): Promise<any> => {
    if (!productId) {
        throw new Error("Thiếu productId khi cập nhật lô hàng");
    }

    const response = await apiClient.put<any>(
        `/products/${productId}/batch`,
        { batchIndex, ...data }
    );
    return response.data;
};

// --------------------- SEARCH & FILTER ---------------------

/**
 * Tìm kiếm sản phẩm theo tên hoặc SKU
 */
export const searchProducts = async (
    query: string,
    storeId: string,
    limit: number = 10
): Promise<SearchResponse> => {
    if (!query || query.trim().length === 0) {
        throw new Error("Query tìm kiếm không được để trống");
    }

    if (!storeId) {
        throw new Error("Thiếu storeId khi tìm kiếm sản phẩm");
    }

    const response = await apiClient.get<SearchResponse>("/products/search", {
        params: {
            query: query.trim(),
            storeId,
            limit
        },
    });
    return response.data;
};

/**
 * Lấy danh sách sản phẩm tồn kho thấp
 */
export const getLowStockProducts = async (storeId?: string): Promise<LowStockResponse> => {
    const response = await apiClient.get<LowStockResponse>("/products/low-stock", {
        params: storeId ? { storeId } : {},
    });
    return response.data;
};

// --------------------- IMAGE MANAGEMENT ---------------------

/**
 * Xóa ảnh sản phẩm (chỉ Manager)
 */
export const deleteProductImage = async (productId: string): Promise<DeleteResponse> => {
    if (!productId) {
        throw new Error("Thiếu productId khi xóa ảnh sản phẩm");
    }

    const response = await apiClient.delete<DeleteResponse>(`/products/${productId}/image`);
    return response.data;
};

/**
 * Upload ảnh sản phẩm
 */
export const uploadProductImage = async (
    productId: string,
    imageFile: File
): Promise<ProductResponse> => {
    if (!productId) {
        throw new Error("Thiếu productId khi upload ảnh");
    }

    if (!imageFile) {
        throw new Error("Vui lòng chọn file ảnh");
    }

    const formData = new FormData();
    formData.append("image", imageFile);

    const response = await apiClient.put<ProductResponse>(
        `/products/${productId}`,
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );
    return response.data;
};

// --------------------- IMPORT/EXPORT ---------------------

/**
 * Import sản phẩm từ file Excel/CSV
 */
/**
 * Import sản phẩm từ file Excel/CSV - Using Expo File class
 */
export const importProducts = async (
    storeId: string,
    file: { uri: string; name?: string; type?: string }
): Promise<ImportResponse> => {
    if (!storeId) throw new Error("Thiếu storeId khi import sản phẩm");
    if (!file?.uri) throw new Error("Vui lòng chọn file để import");

    const formData = new FormData();
    formData.append("file", {
        uri: file.uri,
        name: file.name || "products_import.xlsx",
        type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as any);

    const { data } = await apiClient.post<ImportResponse>(
        `/products/store/${storeId}/import`,
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
            timeout: 120000, // Tăng timeout lên 2 phút
        }
    );

    return data;
};

/**
 * Download template import sản phẩm
 */
export const downloadProductTemplate = async (): Promise<Blob> => {
    try {
        const response = await apiClient.get("/products/template/download", {
            responseType: "blob",
        });

        // Kiểm tra nếu response là lỗi
        if (response.data instanceof Blob && response.data.type === 'application/json') {
            const errorText = await response.data.text();
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.message || 'Download template failed');
            } catch {
                throw new Error(errorText || 'Download template failed');
            }
        }

        if (response.data instanceof Blob) {
            console.log('✅ downloadProductTemplate API response Blob:', response.data);
            return response.data;
        }

        // Fallback cho các trường hợp khác
        return new Blob([response.data as any], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    } catch (error: any) {
        console.error('❌ Lỗi downloadProductTemplate API:', error);
        throw error;
    }
};

/**
 * Export sản phẩm
 */
export const exportProducts = async (storeId: string): Promise<Blob> => {
    if (!storeId) {
        throw new Error("Thiếu storeId khi export sản phẩm");
    }

    try {
        const response = await apiClient.get(`/products/store/${storeId}/export`, {
            responseType: "blob",
        });

        // Kiểm tra nếu response là lỗi
        if (response.data instanceof Blob && response.data.type === 'application/json') {
            const errorText = await response.data.text();
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.message || 'Export failed');
            } catch {
                throw new Error(errorText || 'Export failed');
            }
        }

        if (response.data instanceof Blob) {
            console.log('✅ exportProducts API response Blob:', response.data);
            return response.data;
        }

        // Fallback cho các trường hợp khác
        return new Blob([response.data as any], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    } catch (error: any) {
        console.error('❌ Lỗi exportProducts API:', error);
        throw error;
    }
};

// --------------------- PRODUCT GROUPS ---------------------

/**
 * Lấy danh sách nhóm sản phẩm theo cửa hàng
 */
export const getProductGroupsByStore = async (storeId: string): Promise<{ productGroups: any[] }> => {
    if (!storeId) {
        throw new Error("Thiếu storeId khi lấy danh sách nhóm sản phẩm");
    }

    try {
        const response = await apiClient.get<{ productGroups: any[] }>(`/product-groups/store/${storeId}`);
        return response.data;
    } catch (error) {
        console.error("❌ Lỗi khi lấy nhóm sản phẩm:", error);
        // Fallback: trả về mảng rỗng nếu API chưa có
        return { productGroups: [] };
    }
};

// --------------------- BULK OPERATIONS ---------------------

/**
 * Cập nhật nhiều sản phẩm cùng lúc
 */
export const bulkUpdateProducts = async (
    productIds: string[],
    data: Partial<UpdateProductData>
): Promise<{ message: string; updatedCount: number }> => {
    if (!productIds || productIds.length === 0) {
        throw new Error("Thiếu productIds khi cập nhật hàng loạt");
    }

    const response = await apiClient.patch<{ message: string; updatedCount: number }>(
        "/products/bulk-update",
        { productIds, data }
    );
    return response.data;
};

/**
 * Xóa nhiều sản phẩm cùng lúc
 */
export const bulkDeleteProducts = async (
    productIds: string[]
): Promise<{ message: string; deletedCount: number }> => {
    if (!productIds || productIds.length === 0) {
        throw new Error("Thiếu productIds khi xóa hàng loạt");
    }

    const response = await apiClient.post<{ message: string; deletedCount: number }>(
        "/products/bulk-delete",
        { productIds }
    );
    return response.data;
};

// --------------------- UTILITY FUNCTIONS ---------------------

/**
 * Format giá tiền
 */
export const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
};

/**
 * Kiểm tra sản phẩm có tồn kho thấp không
 */
export const isLowStock = (product: Product): boolean => {
    return product.stock_quantity <= product.min_stock && product.min_stock > 0;
};

/**
 * Lấy trạng thái tồn kho
 */
export const getStockStatus = (product: Product): string => {
    if (product.stock_quantity === 0) {
        return "Hết hàng";
    } else if (isLowStock(product)) {
        return "Tồn kho thấp";
    } else if (product.max_stock && product.stock_quantity >= product.max_stock) {
        return "Tồn kho cao";
    } else {
        return "Bình thường";
    }
};

/**
 * Chuyển đổi Blob sang Base64 (cho React Native)
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
/**
 * Tải file từ Blob (hỗ trợ cả Web và React Native)
 */
export const downloadBlobAsFile = async (
    blob: Blob,
    filename: string,
    onSuccess?: () => void,
    onError?: (error: any) => void
): Promise<void> => {
    try {
        if (typeof document !== 'undefined') {
            // Môi trường web
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            onSuccess?.();
        } else {
            // Môi trường React Native - import động
            const { FileSystem }: any = await import('expo-file-system');
            const Sharing = await import('expo-sharing');

            const fileUri = `${FileSystem.documentDirectory}${filename}`;
            const base64 = await blobToBase64(blob);

            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Tải file',
                    UTI: 'com.microsoft.excel.xlsx'
                });
            }
            onSuccess?.();
        }
    } catch (error) {
        console.error('❌ Lỗi download file:', error);
        onError?.(error);
        throw error;
    }
};

// --------------------- EXPORT ---------------------
export default {
    // CRUD
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsByStore,
    getProductById,

    // Price Management
    updateProductPrice,

    // Search & Filter
    searchProducts,
    getLowStockProducts,

    // Image Management
    deleteProductImage,
    uploadProductImage,

    // Import/Export
    importProducts,
    downloadProductTemplate,
    exportProducts,

    // Product Groups
    getProductGroupsByStore,

    // Bulk Operations
    bulkUpdateProducts,
    bulkDeleteProducts,

    // Utility Functions
    formatPrice,
    isLowStock,
    getStockStatus,
    blobToBase64,
    downloadBlobAsFile,
};