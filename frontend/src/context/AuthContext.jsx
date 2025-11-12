// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { apiClient, userApi, subscriptionApi } from "../api";
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
    const [managerSubscriptionExpired, setManagerSubscriptionExpired] = useState(false);

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
        setLoading(true);

        try {
            // Set immediate auth state
            setUser(userData);
            setToken(tokenData);

            // Nếu user là STAFF và có currentStore, giữ lại store đó
            // Các role khác sẽ phải chọn lại
            const initialStore = (userData?.role === "STAFF" && currentStore) ? currentStore : null;
            persist(userData, tokenData, initialStore);

            // Try to prepare store info but do NOT block redirect for STAFF
            let resolvedStore = null;
            let hasMultipleStores = false;
            try {
                const res = await ensureStore();
                resolvedStore =
                    res?.store || res?.currentStore || (res?.stores && res.stores[0]) || null;
                hasMultipleStores = res?.stores && Array.isArray(res.stores) && res.stores.length > 1;

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
            // Yêu cầu: nếu là STAFF -> check subscription của Manager trước
            if (userData?.role === "STAFF") {
                // Check subscription bằng cách gọi một API bất kỳ có middleware
                try {
                    // Gọi API để trigger middleware check
                    const response = await fetch('/api/products?limit=1', {
                        headers: {
                            'Authorization': `Bearer ${responseToken}`
                        }
                    });
                    
                    if (response.status === 403) {
                        const errorData = await response.json();
                        
                        // Check nếu là lỗi Manager expired - component sẽ hiện modal
                        if (errorData.manager_expired || errorData.is_staff) {
                            // Vẫn navigate để component được mount
                            navigate("/dashboard");
                            return;
                        }
                    }
                    
                    navigate("/dashboard");
                } catch (err) {
                    console.error('STAFF subscription check error:', err);
                    navigate("/dashboard");
                }
                return;
            }

            // Manager và các role khác giữ hành vi cũ
            if (userData?.role === "MANAGER") {
                // � CHECK SUBSCRIPTION TRƯỚC KHI REDIRECT
                try {
                    const subResponse = await subscriptionApi.getCurrentSubscription();
                    const subData = subResponse.data || subResponse;
                    
                    const isExpired = 
                        subData.status === "EXPIRED" || 
                        (subData.status === "TRIAL" && subData.trial && !subData.trial.is_active);
                    
                    if (isExpired) {
                        setManagerSubscriptionExpired(true);
                    } else {
                        setManagerSubscriptionExpired(false);
                    }
                } catch (subErr) {
                    console.warn("Subscription check error in login (ignored):", subErr);
                    // Nếu lỗi 403, coi như expired
                    if (subErr.response?.status === 403) {
                        setManagerSubscriptionExpired(true);
                    }
                }
                
                // Manager LUÔN vào select-store để chọn cửa hàng
                navigate("/select-store");
                return;
            }

            // Default for other roles
            navigate("/dashboard");
        } catch (error) {
            console.error("Login failed:", error);
            // Rollback nếu lỗi
            setUser(null);
            setToken(null);
            persist(null, null, null);
            navigate("/login");
        } finally {
            // Tắt loading sau navigate
            setTimeout(() => {
                setLoading(false);
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
        // Thêm set user để nó cập nhật thông tin mới nhất nếu có Save gì đó trong Profile.jsx
        <AuthContext.Provider value={{ 
            user, 
            setUser, 
            token, 
            currentStore, 
            setCurrentStore, 
            login, 
            logout, 
            loading,
            managerSubscriptionExpired,
            setManagerSubscriptionExpired
        }}> 
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
