// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { apiClient, userApi } from "../api";
import { ensureStore } from "../api/storeApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(() => {
        const u = localStorage.getItem("user");
        return u ? JSON.parse(u) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem("token") || null);
    const [currentStore, setCurrentStore] = useState(() => {
        const s = localStorage.getItem("currentStore");
        return s ? JSON.parse(s) : null;
    });

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem("token");
            const storedUser = localStorage.getItem("user");

            if (storedToken && storedUser) {
                setUser(JSON.parse(storedUser));
                setToken(storedToken);
            }

            setLoading(false); // ✅ Chỉ khi init xong mới check quyền
        };

        initAuth();
    }, []);

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

    // 👉 FIX CẬP NHẬT: Giảm block từ ensureStore(), navigate sớm hơn cho MANAGER nếu chưa có store
    // Thêm log để debug (xóa sau)
    const login = async (userData, tokenData) => {
        console.log('👉 LOGIN START: role=', userData?.role, 'currentStore=', currentStore); // DEBUG
        setLoading(true); // 👉 Bật loading ngay để block ProtectedRoute check auth

        try {
            // Set immediate auth state (nhưng loading=true sẽ block check)
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
            let hasMultipleStores = false; // 👉 THÊM: Cache kết quả để tránh double call
            try {
                const res = await ensureStore();
                console.log('👉 ensureStore RESULT:', res); // DEBUG: Check res.stores, res.store
                resolvedStore =
                    res?.store || res?.currentStore || (res?.stores && res.stores[0]) || null;
                hasMultipleStores = res?.stores && Array.isArray(res.stores) && res.stores.length > 1; // >1 vì nếu =1 thì resolvedStore đã có

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

            // 👉 FIX: Chờ 1 tick để state update (React batch) trước khi navigate
            await new Promise(resolve => setTimeout(resolve, 100)); // TĂNG LÊN 100ms để settle tốt hơn (test 0 nếu nhanh quá)

            // Navigate based on role
            // Yêu cầu: nếu là STAFF -> luôn nhảy về /dashboard ngay lập tức
            if (userData?.role === "STAFF") {
                console.log('👉 STAFF: Navigate to /dashboard'); // DEBUG
                navigate("/dashboard");
                return;
            }

            // Manager và các role khác giữ hành vi cũ
            if (userData?.role === "MANAGER") {
                // 👉 FIX: SỬ DỤNG CACHE từ lần 1, KHÔNG GỌI LẠI ensureStore() để tránh chậm
                if (hasMultipleStores) { // Nếu >1 stores
                    console.log('👉 MANAGER: Multiple stores -> /select-store'); // DEBUG
                    navigate("/select-store");
                    return;
                }

                if (resolvedStore) {
                    console.log('👉 MANAGER: Has resolvedStore -> /dashboard'); // DEBUG
                    navigate("/dashboard");
                } else {
                    console.log('👉 MANAGER: No store -> /select-store'); // DEBUG
                    navigate("/select-store");
                }
                return;
            }

            // Default for other roles
            console.log('👉 DEFAULT: Navigate to /dashboard'); // DEBUG
            navigate("/dashboard");
        } catch (error) {
            console.error("Login failed:", error); // DEBUG
            // Rollback nếu lỗi
            setUser(null);
            setToken(null);
            persist(null, null, null);
            // 👉 THÊM: Navigate về /login nếu fail
            navigate("/login");
        } finally {
            // 👉 FIX: Tắt loading SAU navigate, nhưng delay nhẹ để Spin flash mượt
            setTimeout(() => {
                setLoading(false);
                console.log('👉 LOGIN END: loading=false'); // DEBUG
            }, 200); // 200ms để user thấy Spin tắt sau navigate
        }
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
        // (nếu sau cần invalidate server, thêm lại sau)
        // try {
        //     await apiClient.post("/users/logout");
        // } catch (e) {
        //     console.warn("Logout API failed (ignored):", e?.message || e);
        // }
        navigate("/login");
    };

    return (
        <AuthContext.Provider value={{ user, token, currentStore, setCurrentStore, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);