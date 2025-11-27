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
    const managerSubscriptionKey = "managerSubscriptionExpired";
    const [managerSubscriptionExpired, setManagerSubscriptionExpiredState] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }
        return localStorage.getItem(managerSubscriptionKey) === "true";
    });

    const updateManagerSubscriptionExpired = (expired) => {
        setManagerSubscriptionExpiredState(expired);
        if (typeof window === "undefined") {
            return;
        }
        if (expired) {
            localStorage.setItem(managerSubscriptionKey, "true");
        } else {
            localStorage.removeItem(managerSubscriptionKey);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem("token");
            const storedUser = localStorage.getItem("user");

            if (storedToken && storedUser) {
                setUser(JSON.parse(storedUser));
                setToken(storedToken);
            }

            setLoading(false);
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

    // ✅ LOGOUT FUNCTION - Clear all auth data
    const logout = async () => {
        console.log("🚪 Logging out...");

        // Clear state
        setUser(null);
        setToken(null);
        setCurrentStore(null);
        updateManagerSubscriptionExpired(false);

        // Clear localStorage
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("currentStore");
        localStorage.removeItem(managerSubscriptionKey);

        // Clear axios headers
        delete axios.defaults.headers.common["Authorization"];
        if (apiClient && apiClient.defaults) {
            delete apiClient.defaults.headers.common["Authorization"];
        }

        // Optional: Call logout API
        // try {
        //     await apiClient.post("/users/logout");
        // } catch (e) {
        //     console.warn("Logout API failed (ignored):", e?.message || e);
        // }

        // Navigate to login
        navigate("/login", { replace: true });
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

        // ✅ AXIOS INTERCEPTOR - Auto refresh token or logout
        const interceptor = apiClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Nếu request đánh dấu bỏ qua refresh thì trả lỗi ngay
                if (originalRequest?.skipAuthRefresh) {
                    return Promise.reject(error);
                }

                // 🛑 Bỏ qua refresh-token cho các endpoint công khai
                const isPublicAuthRequest = (() => {
                    if (!originalRequest?.url) return false;
                    const skipPaths = [
                        "/users/login",
                        "/users/register",
                        "/users/verify-otp",
                        "/users/forgot-password",
                        "/users/forgot-password/send-otp",
                        "/users/forgot-password/change",
                        "/users/password/send-otp",
                        "/users/password/change",
                        "/users/refresh-token",
                        "/users/resend-register-otp",
                    ];
                    return skipPaths.some((path) => originalRequest.url.includes(path));
                })();

                // ✅ HANDLE 401 - Token expired or invalid
                if (
                    !isPublicAuthRequest &&
                    error.response &&
                    error.response.status === 401 &&
                    !originalRequest._retry
                ) {
                    originalRequest._retry = true;

                    console.warn("⚠️ 401 Unauthorized - Attempting token refresh...");

                    try {
                        // Try to refresh token
                        const data = await userApi.refreshToken();

                        console.log("✅ Token refreshed successfully");

                        // Update token
                        setToken(data.token);
                        persist(user, data.token, currentStore);

                        // Update headers
                        apiClient.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
                        originalRequest.headers["Authorization"] = `Bearer ${data.token}`;

                        // Retry original request
                        return apiClient(originalRequest);
                    } catch (refreshError) {
                        console.error("❌ Token refresh failed:", refreshError);

                        // ✅ AUTO LOGOUT - Token refresh failed
                        console.log("🔒 Auto logout due to invalid/expired token");
                        logout();

                        return Promise.reject(refreshError);
                    }
                }

                // ✅ HANDLE 403 - Forbidden (could be expired subscription or invalid token)
                if (
                    !isPublicAuthRequest &&
                    error.response &&
                    error.response.status === 403
                ) {
                    const errorData = error.response.data || {};

                    // Check if it's a token-related 403
                    const isTokenError =
                        errorData.message?.toLowerCase().includes("token") ||
                        errorData.message?.toLowerCase().includes("unauthorized") ||
                        errorData.message?.toLowerCase().includes("invalid token") ||
                        errorData.message?.toLowerCase().includes("jwt");

                    if (isTokenError) {
                        console.error("❌ 403 Forbidden - Invalid token");
                        console.log("🔒 Auto logout due to token error");
                        logout();
                        return Promise.reject(error);
                    }

                    // Otherwise, it might be subscription-related, let it pass
                    console.warn("⚠️ 403 Forbidden - Not token related:", errorData.message);
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
        setLoading(true);

        try {
            // Set immediate auth state
            setUser(userData);
            setToken(tokenData);

            // Nếu user là STAFF và có currentStore, giữ lại store đó
            const initialStore = (userData?.role === "STAFF" && currentStore) ? currentStore : null;
            persist(userData, tokenData, initialStore);

            // Try to prepare store info
            let resolvedStore = null;
            try {
                const res = await ensureStore();
                resolvedStore =
                    res?.store || res?.currentStore || (res?.stores && res.stores[0]) || null;

                if (resolvedStore) {
                    setCurrentStore(resolvedStore);
                    persist(userData, tokenData, resolvedStore);
                }
            } catch (err) {
                console.warn("ensureStore error in login (ignored):", err);
            }

            // Wait for state update
            await new Promise(resolve => setTimeout(resolve, 100));

            // Navigate based on role
            if (userData?.role === "STAFF") {
                try {
                    // Gọi API để trigger middleware check
                    const response = await apiClient.get('/products', {
                        params: { limit: 1 }
                    });

                    navigate("/dashboard");
                } catch (err) {
                    if (err.response?.status === 403) {
                        const errorData = err.response.data;

                        // Check nếu là lỗi Manager expired
                        if (errorData.manager_expired || errorData.is_staff) {
                            navigate("/dashboard");
                            return;
                        }
                    }

                    console.error('STAFF subscription check error:', err);
                    navigate("/dashboard");
                }
                return;
            }

            if (userData?.role === "MANAGER") {
                // Check subscription
                try {
                    const subResponse = await subscriptionApi.getCurrentSubscription();
                    const subData = subResponse.data || subResponse;

                    const isExpired =
                        subData.status === "EXPIRED" ||
                        (subData.status === "TRIAL" && subData.trial && !subData.trial.is_active);

                    if (isExpired) {
                        updateManagerSubscriptionExpired(true);
                    } else {
                        updateManagerSubscriptionExpired(false);
                    }
                } catch (subErr) {
                    console.warn("Subscription check error in login (ignored):", subErr);
                    if (subErr.response?.status === 403) {
                        updateManagerSubscriptionExpired(true);
                    }
                }

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
            setTimeout(() => {
                setLoading(false);
            }, 200);
        }
    };

    return (
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
            setManagerSubscriptionExpired: updateManagerSubscriptionExpired
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
