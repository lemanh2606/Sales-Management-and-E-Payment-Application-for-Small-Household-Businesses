// src/context/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../api/apiClient"; // phù hợp với file bạn đã tạo
import * as userApi from "../api/index";
import * as storeApi from "../api/index";
import { navigate } from "../navigation/RootNavigation";

const TOKEN_KEY = "token";
const USER_KEY = "user";
const STORE_KEY = "currentStore";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentStore, setCurrentStore] = useState(null);

  // ref để tránh double refresh attempts
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(USER_KEY);
        const storedStore = await AsyncStorage.getItem(STORE_KEY);

        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedToken) setToken(storedToken);
        if (storedStore) setCurrentStore(JSON.parse(storedStore));
      } catch (e) {
        console.warn("Auth init read failed:", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // đồng bộ axios/apiClient header khi token thay đổi
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

  // Interceptor: handle 401 -> thử refresh token
  useEffect(() => {
    const interceptor = apiClient.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error?.config;
        if (
          error?.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !isRefreshingRef.current
        ) {
          originalRequest._retry = true;
          isRefreshingRef.current = true;
          try {
            const data = await userApi.refreshToken();
            // backend nên trả { token } hoặc tương tự
            const newToken = data?.token;
            if (newToken) {
              await AsyncStorage.setItem(TOKEN_KEY, newToken);
              setToken(newToken);
              // cập nhật header và retry
              apiClient.defaults.headers.common[
                "Authorization"
              ] = `Bearer ${newToken}`;
              originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              isRefreshingRef.current = false;
              return apiClient(originalRequest);
            } else {
              isRefreshingRef.current = false;
              // nếu không có token mới -> logout
              logout();
            }
          } catch (e) {
            console.warn("Refresh token failed:", e);
            isRefreshingRef.current = false;
            logout();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.response.eject(interceptor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentStore, token]);

  // persist state helper
  const persist = async (u, t, store) => {
    try {
      if (u) await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      else await AsyncStorage.removeItem(USER_KEY);

      if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
      else await AsyncStorage.removeItem(TOKEN_KEY);

      if (store) await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
      else await AsyncStorage.removeItem(STORE_KEY);
    } catch (e) {
      console.warn("Persist auth failed:", e);
    }
  };

  // Login: nhận userData & tokenData từ backend caller (hoặc dùng login API bên trong)
  // userData: { ... }, tokenData: string (token)
  const login = async (userData, tokenData) => {
    setLoading(true);
    try {
      setUser(userData);
      setToken(tokenData);

      // Quy tắc: nếu role STAFF và đã có currentStore -> giữ store,
      // Manager sẽ reset store và dùng ensureStore để quyết định
      const initialStore =
        userData?.role === "STAFF" && currentStore ? currentStore : null;
      await persist(userData, tokenData, initialStore);

      // non-blocking attempt to ensureStore (không ngăn STAFF redirect)
      let resolvedStore = null;
      let hasMultipleStores = false;
      try {
        const res = await storeApi.ensureStore();
        resolvedStore =
          res?.store ||
          res?.currentStore ||
          (Array.isArray(res?.stores) && res.stores[0]) ||
          null;
        hasMultipleStores = Array.isArray(res?.stores) && res.stores.length > 1;

        if (resolvedStore) {
          setCurrentStore(resolvedStore);
          await persist(userData, tokenData, resolvedStore);
        }
      } catch (err) {
        console.warn("ensureStore failed (ignored):", err);
      }

      // tiny delay để state ổn định trước navigate
      await new Promise((r) => setTimeout(r, 80));

      // Navigate based on role
      if (userData?.role === "STAFF") {
        navigate("Dashboard");
        return;
      }

      if (userData?.role === "MANAGER") {
        if (hasMultipleStores) {
          navigate("SelectStore");
          return;
        }
        if (resolvedStore) {
          navigate("Dashboard");
        } else {
          navigate("SelectStore");
        }
        return;
      }

      // default
      navigate("Dashboard");
    } catch (e) {
      console.error("Login flow error:", e);
      // rollback
      setUser(null);
      setToken(null);
      setCurrentStore(null);
      await persist(null, null, null);
      navigate("Login");
    } finally {
      // small delay to avoid flash
      setTimeout(() => setLoading(false), 160);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setToken(null);
      setCurrentStore(null);
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(STORE_KEY);

      if (apiClient?.defaults?.headers?.common) {
        delete apiClient.defaults.headers.common["Authorization"];
      }

      // Optionally call server logout endpoint (ignore errors)
      try {
        await apiClient.post("/users/logout");
      } catch (err) {
        // ignore
      }
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      navigate("Login");
    }
  };

  // Expose setCurrentStore that persists immediately
  const setCurrentStoreAndPersist = async (store) => {
    setCurrentStore(store);
    if (store) await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
    else await AsyncStorage.removeItem(STORE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        currentStore,
        setCurrentStore: setCurrentStoreAndPersist,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
