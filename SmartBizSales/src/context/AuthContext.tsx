/**
 * File: src/context/AuthContext.tsx
 * ------------------------------------------------------
 * Quản lý toàn bộ trạng thái đăng nhập và xác thực trong app
 * - Lưu trữ thông tin user, token, cửa hàng hiện tại
 * - Tự động lưu và khôi phục trạng thái đăng nhập từ bộ nhớ
 * - Xử lý tự động làm mới token khi hết hạn
 * - Cung cấp các hàm đăng nhập, đăng xuất, cập nhật thông tin
 * ------------------------------------------------------
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient, userApi, storeApi } from "../api";
import { User } from "../type/user";
import { Store } from "../type/store";
import { navigate, NavigationService } from "../navigation/RootNavigation";

// Tên key để lưu trữ dữ liệu trên thiết bị
const TOKEN_KEY = "token";
const USER_KEY = "user";
const STORE_KEY = "currentStore";

// Định nghĩa kiểu dữ liệu cho context
export type AuthContextValue = {
  user: User | null;
  token: string | null;
  currentStore: Store | null;
  loading: boolean;
  isLoading: boolean;
  login: (userData: User, tokenData: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentStore: (store: Store | null) => Promise<void>;
  setUser: (user: User | null) => Promise<void>;
};

// Tạo context với giá trị mặc định ban đầu
const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  currentStore: null,
  loading: true,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  setCurrentStore: async () => {},
  setUser: async () => {},
});

// Component Provider bao bọc toàn bộ app
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, _setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isRefreshingRef = useRef<boolean>(false);

  // Khởi tạo: kiểm tra thông tin đăng nhập đã lưu trước đó
  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);

        const [storedToken, storedUser, storedStore] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(STORE_KEY),
        ]);

        if (storedUser) _setUser(JSON.parse(storedUser) as User);
        if (storedToken) setToken(storedToken);
        if (storedStore) setCurrentStore(JSON.parse(storedStore) as Store);
      } catch (error) {
        console.warn("Lỗi khi đọc thông tin đăng nhập:", error);
      } finally {
        setIsLoading(false);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Tự động cập nhật header Authorization khi token thay đổi
  useEffect(() => {
    if (token) {
      apiClient.defaults.headers = apiClient.defaults.headers || {};
      apiClient.defaults.headers.common =
        apiClient.defaults.headers.common || {};
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      if (apiClient?.defaults?.headers?.common) {
        delete apiClient.defaults.headers.common["Authorization"];
      }
    }
  }, [token]);

  // Xử lý tự động làm mới token khi nhận lỗi 401 (Unauthorized)
  useEffect(() => {
    const interceptor = apiClient.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = (error?.config ?? {}) as any;
        const status = error?.response?.status;

        if (
          status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !isRefreshingRef.current
        ) {
          originalRequest._retry = true;
          isRefreshingRef.current = true;

          try {
            const data = await userApi.refreshToken();
            const newToken = (data as any)?.token;

            if (newToken) {
              await AsyncStorage.setItem(TOKEN_KEY, newToken);
              setToken(newToken);
              apiClient.defaults.headers.common["Authorization"] =
                `Bearer ${newToken}`;

              if (originalRequest.headers) {
                originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              }

              isRefreshingRef.current = false;
              return apiClient(originalRequest);
            } else {
              isRefreshingRef.current = false;
              await logout();
            }
          } catch (error) {
            console.warn("Làm mới token thất bại:", error);
            isRefreshingRef.current = false;
            await logout();
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      try {
        apiClient.interceptors.response.eject(interceptor);
      } catch {
        // Bỏ qua lỗi khi eject
      }
    };
  }, [user, token, currentStore]);

  // Hàm lưu trạng thái vào bộ nhớ thiết bị
  const persist = async (
    userData: User | null,
    tokenData: string | null,
    store: Store | null
  ) => {
    try {
      if (userData) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      } else {
        await AsyncStorage.removeItem(USER_KEY);
      }

      if (tokenData) {
        await AsyncStorage.setItem(TOKEN_KEY, tokenData);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }

      if (store) {
        await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
      } else {
        await AsyncStorage.removeItem(STORE_KEY);
      }
    } catch (error) {
      console.warn("Lưu thông tin người dùng thất bại:", error);
    }
  };

  const login = async (userData: User, tokenData: string) => {
    console.log(
      "👉 LOGIN START: role=",
      userData?.role,
      "currentStore=",
      currentStore
    );
    setIsLoading(true);
    setLoading(true);

    try {
      _setUser(userData);
      setToken(tokenData);

      // --- QUAN TRỌNG: STAFF giữ nguyên currentStore, các role khác đặt thành null ---
      const initialStore =
        userData?.role === "STAFF" && currentStore ? currentStore : null;

      // Persist ngay lập tức với store phù hợp
      await persist(userData, tokenData, initialStore);
      setCurrentStore(initialStore);

      // Try to prepare store info but do NOT block redirect for STAFF
      let resolvedStore = null;
      let hasMultipleStores = false;

      try {
        const res = await storeApi.ensureStore();
        console.log("👉 ensureStore RESULT:", res);
        const responseData = res as any;

        resolvedStore =
          responseData?.store ||
          responseData?.currentStore ||
          (Array.isArray(responseData?.stores) && responseData.stores[0]) ||
          null;
        hasMultipleStores =
          Array.isArray(responseData?.stores) && responseData.stores.length > 1;

        if (resolvedStore) {
          setCurrentStore(resolvedStore);
          // Cập nhật lại localStorage với store mới/chuẩn
          await persist(userData, tokenData, resolvedStore);
        }
      } catch (err) {
        console.warn("ensureStore error in login (ignored):", err);
      }

      // Chờ 1 tick để state update trước khi navigate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Navigate based on role
      // STAFF -> luôn nhảy về Dashboard ngay lập tức
      if (userData.role === "STAFF") {
        console.log("👉 STAFF: Navigate to Dashboard");
        NavigationService.navigate("Dashboard", undefined, 15);
        return;
      }

      // Manager và các role khác
      if (userData.role === "MANAGER") {
        if (hasMultipleStores) {
          console.log("👉 MANAGER: Multiple stores -> SelectStore");
          NavigationService.navigate("SelectStore", undefined, 15);
          return;
        }

        if (resolvedStore) {
          console.log("👉 MANAGER: Has resolvedStore -> Dashboard");
          NavigationService.navigate("Dashboard", undefined, 15);
        } else {
          console.log("👉 MANAGER: No store -> SelectStore");
          NavigationService.navigate("SelectStore", undefined, 15);
        }
        return;
      }

      // Default for other roles
      console.log("👉 DEFAULT: Navigate to Dashboard");
      NavigationService.navigate("Dashboard", undefined, 15);
    } catch (error) {
      console.error("Login failed:", error);
      // Rollback nếu lỗi - STAFF vẫn giữ currentStore
      _setUser(null);
      setToken(null);

      // STAFF không xóa currentStore khi có lỗi
      if (userData?.role !== "STAFF") {
        setCurrentStore(null);
        await persist(null, null, null);
      } else {
        await persist(null, null, currentStore);
      }

      setTimeout(() => {
        NavigationService.navigate("Login", undefined, 10);
      }, 500);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setLoading(false);
        console.log("👉 LOGIN END: loading=false");
      }, 200);
    }
  };

  const logout = async () => {
    try {
      // QUAN TRỌNG: STAFF không xóa currentStore
      const isStaff = user?.role === "STAFF";
      const storeToKeep = isStaff ? currentStore : null;

      // Xóa thông tin user và token
      _setUser(null);
      setToken(null);

      // Chỉ xóa currentStore nếu không phải STAFF
      if (!isStaff) {
        setCurrentStore(null);
      }

      // Xóa storage - STAFF giữ lại currentStore
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);

      if (!isStaff) {
        await AsyncStorage.removeItem(STORE_KEY);
      } else if (storeToKeep) {
        // STAFF: vẫn lưu currentStore
        await AsyncStorage.setItem(STORE_KEY, JSON.stringify(storeToKeep));
      }

      // Xóa header authorization
      if (apiClient?.defaults?.headers?.common) {
        delete apiClient.defaults.headers.common["Authorization"];
      }

      // Gọi API đăng xuất (không bắt lỗi)
      try {
        await apiClient.post("/users/logout");
      } catch {
        // Bỏ qua lỗi khi gọi API logout
      }
    } catch (error) {
      console.warn("Lỗi khi đăng xuất:", error);
    } finally {
      setTimeout(() => {
        NavigationService.navigate("Login", undefined, 10);
      }, 300);
    }
  };

  // Cập nhật cửa hàng hiện tại
  const setCurrentStoreAndPersist = async (store: Store | null) => {
    setCurrentStore(store);
    if (store) {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
    } else {
      // STAFF không cho phép xóa currentStore
      if (user?.role !== "STAFF") {
        await AsyncStorage.removeItem(STORE_KEY);
      }
    }
  };

  // Cập nhật thông tin user
  const setUserAndPersist = async (userData: User | null) => {
    _setUser(userData);
    if (userData) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
    } else {
      await AsyncStorage.removeItem(USER_KEY);
    }
  };

  // Giá trị cung cấp cho context
  const contextValue: AuthContextValue = {
    user,
    token,
    currentStore,
    loading,
    isLoading,
    login,
    logout,
    setCurrentStore: setCurrentStoreAndPersist,
    setUser: setUserAndPersist,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Hook tiện lợi để sử dụng auth context
export const useAuth = (): AuthContextValue => useContext(AuthContext);

export default AuthContext;
