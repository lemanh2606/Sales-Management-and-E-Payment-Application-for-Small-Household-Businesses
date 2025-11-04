/**
 * 📁 File: src/api/index.ts
 * ======================================================
 * 📦 API EXPORT HUB — GOM TẤT CẢ API VỀ MỘT CHỖ
 * ------------------------------------------------------
 * Giúp import dễ dàng ở nơi khác:
 *    import { apiClient, userApi, storeApi } from '@/api';
 * ======================================================
 */

export { default as apiClient } from './apiClient';

// ========== MODULE API EXPORTS ==========
// Tạm thời chỉ giữ 2 module bạn đang dùng
export * as userApi from './userApi';
export * as storeApi from './storeApi';
export * as productApi from './productApi';
export * as productGroupApi from './productGroupApi';

export function getProductGroupsByStore(storeId: string) {
    throw new Error("Function not implemented.");
}

export function getProductsByStore(storeId: string, arg1: { page: number; limit: number; }) {
    throw new Error("Function not implemented.");
}

export function importProducts(storeId: string, arg1: any) {
    throw new Error("Function not implemented.");
}

export function exportProducts(storeId: string) {
    throw new Error("Function not implemented.");
}

export function downloadProductTemplate() {
    throw new Error("Function not implemented.");
}

export function formatPrice(price: number): import("react").ReactNode {
    throw new Error("Function not implemented.");
}

export function isLowStock(item: Product) {
    throw new Error("Function not implemented.");
}
