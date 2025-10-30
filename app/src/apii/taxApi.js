// src/api/taxApi.js
// API quản lý tờ khai thuế (Tax Declaration)

import apiClient from "./apiClient";

// ===================== PREVIEW =====================
// Xem trước tổng doanh thu hệ thống theo kỳ (chưa lưu vào DB)
export const previewSystemRevenue = async (params) =>
  (await apiClient.get("/tax/preview", { params })).data;

// ===================== CREATE =====================
// Tạo tờ khai thuế mới (bản gốc)
export const createTaxDeclaration = async (data) =>
  (await apiClient.post("/tax", data)).data;

// ===================== UPDATE =====================
// Cập nhật khai báo doanh thu
export const updateTaxDeclaration = async (id, data) =>
  (await apiClient.put(`/tax/${id}`, data)).data;

// ===================== CLONE =====================
// Tạo bản sao từ tờ khai cũ
export const cloneTaxDeclaration = async (id) =>
  (await apiClient.post(`/tax/${id}/clone`)).data;

// ===================== DELETE =====================
// Xóa tờ khai (Manager only)
export const deleteTaxDeclaration = async (id) =>
  (await apiClient.delete(`/tax/${id}`)).data;
// ===================== READ =====================
