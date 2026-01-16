// src/api/stockApi.ts
import apiClient from "./apiClient";

export const getStockChecks = async (storeId: string): Promise<any> => {
    const response = await apiClient.get(`/stores/${storeId}/stock-checks`);
    return response.data;
};

export const getStockDisposals = async (storeId: string): Promise<any> => {
    const response = await apiClient.get(`/stores/${storeId}/stock-disposals`);
    return response.data;
};

export default {
    getStockChecks,
    getStockDisposals,
};
