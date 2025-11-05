// src/navigation/RootNavigation.ts
import { createNavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';

// Định nghĩa type cho Root Stack Param List
export type RootStackParamList = {
    Login: undefined;
    Dashboard: undefined;
    SelectStore: undefined;
    ProductList: undefined;
    ProductDetail: { productId: string };
    OrderList: undefined;
    OrderDetail: { orderId: string };
    CustomerList: undefined;
    CustomerDetail: { customerId: string };
    Settings: undefined;
    [key: string]: object | undefined;
};

// Tạo navigation ref với type safety
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// State để theo dõi navigation ready
let isNavigationReady = false;

// Hàm để đánh dấu navigation đã sẵn sàng
export const setNavigationReady = () => {
    isNavigationReady = true;
};

// Navigation service với type safety
export const NavigationService = {
    // Điều hướng đến màn hình với retry mechanism
    navigate: <K extends keyof RootStackParamList>(
        name: K,
        params?: RootStackParamList[K],
        maxRetries: number = 10
    ) => {
        const attemptNavigation = (retryCount: number = 0) => {
            if (navigationRef.isReady() && isNavigationReady) {
                (navigationRef.navigate as any)(name, params);
                return true;
            } else if (retryCount < maxRetries) {
                console.log(`🔄 Navigation not ready, retrying... (${retryCount + 1}/${maxRetries})`);
                setTimeout(() => attemptNavigation(retryCount + 1), 200 * (retryCount + 1));
                return false;
            } else {
                console.warn('❌ Navigation failed after retries');
                return false;
            }
        };

        return attemptNavigation();
    },

    // Quay lại
    goBack: () => {
        if (navigationRef.isReady() && navigationRef.canGoBack()) {
            navigationRef.goBack();
        }
    },

    // Reset stack (ví dụ: sau khi logout)
    reset: (name: keyof RootStackParamList, params?: object) => {
        if (navigationRef.isReady()) {
            navigationRef.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: name as string, params }],
                })
            );
        }
    },

    // Thay thế màn hình hiện tại
    replace: (name: keyof RootStackParamList, params?: object) => {
        if (navigationRef.isReady()) {
            navigationRef.dispatch(
                StackActions.replace(name as string, params)
            );
        }
    },

    // Lấy current route
    getCurrentRoute: () => {
        if (navigationRef.isReady()) {
            return navigationRef.getCurrentRoute();
        }
        return null;
    },

    // Kiểm tra có thể go back không
    canGoBack: () => {
        return navigationRef.isReady() && navigationRef.canGoBack();
    },

    // Pop to top
    popToTop: () => {
        if (navigationRef.isReady()) {
            navigationRef.dispatch(StackActions.popToTop());
        }
    },

    // Kiểm tra navigation ready
    isReady: () => {
        return navigationRef.isReady() && isNavigationReady;
    }
};

// Export các hàm cũ để tương thích ngược
export function navigate<K extends keyof RootStackParamList>(
    name: K,
    params?: RootStackParamList[K]
) {
    return NavigationService.navigate(name, params, 10); // Retry 10 lần
}

export function goBack() {
    NavigationService.goBack();
}