// frontend/src/api/subscriptionApi.ts
import apiClient from "./apiClient";

/**
 * Types
 */
export type PlanDuration = 1 | 3 | 6;

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface SubscriptionPlan {
    plan_duration: PlanDuration;
    name?: string;
    price?: number;
    description?: string;
    features?: string[];
}

export interface PendingPayment {
    order_code: string;
    amount: number;
    plan_duration: PlanDuration;
    checkout_url?: string;
    created_at?: string;
    qr_data_url?: string;
}

export interface SubscriptionTrial {
    ends_at: string;
}

export interface SubscriptionPremium {
    plan_duration: PlanDuration;
    started_at: string;
    expires_at: string;
}

export interface CurrentSubscription {
    status: SubscriptionStatus;
    days_remaining?: number;

    expires_at?: string;
    trial_ends_at?: string;

    trial?: SubscriptionTrial;
    premium?: SubscriptionPremium;

    pending_payment?: PendingPayment | null;
}

/**
 * Payment history item
 * (field names giữ giống server đang trả về từ code web bạn gửi)
 */
export interface PaymentHistoryItem {
    plan_duration: PlanDuration;
    amount: number;

    transaction_id: string;
    status?: "SUCCESS" | "PENDING" | "FAILED";

    paid_at?: string | null;
}

export interface UsageStats {
    total_orders: number;
    total_revenue: number;
    total_products: number;
}

/**
 * Request bodies
 */
export interface CreateCheckoutBody {
    plan_duration: PlanDuration;
}

export interface ActivatePremiumBody {
    transaction_id: string;
    plan_duration: PlanDuration;
    amount: number;
}

/**
 * Response wrappers (tùy backend có bọc data hay không).
 * - getPaymentHistory ở code web đang xử lý: historyRes.data.data || historyRes.data
 * nên để union cho an toàn.
 */
export type MaybeWrapped<T> = T | { data: T };

/**
 * API
 */
const subscriptionApi = {
    /**
     * GET /api/subscriptions/plans
     * Lấy danh sách các gói subscription
     */
    getPlans: () => {
        return apiClient.get<SubscriptionPlan[]>("/subscriptions/plans");
    },

    /**
     * GET /api/subscriptions/current
     * Lấy thông tin subscription hiện tại của user
     */
    getCurrentSubscription: () => {
        return apiClient.get<CurrentSubscription | null>("/subscriptions/current");
    },

    /**
     * POST /api/subscriptions/checkout
     * Tạo link thanh toán subscription
     */
    createCheckout: (data: CreateCheckoutBody) => {
        return apiClient.post<PendingPayment>("/subscriptions/checkout", data);
    },

    /**
     * POST /api/subscriptions/activate
     * Kích hoạt premium sau khi thanh toán (webhook internal)
     */
    activatePremium: (data: ActivatePremiumBody) => {
        return apiClient.post<{ success: boolean; message?: string }>(
            "/subscriptions/activate",
            data
        );
    },

    /**
     * POST /api/subscriptions/cancel
     * Hủy auto-renew subscription
     */
    cancelAutoRenew: () => {
        return apiClient.post<{ success: boolean; message?: string }>(
            "/subscriptions/cancel"
        );
    },

    /**
     * GET /api/subscriptions/history
     * Lấy lịch sử thanh toán subscription
     */
    getPaymentHistory: () => {
        // backend có thể trả: { data: PaymentHistoryItem[] } hoặc PaymentHistoryItem[]
        return apiClient.get<MaybeWrapped<PaymentHistoryItem[]>>("/subscriptions/history");
    },

    /**
     * GET /api/subscriptions/usage
     * Lấy thống kê sử dụng (orders, revenue, products)
     */
    getUsageStats: () => {
        return apiClient.get<UsageStats | null>("/subscriptions/usage");
    },

    clearPendingPayment: (orderCode: string | null) => {
        return apiClient.post("/subscriptions/clear-pending", { orderCode });
    },

};

export default subscriptionApi;
