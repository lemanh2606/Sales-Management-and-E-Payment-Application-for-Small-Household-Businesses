// src/api/operatingExpenseApi.ts
import apiClient from "./apiClient";

export const getOperatingExpenses = async (params: any): Promise<any> => {
    const response = await apiClient.get("/operating-expenses", { params });
    return response.data;
};

export const getOperatingExpenseByPeriod = async (params: {
  storeId: string;
  periodType: string;
  periodKey: string;
}): Promise<any> => {
  const response = await apiClient.get("/operating-expenses/by-period", { params });
  return response.data;
};

export const createOperatingExpense = async (data: any): Promise<any> => {
    const response = await apiClient.post("/operating-expenses", data);
    return response.data;
};

export const updateOperatingExpense = async (id: string, data: any): Promise<any> => {
  const response = await apiClient.put(`/operating-expenses/${id}`, data);
  return response.data;
};

export const deleteExpenseItem = async (id: string, itemIndex: number): Promise<any> => {
  const response = await apiClient.delete(`/operating-expenses/${id}/item/${itemIndex}`);
  return response.data;
};

export const deleteMultipleExpenseItems = async (id: string, itemIds: string[]): Promise<any> => {
  const response = await apiClient.request({
    url: `/operating-expenses/${id}/items`,
    method: "DELETE",
    data: { itemIds },
  });
  return response.data;
};

export default {
    getOperatingExpenses,
    getOperatingExpenseByPeriod,
    createOperatingExpense,
    updateOperatingExpense,
    deleteExpenseItem,
    deleteMultipleExpenseItems,
};
