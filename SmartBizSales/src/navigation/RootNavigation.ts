// src/navigation/RootNavigation.ts
import {
    CommonActions,
    StackActions,
    createNavigationContainerRef,
    type NavigationContainerRef,
    type ParamListBase,
    type Route,
} from "@react-navigation/native";

/**
 * Root Stack Param List
 * - Khai báo đầy đủ các screen name đang dùng.
 * - Thêm các screen mới để xử lý thanh toán in-app + success/cancel callback.
 */
export type RootStackParamList = {
    // Auth / core
    Login: undefined;
    Dashboard: undefined;
    SelectStore: undefined;

    // Products
    ProductList: undefined;
    ProductDetail: { productId: string };

    // Orders
    OrderList: undefined;
    OrderDetail: { orderId: string };

    // Customers
    CustomerList: undefined;
    CustomerDetail: { customerId: string };

    // Settings root (nếu bạn có nested navigator thì giữ nguyên)
    Settings: undefined;

    // Subscription (Drawer screen names bạn đã đưa)
    Subscription: undefined;
    SubscriptionPricing: undefined;

    // In-app payment flow screens (nên ở Root Stack, không cần nằm trong Drawer menu)
    PaymentWebView: { checkoutUrl: string };

    // Deep-link callbacks
    SubscriptionSuccess: { orderCode?: string | null; status?: string | null } | undefined;
    SubscriptionCancel: { orderCode?: string | null } | undefined;

    /**
     * Fallback cho các screen khác (giữ tương thích ngược như file bạn đang làm).
     * Nếu muốn strict 100% thì nên xoá index signature này và khai báo tường minh.
     */
    [key: string]: object | undefined;
};

// Create navigation ref with typing [web:1251]
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let isNavigationReady = false;

export const setNavigationReady = () => {
    isNavigationReady = true;
};

const isReady = () => navigationRef.isReady() && isNavigationReady;

type NavigateFn = <K extends keyof RootStackParamList>(
    name: K,
    params?: RootStackParamList[K],
    maxRetries?: number
) => boolean;

type ResetFn = <K extends keyof RootStackParamList>(
    name: K,
    params?: RootStackParamList[K]
) => void;

type ReplaceFn = <K extends keyof RootStackParamList>(
    name: K,
    params?: RootStackParamList[K]
) => void;

type GetCurrentRouteFn = () => Route<string> | undefined | null;

export const NavigationService: {
    navigate: NavigateFn;
    goBack: () => void;
    reset: ResetFn;
    replace: ReplaceFn;
    popToTop: () => void;
    canGoBack: () => boolean;
    isReady: () => boolean;
    getCurrentRoute: GetCurrentRouteFn;

    /**
     * Optional: parse deep link url -> route (useful nếu bạn muốn tự handle
     * một số url bên ngoài, còn bình thường để NavigationContainer linking tự xử lý). [web:1199]
     */
    handleDeepLinkUrl: (url: string) => boolean;
} = {
    navigate: (name, params, maxRetries = 10) => {
        const attemptNavigation = (retryCount = 0): boolean => {
            if (isReady()) {
                // navigate typed - đôi khi createNavigationContainerRef inference bị any ở 1 số version [web:1254]
                (navigationRef.navigate as any)(name as string, params);
                return true;
            }

            if (retryCount < maxRetries) {
                setTimeout(() => attemptNavigation(retryCount + 1), 200 * (retryCount + 1));
                return false;
            }

            return false;
        };

        return attemptNavigation();
    },

    goBack: () => {
        if (navigationRef.isReady() && navigationRef.canGoBack()) {
            navigationRef.goBack();
        }
    },

    reset: (name, params) => {
        if (!navigationRef.isReady()) return;

        navigationRef.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: name as string, params: params as any }],
            })
        );
    },

    replace: (name, params) => {
        if (!navigationRef.isReady()) return;

        // StackActions.replace signature: replace(name, params) [web:1264]
        navigationRef.dispatch(StackActions.replace(name as string, params as any));
    },

    popToTop: () => {
        if (navigationRef.isReady()) {
            navigationRef.dispatch(StackActions.popToTop());
        }
    },

    canGoBack: () => navigationRef.isReady() && navigationRef.canGoBack(),

    isReady,

    getCurrentRoute: () => {
        if (!navigationRef.isReady()) return null;
        return navigationRef.getCurrentRoute();
    },

    handleDeepLinkUrl: (url: string) => {
        // Các deep link bạn đang dùng:
        // posapp://subscription/success?orderCode=...&status=...
        // posapp://subscription/cancel?orderCode=...
        // (Phần scheme được khai ở app.json; parse ở đây để fallback) [web:1221]
        try {
            const normalized = String(url || "");
            if (!normalized) return false;

            const u = new URL(normalized);
            const path = (u.host ? `/${u.host}` : "") + (u.pathname || "");
            const orderCode = u.searchParams.get("orderCode");
            const status = u.searchParams.get("status");

            if (path.includes("/subscription/success")) {
                return NavigationService.navigate("SubscriptionSuccess", { orderCode, status });
            }

            if (path.includes("/subscription/cancel")) {
                return NavigationService.navigate("SubscriptionCancel", { orderCode });
            }

            return false;
        } catch {
            return false;
        }
    },
};

// Legacy exports (giữ tương thích)
export function navigate<K extends keyof RootStackParamList>(
    name: K,
    params?: RootStackParamList[K]
) {
    return NavigationService.navigate(name, params, 10);
}

export function goBack() {
    NavigationService.goBack();
}
