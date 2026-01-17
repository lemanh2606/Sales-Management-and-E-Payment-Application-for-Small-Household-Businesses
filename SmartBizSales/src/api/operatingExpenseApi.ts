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

export const suggestAllocation = async (params: {
  storeId: string;
  fromPeriodType: string;
  fromPeriodKey: string;
  toPeriodType: string;
}): Promise<any> => {
  const response = await apiClient.get("/operating-expenses/suggest-allocation", { params });
  return response.data;
};

export const executeAllocation = async (data: {
  storeId: string;
  fromPeriodType: string;
  fromPeriodKey: string;
  toPeriodType: string;
  suggestions: any[];
}): Promise<any> => {
  const response = await apiClient.post("/operating-expenses/execute-allocation", data);
  return response.data;
};

export const upsertOperatingExpense = async (data: {
  storeId: string;
  periodType: string;
  periodKey: string;
  items: Array<{ _id?: string; amount: number; note: string; isSaved: boolean }>;
}): Promise<any> => {
  const response = await apiClient.post("/operating-expenses", data);
  return response.data;
};

export default {
    getOperatingExpenses,
    getOperatingExpenseByPeriod,
    createOperatingExpense,
    updateOperatingExpense,
    deleteExpenseItem,
    deleteItemWithCheckbox: deleteMultipleExpenseItems,
    suggestAllocation,
    executeAllocation,
    upsertOperatingExpense,
};
