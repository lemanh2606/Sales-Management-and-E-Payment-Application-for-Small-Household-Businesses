import React, { createContext, useContext, useEffect, useState } from "react";

import axios from "axios";
import { useNavigate } from "react-router-dom";
import userApi from "../api/userApi";
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

    // Set bearer header when token changes
    useEffect(() => {
        if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        else delete axios.defaults.headers.common["Authorization"];
    }, [token]);

    // Helper: save auth to storage
    const persist = (u, t, store) => {
        if (u) localStorage.setItem("user", JSON.stringify(u)); else localStorage.removeItem("user");
        if (t) localStorage.setItem("token", t); else localStorage.removeItem("token");
        if (store) localStorage.setItem("currentStore", JSON.stringify(store)); else localStorage.removeItem("currentStore");
    };

    /**
     * login: lưu user + token, then call ensureStore to decide where to go next
     * - Nếu user.role === "STAFF": try to read current_store from backend via ensureStore or from user (backend may return)
     * - Nếu user.role === "MANAGER": call ensureStore(), backend will create default store if none, or return stores/currentStore.
     */
    const login = async (userData, tokenData) => {
        setUser(userData);
        setToken(tokenData);
        persist(userData, tokenData, null);

        // Set header for subsequent calls
        axios.defaults.headers.common["Authorization"] = `Bearer ${tokenData}`;

        // Call ensureStore to let backend prepare stores/currentStore
        try {
            const res = await ensureStore();
            // Backend may return various shapes; handle flexibly
            // Examples:
            // { created: true, store: {...} }
            // { created: false, stores: [...], currentStore: {...} }
            // Or simple { store: {...} }
            const store = res.store || res.currentStore || (res.stores && res.stores[0]) || null;
            if (store) {
                setCurrentStore(store);
                persist(userData, tokenData, store);
            }
            // Decide navigation:
            if (userData.role === "STAFF") {
                // Staff: go straight to dashboard of assigned store (if provided)
                if (store) navigate("/dashboard");
                else {
                    // no store assigned — show select store or error
                    navigate("/select-store");
                }
            } else if (userData.role === "MANAGER") {
                // Manager: if multiple stores, let frontend show selection page.
                if (res.stores && res.stores.length > 1) {
                    // send stores array to select page via state (or fetch there)
                    navigate("/select-store");
                } else {
                    // single store -> go to dashboard
                    if (store) navigate("/dashboard");
                    else navigate("/select-store");
                }
            } else {
                navigate("/dashboard");
            }
        } catch (err) {
            console.error("ensureStore error in login:", err);
            // Fallback: go to select-store page
            navigate("/select-store");
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
        // optional: call backend logout to clear refresh cookie
        try { await userApi.post("/logout"); } catch (e) { /* ignore */ }
        navigate("/login");
    };

    return (
        <AuthContext.Provider value={{ user, token, currentStore, setCurrentStore, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
