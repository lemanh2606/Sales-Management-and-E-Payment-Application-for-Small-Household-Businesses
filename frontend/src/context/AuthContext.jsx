import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { apiClient, userApi } from "../api";
import { ensureStore } from "../api/storeApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(() => {
        const u = localStorage.getItem("user");
        return u ? JSON.parse(u) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem("token") || null);
    const [currentStore, setCurrentStore] = useState(() => {
        const s = localStorage.getItem("currentStore");
        return s ? JSON.parse(s) : null;
    });

    // Persist auth state
    const persist = (u, t, store) => {
        if (u) localStorage.setItem("user", JSON.stringify(u));
        else localStorage.removeItem("user");

        if (t) localStorage.setItem("token", t);
        else localStorage.removeItem("token");

        if (store) localStorage.setItem("currentStore", JSON.stringify(store));
        else localStorage.removeItem("currentStore");
    };

    // Set bearer header for axios & apiClient
    useEffect(() => {
        const setAuthHeader = (t) => {
            if (t) {
                axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
                if (apiClient && apiClient.defaults) {
                    apiClient.defaults.headers.common["Authorization"] = `Bearer ${t}`;
                }
            } else {
                delete axios.defaults.headers.common["Authorization"];
                if (apiClient && apiClient.defaults) {
                    delete apiClient.defaults.headers.common["Authorization"];
                }
            }
        };
        setAuthHeader(token);

        // Axios interceptor for automatic refresh token
        const interceptor = apiClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (
                    error.response &&
                    error.response.status === 401 &&
                    !originalRequest._retry
                ) {
                    originalRequest._retry = true;
                    try {
                        const data = await userApi.refreshToken();
                        setToken(data.token);
                        persist(user, data.token, currentStore);
                        // Update header and retry original request
                        apiClient.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
                        originalRequest.headers["Authorization"] = `Bearer ${data.token}`;
                        return apiClient(originalRequest);
                    } catch (e) {
                        console.error("Refresh token failed:", e);
                        logout(); // nếu refresh không được thì logout
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            apiClient.interceptors.response.eject(interceptor);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, user, currentStore]);

    const login = async (userData, tokenData) => {
        // set immediate auth state
        setUser(userData);
        setToken(tokenData);

        // --- BẮT ĐẦU THAY ĐỔI ---
        // Nếu user là STAFF và có currentStore (từ state/localStorage), 
        // thì giữ lại store đó khi persist.
        // Các role khác (Manager) sẽ bị xóa (null) và phải chọn lại.
        const initialStore = (userData?.role === "STAFF" && currentStore) ? currentStore : null;
        persist(userData, tokenData, initialStore);
        // --- KẾT THÚC THAY ĐỔI ---


        // Try to prepare store info but do NOT block redirect for STAFF
        let resolvedStore = null;
        try {
            const res = await ensureStore();
            resolvedStore =
                res?.store || res?.currentStore || (res?.stores && res.stores[0]) || null;

            if (resolvedStore) {
                setCurrentStore(resolvedStore);
                // Dù là role nào, nếu ensureStore() tìm thấy store,
                // ta sẽ cập nhật lại localStorage với store mới/chuẩn.
                persist(userData, tokenData, resolvedStore);
            }
        } catch (err) {
            // Không crash app nếu ensureStore lỗi — chỉ log để debug
            console.warn("ensureStore error in login (ignored):", err);
        }

        // Navigate based on role
        // Yêu cầu: nếu là STAFF -> luôn nhảy về /dashboard ngay lập tức
        if (userData?.role === "STAFF") {
            navigate("/dashboard");
            return;
        }

        // Manager và các role khác giữ hành vi cũ
        if (userData?.role === "MANAGER") {
            // Nếu manager có nhiều store, đưa tới chọn cửa hàng để quản lý
            try {
                const res = await ensureStore(); // gọi lại để lấy danh sách stores nếu cần
                if (res?.stores && Array.isArray(res.stores) && res.stores.length > 0) {
                    navigate("/select-store");
                    return;
                }
            } catch (e) {
                // ignore
            }

            if (resolvedStore) navigate("/dashboard");
            else navigate("/select-store");
            return;
        }

        // Default for other roles
        navigate("/dashboard");
    };

    const logout = async () => {
        setUser(null);
        setToken(null);
        setCurrentStore(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("currentStore");
        delete axios.defaults.headers.common["Authorization"];
        if (apiClient && apiClient.defaults) {
            delete apiClient.defaults.headers.common["Authorization"];
        }
        try {
            await apiClient.post("/users/logout");
        } catch (e) {
            console.warn("Logout API failed (ignored):", e?.message || e);
        }
        navigate("/login");
    };

    return (
        <AuthContext.Provider value={{ user, token, currentStore, setCurrentStore, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);