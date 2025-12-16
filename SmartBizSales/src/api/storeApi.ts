// src/api/storeApi.ts
/**
 * Typed Store API - sử dụng generic cho axios để tránh `unknown` và để TS hiểu rõ kiểu trả về
 */

import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    Store,
    StoreCreateDto,
    StoreUpdateDto,
    StoresListResponse,
    Employee,
    EmployeeCreateDto,
    EmployeeUpdateDto,
    GenericResponse,
} from '../type/store';

const LOCAL_STORE_KEY = 'currentStore';

/* =========================
   STORE CRUD
   ========================= */

export const createStore = async (
    data: StoreCreateDto
): Promise<GenericResponse & { store?: Store }> => {
    const res = await apiClient.post<GenericResponse & { store?: Store }>(
        '/stores',
        data
    );
    return res.data;
};

export const getStoresByManager = async (
    params?: Record<string, any>
): Promise<StoresListResponse> => {
    const res = await apiClient.get<StoresListResponse>('/stores', { params });
    return res.data;
};

export const getStoreById = async (storeId: string): Promise<{ store: Store }> => {
    const res = await apiClient.get<{ store: Store }>(`/stores/${storeId}`);
    return res.data;
};

export const updateStore = async (
    storeId: string,
    data: StoreUpdateDto
): Promise<GenericResponse & { store?: Store }> => {
    const res = await apiClient.put<GenericResponse & { store?: Store }>(
        `/stores/${storeId}`,
        data
    );
    return res.data;
};

export const deleteStore = async (
    storeId: string
): Promise<GenericResponse & { store?: Store }> => {
    const res = await apiClient.delete<GenericResponse & { store?: Store }>(
        `/stores/${storeId}`
    );
    return res.data;
};

/* =========================
   SELECT / DASHBOARD
   ========================= */

export const ensureStore = async (): Promise<any> => {
    // backend có thể trả nhiều shape => giữ any hoặc định nghĩa union nếu rõ shape
    const res = await apiClient.post<any>('/stores/ensure-store');
    return res.data;
};

export const selectStore = async (
    storeId: string
): Promise<GenericResponse & { store?: Store }> => {
    const res = await apiClient.post<GenericResponse & { store?: Store }>(
        `/stores/select/${storeId}`
    );
    return res.data;
};

export const setLocalCurrentStore = async (store: Store | null): Promise<void> => {
    try {
        if (store === null) await AsyncStorage.removeItem(LOCAL_STORE_KEY);
        else await AsyncStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
    } catch (e) {
        console.warn('setLocalCurrentStore failed', (e as Error)?.message || e);
    }
};

export const getLocalCurrentStore = async (): Promise<Store | null> => {
    try {
        const s = await AsyncStorage.getItem(LOCAL_STORE_KEY);
        return s ? (JSON.parse(s) as Store) : null;
    } catch (e) {
        console.warn('getLocalCurrentStore failed', (e as Error)?.message || e);
        return null;
    }
};

export const getStoreDashboard = async (storeId: string, params?: Record<string, any>): Promise<{ data: any }> => {
    const res = await apiClient.get<{ data: any }>(`/stores/${storeId}/dashboard`, { params });
    return res.data;
};

/* =========================
   STAFF / EMPLOYEE
   ========================= */

export const assignStaffToStore = async (
    storeId: string,
    staffUserId: string,
    role: 'STAFF' | 'OWNER' = 'STAFF'
): Promise<GenericResponse & { staffId?: string }> => {
    const res = await apiClient.post<GenericResponse & { staffId?: string }>(
        `/stores/${storeId}/assign-staff`,
        { staffUserId, role }
    );
    return res.data;
};

export const createEmployee = async (
    storeId: string,
    data: EmployeeCreateDto
): Promise<GenericResponse & { user?: any; employee?: Employee }> => {
    const res = await apiClient.post<GenericResponse & { user?: any; employee?: Employee }>(
        `/stores/${storeId}/employees`,
        data
    );
    return res.data;
};

export const getEmployeesByStore = async (
    storeId: string,
    params?: Record<string, any>
): Promise<GenericResponse & { employees?: Employee[] }> => {
    const res = await apiClient.get<GenericResponse & { employees?: Employee[] }>(
        `/stores/${storeId}/employees`,
        { params }
    );
    return res.data;
};

export const getEmployeeById = async (
    storeId: string,
    employeeId: string
): Promise<GenericResponse & { employee?: Employee }> => {
    const res = await apiClient.get<GenericResponse & { employee?: Employee }>(
        `/stores/${storeId}/employees/${employeeId}`
    );
    return res.data;
};

export const updateEmployee = async (
    storeId: string,
    employeeId: string,
    data: EmployeeUpdateDto
): Promise<GenericResponse & { employee?: Employee }> => {
    const res = await apiClient.put<GenericResponse & { employee?: Employee }>(
        `/stores/${storeId}/employees/${employeeId}`,
        data
    );
    return res.data;
};

export const deleteEmployee = async (storeId: string, employeeId: string): Promise<GenericResponse> => {
    const res = await apiClient.delete<GenericResponse>(`/stores/${storeId}/employees/${employeeId}`);
    return res.data;
};

/* =========================
   Default export
   ========================= */
export default {
    createStore,
    getStoresByManager,
    getStoreById,
    updateStore,
    deleteStore,
    ensureStore,
    selectStore,
    getStoreDashboard,
    assignStaffToStore,
    createEmployee,
    getEmployeesByStore,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    setLocalCurrentStore,
    getLocalCurrentStore,
};
