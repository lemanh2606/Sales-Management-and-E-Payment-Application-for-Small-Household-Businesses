// src/api/orderApi.ts
// API xử lý đơn hàng (Orders): tạo, thanh toán, in hóa đơn, thống kê và hoàn tiền
import apiClient from "./apiClient";

// File upload dùng chung Web (File) + React Native (uri/name/type)
export type UploadFileLike =
    | File
    | {
        uri: string;
        name: string;
        type?: string;
    };

type WithStoreId = { storeId?: string };

// ===================== ORDER CORE =====================

// Tạo mới một đơn hàng (cash hoặc QR)
export const createOrder = async (data: any) => (await apiClient.post("/orders", data)).data;

// Xác nhận đã thanh toán tiền mặt cho đơn hàng
export const setPaidCash = async (orderId: string) =>
    (await apiClient.post(`/orders/${orderId}/set-paid-cash`)).data;

// In hóa đơn và trừ kho hàng sau khi đã thanh toán
export const printBill = async (orderId: string, { storeId }: WithStoreId = {}) =>
    (
        await apiClient.post(
            `/orders/${orderId}/print-bill`,
            storeId ? { storeId } : {},
            storeId ? { params: { storeId } } : undefined
        )
    ).data;

// Lấy thông tin chi tiết một đơn hàng theo ID (tùy chọn truyền storeId để vượt middleware store)
export const getOrderById = async (orderId: string, { storeId }: WithStoreId = {}) =>
    (
        await apiClient.get(`/orders/${orderId}`, {
            params: storeId ? { storeId } : undefined,
        })
    ).data;

// ===================== VIETQR CALLBACK =====================

// Callback khi khách hàng quét QR và thanh toán thành công
export const vietqrReturn = async (params: any) =>
    (await apiClient.get("/orders/payments/vietqr_return", { params })).data;

// Callback khi khách hàng hủy thanh toán QR
export const vietqrCancel = async (params: any) =>
    (await apiClient.get("/orders/payments/vietqr_cancel", { params })).data;

// ===================== REFUND =====================

// Hoàn tiền cho đơn hàng (kèm file minh chứng nếu có)
export const refundOrder = async (orderId: string, formData: FormData) =>
    (
        await apiClient.post(`/orders/${orderId}/refund`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        })
    ).data;

// ===================== STATISTICS =====================

export const getTopSellingProducts = async () => (await apiClient.get("/orders/top-products")).data;

export const exportTopSellingProducts = async () =>
    (await apiClient.get("/orders/top-products/export", { responseType: "blob" })).data;

export const getTopFrequentCustomers = async () => (await apiClient.get("/orders/top-customers")).data;

// ===================== RECONCILIATION =====================

export const getPaidNotPrintedOrders = async (params: any) =>
    (await apiClient.get("/orders/reconciliation/paid-not-printed", { params })).data;

export const verifyInvoiceWithPdf = async ({
    orderId,
    storeId,
    file,
}: {
    orderId: string;
    storeId?: string;
    file: UploadFileLike;
}) => {
    const formData = new FormData();
    if (storeId) formData.append("storeId", storeId);

    // Backend đang nhận field "invoice"
    formData.append("invoice", file as any);

    return (
        await apiClient.post(`/orders/${orderId}/reconciliation/verify-invoice`, formData, {
            params: storeId ? { storeId } : undefined,
            headers: { "Content-Type": "multipart/form-data" },
        })
    ).data;
};

export const verifyInvoiceAuto = async ({
    storeId,
    file,
}: {
    storeId?: string;
    file: UploadFileLike;
}) => {
    const formData = new FormData();
    if (storeId) formData.append("storeId", storeId);

    // Backend đang nhận field "invoice"
    formData.append("invoice", file as any);

    return (
        await apiClient.post("/orders/reconciliation/verify-invoice/auto", formData, {
            params: storeId ? { storeId } : undefined,
            headers: { "Content-Type": "multipart/form-data" },
        })
    ).data;
};

// ===================== EXPORT DEFAULT =====================
export default {
    createOrder,
    setPaidCash,
    printBill,
    getOrderById,
    getPaidNotPrintedOrders,
    verifyInvoiceWithPdf,
    verifyInvoiceAuto,
    vietqrReturn,
    vietqrCancel,
    exportTopSellingProducts,
    getTopFrequentCustomers,
    deletePendingOrder: async (orderId: string, storeId?: string) => 
        (await apiClient.delete(`/orders/delete-pending/${orderId}`, { params: { storeId } })).data,
};
