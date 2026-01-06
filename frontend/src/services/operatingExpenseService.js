// src/services/operatingExpenseService.js
import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL;

/**
 * Get operating expenses for a specific period
 * @param {object} params - { storeId, periodType, periodKey }
 * @returns {object} { items: [], totalAmount: 0 } or { items: [] } if not found
 */
export const getOperatingExpenseByPeriod = async ({ storeId, periodType, periodKey }) => {
  try {
    if (!storeId || !periodType || !periodKey) {
      return { items: [], totalAmount: 0 };
    }

    const token = localStorage.getItem("token");
    const response = await axios.get(`${apiUrl}/operating-expenses/by-period`, {
      params: { storeId, periodType, periodKey },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    // Success: return data
    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    // Fallback
    return { items: [], totalAmount: 0 };
  } catch (error) {
    // 404 or any error: return empty items
    if (error.response?.status === 404) {
      return { items: [], totalAmount: 0 };
    }

    console.error("getOperatingExpenseByPeriod error:", error.message);
    return { items: [], totalAmount: 0 };
  }
};

/**
 * Create or update operating expenses (upsert)
 * @param {object} params - { storeId, periodType, periodKey, items }
 * @returns {object} created/updated document
 */
export const upsertOperatingExpense = async ({ storeId, periodType, periodKey, items }) => {
  try {
    if (!storeId || !periodType || !periodKey || !Array.isArray(items)) {
      throw new Error("Thiếu dữ liệu: storeId, periodType, periodKey, items");
    }

    const token = localStorage.getItem("token");
    const response = await axios.post(
      `${apiUrl}/operating-expenses`,
      {
        storeId,
        periodType,
        periodKey,
        items: items.map((it) => ({
          amount: Number(it.amount) || 0,
          note: it.note || "",
        })),
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      }
    );

    if (response.data.success) {
      return response.data.data;
    }

    throw new Error(response.data.message || "Lỗi khi lưu chi phí");
  } catch (error) {
    console.error("upsertOperatingExpense error:", error);
    throw error;
  }
};

/**
 * Get total operating expense for a period
 * @param {object} params - { storeId, periodType, periodKey }
 * @returns {number} total amount
 */
export const getOperatingExpenseTotal = async ({ storeId, periodType, periodKey }) => {
  try {
    if (!storeId || !periodType || !periodKey) return 0;

    const token = localStorage.getItem("token");
    const response = await axios.get(`${apiUrl}/operating-expenses/total`, {
      params: { storeId, periodType, periodKey },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    if (response.data.success) {
      return response.data.total || 0;
    }

    return 0;
  } catch (error) {
    console.error("getOperatingExpenseTotal error:", error.message);
    return 0;
  }
};

/**
 * Delete multiple items from operating expense
 * @param {object} params - { id (document _id), itemIds (array of item itemIds) }
 * @returns {object} updated document
 */
export const deleteMultipleItems = async ({ id, itemIds }) => {
  if (!id || !Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error("Thiếu dữ liệu: id hoặc itemIds");
  }

  const token = localStorage.getItem("token");

  const response = await axios.delete(`${apiUrl}/operating-expenses/${id}/items`, {
    data: { itemIds },
    headers: { Authorization: `Bearer ${token}` },
    timeout: 3000,
  });

  if (response.data?.success) return response.data.data;
  throw new Error(response.data?.message || "Lỗi khi xoá các khoản chi phí");
};

export default {
  getOperatingExpenseByPeriod,
  upsertOperatingExpense,
  getOperatingExpenseTotal,
  deleteMultipleItems,
};
