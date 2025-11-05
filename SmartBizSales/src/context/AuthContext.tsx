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
  loading: boolean; // Trạng thái loading cho các tác vụ (giữ nguyên để tương thích)
  isLoading: boolean; // Trạng thái loading khi khởi tạo kiểm tra đăng nhập
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

  // Trạng thái loading cho các tác vụ (giữ nguyên để không ảnh hưởng code cũ)
  const [loading, setLoading] = useState<boolean>(true);

  // Trạng thái loading khi khởi tạo - dùng để hiển thị màn hình chờ
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isRefreshingRef = useRef<boolean>(false);

  // Khởi tạo: kiểm tra thông tin đăng nhập đã lưu trước đó
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Bắt đầu trạng thái loading
        setIsLoading(true);

        // Đọc tất cả dữ liệu đã lưu từ thiết bị
        const [storedToken, storedUser, storedStore] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(STORE_KEY),
        ]);

        // Khôi phục thông tin nếu có
        if (storedUser) _setUser(JSON.parse(storedUser) as User);
        if (storedToken) setToken(storedToken);
        if (storedStore) setCurrentStore(JSON.parse(storedStore) as Store);
      } catch (error) {
        console.warn("Lỗi khi đọc thông tin đăng nhập:", error);
      } finally {
        // Kết thúc trạng thái loading dù có lỗi hay không
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

        // Nếu gặp lỗi 401 và chưa thử refresh token
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
              // Lưu token mới và thử lại request
              await AsyncStorage.setItem(TOKEN_KEY, newToken);
              setToken(newToken);
              apiClient.defaults.headers.common[
                "Authorization"
              ] = `Bearer ${newToken}`;

              if (originalRequest.headers) {
                originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              }

              isRefreshingRef.current = false;
              return apiClient(originalRequest);
            } else {
              // Không có token mới -> đăng xuất
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

    // Dọn dẹp interceptor khi component unmount
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

  // Trong hàm login, thay thế các lần gọi navigate
  const login = async (userData: User, tokenData: string) => {
    // Bắt đầu trạng thái loading
    setIsLoading(true);
    setLoading(true);

    try {
      _setUser(userData);
      setToken(tokenData);

      let initialStore: Store | null = null;

      // Xử lý riêng cho nhân viên
      if (userData.role === "STAFF") {
        initialStore = currentStore || null;
        setCurrentStore(initialStore);
        await persist(userData, tokenData, initialStore);

        // Sử dụng NavigationService với retry
        NavigationService.navigate("Dashboard", undefined, 15);
        return;
      }

      let resolvedStore: Store | null = null;
      let hasMultipleStores = false;

      // Lấy thông tin cửa hàng cho quản lý
      try {
        const res = await storeApi.ensureStore();
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
          await persist(userData, tokenData, resolvedStore);
        }
      } catch (error) {
        console.warn("Không thể lấy thông tin cửa hàng:", error);
      }

      // Chờ một chút để đảm bảo animation mượt mà
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Điều hướng dựa trên vai trò và thông tin cửa hàng với retry
      if (userData.role === "MANAGER") {
        if (!resolvedStore || hasMultipleStores) {
          NavigationService.navigate("SelectStore", undefined, 15);
        } else {
          NavigationService.navigate("Dashboard", undefined, 15);
        }
        return;
      }

      // Mặc định điều hướng đến Dashboard với retry
      NavigationService.navigate("Dashboard", undefined, 15);
    } catch (error) {
      console.error("Lỗi khi đăng nhập:", error);
      // Reset trạng thái nếu có lỗi
      _setUser(null);
      setToken(null);
      setCurrentStore(null);
      await persist(null, null, null);

      // Sử dụng NavigationService cho logout cũng vậy
      setTimeout(() => {
        NavigationService.navigate("Login", undefined, 10);
      }, 500);
    } finally {
      // Kết thúc trạng thái loading
      setIsLoading(false);
      setTimeout(() => setLoading(false), 200);
    }
  };

  // Trong hàm logout, cũng sửa tương tự
  const logout = async () => {
    try {
      // Xóa tất cả thông tin
      _setUser(null);
      setToken(null);
      setCurrentStore(null);
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(STORE_KEY);

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
      // Sử dụng NavigationService với retry
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
      await AsyncStorage.removeItem(STORE_KEY);
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
    loading, // Giữ nguyên cho tương thích
    isLoading, // Trạng thái loading khi khởi tạo
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
