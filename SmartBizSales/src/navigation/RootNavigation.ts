// src/navigation/RootNavigation.ts
import { createNavigationContainerRef } from '@react-navigation/native';

type RootParamList = {
    [key: string]: object | undefined; // Define your routes and their parameters here
};

export const navigationRef = createNavigationContainerRef<RootParamList>();

// Hàm điều hướng toàn cục (dùng được trong Context hoặc Service)
export function navigate(name: string, params?: object) {
    if (navigationRef.isReady()) {
        navigationRef.navigate(name, params);
    } else {
        console.warn('Navigation is not ready yet');
    }
}

export function goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
    }
}
