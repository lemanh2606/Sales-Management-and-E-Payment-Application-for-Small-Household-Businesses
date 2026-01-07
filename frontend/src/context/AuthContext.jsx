// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
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

    // ✅ Token Refresh Queue - Tránh multiple refresh cùng lúc
    const isRefreshing = useRef(false);
    const failedQueue = useRef([]);

    const processQueue = (error, token = null) => {
        failedQueue.current.forEach(prom => {
            if (error) {
                prom.reject(error);
            } else {
                prom.resolve(token);
            }
        });

        failedQueue.current = [];
    };

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
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    setToken(storedToken);
                } catch (e) {
                    console.error("❌ Failed to parse stored user:", e);
                    localStorage.removeItem("user");
                    localStorage.removeItem("token");
                }
            }

            setLoading(false);
        };

        initAuth();
    }, []);

    const persist = (u, t, store) => {
        if (u) localStorage.setItem("user", JSON.stringify(u));
        else localStorage.removeItem("user");

        if (t) localStorage.setItem("token", t);
        else localStorage.removeItem("token");

        if (store) localStorage.setItem("currentStore", JSON.stringify(store));
        else localStorage.removeItem("currentStore");
    };

    const logout = async () => {
        console.log("🚪 Logging out and clearing all data...");

        // Clear state immediately
        setUser(null);
        setToken(null);
        setCurrentStore(null);
        updateManagerSubscriptionExpired(false);

        // Reset refresh queue
        isRefreshing.current = false;
        failedQueue.current = [];

        // Clear ALL localStorage keys related to auth
        const keysToRemove = [
            "user",
            "token",
            "currentStore",
            managerSubscriptionKey,
            "productVisibleColumns",
        ];

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        // Clear keys with prefix
        Object.keys(localStorage).forEach(storageKey => {
            if (storageKey.startsWith("onboardingSteps_")) {
                localStorage.removeItem(storageKey);
            }
        });

        // Clear axios headers
        delete axios.defaults.headers.common["Authorization"];
        if (apiClient && apiClient.defaults) {
            delete apiClient.defaults.headers.common["Authorization"];
        }

        // Optional: Call logout API
        try {
            await apiClient.post("/users/logout");
            console.log("✅ Logout API called successfully");
        } catch (e) {
            console.warn("⚠️ Logout API failed (ignored):", e?.message || e);
        }

        // Navigate to login page
        navigate("/login", { replace: true });
    };

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

        // ✅ IMPROVED AXIOS INTERCEPTOR với Token Refresh Queue
        const interceptor = apiClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Skip if marked
                if (originalRequest?.skipAuthRefresh) {
                    return Promise.reject(error);
                }

                // Public endpoints
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
                        "/users/logout",
                    ];
                    return skipPaths.some((path) => originalRequest.url.includes(path));
                })();

                // ✅ HANDLE 401 - AUTO LOGOUT
                if (
                    !isPublicAuthRequest &&
                    error.response &&
                    error.response.status === 401
                ) {
                    console.warn("⚠️ 401 Unauthorized - Token expired or invalid.");
                    console.log("🔒 Auto logout triggered.");

                    // Avoid infinite loop if logout api itself fails
                    if (!originalRequest.url.includes("/logout")) {
                         await logout();
                    }
                    
                    return Promise.reject(error);
                }

                // ✅ HANDLE 403
                if (
                    !isPublicAuthRequest &&
                    error.response &&
                    error.response.status === 403
                ) {
                    const errorData = error.response.data || {};

                    const isTokenError =
                        errorData.message?.toLowerCase().includes("token") ||
                        errorData.message?.toLowerCase().includes("unauthorized") ||
                        errorData.message?.toLowerCase().includes("invalid token") ||
                        errorData.message?.toLowerCase().includes("jwt") ||
                        errorData.message?.toLowerCase().includes("expired") ||
                        errorData.message?.toLowerCase().includes("authentication");

                    if (isTokenError) {
                        console.error("❌ 403 Forbidden - Invalid/Expired token");
                        console.log("🔒 Auto logout: Token authentication error");
                        await logout();
                        return Promise.reject(error);
                    }

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
            setUser(userData);
            setToken(tokenData);

            const initialStore = (userData?.role === "STAFF" && currentStore) ? currentStore : null;
            persist(userData, tokenData, initialStore);

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

            await new Promise(resolve => setTimeout(resolve, 100));

            // ✅ SỬA NAVIGATION CHO STAFF
            if (userData?.role === "STAFF") {
                try {
                    const response = await apiClient.get('/products', {
                        params: { limit: 1 }
                    });

                    // ✅ FIX: STAFF cần navigate với storeId
                    // Lấy storeId từ currentStore hoặc resolvedStore
                    const staffStoreId = currentStore?._id || resolvedStore?._id;

                    if (staffStoreId) {
                        // Tuỳ thuộc vào route config của bạn, chọn 1 trong các cách:

                        // Cách 1: Query parameter (recommended)
                        navigate(`/dashboard?storeId=${staffStoreId}`);

                        // Cách 2: Dynamic route
                        // navigate(`/dashboard/${staffStoreId}`);

                        // Cách 3: State
                        // navigate("/dashboard", { state: { storeId: staffStoreId } });

                        console.log(`✅ STAFF logged in, store: ${staffStoreId}`);
                    } else {
                        // Nếu không có storeId, chuyển đến select-store
                        console.warn("No store found for STAFF, redirecting to select-store");
                        navigate("/select-store");
                    }

                } catch (err) {
                    if (err.response?.status === 403) {
                        const errorData = err.response.data;

                        if (errorData.manager_expired || errorData.is_staff) {
                            // Vẫn navigate với storeId nếu có
                            const staffStoreId = currentStore?._id || resolvedStore?._id;
                            if (staffStoreId) {
                                navigate(`/dashboard/${staffStoreId}`);
                            } else {
                                navigate("/dashboard");
                            }
                            return;
                        }
                    }

                    console.error('STAFF subscription check error:', err);

                    // Fallback navigation với storeId
                    const staffStoreId = currentStore?._id || resolvedStore?._id;
                    if (staffStoreId) {
                        navigate(`/dashboard/${staffStoreId}`);
                    } else {
                        navigate("/dashboard");
                    }
                }
                return;
            }

            if (userData?.role === "MANAGER") {
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

            navigate("/dashboard");
        } catch (error) {
            console.error("❌ Login failed:", error);
            setUser(null);
            setToken(null);
            persist(null, null, null);
            await logout();
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
