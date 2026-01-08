// src/api/purchaseApi.ts
import apiClient from "./apiClient";

export const getPurchaseOrders = async (storeId: string): Promise<any> => {
    const response = await apiClient.get(`/stores/${storeId}/purchase-orders`);
    return response.data;
};

export const getPurchaseReturns = async (storeId: string): Promise<any> => {
    const response = await apiClient.get(`/stores/${storeId}/purchase-returns`);
    return response.data;
};

export default {
    getPurchaseOrders,
    getPurchaseReturns,
};
