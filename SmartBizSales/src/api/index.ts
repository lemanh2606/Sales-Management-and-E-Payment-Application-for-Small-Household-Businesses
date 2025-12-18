/**
 *  File: src/api/index.ts
 * ======================================================
 *  API EXPORT HUB — GOM TẤT CẢ API VỀ MỘT CHỖ
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
export * as exportApi from './exportApi';
export * as orderApi from './orderApi';
export * as customerApi from './customerApi';


