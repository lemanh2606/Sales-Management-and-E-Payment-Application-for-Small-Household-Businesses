/**
 * 📁 File: src/context/AuthContext.tsx
 * ------------------------------------------------------
 * Chức năng:
 * - Quản lý trạng thái xác thực: user, token, currentStore
 * - Lưu/đọc token, user, store vào AsyncStorage
 * - Gắn Authorization header cho apiClient khi có token
 * - Tự động refresh token khi gặp 401
 * - Cung cấp login / logout / setCurrentStore / setUser cho toàn app
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
import { navigate } from "../navigation/RootNavigation";

// Keys lưu trên device
const TOKEN_KEY = "token";
const USER_KEY = "user";
const STORE_KEY = "currentStore";

// ------------------------------
// Kiểu dữ liệu context
// ------------------------------
export type AuthContextValue = {
  user: User | null;
  token: string | null;
  currentStore: Store | null;
  loading: boolean;
  login: (userData: User, tokenData: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentStore: (store: Store | null) => Promise<void>;
  setUser: (user: User | null) => Promise<void>; // <- thêm setUser
};

// Tạo context với giá trị mặc định
const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  currentStore: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  setCurrentStore: async () => {},
  setUser: async () => {},
});

// ------------------------------
// Provider component
// ------------------------------
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, _setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isRefreshingRef = useRef<boolean>(false);

  // ------------------------------
  // Khởi tạo: đọc dữ liệu từ AsyncStorage
  // ------------------------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        const [storedToken, storedUser, storedStore] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(STORE_KEY),
        ]);
        if (storedUser) _setUser(JSON.parse(storedUser) as User);
        if (storedToken) setToken(storedToken);
        if (storedStore) setCurrentStore(JSON.parse(storedStore) as Store);
      } catch (e) {
        console.warn(
          "Lỗi khi đọc thông tin đăng nhập:",
          (e as Error)?.message || e
        );
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // ------------------------------
  // Khi token thay đổi: cập nhật header Authorization
  // ------------------------------
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

  // ------------------------------
  // Interceptor response: tự động refresh token khi gặp 401
  // ------------------------------
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
              apiClient.defaults.headers.common[
                "Authorization"
              ] = `Bearer ${newToken}`;
              if (originalRequest.headers) {
                originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              }
              isRefreshingRef.current = false;
              return apiClient(originalRequest);
            } else {
              isRefreshingRef.current = false;
              await logout();
            }
          } catch (e) {
            console.warn("Làm mới token thất bại:", (e as Error)?.message || e);
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
        // ignore
      }
    };
  }, [user, token, currentStore]);

  // ------------------------------
  // Helper: persist trạng thái vào AsyncStorage
  // ------------------------------
  const persist = async (
    u: User | null,
    t: string | null,
    store: Store | null
  ) => {
    try {
      if (u) await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      else await AsyncStorage.removeItem(USER_KEY);

      if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
      else await AsyncStorage.removeItem(TOKEN_KEY);

      if (store) await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
      else await AsyncStorage.removeItem(STORE_KEY);
    } catch (e) {
      console.warn(
        "Lưu thông tin người dùng thất bại:",
        (e as Error)?.message || e
      );
    }
  };

  // ------------------------------
  // Login
  // ------------------------------
  const login = async (userData: User, tokenData: string) => {
    setLoading(true);
    try {
      _setUser(userData);
      setToken(tokenData);

      let initialStore: Store | null = null;

      if (userData.role === "STAFF") {
        initialStore = currentStore || null;
        setCurrentStore(initialStore);
        await persist(userData, tokenData, initialStore);
        navigate("Dashboard");
        return;
      }

      let resolvedStore: Store | null = null;
      let hasMultipleStores = false;

      try {
        const res = await storeApi.ensureStore();
        const anyRes = res as any;
        resolvedStore =
          anyRes?.store ||
          anyRes?.currentStore ||
          (Array.isArray(anyRes?.stores) && anyRes.stores[0]) ||
          null;
        hasMultipleStores =
          Array.isArray(anyRes?.stores) && anyRes.stores.length > 1;
        if (resolvedStore) {
          setCurrentStore(resolvedStore);
          await persist(userData, tokenData, resolvedStore);
        }
      } catch (err) {
        console.warn("Không thể lấy cửa hàng:", (err as Error)?.message || err);
      }

      await new Promise((r) => setTimeout(r, 80));

      if (userData.role === "MANAGER") {
        if (!resolvedStore || hasMultipleStores) {
          navigate("SelectStore");
        } else {
          navigate("Dashboard");
        }
        return;
      }

      navigate("Dashboard");
    } catch (e) {
      console.error("Lỗi khi đăng nhập:", e);
      _setUser(null);
      setToken(null);
      setCurrentStore(null);
      await persist(null, null, null);
      navigate("Login");
    } finally {
      setTimeout(() => setLoading(false), 160);
    }
  };

  // ------------------------------
  // Logout
  // ------------------------------
  const logout = async () => {
    try {
      _setUser(null);
      setToken(null);
      setCurrentStore(null);
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(STORE_KEY);
      if (apiClient?.defaults?.headers?.common) {
        delete apiClient.defaults.headers.common["Authorization"];
      }
      try {
        await apiClient.post("/users/logout");
      } catch {}
    } catch (e) {
      console.warn("Lỗi khi đăng xuất:", (e as Error)?.message || e);
    } finally {
      navigate("Login");
    }
  };

  // ------------------------------
  // Cập nhật currentStore
  // ------------------------------
  const setCurrentStoreAndPersist = async (store: Store | null) => {
    setCurrentStore(store);
    if (store) await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
    else await AsyncStorage.removeItem(STORE_KEY);
  };

  // ------------------------------
  // Cập nhật user thủ công
  // ------------------------------
  const setUserAndPersist = async (u: User | null) => {
    _setUser(u);
    if (u) await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(USER_KEY);
  };

  // ------------------------------
  // Context value
  // ------------------------------
  const contextValue: AuthContextValue = {
    user,
    token,
    currentStore,
    loading,
    login,
    logout,
    setCurrentStore: setCurrentStoreAndPersist,
    setUser: setUserAndPersist, // <- expose setUser
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// ------------------------------
// Hook tiện dụng
// ------------------------------
export const useAuth = (): AuthContextValue => useContext(AuthContext);

export default AuthContext;
