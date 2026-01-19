// src/api/financialApi.ts
import apiClient from "./apiClient";

export interface FinancialData {
  totalRevenue: number;
  grossProfit: number;
  netProfit: number;
  operatingCost: number;
  totalVAT: number;
  totalCOGS: number;
  stockValue: number;
  stockValueAtSalePrice: number;
  periodDisplayText: string;
  revenueChange?: number;
  grossProfitChange?: number;
}

export const getFinancialReport = async (params: {
  storeId: string;
  periodType: string;
  periodKey: string;
}): Promise<FinancialData> => {
  const response = await apiClient.get<any>("/financials", { params });
  return response.data.data;
};

export default {
  getFinancialReport,
};
