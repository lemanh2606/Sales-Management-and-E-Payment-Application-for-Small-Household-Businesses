// src/api/revenueApi.js
// API Báo cáo doanh thu (Revenue Reports)
import apiClient from "./apiClient";

// ===================== READ =====================

// Lấy tổng doanh thu theo khoảng thời gian (ngày/tháng/năm)
export const getRevenueByPeriod = async (storeId, params) =>
  (await apiClient.get(`/revenue`, { params: { storeId, ...params } })).data;

// Lấy doanh thu theo nhân viên
export const getRevenueByEmployee = async (storeId, params) =>
  (await apiClient.get(`/revenue/employee`, { params: { storeId, ...params } }))
    .data;

// ===================== EXPORT =====================

// Xuất báo cáo doanh thu (CSV hoặc PDF)
export const exportRevenue = async (storeId, format = "csv") =>
  (await apiClient.get(`/revenue/export`, { params: { storeId, format } }))
    .data;

// ===================== DEFAULT EXPORT =====================
export default {
  getRevenueByPeriod,
  getRevenueByEmployee,
  exportRevenue,
};
